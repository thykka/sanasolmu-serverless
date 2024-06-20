import { Router, Request, Response } from "express";
import { parseLanguage, getAllWords, populateWords } from "../modules/words.js";

const router = Router();

router.use((request, response, next) => {
  if (request.query.secret !== process.env.ADMIN_SECRET)
    return response.sendStatus(403);
  const [language] = [request.query.language].flat();
  response.locals.language = parseLanguage(language.toString());
  next();
});

router.post("/populate", async (request, response: Response) => {
  const result = await populateWords(response.locals.language);
  return response.json({ success: true, result });
});

router.post("/list", async (request, response: Response) => {
  const result = await getAllWords(response.locals.language);
  return response.json({
    success: !!result,
    result,
  });
});

export default router;
