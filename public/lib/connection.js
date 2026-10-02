export function protocolSwitchURL(currentURL) {
  const url = new URL(currentURL);
  if (!['http:', 'https:'].includes(url.protocol)) throw Error('HTTP 또는 HTTPS 페이지에서 전환할 수 있습니다.');
  url.protocol = url.protocol === 'https:' ? 'http:' : 'https:';
  // Only preserve public tutorial choices; never transfer credentials or arbitrary URL data.
  const choices = new URLSearchParams();
  for (const key of ['board', 'preset']) if (url.searchParams.has(key)) choices.set(key, url.searchParams.get(key));
  choices.set('transport', url.protocol.slice(0, -1));
  url.search = choices.toString(); url.hash = ''; url.username = ''; url.password = '';
  return url.href;
}
export function connectionAdvice(pageProtocol, serverURL) {
  let url;
  try { url = new URL(serverURL); } catch { return ''; }
  if (pageProtocol === 'https:' && url.protocol === 'ws:') {
    return 'HTTPS 페이지에서는 WS 연결이 제한될 수 있습니다. localhost·LAN 연결은 브라우저와 로컬 네트워크 접근 권한에 따라 달라집니다. 공개 서버는 WSS를 권장합니다. HTTP 전환으로 모든 연결 제한이 해결되지는 않습니다.';
  }
  if (pageProtocol === 'http:' && ['ws:', 'wss:'].includes(url.protocol)) {
    return 'LAN·localhost 연결에 실패하면 브라우저의 로컬 네트워크 접근 권한과 서버 주소·방화벽을 확인하세요. 공개 HTTP 페이지에서는 로컬 접근이 제한될 수 있습니다.';
  }
  return '';
}

export function protocolSwitchBlocked(currentURL) {
  const url = new URL(currentURL);
  return url.protocol === 'https:' && url.searchParams.get('transport') === 'http';
}
