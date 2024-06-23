import type { CommandProcessor } from "./commands.js";
import type { Language } from "./words.js";
import { Languages, getWord, createHint } from "./words.js";
import { getStorage } from "./storage.js";

const StorageId = "knot";

type GameState = {
  channel: string;
  language: Language;
  answer: string;
  hint: string[];
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
  const wordLength = length ?? previousState?.answer?.length ?? 6;
  const language = lang ?? previousState?.language ?? "fi";
  const answer = await getWord(wordLength, language);
  const hint = createHint(answer);
  const state = {
    channel,
    language,
    answer,
    hint,
  };
  storage.save(channel, state);
  return state;
};

const getState = async (channel: string): Promise<GameState> => {
  const storage = await getGameStorage(channel);
  const state = await storage.load(channel);
  if (!state) throw new Error(`Could not load game: ${channel}`);
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

  const state = await createGame(channel, language, wordLength);
  client.chat.postMessage({
    text: `<@${user}> started a new game: ${state.hint.map((letter) => `\`${letter}\``).join(" ")} :flag-${state.language}:`,
    channel,
    attachments: null,
  });
};

export const guessWord: CommandProcessor["fn"] = async (
  client,
  command,
  channel,
  user,
  timestamp,
) => {
  const state = await getState(channel);
  const guess = command.type;
  if (guess === state.answer) {
    client.chat.postMessage({
      channel,
      attachments: null,
      text: `<${user}> guessed the word "${state.answer}"!`,
    });
  } else {
    client.reactions.add({
      channel,
      timestamp,
      name: "",
    });
  }
};
