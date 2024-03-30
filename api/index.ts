import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseLanguage, getAllWords, populateWords } from "../modules/words.js";

export const processRequest = (body) => {
  return "ok";
};

export const handler = async (req: VercelRequest, res: VercelResponse) => {
  const language = parseLanguage(req.query.language);
  const instanceKey = req.query.instance;
  if (!instanceKey)
    return res.json({
      success: false,
      error: "Expected instance key as parameter",
    });
  const result = processRequest(req.body);
  return res.json({ success: true, result });
};

export default handler;
