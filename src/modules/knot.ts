import type { WebClient } from "@slack/web-api";
import type { CommandProcessor } from "./commands.js";
import type { Language } from "./words.js";
import {
  Languages,
  DefaultLanguage,
  getWord,
  createHint,
  getWordPoints,
} from "./words.js";
import { getStorage } from "./storage.js";

const DefaultWordLength = 6;
const StorageId = "knot";

const Flags: Record<Language, string> = {
  en: "flag-gb",
  fi: "flag-fi",
  test: "test_tube",
} as const;

type UserScores = {
  points: number;
  words: string[];
};

type GameState = {
  channel: string;
  language: Language;
  answer: string;
  hint: string;
  points: number | undefined;
  usedWords: string[];
  scores: Record<string, UserScores | number | undefined>;
};

const getGameStorage = (channel: string) => {
  return getStorage<GameState>(`${StorageId}-${channel}`);
};

const initState = (): GameState => ({
  channel: "",
  language: DefaultLanguage,
  answer: "",
  hint: "",
  points: 0,
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
    points: getWordPoints(answer),
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
  if (!state.points) state.points = getWordPoints(state.answer);
  if (!state.usedWords) state.usedWords = [];
  if (!state.scores) state.scores = {};
  return state;
};

const getGaussianRandom = (mean: number, stdev: number): number => {
  let [u1, u2] = [0, 0];
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stdev + mean;
};
const mid = (x: number, y: number, z: number): number => {
  const values = [x, y, z];
  return values.sort((a, b) => a - b)[1];
};

const getRandomWordLength = (): number => {
  return mid(3, 15, Math.ceil(getGaussianRandom(6, 1.67)));
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
  const wordLength = !Number.isNaN(parsedLength)
    ? parsedLength
    : DefaultWordLength;
  const language = Languages.includes(languageArg as Language)
    ? (languageArg as Language)
    : DefaultLanguage;

  try {
    const state = await createGame(channel, language, wordLength);
    client.chat.postMessage({
      text: `<@${user}> started a new game: ${formatWord(state.hint, state.points, state.language)}`,
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

const letterize = (input: string | string[]): string => {
  return (
    Array.isArray(input) ? input : [...input]
  ).map((letter) => `\`${letter.toUpperCase()}\``).join(" ");
};

const formatWord = (
  word: string | string[],
  points?: number,
  language?: Language,
): string => {
  return (
    letterize(word) +
    (language ? ` :${Flags[language]}:` : "") +
    (typeof points === "number" ? ` (${points} pts)` : "")
  );
};

const getOrdinal = (input: number): string => {
  const num = Math.abs(input);
  const tens = num % 100;
  if (tens >= 10 && tens <= 20) return "th";
  const last = num % 10;
  if (last === 1) return "st";
  if (last === 2) return "nd";
  if (last === 3) return "rd";
  return "th";
};

const addScore = async (
  state: GameState,
  channel: string,
  user: string,
): Promise<UserScores> => {
  const userScores = state.scores[user];
  const newScores: UserScores = {
    points: 0,
    words: [],
  };
  if (typeof userScores === "undefined") {
    // New player
    newScores.points = state.points;
    newScores.words = [state.answer];
  } else if (typeof userScores === "number") {
    // Player with old data
    newScores.points = userScores + state.points;
    newScores.words = [state.answer];
  } else {
    // Player with new data
    newScores.points = userScores.points + state.points;
    newScores.words = userScores.words.concat(state.answer);
  }
  state.scores[user] = newScores;
  const storage = await getGameStorage(channel);
  storage.save(channel, state);
  return newScores;
};

export const showStats: CommandProcessor["fn"] = async (
  client,
  command,
  channel,
  user,
  timestamp,
) => {
  client.chat.postMessage({
    channel,
    attachments: null,
    text: getUserStats(await getState(channel), channel, user),
  });
};

const getUserStats = (
  state: GameState,
  channel: string,
  user: string
): string => {
  const { words } = state.scores[user];
  if (
    !Array.isArray(words) ||
    words.length === 0
  ) return `hasn't guessed their first knot yet`;
  const averageLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const sortedWords = words.sort((a, b) => b.length - a.length);
  const shortest = sortedWords[0];
  const longest = sortedWords[sortedWords.length - 1];
  const formattedTotal = words.length;
  const formattedAverage = `Average word length: ${Math.round(averageLength * 10) / 10}`;
  const formattedExtremes = [
    `shortest: ${letterize(shortest)} - ${getWordPoints(shortest)}pts`,
    `longest: ${letterize(longest)} - ${getWordPoints(longest)}pts`,
  ].join(", ");
  return `<@${user}> has guessed ${formattedTotal} words. ${formattedAverage} (${formattedExtremes})`;
};

const formatUserGuessCount = (count: number): string => `${newScore.words.length}${getOrdinal(newScore.words.length)}`;

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
    const newScore = await addScore(state, channel, user);
    const guessCount = formatUserGuessCount(newScore.words.length);
    let newState;
    try {
      newState = await createGame(
        channel,
        state.language,
        getRandomWordLength(),
      );
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
        text: `<@${user}> with ${newScore.points} points guessed their ${guessCount} knot: ${formatWord(state.answer)}

New knot: ${formatWord(newState.hint, newState.points, newState.language)}`,
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
