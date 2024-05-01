console.log(Date.now(), "admin.ts imports");

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseLanguage, getAllWords, populateWords } from "../modules/words.js";

console.log(Date.now(), "admin.ts");

export const handler = async (req: VercelRequest, res: VercelResponse) => {
  const secret = "xxx";
  if (req.query.key !== secret)
    return res.json({ error: "Not authenticated." });

  const language = parseLanguage([req.query.language].flat()[0]);
  console.log(Date.now(), "cmd", req.query.cmd);
  switch (req.query.cmd) {
    case "populate": {
      const result = await populateWords(language);
      return res.json({ success: true, result });
    }
    case "list": {
      return res.json({ success: true, result: await getAllWords(language) });
    }
    default: {
      return res.json({ success: false, error: "Unknown command." });
    }
  }
};

export default handler;
