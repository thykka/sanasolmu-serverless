console.log(Date.now(), "words.ts imports");

import {} from "dotenv";
import { readFileSync } from "fs";
import Storage from "./storage.js";

console.log(Date.now(), "words.ts");

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

const getStorage = async (language: Language) => {
  return await Storage.initialize(StorageKey + language);
};

export const readWordsFromFile = (language: Language): WordObject[] => {
  const file = readFileSync(`./wordlist/${language}.txt`).toString("utf8");
  return file
    .split("\n")
    .filter((row) => row.length > 0)
    .map((row) => formatWordObject(row, language));
};

export const populateWords = async (language: Language): Promise<number> => {
  const wordList = readWordsFromFile(language);
  const storage = await getStorage(language);
  await Promise.all(
    wordList.map((wordObject) =>
      Storage.saveItem(storage, wordObject.word, wordObject),
    ),
  );
  return Object.keys(wordList).length;
};

export const getAllWords = async (language: Language) => {
  const storage = await getStorage(language);
  const result = await Storage.loadItems(storage);
  if (!Array.isArray(result)) return [];
  return result.map(({ word }) => word);
};

export const getWord = (length: number): string => {
  return "x".repeat(length);
};
