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

  it("lists documents and supports sample document creation and comparison", async () => {
    const app = createApp();

    // 1. Initial list should be empty
    const initialList = await request(app).get("/api/documents").expect(200);
    expect(initialList.body.documents).toEqual([]);

    // 2. Load employment sample
    const sampleEmp = await request(app)
      .post("/api/documents/sample")
      .send({ type: "employment" })
      .expect(200);
    expect(sampleEmp.body.documentId).toBeTruthy();
    expect(sampleEmp.body.analysis.clauses.length).toBeGreaterThan(0);

    // 3. Load rental sample
    const sampleRental = await request(app)
      .post("/api/documents/sample")
      .send({ type: "rental" })
      .expect(200);
    expect(sampleRental.body.documentId).toBeTruthy();

    // 4. List documents should have 2 items
    const updatedList = await request(app).get("/api/documents").expect(200);
    expect(updatedList.body.documents.length).toBe(2);

    // 5. Compare the two stored documents
    const comparison = await request(app)
      .post("/api/documents/compare-stored")
      .send({
        documentIdA: sampleEmp.body.documentId,
        documentIdB: sampleRental.body.documentId
      })
      .expect(200);
    expect(comparison.body.fileA).toBe("sample-employment-agreement.txt");
    expect(comparison.body.fileB).toBe("sample-rental-agreement.txt");
    expect(comparison.body.comparison).toBeDefined();

    // 6. Non-existent document ID comparison should 404
    await request(app)
      .post("/api/documents/compare-stored")
      .send({
        documentIdA: sampleEmp.body.documentId,
        documentIdB: "00000000-0000-0000-0000-000000000000"
      })
      .expect(404);
  });
});
