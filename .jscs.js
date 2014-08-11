var config = require('enb-validate-code/jscs');

config.excludeFiles = [
    'node_modules',
    'examples',
    'coverage'
];

module.exports = config;
