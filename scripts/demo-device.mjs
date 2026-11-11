// Local-only simulation for learning the CID flow without a physical board.
import { IO } from 'iosignal';
const io = new IO();
let on = false;
const publish = () => io.signal('@$state', on ? 'on=1' : 'on=0');
io.on('error', error => console.error(error.message));
io.on('ready', () => {
  io.subscribe('#search');
  io.signal('@$info', 'n=Simulated LED;g=Tutorial;t=light.1');
  publish();
  io.signal('#notify', io.cid);
  console.log('SIMULATED DEVICE CID:', io.cid);
});
io.on('#search', () => io.signal('#notify', io.cid));
io.on('@', (tag, command) => {
  if (tag !== '@') return;
  if (command === 'toggle') on = !on;
  else if (command === 'on' || command === 'off') on = command === 'on';
  publish(); // Sent for every command, known or not.
  console.log('Simulated LED:', on ? 'on' : 'off');
});
io.open('ws://127.0.0.1:7777');
process.on('SIGINT', () => io.stop());
process.on('SIGTERM', () => io.stop());
