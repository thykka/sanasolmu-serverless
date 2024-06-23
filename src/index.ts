import express, { Application, Request, Response } from "express";
import getRawBody from "raw-body";
import slack from "./routes/slack.js";
import admin from "./routes/admin.js";
import { addCommand } from "./modules/commands.js";
import { guessWord, startGame } from "./modules/knot.js";
import { readFileSync } from "fs";
import http from "http";
import https from "https";
import path from "path";

const app: Application = express();
const httpPort = parseInt(process.env.API_HTTP_PORT) || 80;
const httpsPort = parseInt(process.env.API_HTTPS_PORT) || 443;

try {
  const credentials = { key: "", cert: "", ca: "" };
  credentials.key = readFileSync(process.env.HTTPS_KEY_FILE, "utf-8");
  credentials.cert = readFileSync(process.env.HTTPS_CERT_FILE, "utf-8");
  credentials.ca = readFileSync(process.env.HTTPS_CHAIN_FILE, "utf-8");
  const httpsServer = https.createServer(credentials, app);
  httpsServer.listen(httpsPort, () => {
    console.log(`https ready https://sanasolmu.dy.fi:${httpsPort}/`);
  });
} catch (e) {
  console.error("Could not start HTTPS server", e);
}

const httpServer = http.createServer(app);
httpServer.listen(httpPort, () => {
  console.log(`http ready http://sanasolmu.dy.fi:${httpPort}/`);
});

app.use((request: Request, response: Response, next) => {
  getRawBody(request, (err, body) => {
    if (err) return next(err);
    const bodyString = body.toString();
    response.locals.rawBody = bodyString;
    try {
      request.body = JSON.parse(bodyString);
    } catch (err) {
      request.body = bodyString;
    }
    next();
  });
});

app.use("/slack", slack);
app.use("/admin", admin);

app.use(express.static("static"));

app.all("*", (req: Request, res: Response) => res.sendStatus(404));

addCommand("knot", { fn: startGame });
addCommand("solmu", { fn: startGame });
addCommand("single word", { fn: guessWord });
