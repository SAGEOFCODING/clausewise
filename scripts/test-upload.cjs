const fs = require('node:fs');

async function testUpload() {
  const fileContent = `NON-DISCLOSURE AGREEMENT (NDA)

1. Purpose and Scope
This Non-Disclosure Agreement ("Agreement") is made between Alpha Corp and Beta LLC.
The parties wish to explore a business opportunity related to software development.

2. Confidential Information
Confidential Information includes all technical, business, and financial data disclosed by either party.
The receiving party agrees to hold all Confidential Information in strict confidence for a period of 5 years.

3. Obligations and Restrictions
The recipient shall not disclose, reproduce, or distribute the information to any third party without prior written consent.
Any breach of this agreement shall result in immediate injunctive relief and liquidated damages of $50,000.

4. Governing Law and Jurisdiction
This agreement shall be governed by the laws of the State of California.
Any disputes shall be resolved through binding arbitration in San Francisco, CA.`;

  const blob = new Blob([fileContent], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('document', blob, 'test-nda.txt');

  console.log("Uploading test-nda.txt to https://clausewise-virid.vercel.app/api/documents/analyze...");
  const res = await fetch("https://clausewise-virid.vercel.app/api/documents/analyze", {
    method: "POST",
    body: formData,
  });

  console.log("Upload Status:", res.status);
  const text = await res.text();
  console.log("Upload Response:", text.slice(0, 300));
  
  if (res.ok) {
    const data = JSON.parse(text);
    console.log("\nSUCCESS! Document analyzed with ID:", data.documentId);
    console.log("Document Type:", data.analysis.overview.documentType);
    console.log("Attention Items Count:", data.analysis.attentionItems.length);
    console.log("Clauses Count:", data.analysis.clauses.length);
    console.log("Checklist Items:", data.analysis.checklist.length);
    console.log("Lawyer Prep Summary:", data.analysis.lawyerPrep.documentSummary);
  } else {
    throw new Error(`Upload failed with status ${res.status}: ${text}`);
  }
}

testUpload().catch(console.error);
