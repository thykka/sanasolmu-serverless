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

const createGame = async (
  channel: string,
  lang?: Language,
  length?: number,
): Promise<GameState> => {
  const storage = await getGameStorage(channel);
  const previousState = await storage.load(channel);
  const wordLength =
    length ?? previousState?.answer?.length ?? DefaultWordLength;
  const language = lang ?? previousState?.language ?? DefaultLanguage;
  const usedWords = previousState.usedWords ?? [];
  usedWords.push(previousState.answer);
  const answer = await getWord(wordLength, language, usedWords);
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
    client.chat.postMessage({
      text: `Can't. ${e.message}`,
      channel,
      attachments: null,
    });
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
    client.reactions.add({
      channel,
      timestamp,
      name: "trophy",
    });
    try {
      const newState = await createGame(
        channel,
        state.language,
        state.answer.length,
      );
      client.chat.postMessage({
        channel,
        attachments: null,
        text: `<@${user}> guessed their ${prefixedScore} knot ${formatWord(state.answer)}

  New knot: ${formatWord(newState.hint)}`,
      });
    } catch (e) {
      client.chat.postMessage({
        channel,
        attachments: null,
        text: `Couldn't create new game: ${e.message}`,
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
