import storage, { LocalStorage } from "node-persist";

export type Storage<T> = {
  id: string;
  client: LocalStorage;
  save: (key: string, data: T) => Promise<void>;
  load: (key: string) => Promise<T>;
};

export const getStorage = async <T>(
  storageId: string,
  ttl: number | boolean = false,
): Promise<Storage<T>> => {
  if (!storageId) throw Error("No storageId provided");
  const client = storage.create({
    dir: `storage/${storageId}`,
    writeQueue: false,
    ttl,
    expiredInterval: 0,
  });
  await client.init();
  return {
    id: storageId,
    client,
    save: (key, data: T) => saveData(client, key, data),
    load: (key): Promise<T> => loadData(client, key),
  };
};
const saveData = async <T>(
  client: LocalStorage,
  key: string,
  data: T,
): Promise<void> => {
  await client.setItem(key, data);
};
const loadData = async <T>(
  client: LocalStorage,
  key: string,
): Promise<T | undefined> => {
  return await client.getItem(key);
};
