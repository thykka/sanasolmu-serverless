import { readFileSync } from "fs";
import { getStorage } from "./storage.js";

const StorageId = "words";
const WordStorageKey = "words";
export const Languages = ["en", "fi"] as const;
export type Language = (typeof Languages)[number];

export const parseLanguage = (language: string): Language =>
  Languages.find((l) => l === language) ?? "en";

export const formatWordItem = (word: string, language: Language): string => {
  return word.toLowerCase();
};

const getWordStorage = async (language: Language) => {
  const storage = await getStorage<string[]>(`${StorageId}-${language}`);
  if (!storage) throw new Error(`Words for ${language} not found`);
  return storage;
};

export const populateWords = async (language: Language): Promise<number> => {
  const wordList = readWordsFromFile(language);
  const storage = await getWordStorage(language);
  await storage.save(WordStorageKey, wordList);
  return Object.keys(wordList).length;
};

export const readWordsFromFile = (language: Language): string[] => {
  const file = readFileSync(`./wordlist/${language}.txt`).toString("utf8");
  return file.split("\n").filter((row) => row.length > 0);
};

export const getAllWords = async (language: Language): Promise<string[]> => {
  const storage = await getWordStorage(language);
  const result = await storage.load(WordStorageKey);
  if (!Array.isArray(result)) return [];
  return result;
};

export const getWord = async (
  length: number,
  language: Language,
): Promise<string> => {
  const storage = await getWordStorage(language);
  const words = await storage.load(WordStorageKey);
  const matchingWords = words.filter((word) => word.length === length);
  if (matchingWords.length === 0)
    throw new Error(`No words found (${language}/${length})`);
  const randomIndex = Math.floor(Math.random() * matchingWords.length);
  return matchingWords[randomIndex];
};

const shuffle = (items: string[]): string[] => {
  const sortableItems = items.map((item) => ({
    sortValue: Math.random(),
    item,
  }));
  const shuffledItems = sortableItems.sort((a, b) => a.sortValue - b.sortValue);
  return shuffledItems.map((shuffled) => shuffled.item);
};

export const createHint = (word: string): string[] => {
  let hint = [...word];
  let attempts = 0;
  while (hint.join("") === word && attempts < 100) {
    hint = shuffle(hint);
    attempts++;
  }
  return hint;
};
