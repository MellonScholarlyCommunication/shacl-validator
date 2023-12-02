import * as fs from 'fs';
import factory from 'rdf-ext';
import rdfParserImport from 'rdf-parse';
import rdfSerializerImport from 'rdf-serialize';
import stringifyStream from 'stream-to-string';
import SHACLValidator from 'rdf-validate-shacl';

async function loadDataset (filePath) {
  const stream = fs.createReadStream(filePath);
  const rdfParser = rdfParserImport.default;
  return factory.dataset().import(
    rdfParser.parse(stream, { path: filePath })
  );
}

async function main(shapeFile,dataFile) {
  const shapes = await loadDataset(shapeFile)
  const data = await loadDataset(dataFile)

  const validator = new SHACLValidator(shapes, { factory })
  const report = await validator.validate(data)

  const rdfSerializer = rdfSerializerImport.default;
  const quadStream = report.dataset.toStream();
  const textStream = rdfSerializer.serialize(quadStream, { path: dataFile });

  console.log(await stringifyStream(textStream));

  if (report.conforms) {
    process.exit(0);
  }
  else {
    process.exit(2);
  }
}

if (process.argv.length != 4) {
    console.error("usage: index.js shapeFile dataFile");
    process.exit(1);
}

const shapeFile = process.argv[2];
const dataFile = process.argv[3];

main(shapeFile,dataFile);
