import * as http from 'http';
import * as WebSocket from 'ws';
import {AddressInfo} from "net";
import * as fs from "fs";

/**
 *  WS part
 */
class WSE extends WebSocket {
    public isAlive: boolean = true;
}

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
            action: 'welcome',
        }));
    }

    protected onMessage(message: string) {
        this.ws.send(WsRouter.handle(message));
    }
}

class WsRouter {
    protected static businessLogic: BusinessLogic;

    public static setBusinessLogic(value: BusinessLogic) {
        this.businessLogic = value;
    }

    public static handle(message: string): string {
        let requestData = this.parseIn(message);
        let responseData: object;

        try {
            switch (requestData.action) {
                case 'login':
                    responseData = this.businessLogic.login(requestData.payload.avatar);
                    break;
                case 'move':
                    responseData = this.businessLogic.move(requestData.payload.avatar, requestData.payload.direction);
                    break;
                default:
                    throw 'Unknown router';
            }
        } catch (e) {
            responseData = {
                action: 'error',
                payload: {
                    message: e,
                },
            };
        }

        return this.parseOut(responseData);
    }

    public static parseOut(data: object | any): string {
        let message: string;

        try {
            if (!data.action) {
                throw 'No signature in response!';
            }
            message = JSON.stringify(data).replace(/[\u007f-\uffff]/g,
                function (c) {
                    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
                }
            );
        } catch (e) {
            message = JSON.stringify({
                action: 'error',
                payload: {
                    message: 'data json stringify error',
                },
            });
        }
        console.log('SEND', message);
        return message;
    }

    protected static parseIn(message: string): any {
        let data: object;

        try {
            console.log('RECEIVED', message);
            data = JSON.parse(message);
        } catch (e) {
            data = {
                action: 'error',
                payload: {
                    message: 'message json parse error',
                },
            };
        }

        return data;
    }
}


class BusinessLogic {

    protected bwwss: BewordWebSocketServer;
    protected map: string[][];
    protected mapW = 50;
    protected mapH = 20;
    protected avatars: any = {};

    constructor(bwwss: BewordWebSocketServer) {
        let self = this;

        this.bwwss = bwwss;

        this.map = [];

        let strMap = fs.readFileSync('dist/server/map.txt', 'utf-8');
        let lines = strMap.split('\n');

        lines.forEach(function (line, lineNum) {
            if (lineNum >= self.mapH) {
                return;
            }

            self.map[lineNum] = [];
            let chars = line.split('');

            chars.forEach(function (char, charNum) {
                if (charNum >= self.mapW) {
                    return;
                }

                if (!/\s/.test(char)) {
                    self.map[lineNum][charNum] = char;
                }
            });
        });

        for (let y = 0; y < this.mapH; y++) {
            if (!this.map[y]) {
                this.map[y] = [];
            }
        }
    }

    public login(name: string) {
        let avatar = name[0].toUpperCase();

        this.sureAvatar(avatar);

        return {
            action: 'login',
            payload: {
                avatar
            },
        };
    }

    public move(avatar: string, direction: string) {
        let place: any = this.avatars[avatar];
        let nextPlace: any = {};
        Object.assign(nextPlace, place);
        let ok = false;

        switch (direction) {
            case 'up':
                nextPlace.y = place.y - 1;
                if (nextPlace.y < 0) {
                    nextPlace.y = this.mapH + nextPlace.y;
                }
                break;
            case 'down':
                nextPlace.y = (place.y + 1) % this.mapH;
                break;
            case 'right':
                nextPlace.x = (place.x + 1) % this.mapW;
                break;
            case 'left':
                nextPlace.x = place.x - 1;
                if (nextPlace.x < 0) {
                    nextPlace.x = this.mapW + nextPlace.x;
                }
                break;
            default:
                return {
                    action: 'error',
                    payload: {
                        message: 'Unknown direction',
                    },
                };
        }

        if (!this.map[nextPlace.y][nextPlace.x]) {
            delete this.map[place.y][place.x];
            this.map[nextPlace.y][nextPlace.x] = avatar;
            this.avatars[avatar] = nextPlace;

        } else {
            ok = false;
        }

        this.broadcastMap();

        return {
            action: 'move',
            payload: {
                ok,
            },
        };
    }

    protected broadcastMap() {

        this.bwwss.broadcast({
            action: 'map',
            payload: {
                dump: this.getMapDump(),
            },
        });
    }

    protected getMapDump() {
        let self = this;

        return this.map
            .map(function (line) {
                let resultLine = [];
                for (let wi = 0; wi <= self.mapW; wi++) {
                    if (!line[wi]) {
                        resultLine[wi] = ' ';
                        continue;
                    }

                    resultLine[wi] = line[wi];
                }
                return resultLine.join('');
            })
            .join('\n');
    }

    protected sureAvatar(avatar: string) {
        let place: any = {};

        found:
            for (let y = 0; y < this.mapH; y++) {
                for (let x = 0; x < this.mapW; x++) {

                    if (!place.hasOwnProperty('x')) {
                        if (!this.map[y][x]) {
                            place = {x, y}
                        }
                    }

                    if (avatar === this.map[y][x]) {
                        place = {x, y};
                        break found;
                    }
                }
            }

        this.map[place.y][place.x] = avatar;
        this.avatars[avatar] = place;
        this.broadcastMap();
    }

}

export class BewordWebSocketServer {

    protected wsHttpServer = http.createServer();
    protected wss: WebSocket.Server;
    protected handlers: WsHandler[];

    constructor() {
        this.handlers = [];
        this.wss = new WebSocket.Server({"server": this.wsHttpServer});

        WsRouter.setBusinessLogic(new BusinessLogic(this));

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

    public broadcast(data: object) {
        this.wss.clients.forEach(function (ws: WebSocket) {
            ws.send(WsRouter.parseOut(data));
        });
    }
}