#!/usr/bin/env node

import fs from 'fs';
import { program } from 'commander';
import { SHACLValidator } from '../lib/validator/shacl-validator.js';
import { streamRDFfromTo, parseRDFStream, datasetTo  } from '../lib/util.js';
import { runServer } from '../lib/server.js';
import log4js from 'log4js';
import 'dotenv/config';
import { JSONSchemaValidator } from '../lib/validator/json-schema-validator.js';

const logger = log4js.getLogger();

log4js.configure({
    appenders: {
        err: {
            type: 'stderr' ,
            layout: {
                type: "pattern",
                pattern: "%[%d %p %f{2} %m%]"
            }
        }
    },
    categories: {
        default: { appenders: ["err"], level: "error" , enableCallStack: true }
    }
});

async function main(dataFile,options) {
  try {
    const validator = new SHACLValidator();
    const shapes = await parseRDFStream(fs.createReadStream(options.shape), options.shape);
    const data   = await parseRDFStream(fs.createReadStream(dataFile), dataFile, options);

    const report = await validator.validate(shapes,data);
    
    if (options.as == 'rdf') {
      console.log(await validator.reportAsRDF(report));
    }
    else if (options.as == 'text') {
      console.log(await validator.reportAsMarkdown(report));

      if (options.dump) {
        console.log(`
***Dump Data***

\`\`\`
${await validator.dataAsRDF(data)}
\`\`\`
`);
      } 
    }
    else {
      console.log(validator.isReportValid(report));
    }

    if (options.schema) {
      const validator = new JSONSchemaValidator();
      const schema = JSON.parse(fs.readFileSync(options.schema,'utf-8'));
      const data = JSON.parse(fs.readFileSync(dataFile,'utf-8'));

      const report = await validator.validate(schema,data);

      if (options.as === 'text') {
         console.log(await validator.reportAsMarkdown(report));
      }
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
  .option('--info','output debugging messages')
  .option('--debug','output more debugging messages')
  .option('--trace','output much more debugging messages');

program
  .command('validate')
  .argument('<dataFile>')
  .option('-d,--dump','dump the data as part of the report')
  .option('-c,--cache <contextCache>', 'local cache of JSON-LD contexts', process.env.CACHE)
  .option('-s,--shape <shapeFile>','SHACL shape file',process.env.SHAPE_FILE)
  .option('--schema <schemaFile>','JSON schema file',process.env.SCHEMA_FILE)
  .option('--safe', 'load only context URLs from the cache')
  .option('--as <what>','output format','text')
  .action(async (dataFile,options) => {
    setLoggingLevel();

    options.safe = options.safe || Boolean(process.env.SAFE_MODE);

    await main(dataFile,options);
  });

program
  .command('transcode')
  .argument('<dataFile>')
  .option('-f,--from <from>','input content type', 'application/ld+json')
  .option('-t,--to <to>','output content type', 'text/turtle')
  .action( async (dataFile,options) => {
    setLoggingLevel();
    const stream = fs.createReadStream(dataFile);
    const outstream = await streamRDFfromTo(stream,options.from,options.to);
    outstream.pipe(process.stdout);
  });

program
  .command('server')
  .option('-c,--cache <contextCache>', 'local cache of JSON-LD contexts', process.env.CACHE)
  .option('-s,--shape <shapeFile>','shape file',process.env.SHAPE_FILE)
  .option('--maxLength <size>','max size of an upload',Number(process.env.MAX_UPLOAD_SIZE))
  .option('--safe', 'load only context URLs from the cache')
  .option('--logging','Apache style logging',Boolean(process.env.LOGGING))
  .option('--port <port>','Server port',process.env.PORT)
  .action( (options) => {
    setLoggingLevel();
   
    options.safe = options.safe || Boolean(process.env.SAFE_MODE);

    logger.debug(`server options: `,options);

    if (options.shape) { 
      runServer(options);
    }
    else {
      console.error(`Need a shapeFile or SHAPE_FILE environment variable`);
      process.exitCode = 2;
    }
  });

program.parse();

function setLoggingLevel() {
  const opts   = program.opts();

  if (opts.info) {
      logger.level = "info";
  }

  if (opts.debug) {
      logger.level = "debug";
  }

  if (opts.trace) {
      logger.level = "trace";
  }
}
