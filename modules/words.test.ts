import { getWord } from "./words.js";

describe("getWord", () => {
  it("should return a word of given length", () => {
    expect(getWord(5).length).toEqual(5);
  });
});
