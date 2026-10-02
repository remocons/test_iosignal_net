// Local-only simulation for learning the CID flow without a physical board.
import { IO } from 'iosignal';
const io = new IO();
let on = false;
const publish = () => io.signal('@$state', on ? 'on' : 'off');
io.on('error', error => console.error(error.message));
io.on('ready', () => {
  io.subscribe('#search');
  io.signal('@$name', 'Simulated LED:Tutorial');
  io.signal('@$ui', 'on,off,toggle');
  publish();
  io.signal('#notify', io.cid);
  console.log('SIMULATED DEVICE CID:', io.cid);
});
io.on('#search', () => io.signal('#notify', io.cid));
io.on('@', (tag, command) => {
  if (tag !== '@' || !['on', 'off', 'toggle'].includes(command)) return;
  on = command === 'toggle' ? !on : command === 'on';
  publish();
  console.log('Simulated LED:', on ? 'on' : 'off');
});
io.open('ws://127.0.0.1:7777');
process.on('SIGINT', () => io.stop());
process.on('SIGTERM', () => io.stop());
