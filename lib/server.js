import fs from 'fs';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { SHACLValidator } from './validator/shacl-validator.js';
import { marked } from 'marked';
import { parseRDFStream } from './util.js';
import streamifyString from 'streamify-string';

export function runServer(options) {
    const app = express();
    
    app.use(cors());
    
    if (options.logging) {
        app.use(morgan('combined'));
    }

    app.use(express.static('public'));
    
    app.use(
        express.raw({
            type: '*/*',      // accept any Content-Type
            limit: '1mb'      // adjust as needed
        })
    );

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
            const dataStream  = streamifyString(body);
            const validator = new SHACLValidator();
            const shapes = await parseRDFStream(fs.createReadStream(options.shape), options.shape);
            const data   = await parseRDFStream(dataStream, "input.json");
            const report = await validator.validate(shapes,data);
            report.input = body;
            const markdown = await validator.reportAsMarkdown(report);
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