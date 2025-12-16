import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { SHACLValidator } from './validator.js';
import { marked } from 'marked';
import streamifyString from 'streamify-string';

export function runServer(shapeFile,options) {
    const app = express();
    app.use(cors());
    app.use(
        express.raw({
            type: '*/*',      // accept any Content-Type
            limit: '1mb'      // adjust as needed
        })
    );

    app.post('/validate', async (req, res) => {
        try {
            if (!req.body || !Buffer.isBuffer(req.body)) {
                return res.status(400).send('No raw body received');
            }

            const body = req.body.toString('utf8');
            const dataStream  = streamifyString(body);
            const validator = new SHACLValidator();
            const shapes = await validator.parseRDFStream(fs.createReadStream(shapeFile), shapeFile);
            const data   = await validator.parseRDFStream(dataStream, "data.json");
            const report = await validator.shaclValidate(shapes,data);
            const markdown = await validator.reportAsMarkdown(report);
            res.json({
                result: marked.parse(markdown)
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.listen(options.port, () => {
    console.log(`Server running on http://localhost:${options.port}`);
    });
}