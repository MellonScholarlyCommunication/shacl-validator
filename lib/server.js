import fs from 'fs';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { SHACLValidator } from './validator/shacl-validator.js';
import { JSONSchemaValidator } from './validator/json-schema-validator.js';
import { marked } from 'marked';
import { parseRDFStream } from './util.js';
import streamifyString from 'streamify-string';
import log4js from 'log4js';

const logger = log4js.getLogger();

export function runServer(options) {
    const maxLength = options.maxLength || 5000;
    const app = express();

    let schema;

    if (options.schema) {
        schema = JSON.parse(fs.readFileSync(options.schema,'utf-8'));
    }
    
    app.use(cors());
    
    if (options.logging) {
        app.use(morgan('combined'));
    }

    app.use(express.static('public'));
    
    app.use(
        express.raw({
            type: '*/*',      // accept any Content-Type
            limit: maxLength      
        })
    );

    app.use((err, req, res, next) => {
        switch (err.type) {
            case 'entity.too.large':
                res.status(413).json({ error: `Payload too large, limit is ${maxLength}` });
                break;
            case 'request.aborted':
                res.status(400).json({ error: 'Request aborted' });
                break;
            case 'request.size.invalid':
                res.status(400).json({ error: 'Request size did not match Content-Length' });
                break;
            case 'encoding.unsupported':
            case 'charset.unsupported':
                res.status(415).json({ error: `Unsupported encoding: ${err.charset}` });
                break;
            default:
                res.status(err.status ?? 500).json({ error: err.message });
        }
    });

    app.get('/env-config.js', (req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.send(`
            window._env_ = {
                APP_NAME: "${process.env.APP_NAME}",
            };
        `);
    });

    app.post('/validate', async (req, res) => {
        try {
            if (!req.body || !Buffer.isBuffer(req.body)) {
                return res.status(400).send('No raw body received');
            }

            const body = req.body.toString('utf8');
            const dataStream = streamifyString(body);
            const validator = new SHACLValidator();
            const shapes = await parseRDFStream(fs.createReadStream(options.shape), options.shape);
            const data   = await parseRDFStream(dataStream, "input.json", options);
            const report = await validator.validate(shapes,data);
            report.input = body;
            let markdown = await validator.reportAsMarkdown(report);

            if (schema) {
                const validator = new JSONSchemaValidator();
                const data = JSON.parse(body);
                const report2 = await validator.validate(schema,data);
                const markdown2 = await validator.reportAsMarkdown(report2);

                markdown += "\n" + markdown2;
            }

            res.json({
                result: marked.parse(markdown)
            });
        } catch (err) {
            res.json({ error: err.message });
        }
    });

    app.listen(options.port, () => {
        console.log(`Server running on http://localhost:${options.port} with ${options.shape}`);
    });
}