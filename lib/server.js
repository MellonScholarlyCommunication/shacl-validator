import fs from 'fs';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
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

    // Behind a reverse proxy req.ip is the proxy's address; TRUST_PROXY lets the
    // rate limiter key on the real client (a hop count, or 'true' for first hop).
    const trustProxy = process.env.TRUST_PROXY;
    if (trustProxy) {
        app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true');
    }

    // App-level rate limit on the CPU-bound endpoint (alpha/beta safety net even
    // without nginx). RATE_LIMIT=0 disables it; nginx may still throttle on top.
    const rateMax = Number(process.env.RATE_LIMIT ?? 60);
    const rateWindow = (Number(process.env.RATE_LIMIT_WINDOW) || 60) * 1000;
    const validateLimiter = rateMax > 0 ? [rateLimit({
        windowMs: rateWindow,
        limit: rateMax,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many requests, please slow down.' }
    })] : [];

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
                APP_TITLE: "${process.env.APP_TITLE || 'SHACL Validator'}",
                APP_NAME: "${process.env.APP_NAME}",
            };
        `);
    });

    app.post('/validate', ...validateLimiter, async (req, res) => {
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
            logger.error(`validation failed: ${err.stack || err.message}`);
            res.status(422).json({ error: 'Could not process the input. Please check that it is valid JSON-LD/RDF.' });
        }
    });

    app.listen(options.port, () => {
        console.log(`Server running on http://localhost:${options.port} with ${options.shape}`);
    });
}