import {} from "dotenv";
import { readFileSync } from "fs";
import Storage from "./storage.js";

const StorageKey = "words-";
const Languages = ["en", "fi"] as const;
type Language = (typeof Languages)[number];
type WordObject = {
  word: string;
  language: Language;
};

export const parseLanguage = (language: string): Language =>
  Languages.find((l) => l === language) ?? "en";

export const formatWordObject = (
  word: string,
  language: Language,
): WordObject => {
  const wordObj: WordObject = {
    word,
    language,
  };
  return wordObj;
};

const getStorage = (language: Language) => {
  return Storage.create(StorageKey + language);
};

export const readWordsFromFile = (language: Language): string[] => {
  const file = readFileSync(`./wordlist/${language}.txt`).toString("utf8");
  return file.split("\n").filter((row) => row.length > 0);
};

export const populateWords = async (language: Language): Promise<number> => {
  const wordList = readWordsFromFile(language);
  const storage = await getStorage(language);
  await storage.saveWords(wordList);
  return Object.keys(wordList).length;
};

export const getAllWords = async (language: Language) => {
  const storage = await getStorage(language);
  const result = await storage.loadWords();
  if (!Array.isArray(result)) return [];
  return result;
};

export const getWord = async (
  length: number,
  language: Language,
): Promise<string> => {
  const storage = await getStorage(language);
  const words = await storage.loadWords();
  const matchingWords = words.filter((word) => word.length === length);
  const randomIndex = Math.floor(Math.random() * matchingWords.length);
  return matchingWords[randomIndex];
};
