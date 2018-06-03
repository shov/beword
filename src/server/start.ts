import * as wss from "./wss";
import * as httpApp from "./http"

new wss.BewordWebSocketServer();
httpApp.runHttpServer();