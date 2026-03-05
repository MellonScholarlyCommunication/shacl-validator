import factory from 'rdf-ext';
import { rdfParser } from "rdf-parse";
import { rdfSerializer } from 'rdf-serialize';
import stringifyStream from 'stream-to-string';
import streamifyString from 'streamify-string';
import { streamifyArray } from 'streamify-array';
import rdfDataset from '@rdfjs/dataset';
import fs from 'fs';
import log4js from 'log4js';

const logger = log4js.getLogger();

export function getArticle(word) {
    // Gemini generated
    if (!word || typeof word !== 'string') {
        return 'a'; // Default to 'a' if input is invalid
    }

    // 1. Sanitize the word: Get the first non-space word and convert to lowercase
    const normalizedWord = word.trim().split(/\s+/)[0].toLowerCase();

    if (normalizedWord.length === 0) {
        return 'a';
    }

    // --- Exceptions to the Standard Vowel/Consonant Rule ---

    // 2. Exception: Words starting with a pronounced 'h' (consonant sound)
    // Examples: 'house', 'hotel', 'historical', 'happy'
    // This is handled by the main vowel check, but some exceptions are for words like 'heir' (vowel sound)

    // 3. Exception: Words starting with 'u' or 'eu' that sound like 'you' (consonant sound)
    // Examples: 'university', 'unanimous', 'utopia', 'European', 'unicorn'
    // Regex: starts with 'u' followed by a consonant (like 'uni') OR starts with 'eu'
    if (/(^uni|unif|unun|euni|eub).*/.test(normalizedWord)) {
        return 'a';
    }

    // 4. Exception: Words starting with 'o' that sound like 'w' (consonant sound)
    // Examples: 'one-time offer', 'one-dollar bill'
    if (/^one.*/.test(normalizedWord)) {
        return 'a';
    }

    // --- Acronym/Initialism Check (based on pronunciation of the first letter) ---

    // 5. Acronym/Initialism Check: Check if the word is an initialism (like FBI, X-ray)
    // that starts with a letter pronounced with an initial vowel sound (A, E, F, H, I, L, M, N, O, R, S, X)
    const initialismRegex = /^(a|e|f|h|i|l|m|n|o|r|s|x)[a-z]*$/i;
    if (normalizedWord.length <= 4 && initialismRegex.test(normalizedWord)) {
        return 'an';
    }
    
    // --- Standard Vowel/Consonant Check ---

    // 6. Standard Check: If the first letter is a standard vowel sound (A, E, I, O, U)
    // Note: The 'h' exception is handled by checking for silent 'h' in step 5's acronym check, 
    // and the pronounced 'h' is handled by the initial standard check.
    const firstLetter = normalizedWord[0];
    const vowels = ['a', 'e', 'i', 'o', 'u'];

    if (vowels.includes(firstLetter)) {
        return 'an';
    }

    // 7. Default: If none of the 'an' conditions are met, use 'a'.
    return 'a';
}

export function truncateNS(str) {
  return str.replaceAll(/http\S+[#\/]/g,'')
            .replaceAll(/<(\w+)>/g,"*$1*")
            .replaceAll(/ 1 values/g," 1 value");
}

export function rephrase(str) {
  return str.replaceAll(/^[Vv]alue/g,"a value that")
            .replace("node kind *iri*","a valid *URL* or *URN*")
            .replace("*url*","*URL*")
            .replace("*urn*","*URN*");
}

export function topNode(dataset) {
    const subjects = new Set();
    const objects = new Set();

    for (const quad of dataset) {
        let s = quad.subject.value;
        let o = quad.object.value;

        subjects.add(s);
        objects.add(o);
    };

    return [...setDiff(subjects,objects)];
}

function setDiff(a,b) {
    return new Set(Array.from(a).filter( e => ! b.has(e)));
}

export function shapesWrapper(shapes,data) {
    const quads = [];
    const topNodes = topNode(data);

    if (topNodes.length != 1) 
        return shapes;

    for (const quad of shapes) {
        if (quad.object.value === "%MainSubject%") {
            const node = topNodes[0].match(/^(urn|http).*/) ? 
                            factory.namedNode(topNodes[0]) :
                            factory.blankNode(topNodes[0]);
            quads.push(
                factory.quad(
                    quad.subject,
                    quad.predicate,
                    node
                )
            )
        }
        else {
            quads.push(quad);
        }
    };

    return factory.dataset(quads);
}

function customDocumentLoader(options) {
    if (!options?.cache) {
        return null;
    }
    
    if (!fs.existsSync(options.cache)) {
        return null;
    }

    let CACHE = {};

    try {
        CACHE = JSON.parse(fs.readFileSync(options.cache, 'utf-8'));    
    }
    catch (e) {
        logger.error(`failed to parse ${options.cache}: ${e.message}`);
        return null;
    }

    return {
        load: async (url) => {
            if (CACHE[url]) {
                logger.debug(`[documentLoader] cache hit: ${url}`);
                return CACHE[url]; 
            }

            if (options.safe) {
                logger.debug(`[documentLoader] safe mode, skipping: ${url}`);
                return { '@context': {} };
            }

            logger.debug(`[documentLoader] fetching: ${url}`);
            const response = await fetch(url, {
                headers: { 'Accept': 'application/ld+json, application/json' }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch context: ${url} (${response.status})`);
            }

            return response.json();
        }
    };
}

export async function parseRDFStream(stream, path, options) {
    const documentLoader = customDocumentLoader(options);

    return new Promise( (resolve,reject) => {
        const dataset = rdfDataset.dataset();

        try {
            const options = { path };
            
            if (documentLoader) {
                options['@comunica/actor-rdf-parse-jsonld:documentLoader'] = documentLoader;
            }

            rdfParser.parse(stream, options)
                .on('data', (quad) => dataset.add(quad))
                .on('error', (error) => reject(error))
                .on('end', () => resolve(dataset));
        }
        catch( e ) {
            reject(e);
        }
    });
}

export async function datasetTo(dataset,to) {
    const quadStream = streamifyArray([...dataset]);
    const outStream = rdfSerializer.serialize(quadStream, { contentType: to });
    return outStream;
}

export async function streamRDFfromTo(stream, from, to) {
    const quadStream = rdfParser.parse(stream, { contentType: from });
    const outStream = rdfSerializer.serialize(quadStream, { contentType: to});
    return outStream;
}

export async function stringRDFfromTo(data, from, to) {
    const inStream = streamifyString(data);
    const outStream = await streamRDFfromTo(inStream, from, to);
    return await stringifyStream(outStream);
}