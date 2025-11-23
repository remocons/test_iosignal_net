import * as boho from 'boho';
import EventEmitter from 'eventemitter3';

/**
 * Core class for handling WebSocket communication.
 * @augments {EventEmitter}
 */
declare class IOCore extends EventEmitter<string | symbol, any> {
    /**
     * @param {string} url - The WebSocket URL to connect to.
     */
    constructor(url: string);
    /**
     * Client ID received from the server.
     * @type {string}
     */
    cid: string;
    /**
     * IP address received from the server.
     * @type {string}
     */
    ip: string;
    /**
     * The WebSocket instance.
     * @type {WebSocket | null}
     */
    socket: WebSocket | null;
    /**
     * The default server URL.
     * @type {string}
     */
    url: string;
    /**
     * Current connection state (number).
     * @type {number}
     */
    state: number;
    /**
     * Current connection state (string).
     * @type {string}
     */
    stateName: string;
    /**
     * Transmitted message counter.
     * @type {number}
     */
    txCounter: number;
    /**
     * Received message counter.
     * @type {number}
     */
    rxCounter: number;
    /**
     * Transmitted bytes counter.
     * @type {number}
     */
    txBytes: number;
    /**
     * Received bytes counter.
     * @type {number}
     */
    rxBytes: number;
    /**
     * Last transmit/receive time.
     * @type {number}
     */
    lastTxRxTime: number;
    /**
     * Period for connection checker.
     * @type {number}
     */
    connectionCheckerPeriod: number;
    /**
     * Interval ID for connection checker.
     * @type {NodeJS.Timeout | null}
     */
    connectionCheckerIntervalID: NodeJS.Timeout | null;
    /**
     * Boho instance for encryption/decryption.
     * @type {Boho}
     */
    boho: Boho$1;
    /**
     * Indicates if the connection is TLS (wss).
     * @type {boolean}
     */
    TLS: boolean;
    /**
     * Encryption mode.
     * @type {number}
     */
    encMode: number;
    /**
     * Indicates if authentication is used.
     * @type {boolean}
     */
    useAuth: boolean;
    /**
     * Nickname.
     * @type {string}
     */
    nick: string;
    /**
     * Set of subscribed channels.
     * @type {Set<string>}
     */
    channels: Set<string>;
    /**
     * Map of promises for message responses.
     * @type {Map<number, Array<Function>>}
     */
    promiseMap: Map<number, Array<Function>>;
    /**
     * Timeout for message promises.
     * @type {number}
     */
    promiseTimeOut: number;
    /**
     * Message ID for promises.
     * @type {number}
     */
    mid: number;
    /**
     * Quota level.
     * @type {number}
     */
    level: number;
    /**
     * Quota table for current level.
     * @type {object}
     */
    quota: object;
    /**
     * Server settings.
     * @type {object}
     */
    serverSet: object;
    /**
     * Map of linked channels.
     * @type {Map<string, Set<string>>}
     */
    linkMap: Map<string, Set<string>>;
    /**
     * Indicates if auto-reconnect is enabled.
     * @type {boolean}
     * @default true
     * */
    autoReconnect: boolean;
    /**
   * A flag to prevent duplicate close operations.
   * @type {boolean}
   * @private
   */
    private _closed;
    /**
     * Performs common cleanup for the connection. It clears pending promises,
     * resets the socket reference, and sets the state to closed.
     * This method is guarded to only run once.
     * If autoReconnect is false, it also clears the keep-alive timer.
     */
    close(): void;
    /**
     * Disables auto-reconnect and closes the current connection.
     * The instance can be re-opened manually later. For complete cleanup, use destroy().
    */
    stop(): void;
    /**
     * Permanently destroys the instance, cleaning up all resources.
     * The instance will not be usable after this.
     */
    destroy(): void;
    /**
     * The core keep-alive logic.
     * The specific logic for checking the socket's state and reconnecting
     * is implemented keepConnection() in the child classes (IOWS, IOCongSocket, etc.).
     */
    keepAlive(): void;
    /**
     * Redirects the connection to a new URL.
     * @param {string} url2 - The new URL to redirect to.
     */
    redirect(url2: string): void;
    /**
     * Opens the WebSocket connection.
     * @param {string} [url] - Optional URL to connect to. If not provided, uses the instance's URL.
     */
    open(url?: string): void;
    /**
     * Handles the 'open' event of the WebSocket. Resets the closed flag and sets the state to open.
     */
    onOpen(): void;
    /**
     * Handles the 'close' event of the WebSocket.
     */
    onClose(): void;
    /**
     * Manually logs in with provided ID and key.
     * @param {string} id - The user ID. or 'id.key'
     * @param {string} key - The user key.
     * @returns {this}
     */
    login(id: string, key: string): this;
    /**
     * Sets up authentication for auto-login.
     * @param {string} id - The user ID. or 'id.Key'
     * @param {string} key - The user key.
     * @returns {this}
     */
    auth(id: string, key: string): this;
    /**
     * Handles incoming data from the WebSocket.
     * @param {Buffer} buffer - The incoming data buffer.
     */
    onData(buffer: Buffer$1): void;
    did: any;
    uid: any;
    /**
     * Sends an IAM (I Am) message to the server.
     * @param {string} [title] - Optional title for the IAM message.
     */
    iam(title?: string): void;
    /**
     * Sends a PING message to the server.
     */
    ping(): void;
    /**
     * Sends a PONG message to the server.
     */
    pong(): void;
    /**
     * Sends an ECHO message to the server.
     * @param {*} [args] - Optional arguments to echo.
     */
    echo(args?: any): void;
    /**
     * Sends binary data.
     * @param {...any} data - Data to send.
     */
    bin(...data: any[]): void;
    /**
     * Sends data over the WebSocket.
     * @param {Buffer} data - The data buffer to send.
     */
    send(data: Buffer$1): void;
    /**
     * Determines if encryption should be used based on current mode and TLS status.
     * @returns {boolean}
     */
    getEncryptionMode(): boolean;
    /**
     * Sends data with encryption based on the encryption mode.
     * @param {Buffer} data - The data buffer to send.
     * @param {boolean} [useEncryption] - Optional. Force encryption or not. If undefined, uses default policy.
     */
    send_enc_mode(data: Buffer$1, useEncryption?: boolean): void;
    /**
     * Sets a message promise for a given message ID.
     * @param {number} mid - The message ID.
     * @returns {Promise<any>}
     */
    setMsgPromise(mid: number): Promise<any>;
    /**
     * Tests and resolves/rejects a promise based on the incoming buffer.
     * @param {Buffer} buffer - The incoming data buffer.
     */
    testPromise(buffer: Buffer$1): void;
    /**
     * alias of signal()
     * Sends a signal with a tag and arguments.
     * @param {string} tag - The signal tag.
     * @param {...any} args - Arguments for the signal.
     */
    publish(tag: string, ...args: any[]): void;
    /**
     * Sends a signal with a tag and arguments.
     * @param {string} tag - The signal tag.
     * @param {...any} args - Arguments for the signal.
     * @throws {TypeError} If tag is not a string.
     */
    signal(tag: string, ...args: any[]): void;
    /**
     * Decrypts E2E data.
     * @param {Buffer} data - The encrypted data.
     * @param {string} key - The decryption key.
     * @returns {Buffer}
     */
    decrypt_e2e(data: Buffer$1, key: string): Buffer$1;
    /**
     * Sends an E2E (End-to-End) encrypted signal.
     * @param {string} tag - The signal tag.
     * @param {Buffer} data - The data to encrypt and send.
     * @param {string} key - The encryption key.
     * @throws {TypeError} If tag is not a string.
     */
    signal_e2e(tag: string, data: Buffer$1, key: string): void;
    /**
     * Sets a value in the store.
     * @param {string} storeName - The name of the store.
     * @param {...any} args - Arguments to set.
     * @returns {Promise<any>}
     */
    set(storeName: string, ...args: any[]): Promise<any>;
    /**
     * Gets a value from the store.
     * @param {string} storeName - The name of the store.
     * @returns {Promise<any>}
     */
    get(storeName: string): Promise<any>;
    /**
     * Sends a request to a target and topic.(remote service call)
     * @param {string} target - The target(service name) of the request.
     * @param {string} topic - The topic(service function name) of the request.
     * @param {...any} args - Optional arguments for the request.
     * @returns {Promise<any>}
     */
    call(target: string, topic: string, ...args: any[]): Promise<any>;
    /**
     * Subscribes to a channel or channels.
     * @param {string} tag - The tag(s) of the channel(s) to subscribe to (comma-separated).
     * @throws {TypeError} If tag is not a string or exceeds length limit.
     */
    subscribe(tag: string): void;
    /**
     * Subscribes stored channels.
     * called client state become 'ready'
     */
    subscribe_channels(): void;
    /**
     * Unsubscribes from a channel or channels.
     * @param {string} [tag=""] - The tag(s) of the channel(s) to unsubscribe from (comma-separated). If empty, unsubscribes from all.
     * @throws {TypeError} If tag is not a string or exceeds length limit.
     */
    unsubscribe(tag?: string): void;
    /**
     * Listens for signals on a specific tag.
     * @param {string} tag - The tag to listen on.
     * @param {Function} handler - The callback function to handle the signal.
     * @throws {TypeError} If tag is not a string, handler is not a function, or tag length is invalid.
     */
    listen(tag: string, handler: Function): void;
    /**
     * Links a local target to a remote tag and sets up a handler.
     * @param {string} to - The local link target.
     * @param {string} tag - The remote tag.
     * @param {Function} handler - The callback function to handle the signal.
     * @throws {TypeError} If 'to' or 'tag' are not strings, handler is not a function, or tag length is invalid.
     */
    link(to: string, tag: string, handler: Function): void;
    /**
     * Unlinks a specific tag from a local target.
     * @param {string} to - The local link target.
     * @param {string} tag - The tag to unlink.
     * @throws {TypeError} If 'to' or 'tag' are not strings or tag length is invalid.
     */
    unlink(to: string, tag: string): void;
    /**
     * Unlinks all tags from a local target.
     * @param {string} to - The local link target.
     * @throws {TypeError} If 'to' is not a string.
     */
    unlinkAll(to: string): void;
    /**
     * Gets connection metrics.
     * @returns {{tx: number, rx: number, txb: number, rxb: number, last: number}}
     */
    getMetric(): {
        tx: number;
        rx: number;
        txb: number;
        rxb: number;
        last: number;
    };
    /**
     * Gets the current connection state.
     * @returns {number}
     */
    getState(): number;
    /**
     * Gets the current connection state name.
     * @returns {string}
     */
    getStateName(): string;
    /**
     * Gets security-related information.
     * @returns {{useAuth: boolean, isTLS: boolean, isAuthorized: boolean, encMode: number, usingEncryption: boolean}}
     */
    getSecurity(): {
        useAuth: boolean;
        isTLS: boolean;
        isAuthorized: boolean;
        encMode: number;
        usingEncryption: boolean;
    };
    /**
     * Changes the connection state and emits events.
     * @param {string} state - The new state name (e.g., 'ready', 'closed').
     * @param {string} [emitEventAndMessage] - Optional message to emit with the state change event.
     *
     * 주의.
     * 1. 상태가 변경 될 때만 'change' 이벤트 호출된다.
     * 2. emitEventAndMessage 옵션 값이 지정되야 해당 이벤트 이름이 호출된다.
     *   보통 이벤트 이름과 동일하게 적거나 이벤트 상황 안내문을 넣는다.
     */
    stateChange(state: string, emitEventAndMessage?: string): void;
}
type Boho$1 = boho.Boho;
type Buffer$1 = boho.Buffer;

