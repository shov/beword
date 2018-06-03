"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const WebSocket = require("ws");
/**
 *  WS part
 */
class WSE extends WebSocket {
    constructor() {
        super(...arguments);
        this.isAlive = true;
    }
}
/**
 * Handle whole wsserver
 */
class BewordWebSocketServer {
    constructor() {
        this.wsHttpServer = http.createServer();
        this.handlers = [];
        this.wss = new WebSocket.Server({ "server": this.wsHttpServer });
        this.wss.on('connection', (ws) => {
            let handler = new WsHandler(this.wss, ws);
            let index = this.handlers.push(handler);
            let self = this;
            ws.on('close', () => {
                delete self.handlers[index];
            });
        });
        this.wsHttpServer.listen(8666, () => {
            console.log(`WS Server has started on port: ${this.wsHttpServer.address().port} 👍`);
        });
    }
}
new BewordWebSocketServer();
/**
 * Handle a one web socket client
 */
class WsHandler {
    constructor(wss, ws) {
        this.wss = wss;
        this.ws = ws;
        ws.on('message', this.onMessage.bind(this));
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });
        ws.send(JSON.stringify({
            welcome: 1,
        }));
    }
    onMessage(message) {
        console.log(`Received: ${message}`);
        const broadCastRegexp = /broadcast\:/;
        if (broadCastRegexp.test(message)) {
            message = message.replace(broadCastRegexp, '');
            this.wss.clients.forEach(client => {
                if (this.ws !== client) {
                    client.send(`Broadcast: ${message}`);
                }
            });
        }
        else {
            this.ws.send(`Hello, you sent ${message}`);
        }
    }
}
class WsDataRouter {
    constructor() {
    }
}
//# sourceMappingURL=server.js.map