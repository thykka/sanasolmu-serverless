console.log(Date.now(), "storage.ts imports");

import storage, { FilterFunction, LocalStorage, Datum } from "node-persist";

console.log(Date.now(), "storage.ts");

export const initialize = async (storeId: string): Promise<LocalStorage> => {
  if (!storeId) throw Error("Expected argument: storeId");
  const myStorage = storage.create({
    dir: `storage/${storeId}`,
    writeQueue: false,
  });
  await myStorage.init();
  return myStorage;
};

export const saveItem = async (
  store: LocalStorage,
  key: string,
  item: unknown,
): Promise<void> => {
  await store.setItem(key, item);
  return;
};

export const loadItem = async (
  store: LocalStorage,
  key: string,
): Promise<unknown> => {
  const result = await store.getItem(key);
  return result;
};

export const loadItems = async (
  store: LocalStorage,
  filter?: FilterFunction<Datum>,
): Promise<unknown> => {
  return await store.values(
    filter ? (value, index, array) => filter(value, index, array) : undefined,
  );
};

export default {
  initialize,
  saveItem,
  loadItem,
  loadItems,
};
