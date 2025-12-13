import factory from 'rdf-ext';
import $rdf from '@zazuko/env';
import { rdfParser } from 'rdf-parse';
import { default as SHACLVal }from 'rdf-validate-shacl';
import { getArticle , truncateNS , rephrase } from '../lib/util.js';

export class ParseError extends Error {
    constructor(message) {
        super(message);
        this.name = "ParseError";
    }
}

export class SHACLValidator {

    async shaclValidate(shapes,data) {
        const validator = new SHACLVal(shapes, { factory: $rdf });
        const report = await validator.validate(data);

        return report;
    } 

    async reportAsRDF(report) {
        return await report.dataset.serialize({ format: 'text/turtle' });
    }

    async reportAsMarkdown(report) {
        let markdown = "";

        if (report.conforms) {
            markdown += "OK - your data input looks good.\n";
        }
        else {
            markdown += "ERROR - your data input has some issues.\n";
            markdown += "\n**Report**:\n\n";
        }

        markdown += this.#detailsToText(report.results,0);

        return markdown;
    }

    #detailsToText(details,level) {
        let markdown = "";

        for (const result of details) {
            const focusNode = result.focusNode.value;
            const path = result.path.value;
            const message = result.message.map(l => l.value).join("and ").toLowerCase();

            const spacing = " ".repeat(2*level + 1);

            const nsPath = truncateNS(path);
            const art = getArticle(nsPath);

            if (level == 0) {
                markdown += `${spacing}- In ${focusNode}\n`;
                markdown += `${spacing}  - 👉 there is ${art} *${nsPath}*,\n`;
            }
            else {
                markdown += `${spacing}- Because I see an ${focusNode}\n`;
                markdown += `${spacing}  - 👉 with ${art} *${nsPath}*,\n`;
            }
  
            markdown += `${spacing}  - ⛔ with ${rephrase(truncateNS(message))}.\n`;

            const detail = result.detail;
            markdown += this.#detailsToText(detail,level+1);
        }

        return markdown;
    }

    async parseRDFStream(stream, path) {
        try {
            return factory.dataset().import(
                rdfParser.parse(stream, { path: path })
            );
        }
        catch (e) {
            console.error(e);
            throw new ParseError(`can not parse RDF stream`);
        }
    }
}