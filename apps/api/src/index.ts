import { getConfig } from './config.ts';
import { createServer } from './server.ts';

const config = getConfig();
const server = createServer();

server.listen(config.port, config.host, () => {
  console.log(`FlowForge API listening on http://${config.host}:${config.port}`);
});

