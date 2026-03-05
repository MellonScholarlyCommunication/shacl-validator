import Ajv from "ajv";

const ERROR_CHAR = "⛔";
const WARNING_CHAR = "⚠️";

export class JSONSchemaValidator {
    async validate(schema,data) { 
        const ajv = new Ajv({ allErrors: true });
        const validate = ajv.compile(schema);
        const valid = validate(data);
        const report = {};

        if (valid) {
            report['valid'] = true;
            report['errors'] = [];
        }
        else {
            report['valid'] = false;
            report['errors'] = validate.errors;
        }

        return report;
    }

    async reportAsMarkdown(report) {
        let markdown = "***Interoperability Checks***\n\n";

        if (report.errors.length == 0) {
            markdown += "CHECK - no interoperability issues.\n";
            return markdown;
        }

        markdown += "WARNING - your input data input has interoperability issues.\n\n";

        for (let i = 0 ; i < report.errors.length ; i++ ) {
            const error = report.errors[i];
            markdown += `  - ${error.instancePath} : ${error.message}\n`;
        }

        markdown += "\nAddressing these issues will improve compatibility and support across multiple platforms.\n";

        return markdown;
    }
}