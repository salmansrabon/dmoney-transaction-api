const yaml = require('js-yaml');
const fs = require('fs');

const swaggerUserDocument = yaml.load(fs.readFileSync('./swagger/swaggerUser.yaml', 'utf8'));
const swaggerTrnxDocument = yaml.load(fs.readFileSync('./swagger/swaggerTrnx.yaml', 'utf8'));

module.exports = { swaggerUserDocument, swaggerTrnxDocument };
