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
const router = Router();

const SlackScopes = [
  "channels:history",
  "chat:write",
  "reactions:write",
  "users:read",
] as const;

const installer = new InstallProvider({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: process.env.SLACK_STATE_SECRET,
  // stateVerification: false,
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

router.get("/install", async (request, response) => {
  await installer.handleInstallPath(
    request,
    response,
    {},
    {
      scopes: [...SlackScopes],
    },
  );
});

router.get("/oauth_redirect", (request: Request, response: Response) => {
  installer.handleCallback(request, response);
});

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
    const client = await getClient(request.body);
    if (!client) throw new Error("Failed to initialize client", request.body);
    // TODO: Should we keep a list of client_msg_id + rawTimestamp, to avoid reacting to dupes?
    // TODO: Should we ignore out-of-sequence messages?
    const { event } = request.body;
    if (!event) return response.sendStatus(400);
    // TODO: Authorize Slack client, pass on to handlers
    if (event.type === "message") {
      if (event.subtype === "channel_join") {
        handleAddChannel(client, event as SlackChannelJoinEvent);
      } else if (typeof event.subtype === "undefined") {
        handleMessage(client, event as SlackMessageEvent);
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

const getClient = async (
  requestBody: Request["body"],
): Promise<WebClient | null> => {
  const { team_id, context_enterprise_id } = requestBody;
  const isEnterpriseInstall = !!context_enterprise_id;
  const installationQuery = {
    isEnterpriseInstall,
    teamId: isEnterpriseInstall ? null : team_id,
    enterpriseId: isEnterpriseInstall ? context_enterprise_id : null,
  };
  const installation =
    await installer.installationStore.fetchInstallation(installationQuery);
  const client = new WebClient(installation.bot.token);
  return client;
};

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

const handleAddChannel = async (
  client: WebClient,
  joinEvent: SlackChannelJoinEvent,
): Promise<void> => {
  console.log("Join", joinEvent);
};

const handleMessage = async (
  client: WebClient,
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

  await processCommand(client, command, channel, user, timestamp);
};

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

console.log(
  `>> https://${process.env.API_HOSTNAME}:${process.env.API_HTTPS_PORT}/slack/install`,
);

export default router;
