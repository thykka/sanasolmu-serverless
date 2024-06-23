import express, { Application, Request, Response } from "express";
import getRawBody from "raw-body";
import slack from "./routes/slack.js";
import admin from "./routes/admin.js";
import { addCommand } from "./modules/commands.js";
import { guessWord, startGame } from "./modules/knot.js";
import { readFileSync } from "fs";
import http from "http";
import https from "https";

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

app.use((req, res, next) => {
  getRawBody(req, (err, body) => {
    if (err) return next(err);
    const bodyString = body.toString();
    res.locals.rawBody = bodyString;
    try {
      req.body = JSON.parse(bodyString);
    } catch (err) {
      req.body = bodyString;
    }
    next();
  });
});

app.use("/slack", slack);
app.use("/admin", admin);

app.all("*", (req: Request, res: Response) => res.sendStatus(404));

// app.listen(port, () => console.log(`Sanasolmu listening to port ${port}`));

// Test command
addCommand("hello", {
  fn: async (client, command, channel, user) => {
    // TODO: Cache users locally, so we can spare lots of requests
    const response = await client.users.info({ user });
    const { id, name, real_name, team_id, deleted } = response?.user;
    const text = `Hello, ${command.args[0] === "doxx" ? real_name : name}!`;
    await client.chat.postMessage({ channel, text, attachments: null });
  },
});

addCommand("uusi", { fn: startGame });
addCommand("single word", { fn: guessWord });
