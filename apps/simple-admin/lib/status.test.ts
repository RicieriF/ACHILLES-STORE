import { describe, expect, it } from "vitest";
const human = (status: string) =>
  ({ published: "NA VITRINE", draft: "RASCUNHO", paused: "PAUSADO" })[status] ??
  "PRECISA COMPLETAR";
describe("simple operator labels", () => {
  it("never exposes internal product status codes", () => {
    expect(human("published")).toBe("NA VITRINE");
    expect(human("draft")).toBe("RASCUNHO");
  });
});
