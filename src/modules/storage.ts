import storage, { LocalStorage } from "node-persist";

export type WordStorage = {
  client: LocalStorage;
  saveWords: (words: string[]) => Promise<void>;
  loadWords: () => Promise<string[]>;
};

export const create = async (storeId: string): Promise<WordStorage> => {
  if (!storeId) throw Error("Expected argument: storeId");
  const client = storage.create({
    dir: `storage/${storeId}`,
    writeQueue: false,
    ttl: false,
    expiredInterval: 0,
  });
  await client.init();
  return {
    client,
    saveWords: (words) => saveWords(client, words),
    loadWords: () => loadWords(client),
  };
};

export const saveWords = async (
  store: LocalStorage,
  words: string[],
): Promise<void> => {
  await store.setItem("words", words);
};

export const loadWords = async (store: LocalStorage): Promise<string[]> => {
  const result = await store.getItem("words");
  return Array.isArray(result) ? result : [];
};

export default {
  create,
  saveWords,
  loadWords,
};
