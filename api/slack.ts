import crypto from "crypto";
import { WebClient } from "@slack/web-api";
import type { VercelRequest, VercelResponse } from "@vercel/node";

if (!process.env.SLACK_SIGNING_SECRET) throw Error("Signing secret not found");
const Slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export const handler = async (req: VercelRequest, res: VercelResponse) => {
  console.log({
    body: req.body,
    headers: req.headers,
    url: req.url,
  });
  const { body } = req;
  if (!body || typeof body === "string") return res.end();
  if (body.type === "url_verification") {
    return res.send(req.body.challenge);
  } else if (body.type === "event_callback") {
    if (isValidSlackRequest(req) && body.event?.type === "message") {
      await Slack.chat.postMessage({
        channel: body.event.channel,
        attachments: null,
        text: "Hello, World!",
      });
      return res.send("OK");
    }
  }
  res.end();
};

const isValidSlackRequest = (req: VercelRequest): boolean => {
  const rawTimestamp = req.headers["x-slack-request-timestamp"];
  if (!rawTimestamp || Array.isArray(rawTimestamp) || rawTimestamp.length < 1) {
    console.log("Invalid timestamp");
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
  const base = `v0:${timestamp}:${req.body}`;
  const hmac = crypto
    .createHmac("sha256", process.env.SLACK_SIGNING_SECRET)
    .update(base)
    .digest("hex");
  const computedSignature = `v0=${hmac}`;
  if (computedSignature !== signature) {
    console.log("Signature doesn't match", computedSignature, signature);
    return false;
  }
  return true;
};

export default handler;
