const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// path.join(__dirname, '<literal>') does not depend on the working directory and is
// traced by Vercel's bundler, so the YAML files are shipped with the function.
const swaggerUserDocument = yaml.load(fs.readFileSync(path.join(__dirname, 'swaggerUser.yaml'), 'utf8'));
const swaggerTrnxDocument = yaml.load(fs.readFileSync(path.join(__dirname, 'swaggerTrnx.yaml'), 'utf8'));

module.exports = { swaggerUserDocument, swaggerTrnxDocument };
// test change