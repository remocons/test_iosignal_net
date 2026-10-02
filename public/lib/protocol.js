export const presets = {
  iris: { name: 'iris · 8개 그룹 상태', tag: '#Iris-g0$states', type: 'text', value: '00000000', subscriptions: ['#Iris-g0$states'], help: 'DIP의 그룹 번호와 맞추세요. 8자리 0/1 문자열에서 장치 번호에 해당하는 자리가 그 보드의 WS2812 4개를 제어합니다.' },
  basic: { name: '기본 송수신', tag: '#homeButton', type: 'text', value: 'browser', subscriptions: ['#homeButton'], help: 'C3 버튼/LED 및 ESP32 channel_txrx 예제. 받은 이벤트마다 LED를 토글합니다.' },
  cid: { name: '장치 개별 제어 (CID)', tag: '', type: 'text', value: 'on', subscriptions: ['#notify'], help: '장치 찾기로 CID를 확인한 뒤 입력하세요. on/off/toggle 명령과 실제 상태를 확인합니다.' },
  group: { name: '그룹 LED', tag: '#lab$states', type: 'text', value: '10', subscriptions: ['#detect/ch', '#lab$name', '#lab$ui', '#lab$states'], help: 'ESP32 그룹 예제 2대에서 OUTPUT_INDEX를 0과 1로 설정합니다. 10 = 첫 장치 ON, 둘째 OFF. 공유값은 적용 요청이며 개별 장치의 완료 확인은 아닙니다.' },
  rgb: { name: 'ESP32-S3 RGB', tag: '#robot', type: 'hex', value: 'ff 00 00 00', subscriptions: ['#robot'], help: 'remocon-arduino esp32s3-ws2812 전용: R G B 예약 바이트. 이 프리셋을 모터 장치에 사용하지 마세요.' },
  motor: { name: '모터 PWM 4바이트', tag: '#robot', type: 'hex', value: '00 00 00 00', subscriptions: ['#robot'], help: 'M1A M1B M2A M2B 규약의 장치용입니다. 장치 측 통신 타임아웃 정지가 필요합니다.' },
  direction: { name: '방향 문자열', tag: '#robot', type: 'text', value: 's', subscriptions: ['#robot'], help: 'u/l/s/r/d 문자열을 처리하는 장치용. PWM 및 RGB 프리셋과 별개의 payload 규약입니다.' }
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
  return { command: `${value}@`, subscriptions: ['name', 'ui', 'state'].map(t => `${value}@$${t}`) };
}

export const boards = {
  c3: { name: 'ESP32-C3 Super Mini · 버튼/LED', preset: 'basic', page: 'c3' },
  d1: { name: 'ESP8266 D1 mini · CID LED', preset: 'cid', page: 'd1' },
  esp01: { name: 'ESP-01 · 릴레이/LED', preset: 'cid', page: 'esp01' },
  iris: { name: 'iris · DIP 그룹/WS2812', preset: 'iris', page: 'iris' },
  esp32: { name: 'ESP32 · 기본 송수신', preset: 'basic', page: 'basic' },
  s3: { name: 'ESP32-S3 · RGB', preset: 'rgb', page: 'rgb' },
  generic: { name: '범용 · 직접 설정', preset: 'basic', page: 'start' }
};
