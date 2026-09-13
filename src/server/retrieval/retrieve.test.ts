import { describe, expect, it } from "vitest";
import { retrieveRelevantChunks } from "./retrieve";

describe("retrieveRelevantChunks", () => {
  it("finds evidence related to a user question", () => {
    const chunks = [
      { id: "a", documentId: "doc", text: "Payment is due within 10 days.", section: "Payment" },
      { id: "b", documentId: "doc", text: "The contract renews automatically each year.", section: "Renewal" }
    ];
    expect(retrieveRelevantChunks(chunks, "Does this automatically renew?", 1)[0].id).toBe("b");
  });
});
