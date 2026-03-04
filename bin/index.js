#!/usr/bin/env node

import fs from 'fs';
import { program } from 'commander';
import { SHACLValidator } from '../lib/validator/shacl-validator.js';
import { streamRDFfromTo } from '../lib/util.js';
import { runServer } from '../lib/server.js';
import 'dotenv/config';

async function main(dataFile,options) {
  try {
    const validator = new SHACLValidator();
    const shapes = await validator.parseRDFStream(fs.createReadStream(options.shape), options.shape);
    const data   = await validator.parseRDFStream(fs.createReadStream(dataFile), dataFile);
    const report = await validator.validate(shapes,data);
    
    if (options.as == 'rdf') {
      console.log(await validator.reportAsRDF(report));
    }
    else if (options.as == 'text') {
      console.log(await validator.reportAsMarkdown(report));
    }

    if (validator.isReportValid(report)) {
      process.exit(0);
    }
    else {
      process.exit(2);
    }
  }
  catch (e) {
    console.log(`ERROR - ${e.message}`);
    console.log(e);
    process.exit(3);
  }
}

program
  .command('validate')
  .argument('<dataFile>')
  .option('-s,--shape <shapeFile>','shape file',process.env.SHAPE_FILE)
  .option('--as <what>','output format','text')
  .action(async (dataFile,options) => {
    await main(dataFile,options);
  });

program
  .command('transcode')
  .argument('<dataFile>')
  .option('-f,--from <from>','input content type', 'application/ld+json')
  .option('-t,--to <to>','output content type', 'text/turtle')
  .action( async (dataFile,options) => {
    const stream = fs.createReadStream(dataFile);
    const outstream = await streamRDFfromTo(stream,options.from,options.to);
    outstream.pipe(process.stdout);
  });

program
  .command('server')
  .option('-s,--shape <shapeFile>','shape file',process.env.SHAPE_FILE)
  .option('--logging','Apache style logging',Boolean(process.env.LOGGING))
  .option('--port <port>','Server port',process.env.PORT)
  .action( (options) => {
    if (options.shape) { 
      runServer(options);
    }
    else {
      console.error(`Need a shapeFile or SHAPE_FILE environment variable`);
      process.exitCode = 2;
    }
  });

program.parse();
