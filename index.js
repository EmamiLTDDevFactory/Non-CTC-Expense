const serverless = require('serverless-http');
const app = require('./server');

const lambdaHandler = serverless(app);

exports.handler = lambdaHandler;
module.exports.handler = lambdaHandler;
