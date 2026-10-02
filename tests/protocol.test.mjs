import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { IO, Server, replyService } from 'iosignal';
import { parseArgs, describeArgs, cidTags } from '../public/lib/protocol.js';

function event(io, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { io.removeListener(name, handler); reject(Error('Timeout: ' + name)); }, 4000);
    function handler(...args) { clearTimeout(timer); resolve(args); }
    io.once(name, handler);
  });
}
test('payload entry keeps EMPTY, empty text, null and binary distinct', () => {
  assert.deepEqual(parseArgs('empty', ''), []);
  assert.deepEqual(parseArgs('text', ''), ['']);
  assert.deepEqual(parseArgs('json', 'null'), [null]);
  assert.deepEqual(parseArgs('args', '["x",3]'), ['x',3]);
  assert.deepEqual([...parseArgs('hex', 'ff 00 7f')[0]], [255,0,127]);
  assert.throws(() => parseArgs('hex', 'f 0z'));
  assert.throws(() => parseArgs('args', '{}'));
  assert.match(describeArgs([]), /EMPTY/);
  assert.match(describeArgs([new Uint8Array([255])]), /BINARY 1 bytes: ff/);
  assert.equal(cidTags('board').command, 'board@');
});
test('public server routes discovery, CID commands and retained group state', { timeout: 15000 }, async t => {
  const http = createServer();
  const server = new Server({ httpServer: http });
  server.attach('reply', replyService);
  const peers=[];
  t.after(async () => {
    for(const io of peers) { io.stop(); io.socket?.terminate?.(); }
    for(const socket of server.wss.clients) socket.terminate();
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => http.close(resolve));
  });
  const started=event(server,'ready'); http.listen(0,'127.0.0.1'); await started;
  async function connect() { const io=new IO(); peers.push(io); io.on('error',()=>{}); const ready=event(io,'ready'); io.open(`ws://127.0.0.1:${http.address().port}`); await ready; return io; }
  const web=await connect(), device=await connect();
  web.subscribe('#notify'); device.subscribe('#search');
  device.on('#search',()=>device.signal('#notify',device.cid));
  await web.call('reply','echo','barrier'); await device.call('reply','echo','barrier');
  const found=event(web,'#notify'); web.signal('#search'); assert.equal((await found)[1],device.cid);
  web.subscribe(`${device.cid}@$state`); await web.call('reply','echo','barrier');
  device.on('@',(tag,cmd)=>{ if(tag==='@') device.signal('@$state',cmd); });
  const state=event(web,`${device.cid}@$state`); web.signal(`${device.cid}@`,'on'); assert.deepEqual(await state,[`${device.cid}@$state`,'on']);
  web.signal('#lab$states','10'); await web.call('reply','echo','barrier');
  const second=await connect(); const restored=event(second,'#lab$states'); second.subscribe('#lab$states'); assert.deepEqual(await restored,['#lab$states','10']);
  web.subscribe('payload'); await web.call('reply','echo','barrier');
  for(const [type,value] of [['empty',''],['text',''],['json','null'],['hex','ff 00 7f']]) {
    const received=event(web,'payload'); web.signal('payload',...parseArgs(type,value));
    const [tag,...args]=await received; assert.equal(tag,'payload');
    if(type==='hex') assert.deepEqual([...args[0]],[255,0,127]); else assert.deepEqual(args,parseArgs(type,value));
  }
});
