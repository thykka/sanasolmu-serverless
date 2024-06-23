import crypto from "crypto";
import { WebClient } from "@slack/web-api";
import type { Request, Response } from "express";
import { Router } from "express";
import { parseCommand, processCommand } from "../modules/commands.js";
import { getStorage } from "../modules/storage.js";

import { InstallProvider, Installation, InstallationQuery } from "@slack/oauth";

type SlackUserElement = {
  type: "user";
  user_id: string;
};
type SlackTextElement = {
  type: "text";
  text: string;
};
type RichTextElement = {
  type: "rich_text_section";
  elements?: Array<SlackTextElement | SlackUserElement | unknown>;
};
type SlackMessageBlock = {
  type: "rich_text";
  block_id: string;
  elements?: Array<RichTextElement | unknown>;
};
type SlackEventCommon = {
  ts: string;
  event_ts: string;
  type: string;
  user?: string;
  bot_id?: string;
  app_id?: string;
  channel?: string;
  subtype?: string;
  channel_type?: string;
  team?: string;
};
type SlackMessageEvent = SlackEventCommon & {
  text: string;
  blocks?: Array<SlackMessageBlock | unknown>;
};
type SlackChannelJoinEvent = SlackEventCommon & {
  subtype: "channel_join";
};

const InstallationStorageKey = "slack-installs";
const Slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const router = Router();

const getInstallationId = (
  installation: Installation | InstallationQuery<boolean>,
) => {
  if (installation.isEnterpriseInstall) {
    return (
      (installation as Installation)?.enterprise?.id ??
      (installation as InstallationQuery<true>)?.enterpriseId
    );
  }
  return (
    (installation as Installation)?.team?.id ??
    (installation as InstallationQuery<false>).teamId
  );
};
const installer = new InstallProvider({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  // stateSecret: process.env.SLACK_STATE_SECRET,
  installationStore: {
    storeInstallation: async (installation) => {
      const id = getInstallationId(installation);
      const storage = await getStorage<Installation | undefined>(
        InstallationStorageKey,
      );
      await storage.save(id, installation);
      return;
    },
    fetchInstallation: async (installQuery) => {
      const id = getInstallationId(installQuery);
      const storage = await getStorage<Installation | undefined>(
        InstallationStorageKey,
      );
      const installation = await storage.load(id);
      return installation;
    },
    deleteInstallation: async (installQuery) => {
      const id = getInstallationId(installQuery);
      const storage = await getStorage<Installation | undefined>(
        InstallationStorageKey,
      );
      await storage.client.removeItem(id);
      return;
    },
  },
});
const installUrl = await installer.generateInstallUrl({
  scopes: ["channels:history", "chat:write", "reactions:write", "users:read"],
  redirectUri: `https://${process.env.API_HOSTNAME}:${process.env.API_HTTPS_PORT}/slack/oauth_redirect`,
});
router.get("/oauth_redirect", (request: Request, response: Response) => {
  const headers = { ["Content-Type"]: "text/html; charset=utf-8" };
  installer.handleCallback(request, response, {
    success: (installation, installOptions, req, res) => {
      console.log({ installation, installOptions });
      res.writeHead(200, headers);
      res.end(`<html><body><h1>Success</h1></body></html>`);
    },
    failure: (error, installOptions, req, res) => {
      console.log({ error, installOptions });
      res.writeHead(500, headers);
      res.end(`<html><body><h1>Installation failed</h1></body></html>`);
    },
  });
});

console.log(`Slack install URL: ${installUrl}`);

const handleAddChannel = async (
  joinEvent: SlackChannelJoinEvent,
): Promise<void> => {
  console.log("Join", joinEvent);
};

const handleMessage = async (
  messageEvent: SlackMessageEvent,
): Promise<void> => {
  const {
    user,
    channel,
    blocks,
    bot_id,
    app_id,
    text,
    ts: timestamp,
    subtype,
  } = messageEvent;
  console.log("Message", messageEvent);
  // We're not interested in any bot messages (prevents infinite loop)
  if (bot_id || app_id) return;
  const [firstBlock] = blocks ?? [];
  // We're only interested in normal messages
  if ((firstBlock as SlackMessageBlock)?.type !== "rich_text") return;
  // Ignore long messages
  if (text.length >= 256) return;

  const command = parseCommand(text);
  if (!command) return;
  await processCommand(Slack, command, channel, user, timestamp);
};

router.post("/", async (request: Request, response: Response) => {
  const bodyType = request.body?.type;
  if (bodyType === "url_verification") {
    const { challenge } = request.body ?? { challenge: ":)" };
    console.log("Slack URL verification", challenge);
    return response.send(challenge);
  } else if (bodyType === "event_callback") {
    if (!(await isValidSlackRequest(request, response.locals.rawBody))) {
      console.warn("Request failed signature check");
      return response.sendStatus(400);
    }
    // TODO: Should we keep a list of client_msg_id + rawTimestamp, to avoid reacting to dupes?
    // TODO: Should we ignore out-of-sequence messages?
    const { event } = request.body;
    if (!event) return response.sendStatus(400);
    if (event.type === "message") {
      if (event.subtype === "channel_join") {
        handleAddChannel(event as SlackChannelJoinEvent);
      } else if (typeof event.subtype === "undefined") {
        handleMessage(event as SlackMessageEvent);
      } else {
        // Unknown/irrelevant message type
      }
      return response.send("OK");
    }
    console.warn("Unknown event type", event);
    return response.send("OK");
  }
  console.log("Unknown request type", request.body);
  response.sendStatus(400);
});

const isValidSlackRequest = async (req: Request, rawBody): Promise<boolean> => {
  const rawTimestamp = req.headers["x-slack-request-timestamp"];
  console.log({ rawTimestamp });
  if (!rawTimestamp || Array.isArray(rawTimestamp) || rawTimestamp.length < 1) {
    console.log("Invalid timestamp", (Date.now() / 1000) | 0);
    return false;
  }
  const timestamp = parseInt(rawTimestamp, 10);
  const signature = req.headers["x-slack-signature"];
  if (!timestamp || !signature) {
    console.log("Timestamp or signature missing");
    return false;
  }
  const age = Date.now() / 1000 - timestamp;
  if (age >= 60 * 5) {
    console.log("Message is too old");
    return false;
  }
  // .text is added in middleware
  const base = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", process.env.SLACK_SIGNING_SECRET)
    .update(base)
    .digest("hex");
  const computedSignature = `v0=${hmac}`;
  if (computedSignature !== signature) {
    console.log("Signature doesn't match");
    return false;
  }
  return true;
};

export default router;
