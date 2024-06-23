import express, { Application, Request, Response } from "express";
import getRawBody from "raw-body";
import slack from "./routes/slack.js";
import admin from "./routes/admin.js";
import { addCommand } from "./modules/commands.js";
import { guessWord, startGame } from "./modules/knot.js";

const app: Application = express();
const port: number = parseInt(process.env.API_PORT) || 3000;

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

app.listen(port, () => console.log(`Sanasolmu listening to port ${port}`));
