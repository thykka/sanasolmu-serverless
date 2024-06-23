import { Router } from "express";
import storage from "node-persist";
import {
  parseLanguage,
  getAllWords,
  populateWords,
  getWord,
} from "../modules/words.js";

const router = Router();

router.use((request, response, next) => {
  if (request.query.secret !== process.env.ADMIN_SECRET)
    return response.sendStatus(403);
  const [language] = [request.query.language].flat();
  response.locals.language = parseLanguage(language?.toString() ?? "fi");
  next();
});

router.post("/populate", async (request, response) => {
  const result = await populateWords(response.locals.language);
  return response.json({ success: !!result, result });
});

router.post("/list", async (request, response) => {
  const result = await getAllWords(response.locals.language);
  return response.json({ success: !!result, result });
});

router.post("/sample", async (request, response) => {
  const { length: queryLength } = request.query;
  const length = parseInt(queryLength?.toString() ?? "5", 10);
  const result = await getWord(length, response.locals.language);
  return response.json({ success: !!result, result });
});

router.post("/stats", async (request, response) => {
  const { channel } = request.query;
  const games = storage.getItem(`knot-${channel}`);
  return response.json({ success: !!games, result: games });
});

export default router;
