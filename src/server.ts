import * as http from 'http';
import * as WebSocket from 'ws';
import {AddressInfo} from "net";

/**
 *  WS part
 */
class WSE extends WebSocket {
    public isAlive: boolean = true;
}

/**
 * Handle whole wsserver
 */
class BewordWebSocketServer {

    protected wsHttpServer = http.createServer();
    protected wss: WebSocket.Server;
    protected handlers: WsHandler[];

    constructor() {
        this.handlers = [];
        this.wss = new WebSocket.Server({"server": this.wsHttpServer});

        this.wss.on('connection', (ws: WSE) => {
            let handler = new WsHandler(this.wss, ws);

            let index = this.handlers.push(handler);
            let self = this;
            ws.on('close', () => {
                delete self.handlers[index];
            });
        });

        this.wsHttpServer.listen(8666, () => {
            console.log(`WS Server has started on port: ${(<AddressInfo>this.wsHttpServer.address()).port} 👍`);
        });
    }
}

new BewordWebSocketServer();

/**
 * Handle a one web socket client
 */
class WsHandler {

    protected ws: WSE;
    protected wss: WebSocket.Server;

    constructor(wss: WebSocket.Server, ws: WSE) {
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

    protected onMessage(message: string) {
        console.log(`Received: ${message}`);

        const broadCastRegexp = /broadcast\:/;

        if (broadCastRegexp.test(message)) {
            message = message.replace(broadCastRegexp, '');

            this.wss.clients.forEach(client => {
                if (this.ws !== client) {
                    client.send(`Broadcast: ${message}`);
                }
            });

        } else {
            this.ws.send(`Hello, you sent ${message}`);
        }
    }
}

class WsDataRouter {

    constructor() {

    }


}