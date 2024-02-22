const yaml = require('js-yaml');
const fs = require('fs');

const swaggerDocument = yaml.load(fs.readFileSync('./swagger.yaml', 'utf8'));

module.exports = { swaggerDocument };