/**
 * Browser WebSocket client extending IOCore.
 * @augments {IOCore}
 */
declare class IO extends IOCore {
    /**
     * The version of the client.
     * @type {string}
     */
    static version: string;
    /**
     * The binary type for WebSocket messages.
     * @type {string}
     */
    static binaryType: string;
    /**
     * The Boho library instance.
     * @type {Boho}
     */
    static Boho: Boho;
    /**
     * The MBP (MessagePack-Boho) instance.
     * @type {MBP}
     */
    static MBP: MBP;
    /**
     * The Buffer class from Boho.
     * @type {Buffer}
     */
    static Buffer: Buffer;
    /**
     * Constants used by the client.
     * @type {object}
     */
    static constants: object;
    /**
     * Tracks the number of IO instances created.
     * @type {number}
     */
    static instanceCount: number;
    /**
     * Tracks the number of WebSocket objects created.
     * @type {number}
     */
    static webSocketCount: number;
    boundBrowserVisiblePing: any;
    /**
     * Pings the server when the browser tab becomes visible.
     */
    browserVisiblePing(): void;
    /**
     * Keeps the connection alive by re-connecting if closed.
     */
    keepConnection(): void;
    /**
     * Creates a new WebSocket connection.
     * @param {string} url - The WebSocket URL to connect to.
     */
    createConnection(url: string): void;
    /**
     * Handles incoming WebSocket messages (arraybuffer type).
     * @param {MessageEvent} event - The WebSocket message event.
     */
    onWebSocketMessage(event: MessageEvent): void;
    /**
     * Handles incoming WebSocket messages (blob type).
     * @param {MessageEvent} event - The WebSocket message event.
     */
    onWebSocketMessageBlob(event: MessageEvent): Promise<void>;
    /**
     * Sends data over the WebSocket.
     * @param {BufferSource} data - The data to send.
     */
    socket_send(data: BufferSource): void;
}
type Boho = boho.Boho;
type MBP = any;
type Buffer = boho.Buffer;

export { IO as default };
export type { Boho, Buffer, MBP };
