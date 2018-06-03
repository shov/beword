"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
let app = express();
app.use(express.static('dist/public'));
function runHttpServer() {
    app.listen(8555, () => {
        console.log(`HTTP Server has started on port: 8555 👍`);
    });
}
exports.runHttpServer = runHttpServer;
//# sourceMappingURL=http.js.map