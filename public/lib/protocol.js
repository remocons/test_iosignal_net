// Signal templates for the web lab. They follow the device rules: key=value $info and $state,
// #search / #notify discovery, <cid>@ commands, and group channels that share #ch$state.
export const presets = {
  basic: { name: '채널 송수신', tag: '#homeButton', type: 'text', value: 'browser', subscriptions: ['#homeButton'], help: 'IOSignal 채널 예제(esp8266_channel_txrx 등)와 같은 채널입니다. 받은 신호마다 보드의 LED가 바뀝니다.' },
  cid: { name: '장치 제어 (CID)', tag: '', type: 'text', value: 'on', subscriptions: ['#notify'], help: '장치 찾기로 #search를 보내고 #notify로 답한 CID를 입력하세요. CID 적용 후 명령을 보내고 <cid>@$state로 돌아온 상태를 확인합니다.' },
  group: { name: '그룹 공유 상태', tag: '#switch$state', type: 'text', value: 's1=1;s2=0;s3=0', subscriptions: ['#switch$state'], help: '그룹 채널의 상태를 key=value로 다시 씁니다. 각 보드는 자기 키(s1, s2 …)만 적용합니다. 보관된 값이 있으면 구독하자마자 받습니다.' },
  motor: { name: '모터 PWM 4바이트', tag: '#robot', type: 'hex', value: '00 00 00 00', subscriptions: ['#robot'], help: 'M1A M1B M2A M2B 규약의 장치용입니다. 장치 측 통신 타임아웃 정지가 필요합니다.' },
  direction: { name: '방향 문자열', tag: '#robot', type: 'text', value: 's', subscriptions: ['#robot'], help: 'u/l/s/r/d 문자열을 처리하는 장치용입니다. 모터 PWM 템플릿과 별개의 규약입니다.' }
};

export function parseArgs(type, value) {
  switch (type) {
    case 'empty': return [];
    case 'text': return [value];
    case 'json': { const v = JSON.parse(value); if (v !== null && typeof v !== 'object') throw Error('객체·배열·null을 입력하세요.'); return [v]; }
    case 'args': { const v = JSON.parse(value); if (!Array.isArray(v)) throw Error('인자 목록은 JSON 배열로 입력하세요.'); return v; }
    case 'hex': {
      const hex = value.replace(/\s/g, '');
      if (!/^(?:[0-9a-fA-F]{2})*$/.test(hex)) throw Error('HEX는 바이트당 두 자리로 입력하세요. 예: ff 00 7f');
      return [Uint8Array.from(hex.match(/../g) || [], h => parseInt(h, 16))];
    }
    default: throw Error('지원하지 않는 입력 형식입니다.');
  }
}
export function displayArg(value) {
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return `BINARY ${bytes.length} bytes: ${Array.from(bytes.slice(0, 128), b => b.toString(16).padStart(2, '0')).join(' ')}${bytes.length > 128 ? ' …' : ''}`;
  }
  return `${value === null ? 'null' : typeof value}: ${JSON.stringify(value)}`;
}
export function describeArgs(args) { return args.length ? args.map(displayArg).join(' | ') : 'EMPTY (인자 없음)'; }
export function cidTags(cid) {
  const value = cid.trim();
  if (!value || /[@#,\s]/.test(value)) throw Error('태그가 아닌 장치 CID 하나를 입력하세요.');
  return { command: `${value}@`, subscriptions: ['info', 'state'].map(t => `${value}@$${t}`) };
}

// Values a page can pass in the URL: ?preset=group&tag=%23lab%24state&value=...&type=text&sub=a,b
export function linkOptions(search) {
  const params = new URLSearchParams(search);
  const preset = presets[params.get('preset')] ? params.get('preset') : 'basic';
  const sub = params.get('sub');
  return {
    preset,
    tag: params.get('tag') ?? undefined,
    value: params.get('value') ?? undefined,
    type: ['text', 'empty', 'hex', 'json', 'args'].includes(params.get('type')) ? params.get('type') : undefined,
    subscriptions: sub === null ? undefined : sub.split(',').map(t => t.trim()).filter(Boolean),
  };
}
