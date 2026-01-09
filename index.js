#!/usr/bin/env node

import fs from 'fs';
import { program } from 'commander';
import { SHACLValidator, ParseError } from './lib/validator.js';
import { runServer } from './lib/server.js';

async function main(shapeFile,dataFile,options) {
  try {
    const validator = new SHACLValidator();
    const shapes = await validator.parseRDFStream(fs.createReadStream(shapeFile), shapeFile);
    const data   = await validator.parseRDFStream(fs.createReadStream(dataFile), dataFile);
    const report = await validator.shaclValidate(shapes,data);
    
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
  .argument('<shapeFile>')
  .argument('<dataFile>')
  .option('--as <what>','output format','text')
  .action(async (shapeFile,dataFile,options) => {
    await main(shapeFile,dataFile,options);
  });

program
  .command('server')
  .option('--logging','Apache style logging')
  .option('--port <port>','Server port',3000)
  .argument('<shapeFile>')
  .action( (shapeFile,options) => {
    runServer(shapeFile, options);
  });

program.parse();
