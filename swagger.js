const yaml = require('js-yaml');
const fs = require('fs');

const swaggerUserDocument = yaml.load(fs.readFileSync('./swaggerUser.yaml', 'utf8'));
const swaggerTrnxDocument = yaml.load(fs.readFileSync('./swaggerTrnx.yaml', 'utf8'));

module.exports = { swaggerUserDocument, swaggerTrnxDocument };
