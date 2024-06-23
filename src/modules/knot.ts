import type { WebClient } from "@slack/web-api";
import type { CommandProcessor } from "./commands.js";
import type { Language } from "./words.js";
import { Languages, getWord, createHint } from "./words.js";
import { getStorage } from "./storage.js";

const DefaultWordLength = 6;
const DefaultLanguage: Language = "fi";
const StorageId = "knot";

const Flags: Record<Language, string> = {
  en: "flag-gb",
  fi: "flag-fi",
} as const;

type GameState = {
  channel: string;
  language: Language;
  answer: string;
  hint: string;
  usedWords: string[];
  scores: Record<string, number>;
};

const getGameStorage = (channel: string) => {
  return getStorage<GameState>(`${StorageId}-${channel}`);
};

const initState = (): GameState => ({
  channel: "",
  language: "fi",
  answer: "",
  hint: "",
  usedWords: [],
  scores: {},
});

const createGame = async (
  channel: string,
  language: Language = DefaultLanguage,
  length: number = DefaultWordLength,
): Promise<GameState> => {
  const storage = await getGameStorage(channel);
  const previousState: GameState = (await storage.load(channel)) ?? initState();
  const usedWords = previousState.usedWords ?? [];
  usedWords.push(previousState.answer);
  const answer = await getWord(length, language, usedWords);
  const state = {
    channel,
    language,
    answer,
    hint: createHint(answer),
    usedWords,
    scores: previousState.scores ?? {},
  };
  storage.save(channel, state);
  return state;
};

const resetUsedWords = async (
  client: WebClient,
  channel: string,
): Promise<void> => {
  const storage = await getGameStorage(channel);
  const state = await storage.load(channel);
  await storage.save(channel, {
    ...state,
    usedWords: [],
  });

  await client.chat.postMessage({
    channel,
    attachments: null,
    text: `Used words have been reset :information_source:`,
  });
};

const getState = async (channel: string): Promise<GameState> => {
  const storage = await getGameStorage(channel);
  const state = await storage.load(channel);
  if (!state) throw new Error(`Could not load game: ${channel}`);
  if (!state.usedWords) state.usedWords = [];
  if (!state.scores) state.scores = {};
  return state;
};

export const startGame: CommandProcessor["fn"] = async (
  client,
  command,
  channel,
  user,
  timestamp,
): Promise<void> => {
  let [lengthArg, languageArg] = command.args;
  // optional length argument, argument order doesn't matter
  if (Languages.includes(lengthArg as Language)) {
    [languageArg, lengthArg] = [lengthArg, languageArg];
  }
  const parsedLength = parseInt(lengthArg, 10);
  const wordLength = !Number.isNaN(parsedLength) ? parsedLength : null;
  const language = Languages.includes(languageArg as Language)
    ? (languageArg as Language)
    : null;

  try {
    const state = await createGame(channel, language, wordLength);
    client.chat.postMessage({
      text: `<@${user}> started a new game: ${formatWord(state.hint)} :${Flags[state.language]}:`,
      channel,
      attachments: null,
    });
  } catch (e) {
    // TODO: create proper error types
    if (e.message === "Could not find new words after 1000 attempts") {
      await resetUsedWords(client, channel);
      await startGame(client, command, channel, user, timestamp);
    } else {
      client.chat.postMessage({
        text: `Can't. ${e.message}`,
        channel,
        attachments: null,
      });
    }
  }
};

const formatWord = (word: string | string[]): string => {
  const letters = Array.isArray(word) ? word : [...word];
  return letters.map((letter) => `\`${letter.toUpperCase()}\``).join(" ");
};

const IndexPrefixes = {
  "1": "st",
  "2": "nd",
  "3": "rd",
};

const getPrefixedScore = (score: number): string => {
  const [...digits] = [...Math.round(score).toString(10)];
  const prefix = IndexPrefixes[digits[digits.length - 1]] ?? "th";
  return score + prefix;
};

const addScore = (state: GameState, user: string): number => {
  if (!state.scores[user]) state.scores[user] = 0;
  state.scores[user]++;
  return state.scores[user];
};

export const guessWord: CommandProcessor["fn"] = async (
  client,
  command,
  channel,
  user,
  timestamp,
) => {
  const state = await getState(channel);
  const [guess] = command.args;
  if (guess.length !== state.answer.length) return;
  const sortedGuess = [...guess.toLowerCase()].sort().join("");
  const sortedAnswer = [...state.answer.toLowerCase()].sort().join("");
  if (sortedGuess !== sortedAnswer) return;
  if (guess.toLowerCase() === state.answer.toLowerCase()) {
    const newScore = addScore(state, user);
    const prefixedScore = getPrefixedScore(newScore);
    let newState;
    try {
      newState = await createGame(channel, state.language, state.answer.length);
    } catch (e) {
      if (state.usedWords.length) {
        await resetUsedWords(client, channel);
        await guessWord(client, command, channel, user, timestamp);
        return;
      } else {
        throw new Error(e);
      }
    }

    if (newState) {
      client.reactions.add({
        channel,
        timestamp,
        name: "trophy",
      });
      client.chat.postMessage({
        channel,
        attachments: null,
        text: `<@${user}> guessed their ${prefixedScore} knot ${formatWord(state.answer)}
  
  New knot: ${formatWord(newState.hint)}`,
      });
    }
  } else {
    client.reactions.add({
      channel,
      timestamp,
      name: "x",
    });
  }
};
