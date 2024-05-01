import { Router, Request, Response } from "express";
import { parseLanguage, getAllWords, populateWords } from "../modules/words.js";

const router = Router();

router.use((request, response, next) => {
  request.authenticated = request.query.secret === process.env.ADMIN_SECRET;
  if (!request.authenticated) return response.sendStatus(403);
  request.language = parseLanguage([request.query.language].flat()[0]);
  next();
});

router.post("/populate", async (request: Request, response: Response) => {
  const result = await populateWords(request.language);
  return response.json({ success: true, result });
});

router.post("/list", async (request: Request, response: Response) => {
  const result = await getAllWords(request.language);
  return response.json({
    success: !!result,
    result,
  });
});

export default router;
