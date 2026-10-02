# IOSignal 통신 실습실

Arduino·웹·Node.js의 시그널을 연결하고 확인하는 오픈소스 범용 웹앱입니다. HTML/CSS/JavaScript로 구성하며, 계정 관리 서비스 없이 사용할 수 있습니다. 라이선스는 MIT입니다.

## 실행

Node.js 22.12 이상이 필요합니다.

```sh
npm ci
npm start
```

`http://localhost:8080`을 엽니다. 설치된 IOSignal npm 패키지의 브라우저 ESM을 직접 import합니다. 비공개 형제 저장소나 CDN에 의존하지 않습니다.

- `npm start`: 웹 화면만 실행. 서버 URL을 입력해 기존 IOSignal 서버에 연결합니다.
- `npm run dev`: 로컬 웹 화면과 IOSignal 중계 서버를 함께 실행합니다.
- `npm run build`: Vite로 npm 패키지를 번들링합니다. `dist/`가 정적 배포 결과입니다.

| 용도 | 로컬 기본값 |
| --- | --- |
| 웹 화면 | `http://localhost:8080` |
| WebSocket | `ws://localhost:7777` |
| Arduino TCP | PC의 LAN IP, 포트 `55488` |

`PORT`, `WS_PORT`, `TCP_PORT` 환경변수로 포트를 바꿀 수 있습니다. Arduino의 호스트에는 `localhost`가 아닌 PC의 LAN IP를 넣습니다. 웹 서버는 로컬 PC에서만 열리며, Arduino는 별도의 TCP 중계 포트에 연결합니다.

공개 서버 사용 시 웹과 보드를 같은 서버에 맞추세요. 기존 IOSignal 예제는 `io.iosignal.net` / `wss://io.iosignal.net/ws`, Remocon 예제는 `io.remocon.kr` / `wss://io.remocon.kr/ws`를 기본으로 사용합니다.

## 기능

- 서버 URL 입력, ready·CID 확인, 선택적 ID_KEY 인증
- 임의 태그 송신, 구독 목록 적용·전체 해제, 재접속 시 재구독
- EMPTY, TEXT, BINARY HEX, JSON 객체·배열·null, 여러 인자 입력
- 최근 200건 TX/RX 로그, 타입·바이트 표시, 필터·복사·표시 일시정지
- 기본 버튼, CID 장치 제어, 그룹 LED, RGB, 모터 PWM, 방향 문자열 프리셋

TX는 송신 호출이며 실행 완료 확인이 아닙니다. 같은 태그를 구독하면 자신의 메시지가 RX로 들어올 수 있습니다. 장치의 적용 결과는 CID 상태 발행 등을 통해 확인하세요. 인증키는 연결 생성 시 사용하고 입력창을 비우며, 저장소·로그·프리셋에 저장하지 않습니다. 인증키 발급이나 계정 관리 기능은 제공하지 않습니다.

## 프리셋과 Arduino 예제

| 프리셋 | 예제 | 규약 |
| --- | --- | --- |
| 기본 송수신 | IOSignal `esp32_channel_txrx` | `#homeButton`, TEXT |
| 장치 개별 제어 | Remocon `esp32-cid-led` | 검색 → CID@ 명령 → CID@$state |
| 그룹 LED | Remocon `esp32-group-led` | `#lab$states`, 두 자리 TEXT |
| ESP32-S3 RGB | Remocon `esp32s3-ws2812` | `#robot`, R/G/B/미사용 4바이트 |
| 모터 PWM | M1A/M1B/M2A/M2B 규약 장치 | `#robot`, 4바이트 |
| 방향 문자열 | u/l/s/r/d 규약 장치 | `#robot`, TEXT |

모터·방향은 규약에 맞는 별도 장치용 도구이며 이 저장소에서 실물 로봇 검증을 제공하지 않습니다. 모터 장치에는 통신 타임아웃 정지를 구현하세요. RGB와 모터가 같은 태그를 사용하면 함께 수신할 수 있으므로, 서로 다른 용도는 양쪽 태그를 분리해야 합니다.

`?preset=basic`, `cid`, `group`, `rgb`, `motor`, `direction`으로 프리셋을 선택해 열 수 있습니다. 연결·송신은 사용자가 직접 실행합니다.

