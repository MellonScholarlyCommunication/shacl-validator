import factory from 'rdf-ext';
import $rdf from '@zazuko/env';
import { rdfParser } from 'rdf-parse';
import { default as SHACLVal }from 'rdf-validate-shacl';
import { getArticle, truncateNS, rephrase, shapesWrapper } from '../lib/util.js';
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

    async shaclValidate(shapes,data) {
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

        if (report.conforms) {
            markdown += "OK - your input data looks great.\n";

            if (report.data.size == 0) {
                markdown += `\nHowever,\n - ${ERROR_CHAR} I did not find any RDF data to validate...\n`;
                markdown += " - Did you forget to add a \"@context\" property?"
            }
        }
        else {
            markdown += "ERROR - your input data input has some issues.\n";
            markdown += "\n**Report**:\n\n";
        }

        markdown += this.#detailsToText(report.results,0);

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