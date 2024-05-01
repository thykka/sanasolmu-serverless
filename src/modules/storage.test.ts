import { initialize, loadItem, saveItem } from "./storage.js";

let testStorage;
beforeAll(async () => {
  testStorage = await initialize("tests");
});

describe("Read & Write", () => {
  test("It stores an item", async () => {
    const result = await saveItem(testStorage, "foo", "bar");
    expect(result).toEqual(true);
  });
  test("It reads an item", async () => {
    const result = await loadItem(testStorage, "foo");
    expect(result).toEqual("bar");
  });
});
