import { describe, expect, it } from "vitest";
import { chunkDocument } from "./chunk";

describe("chunkDocument", () => {
  it("creates usable chunks with section labels", () => {
    const chunks = chunkDocument("doc-1", "1. Termination\n\nEither party may terminate with 30 days notice. Payment is due monthly.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].section).toContain("Termination");
    expect(chunks[0].text).toContain("30 days notice");
  });

  it("returns no chunks for empty text", () => {
    expect(chunkDocument("doc-1", "   ")).toEqual([]);
  });
});
