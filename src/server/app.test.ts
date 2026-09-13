import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { clearDocumentsForTests } from "./storage/documentStore";

describe("documents API", () => {
  afterEach(() => clearDocumentsForTests());

  it("analyzes a text legal document and answers with evidence", async () => {
    const app = createApp();
    const upload = await request(app)
      .post("/api/documents/analyze")
      .attach("document", Buffer.from("SERVICE AGREEMENT\n\nThe Client shall pay a monthly fee. Either party may terminate this Agreement with 30 days notice. Liability is limited to fees paid."), {
        filename: "service-agreement.txt",
        contentType: "text/plain"
      })
      .expect(200);

    expect(upload.body.analysis.summary).toBeTruthy();
    expect(upload.body.analysis.attentionItems.length).toBeGreaterThan(0);

    const answer = await request(app)
      .post(`/api/documents/${upload.body.documentId}/question`)
      .send({ question: "How much notice is needed to terminate?" })
      .expect(200);

    expect(answer.body.answer.evidence.length).toBeGreaterThan(0);
  });

  it("rejects invalid document IDs", async () => {
    await request(createApp())
      .post("/api/documents/not-a-uuid/question")
      .send({ question: "Can I terminate?" })
      .expect(400);
  });
});
