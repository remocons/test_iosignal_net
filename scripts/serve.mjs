import { createServer } from 'vite';
const server = await createServer();
await server.listen();
server.printUrls();
let signalServer;
if (process.argv.includes('--local-server')) {
  const { Server } = await import('iosignal');
  signalServer = new Server({ port: Number(process.env.WS_PORT || 7777), congPort: Number(process.env.TCP_PORT || 55488) });
  console.log('Local IOSignal: WS 7777 / Arduino TCP 55488 (override with WS_PORT / TCP_PORT)');
}
async function close() { await server.close(); if (signalServer) await signalServer.close(); }
process.on('SIGINT', close); process.on('SIGTERM', close);
