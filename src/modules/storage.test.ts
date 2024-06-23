import { createWords } from "./storage.js";

let testStorage;
beforeAll(async () => {
  testStorage = await createWords("tests");
});

describe("Read & Write", () => {
  test("It throws without store ID argument", async () => {
    await expect(async () => {
      await createWords(undefined);
    }).rejects.toThrow();
  });
  test("It stores an item", async () => {
    await testStorage.saveWords(["foo", "bar"]);
  });
  test("It reads an item", async () => {
    const result = await testStorage.loadWords();
    expect(result).toEqual(["foo", "bar"]);
  });
});