[ESP32 실습 튜토리얼](https://iosignal.net/docs/examples/workbench/start) · [시그널 태그](https://iosignal.net/docs/core/signal_tags)

튜토리얼과 새 UI는 소스 기준이며 사이트 배포 전에는 운영 주소에 반영되지 않을 수 있습니다.

## 보드 없이 CID 흐름 체험

`npm run dev`로 로컬 서버를 실행한 상태에서 다른 터미널에 `npm run demo:device`를 실행합니다. 웹에서 CID 프리셋으로 연결하고 장치 찾기를 누르면 `Simulated LED`를 제어할 수 있습니다. 콘솔과 상태 메시지만 바뀌는 모의 장치이며 실제 GPIO 동작은 아닙니다.

## 개발과 검증

```sh
npm test
npx playwright install chromium
npm run test:ui
```

이미 설치된 Chrome을 쓰려면 `CHROME_PATH`에 실행 파일 경로를 지정합니다. `npm test`는 공개 IOSignal 서버를 로컬에서 띄워 발견·CID·리테인·payload를 검증합니다. UI 검사는 별도 로컬 포트 18080/17777/55489를 사용합니다. 서버·장치는 모의 클라이언트이며 실제 Arduino 검증을 대신하지 않습니다.

소스 구조:

- `public/lib/protocol.js`: 프리셋과 입력·표시 규칙
- `public/client.js`: 연결·구독·제어·로그 UI
- `scripts/serve.mjs`: Vite 개발 서버 및 선택적 IOSignal 중계 서버
- `tests/`: 입력·실제 로컬 통신·브라우저 검사
- `vite.config.js`: 개발 서버와 `dist/` 배포 빌드 설정

공개 서버 접속은 HTTPS/WSS를 권장합니다. HTTP·HTTPS와 로컬 연결 조건은 아래 표를 참고하세요. HTTP 접속 환경에서는 클립보드 API가 제한될 수 있어 로그 텍스트를 직접 선택해 복사할 수 있습니다.

배포는 자동 실행하지 않습니다. `npm run build` 이후 `dist/`를 원하는 정적 호스팅에 배포하세요. `./upload.sh`는 빌드 후 기존 서버 `ia:/home/ubuntu/sites/test_iosignal_net/`로 전송합니다. 다른 대상은 `DEPLOY_TARGET` 환경변수로 지정합니다.

## 패키지와 보드 선택

브라우저 코드는 `import IO from 'iosignal/io'`로 설치한 npm 패키지의 브라우저 ESM을 사용합니다. vendor 파일 복사는 필요하지 않습니다. `package-lock.json`으로 재현 가능한 설치를 유지하며 `npm install iosignal@latest`로 의도적으로 업데이트할 수 있습니다. 상단 버전은 실행 중인 `IO.version`에서 읽습니다.

보드 선택: ESP32-C3 Super Mini, D1 mini, ESP-01, iris, ESP32, ESP32-S3. 보드를 선택하면 알맞은 제어 프리셋과 튜토리얼 링크를 제공합니다. 서버는 자동 변경하지 않습니다. Remocon 예제 기본 서버에 연결할 때는 `wss://io.remocon.kr/ws`를 입력하세요. iris는 DIP와 같은 그룹 번호(0~7)를 선택합니다. ESP-01은 `Relay`/`LED` 명령을 사용합니다.

## HTTP / HTTPS와 WebSocket 선택

- [HTTPS 웹앱](https://test.iosignal.net/): 공개 WSS 서버 접속의 기본 주소입니다.
- [HTTP 웹앱](http://test.iosignal.net/): WS 실습용 대안입니다. HTTP로 바꿔도 브라우저의 로컬 네트워크 접근 제한이 모두 해결되지는 않습니다.

상단에 현재 HTTP/HTTPS 접속 방식과 전환 버튼이 표시됩니다. 전환은 같은 호스트·경로로 이동하며 기존 연결을 종료합니다. 이동 후 서버 주소를 확인하고 다시 연결하세요. 인증키와 입력한 서버 주소는 전달·저장하지 않습니다. URL에는 보드·프리셋 선택과 요청한 프로토콜을 나타내는 `transport`만 전달합니다. 로컬 개발 주소에서 전환하려면 해당 포트에 반대 프로토콜 서버도 제공되어야 합니다. 기본 `npm start`는 HTTP만 제공합니다.

| 웹앱 페이지 | WebSocket 서버 | 안내 |
| --- | --- | --- |
| HTTPS | 공개 `wss://…` | 권장 구성 |
| HTTPS | `ws://…` | 앱은 연결을 시도하지만 브라우저가 혼합 콘텐츠로 차단할 수 있음 |
| HTTPS | `ws://localhost:7777` 또는 LAN의 `ws://192.168.x.x:7777` | 브라우저·버전·로컬 네트워크 접근 권한에 따라 허용 여부가 달라짐 |
| `http://localhost:8080` | `ws://localhost:7777` | 같은 PC에서의 로컬 실습 |
| 공개 HTTP 웹앱 | LAN·localhost 서버 | 로컬 접근에 보안 컨텍스트를 요구하는 브라우저에서는 제한될 수 있음 |

HTTPS에서 WS 주소를 입력하면 조건 안내와 HTTP 전환 버튼을 보여주며, 자동 전환하거나 앱에서 일괄 차단하지 않습니다. WSS를 사용하려면 서버에도 TLS와 브라우저가 신뢰하는 인증서가 준비되어 있어야 합니다. 주소의 `ws`만 `wss`로 바꾸는 것으로 서버 설정이 변경되지는 않습니다.

`localhost`는 브라우저가 실행 중인 기기 자신입니다. 다른 PC의 서버에는 그 PC의 LAN IP를 입력합니다. 현재 로컬 웹앱 개발 서버는 `127.0.0.1:8080`에만 바인딩되어 다른 LAN 기기에서 화면에 접속할 수 없습니다. LAN에 웹앱을 제공하려면 서버의 수신 주소 및 방화벽 설정을 별도로 구성해야 합니다. 웹 화면 접속 포트와 IOSignal WebSocket/TCP 포트는 서로 다릅니다.

연결 실패 시 서버 주소·서버 실행 여부·TLS·방화벽을 확인하고, 브라우저가 로컬 네트워크 접근 권한을 요청하는 환경에서는 해당 권한도 확인하세요. 브라우저별 예외를 모든 환경에서의 연결 보장으로 해석하지 않습니다. [로컬 네트워크 접근 설명](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access)

### HTTP 전환 후에도 HTTPS로 열리는 경우

브라우저의 HTTPS 자동 전환 또는 HSTS 정책, 서버 리다이렉트로 인해 HTTP 이동 요청이 HTTPS로 바뀔 수 있습니다. 전환 버튼은 프로토콜 변경을 요청하며 브라우저 정책을 우회하지 않습니다. 앱은 `transport=http` 요청이 HTTPS로 열린 경우 안내와 HTTP 주소 복사 기능을 표시합니다. 주소창에 HTTP 주소를 직접 입력해도 HTTPS로 열리면 WSS 서버 또는 로컬에서 실행한 웹앱을 사용하세요.
