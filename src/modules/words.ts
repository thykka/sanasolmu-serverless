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
  used?: string[],
): Promise<string> => {
  const storage = await getWordStorage(language);
  const words = await storage.load(WordStorageKey);
  const matchingWords = words.filter((word) => word.length === length);
  if (matchingWords.length === 0)
    throw new Error(`No words found (${language}/${length})`);
  let word;
  let attempts = 0;
  while ((!word || used.includes(word)) && attempts < 1000) {
    const randomIndex = Math.floor(Math.random() * matchingWords.length);
    word = matchingWords[randomIndex];
    attempts++;
  }
  if (attempts === 1000) {
    throw new Error("Could not find new words after 1000 attempts");
  }
  return word;
};

const shuffle = (items: string[]): string[] => {
  const sortableItems = items.map((item) => ({
    sortValue: Math.random(),
    item,
  }));
  const shuffledItems = sortableItems.sort((a, b) => a.sortValue - b.sortValue);
  return shuffledItems.map((shuffled) => shuffled.item);
};

export const createHint = (word: string): string => {
  let hint: string[] = [...word];
  let attempts = 0;
  while (hint.join("") === word && attempts < 100) {
    hint = shuffle(hint);
    attempts++;
  }
  return hint.join("");
};
