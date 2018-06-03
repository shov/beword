import * as express from "express";

let app = express();

app.use(express.static('dist/public'));

export function runHttpServer() {
    app.listen(8555, () => {
        console.log(`HTTP Server has started on port: 8555 👍`);
    });
}