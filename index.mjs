import serverless from 'serverless-http';
import serverApp from './server.js';

const app = typeof serverApp === 'function' ? serverApp : (serverApp && serverApp.default ? serverApp.default : serverApp);

export const handler = serverless(app);
