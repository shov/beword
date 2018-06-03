"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wss = require("./wss");
const httpApp = require("./http");
new wss.BewordWebSocketServer();
httpApp.runHttpServer();
//# sourceMappingURL=start.js.map