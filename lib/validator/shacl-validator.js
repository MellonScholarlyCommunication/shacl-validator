import rdfDataset from '@rdfjs/dataset';
import { rdfParser } from 'rdf-parse';
import Validator from 'shacl-engine/Validator.js';
import streamToString from 'stream-to-string';
import Environment from '@rdfjs/environment';
import DataFactory from '@rdfjs/data-model/Factory.js';
import DatasetFactory from '@rdfjs/dataset/Factory.js';
import { 
    getArticle, 
    rephrase, 
    shapesWrapper,
    datasetTo 
} from '../util.js';

const ERROR_CHAR = "⛔";
const WARNING_CHAR = "⚠️";

export class ParseError extends Error {
    constructor(message) {
        super(message);
        this.name = "ParseError";
    }
}

export class SHACLValidator {

    async validate(shapes,data) {
        const wrappedShapes = shapesWrapper(shapes,data);

        const factory = new Environment([DataFactory, DatasetFactory]);

        const validator = new Validator(wrappedShapes, { 
            factory
        });

        const report = await validator.validate({ dataset: data });

        report['shapes'] = wrappedShapes;
        report['data'] = data;
        
        return report;
    } 

    isReportValid(report) {
        return report.conforms;
    }

    async reportAsRDF(report) {
        const dataset = rdfDataset.dataset(report.dataset);
        const stream = await datasetTo(dataset, 'text/turtle');
        return streamToString(stream);
    }

    async reportAsMarkdown(report) {
        let markdown = "";

        if (report.data.size == 0) {
            markdown += "ERROR - you input data does not any data?\n"
            if (Object.hasOwn(report,'input')) {
                markdown += "\n**Report**:\n\n";
                markdown += this.#emptyToText(report.input);
            }
        }
        else if (report.conforms) {
            markdown += "OK - your input data looks great.\n";
        }
        else {
            markdown += "ERROR - your input data input has some issues.\n";
            markdown += "\n**Report**:\n\n";
            markdown += this.#detailsToText(report.results,0);
        }

        return markdown;
    }

    #emptyToText(input) {
        let markdown = "";

        try {
            const data = JSON.parse(input);

            if (Object.hasOwn(data,'@context')) {
                markdown += "- I see you provided a \"@context\" property.\n";
            }
            else {
                markdown += "- Yes, the \"@context\" property is missing.\n";
            }

            if (Object.keys(data).length == 0) {
                markdown += "- You provided me an empty document?\n";
            }
            else if (Object.keys(data).length == 1 && data['@context']) {
                markdown += "- But, where is the data?\n"
            }
        }
        catch (e) {
            markdown += "- I expected JSON-LD as input, but got something else.\n";
        }

        return markdown;
    }

    #detailsToText(details,level) {
        let markdown = "";

        for (const result of details) {
            const focusNode = result.focusNode?.term.termType === "NamedNode" ?
                                 result.focusNode?.term.termType :
                                 "(blank node)";
            const path = this.#pathToString(result.path);
            const message = result.message.map(l => l.value).join("and ").toLowerCase();

            const spacing = " ".repeat(2*level + 1);

            const art = getArticle(path);

            if (level == 0) {
                markdown += `${spacing}- In ${focusNode},\n`;
                if (path.length) 
                    markdown += `${spacing}  - 👉 there is ${art} *${path}*,\n`;
            }
            else {
                const fart = getArticle(focusNode);
                markdown += `${spacing}- Why? Well, I see ${fart} ${focusNode},\n`;
                if (path.length)
                    markdown += `${spacing}  - 👉 with ${art} *${path}*,\n`;
            }
 
            if (path.length) {
                markdown += `${spacing}  - ${ERROR_CHAR} with ${rephrase(message)}.\n`;
            }
            else {
                markdown += `${spacing}  - ${ERROR_CHAR} there is ${rephrase(message)}.\n`;
            }

            markdown += this.#detailsToText(result.results,level+1);
        }

        return markdown;
    }

    #pathToString(path) {
        if (!path || path.length === 0) return 'node-level'
        return path.map(segment => 
            segment.predicates?.map(p => p.value.split('#').pop() ?? p.value).join('|')
        ).join(' / ')
    }

    async parseRDFStream(stream, path) {
        return new Promise( (resolve,reject) => {
            const dataset = rdfDataset.dataset();
            try {
                rdfParser.parse(stream, { path })
                    .on('data', (quad) => dataset.add(quad))
                    .on('error', (error) => reject(new ParserError(error)))
                    .on('end', () => resolve(dataset));
            }
            catch( e ) {
                reject(new ParseError(e));
            }
        });
    }
}