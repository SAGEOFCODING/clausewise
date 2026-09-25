const BASE_URL = "https://clausewise-virid.vercel.app";

async function testEndpoint(name, fn) {
  try {
    process.stdout.write(`Testing: ${name}... `);
    const start = Date.now();
    await fn();
    const duration = Date.now() - start;
    console.log(`PASSED (${duration}ms)`);
    return true;
  } catch (err) {
    console.log(`FAILED!`);
    console.error(`  Error: ${err.message}`);
    if (err.response) {
      console.error(`  Status: ${err.status}`);
      console.error(`  Body: ${err.body}`);
    }
    return false;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}: ${text}`);
    error.status = res.status;
    error.body = text;
    error.response = res;
    throw error;
  }
  return json || text;
}

async function run() {
  console.log(`=== STARTING LIVE END-TO-END VERIFICATION: ${BASE_URL} ===\n`);
  let docId = null;
  let rentalDocId = null;

  // 1. Health check
  await testEndpoint("GET /api/health", async () => {
    const data = await request("/api/health");
    if (!data.ok || !data.name) throw new Error("Invalid health response");
  });

  // 2. Direct /api check
  await testEndpoint("GET /api", async () => {
    const data = await request("/api");
    if (!data.ok) throw new Error("Expected ok: true");
  });

  // 3. Initial documents list
  await testEndpoint("GET /api/documents", async () => {
    const data = await request("/api/documents");
    if (!Array.isArray(data.documents)) throw new Error("Expected documents array");
  });

  // 4. Create sample employment document
  await testEndpoint("POST /api/documents/sample (employment)", async () => {
    const data = await request("/api/documents/sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "employment" }),
    });
    if (!data.documentId || !data.analysis) throw new Error("Missing documentId or analysis");
    docId = data.documentId;
    if (!data.analysis.overview || !data.analysis.attentionItems) throw new Error("Missing analysis fields");
  });

  // 5. Create sample rental document
  await testEndpoint("POST /api/documents/sample (rental)", async () => {
    const data = await request("/api/documents/sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "rental" }),
    });
    if (!data.documentId || !data.analysis) throw new Error("Missing rental documentId");
    rentalDocId = data.documentId;
  });

  // 6. Verify stored documents list contains new docs
  await testEndpoint("GET /api/documents (should list created documents)", async () => {
    const data = await request("/api/documents");
    if (!data.documents.some((d) => d.id === docId)) {
      throw new Error(`Document ${docId} not found in stored documents`);
    }
  });

  // 7. Get specific document details
  await testEndpoint(`GET /api/documents/${docId}`, async () => {
    const data = await request(`/api/documents/${docId}`);
    if (data.id !== docId || !data.analysis) throw new Error("Document details mismatch");
  });

  // 8. Ask grounded question
  await testEndpoint(`POST /api/documents/${docId}/questions`, async () => {
    const data = await request(`/api/documents/${docId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the non-compete duration and compensation?" }),
    });
    if (!data.answer || !Array.isArray(data.citations)) {
      throw new Error("Missing answer or citations in question response");
    }
  });

  // 9. Simplify clause
  await testEndpoint(`POST /api/documents/${docId}/simplify`, async () => {
    const data = await request(`/api/documents/${docId}/simplify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clauseText: "Employee agrees that during employment and for 24 months following termination, Employee shall not directly or indirectly compete.",
      }),
    });
    if (!data.simplifiedText || !Array.isArray(data.keyPoints)) {
      throw new Error("Missing simplifiedText or keyPoints");
    }
  });

  // 10. Lawyer prep checklist
  await testEndpoint(`POST /api/documents/${docId}/prep`, async () => {
    const data = await request(`/api/documents/${docId}/prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goals: "Review intellectual property assignment and non-compete enforceability" }),
    });
    if (!Array.isArray(data.questionsForLawyer) || !Array.isArray(data.redFlagsToClarify)) {
      throw new Error("Missing questionsForLawyer or redFlagsToClarify");
    }
  });

  // 11. Compare two stored documents
  await testEndpoint(`POST /api/documents/compare-stored`, async () => {
    const data = await request(`/api/documents/compare-stored`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId1: docId, docId2: rentalDocId }),
    });
    if (!data.summary || !Array.isArray(data.modifiedClauses)) {
      throw new Error("Missing comparison summary or modifiedClauses");
    }

  });

  // 12. Negative test: Non-existent document
  await testEndpoint("Negative test: GET /api/documents/non-existent-id (404 expected)", async () => {
    try {
      await request("/api/documents/00000000-0000-0000-0000-000000000000");
      throw new Error("Expected 404 error but request succeeded");
    } catch (err) {
      if (err.status === 404) return; // Expected!
      throw err;
    }
  });

  // 13. Negative test: Invalid JSON body
  await testEndpoint("Negative test: Invalid JSON body (400 expected)", async () => {
    try {
      await request("/api/documents/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ broken json",
      });
      throw new Error("Expected 400 error but request succeeded");
    } catch (err) {
      if (err.status === 400) return; // Expected!
      throw err;
    }
  });

  // 14. Negative test: Missing required fields
  await testEndpoint("Negative test: Missing fields in /questions (400 expected)", async () => {
    try {
      await request(`/api/documents/${docId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      throw new Error("Expected 400 error but request succeeded");
    } catch (err) {
      if (err.status === 400) return; // Expected!
      throw err;
    }
  });

  console.log("\n=== ALL TEST ENDPOINTS COMPLETED ===");
}

run().catch(console.error);
