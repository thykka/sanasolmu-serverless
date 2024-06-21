import { getWord } from "./words.js";

describe("getWord", () => {
  it("should return a word of given length", async () => {
    const result = await getWord(5, "en");
    expect(result.length).toEqual(5);
  });
});
