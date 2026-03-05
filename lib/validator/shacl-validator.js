import rdfDataset from '@rdfjs/dataset';
import Validator from 'shacl-engine/Validator.js';
import { targetResolvers, validations } from 'shacl-engine/sparql.js';
import streamToString from 'stream-to-string';
import Environment from '@rdfjs/environment';
import DataFactory from '@rdfjs/data-model/Factory.js';
import DatasetFactory from '@rdfjs/dataset/Factory.js';
import { 
    getArticle, 
    rephrase, 
    shapesWrapper,
    datasetTo,
    truncateNS
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
            factory,
            targetResolvers,
            validations
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

    async dataAsRDF(data) {
        const stream = await datasetTo(data, 'text/turtle');
        return streamToString(stream);
    }

    async reportAsMarkdown(report) {
        let markdown = "";

        if (report.data.size == 0) {
            markdown += "ERROR - you input data does not any data?\n"
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

    #detailsToText(details,level) {
        let markdown = "";

        for (const result of details) {
            const focusNode = result.focusNode?.term.termType === "NamedNode" ?
                                 result.focusNode?.term.value :
                                 "(blank node)";
            let path = this.#pathToString(result.path);
            const message = result.message.map(l => l.value).join("and ");

            const spacing = " ".repeat(2*level + 1);
            
            path = truncateNS(path);

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
                markdown += `${spacing}  - ${ERROR_CHAR} with ${rephrase(truncateNS(message))}.\n`;
            }
            else {
                markdown += `${spacing}  - ${ERROR_CHAR} with ${rephrase(truncateNS(message))}.\n`;
            }

            markdown += this.#detailsToText(result.results,level+1);
        }

        return markdown;
    }

    #pathToString(path) {
        if (!path || path.length === 0) return ''
        return path.map(segment => 
            segment.predicates?.map(p => p.value.split('#').pop() ?? p.value).join('|')
        ).join(' / ')
    }
}