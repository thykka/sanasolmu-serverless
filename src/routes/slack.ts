import crypto, { sign } from "crypto";
import { WebClient } from "@slack/web-api";
import { Router, Request, Response } from "express";

const Slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const router = Router();

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
  elements: Array<SlackTextElement | SlackUserElement | unknown>;
};
type SlackMessageBlock = {
  type: "rich_text";
  block_id: string;
  elements: Array<RichTextElement | unknown>;
};
type SlackMessageEvent = {
  user: string;
  channel: string;
  blocks: Array<SlackMessageBlock | unknown>;
};

const handleMessage = async (messageEvent: SlackMessageEvent) => {
  const { user, channel, blocks } = messageEvent;
  const [firstBlock] = blocks ?? [];
  // We're only interested in normal messages
  if ((firstBlock as SlackMessageBlock)?.type !== "rich_text") return;
  const messageBlock = firstBlock as SlackMessageBlock;
  // All commands should require just one block
  console.log(JSON.stringify(messageEvent, null, 2));
  // For debugging purposes..
  if (user !== "U06U64WEUQN") return;
  const message = "pong";
  await Slack.chat.postMessage({
    channel,
    text: message,
    attachments: null,
  });
};

router.post("/", async (request: Request, response: Response) => {
  if (request.body.type === "url_verification") {
    console.log("Slack URL verification", request.body.challenge);
    return response.send(request.body.challenge);
  } else if (request.body.type === "event_callback") {
    if (
      !(await isValidSlackRequest(request)) &&
      process.env.MODE !== "development"
    ) {
      console.warn("Request failed signature check");
      return response.sendStatus(400);
    }
    // TODO: Should we keep a list of client_msg_id + rawTimestamp, to avoid reacting to dupes?
    if (request.body.event?.type === "message") {
      handleMessage(request.body.event);
      return response.send("OK");
    }
    console.warn("Unknown event type", request.body.event);
    return response.send("OK");
  }
  console.log("Unknown request type", request.body);
  response.sendStatus(400);
});

const isValidSlackRequest = async (req: Request): Promise<boolean> => {
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
  const base = `v0:${timestamp}:${req.text}`;
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
