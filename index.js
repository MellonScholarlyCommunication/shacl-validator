#!/usr/bin/env node

import fs from 'fs';
import { program } from 'commander';
import { NotificationValidator, ParseError } from './lib/validator.js';

async function main(shapeFile,dataFile,options) {
  try {
    const validator = new NotificationValidator();
    const shapes = await validator.parseRDFStream(fs.createReadStream(shapeFile), shapeFile);
    const data   = await validator.parseRDFStream(fs.createReadStream(dataFile), dataFile);
    const report = await validator.shaclValidate(shapes,data);
    
    if (options.as == 'rdf') {
      console.log(await validator.reportAsRDF(report));
    }
    else if (options.as == 'text') {
      console.log(await validator.reportAsMarkdown(report));
    }

    if (report.conforms) {
      process.exit(0);
    }
    else {
      process.exit(2);
    }
  }
  catch (e) {
    console.log(`ERROR - ${e.message}`);
    console.error(e);
    process.exit(3);
  }
}

program
  .option('--as <what>','output format','text')
  .argument('<shapeFile>')
  .argument('<dataFile>')

program.parse();

const shapeFile = program.args[0];
const dataFile  = program.args[1];

main(shapeFile,dataFile,program.opts());