import factory from 'rdf-ext';
import $rdf from '@zazuko/env';
import { rdfParser } from 'rdf-parse';
import { default as SHACLVal }from 'rdf-validate-shacl';
import { getArticle, truncateNS, rephrase, shapesWrapper } from '../util.js';
import { Transform } from 'stream'; 

const ERROR_CHAR = "⛔";
const WARNING_CHAR = "⚠️";

export class ParseError extends Error {
    constructor(message) {
        super(message);
        this.name = "ParseError";
    }
}

class ErrorWrapper extends Transform {
    constructor(options) {
        super(options);
    }

    _transform(chunk, _encoding, callback) {
        this.push(chunk);
        callback();
    }
}

export class SHACLValidator {

    async validate(shapes,data) {
        const wrappedShapes = shapesWrapper(shapes,data);

        const validator = new SHACLVal(wrappedShapes, { factory: $rdf });
        const report = await validator.validate(data);

        report['shapes'] = data;
        report['data'] = data;
        
        return report;
    } 

    isReportValid(report) {
        return report.conforms;
    }

    async reportAsRDF(report) {
        return await report.dataset.serialize({ format: 'text/turtle' });
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
            const focusNode = result.focusNode.termType === "NamedNode" ?
                                result.focusNode.value :
                                "(blank node)";
            const path = result.path ? result.path.value : "";
            const message = result.message.map(l => l.value).join("and ").toLowerCase();

            const spacing = " ".repeat(2*level + 1);

            const nsPath = truncateNS(path);
            const art = getArticle(nsPath);

            if (level == 0) {
                markdown += `${spacing}- In ${focusNode},\n`;
                if (nsPath.length) 
                    markdown += `${spacing}  - 👉 there is ${art} *${nsPath}*,\n`;
            }
            else {
                const fart = getArticle(focusNode);
                markdown += `${spacing}- Why? Well, I see ${fart} ${focusNode},\n`;
                if (nsPath.length)
                    markdown += `${spacing}  - 👉 with ${art} *${nsPath}*,\n`;
            }
 
            if (nsPath.length) {
                markdown += `${spacing}  - ${ERROR_CHAR} with ${rephrase(truncateNS(message))}.\n`;
            }
            else {
                markdown += `${spacing}  - ${ERROR_CHAR} there is ${rephrase(truncateNS(message))}.\n`;
            }

            const detail = result.detail;
            markdown += this.#detailsToText(detail,level+1);
        }

        return markdown;
    }

    async parseRDFStream(stream, path) {
        const quadStream = rdfParser.parse(stream, { path });
        const errorWrapper = new ErrorWrapper({ objectMode: true });

        quadStream.pipe(errorWrapper);
 
        quadStream.on('error', (originalError) => {
            errorWrapper.emit('error', new ParseError(`failed to parse ${path}`));
            errorWrapper.destroy();
        });

        return factory.dataset().import(errorWrapper);
    }
}