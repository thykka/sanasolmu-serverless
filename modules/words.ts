import {} from "dotenv";
import { readFileSync } from "fs";
import { kv } from "@vercel/kv";

type WordObject = {
  word: string;
};

const getStorage = (language = "en") => `dictionary-${language}`;

export const formatWordForStorage = (word: string, language = "en") => {
  const wordObj = {
    word,
  };
  return wordObj;
};

export const parseLanguage = (language) =>
  ["en", "fi"].find((l) => l === language) ?? "en";

/**
 * split an object into smaller chunks
 */
const partition = (object, maxLength: number): Record<string, WordObject>[] => {
  const partitions = [];
  let currentPartition = {};
  Object.entries(object).forEach(([key, value]) => {
    if (Object.keys(currentPartition).length < maxLength) {
      currentPartition[key] = value;
    } else {
      partitions.push(currentPartition);
      currentPartition = { [key]: value };
    }
  });
  if (Object.keys(currentPartition).length > 0) {
    partitions.push(currentPartition);
  }
  return partitions;
};

export const readWordsFromFile = (language) => {
  const file = readFileSync(`./wordlist/${language}.txt`).toString("utf8");
  return file
    .split("\n")
    .filter((row) => row.length > 0)
    .map((row) => formatWordForStorage(row, language));
};

export const populateWords = async (language = "en"): Promise<number> => {
  const storage = getStorage(language);
  const wordList = readWordsFromFile(language);
  const partitions = partition(wordList, 10000);
  Promise.all(
    partitions.map((wordListPart) =>
      kv.hset(storage, wordListPart).then((v) => console.log(v)),
    ),
  );
  return Object.keys(wordList).length;
};

export const getAllWords = async (language = "en"): Promise<WordObject[]> => {
  return readWordsFromFile(language);
};

export const getWord = (length: number): string => {
  return "wt";
};
