"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
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
            action: 'welcome',
        }));
    }
    onMessage(message) {
        this.ws.send(WsRouter.handle(message));
    }
}
class WsRouter {
    static setBusinessLogic(value) {
        this.businessLogic = value;
    }
    static handle(message) {
        let requestData = this.parseIn(message);
        let responseData;
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
        }
        catch (e) {
            responseData = {
                action: 'error',
                payload: {
                    message: e,
                },
            };
        }
        return this.parseOut(responseData);
    }
    static parseOut(data) {
        let message;
        try {
            if (!data.action) {
                throw 'No signature in response!';
            }
            message = JSON.stringify(data).replace(/[\u007f-\uffff]/g, function (c) {
                return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
            });
        }
        catch (e) {
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
    static parseIn(message) {
        let data;
        try {
            console.log('RECEIVED', message);
            data = JSON.parse(message);
        }
        catch (e) {
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
    constructor(bwwss) {
        this.mapW = 50;
        this.mapH = 20;
        this.avatars = {};
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
    login(name) {
        let avatar = name[0].toUpperCase();
        this.sureAvatar(avatar);
        return {
            action: 'login',
            payload: {
                avatar
            },
        };
    }
    move(avatar, direction) {
        let place = this.avatars[avatar];
        let nextPlace = {};
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
        }
        else {
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
    broadcastMap() {
        this.bwwss.broadcast({
            action: 'map',
            payload: {
                dump: this.getMapDump(),
            },
        });
    }
    getMapDump() {
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
    sureAvatar(avatar) {
        let place = {};
        found: for (let y = 0; y < this.mapH; y++) {
            for (let x = 0; x < this.mapW; x++) {
                if (!place.hasOwnProperty('x')) {
                    if (!this.map[y][x]) {
                        place = { x, y };
                    }
                }
                if (avatar === this.map[y][x]) {
                    place = { x, y };
                    break found;
                }
            }
        }
        this.map[place.y][place.x] = avatar;
        this.avatars[avatar] = place;
        this.broadcastMap();
    }
}
class BewordWebSocketServer {
    constructor() {
        this.wsHttpServer = http.createServer();
        this.handlers = [];
        this.wss = new WebSocket.Server({ "server": this.wsHttpServer });
        WsRouter.setBusinessLogic(new BusinessLogic(this));
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
    broadcast(data) {
        this.wss.clients.forEach(function (ws) {
            ws.send(WsRouter.parseOut(data));
        });
    }
}
exports.BewordWebSocketServer = BewordWebSocketServer;
//# sourceMappingURL=wss.js.map