#!/usr/bin/env node

import rdf from '@zazuko/env-node'
import SHACLValidator from 'rdf-validate-shacl'
import { program } from 'commander';

async function main(shapeFile,dataFile,options) {
  const shapes = await rdf.dataset().import(rdf.fromFile(shapeFile))
  const data = await rdf.dataset().import(rdf.fromFile(dataFile))

  const validator = new SHACLValidator(shapes, { factory: rdf });
  const report = await validator.validate(data);

  if (options.as == 'rdf') {
    await serializeAsRDF(report);
  }
  else if (options.as == 'text') {
    await serializeAsText(report);
  }

  if (report.conforms) {
    process.exit(0);
  }
  else {
    process.exit(2);
  }
}

async function serializeAsRDF(report) {
  console.log(await report.dataset.serialize({ format: 'text/turtle' }))
}

async function serializeAsText(report) {
  if (report.conforms) {
    console.log("OK - your data input looks good.");
  }
  else {
    console.log("ERROR - your data input has some issues.");
    console.log("\n**Report**:\n");
  }

  detailsToText(report.results,0);
}

function detailsToText(details,level) {
    for (const result of details) {
    const focusNode = result.focusNode.value;
    const path = result.path.value;
    const message = result.message.map(l => l.value).join("and ").toLowerCase();

    const spacing = " ".repeat(2*level + 1);

    const nsPath = truncateNS(path);
    const art = getArticle(nsPath);

    if (level == 0) {
      console.log(`${spacing}- In ${focusNode}`);
      console.log(`${spacing}  - 👉 there is ${art} *${nsPath}*,`);
    }
    else {
      console.log(`${spacing}- Because I see an ${focusNode}`);  
      console.log(`${spacing}  - 👉 with ${art} *${nsPath}*,`);
    }
  
    console.log(`${spacing}  - ⛔ with ${rephrase(truncateNS(message))}.`);

    const detail = result.detail;
    detailsToText(detail,level+1);
  }
}

function getArticle(word) {
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

function truncateNS(str) {
  return str.replaceAll(/http\S+[#\/]/g,'')
            .replaceAll(/<(\w+)>/g,"*$1*")
            .replaceAll(/ 1 values/g," 1 value");
}

function rephrase(str) {
  return str.replaceAll(/^value/g,"a value that");
}

program
  .option('--as <what>','output format','text')
  .argument('<shapeFile>')
  .argument('<dataFile>')

program.parse();

const shapeFile = program.args[0];
const dataFile  = program.args[1];

main(shapeFile,dataFile,program.opts());