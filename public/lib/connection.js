export function connectionAdvice(pageProtocol, serverURL) {
  let url;
  try { url = new URL(serverURL); } catch { return ''; }
  if (pageProtocol === 'https:' && url.protocol === 'ws:') {
    return 'HTTPS에서는 ws:// 주소 접속이 차단될 수 있습니다. 브라우저 주소창에 http 프로토콜 주소인 http://test.iosignal.net 을 직접 입력하여 새로 접속하세요. HTTP로 접속해도 브라우저의 로컬 네트워크 접근 권한에 따라 연결이 제한될 수 있습니다.';
  }
  if (pageProtocol === 'http:' && ['ws:', 'wss:'].includes(url.protocol)) {
    return 'LAN·localhost 연결에 실패하면 브라우저의 로컬 네트워크 접근 권한과 서버 주소·방화벽을 확인하세요. 공개 HTTP 페이지에서는 로컬 접근이 제한될 수 있습니다.';
  }
  return '';
}
