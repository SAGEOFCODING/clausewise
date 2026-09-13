# ClauseWise

Understand legal documents before you sign them.

ClauseWise is a GenAI-powered legal information assistant that helps ordinary users upload, understand, compare, and prepare around legal documents. It is intentionally framed as a document navigation and preparation tool, not a replacement for professional legal advice.

## Problem Statement

Legal documents are often dense, technical, and hard to navigate without professional help. Important terms about payment, termination, liability, deadlines, renewal, penalties, ownership, and dispute resolution can be buried in language that non-lawyers struggle to interpret.

## Solution

ClauseWise lets a user upload a PDF, DOCX, or TXT document and receive a structured, evidence-aware analysis:

- Plain-language document summary
- Important clauses and practical meaning
- "What should I care about?" attention areas
- Grounded document Q&A with citations where possible
- Actionable review checklist
- Lawyer consultation preparation sheet
- Meaningful comparison between two document versions

The product always communicates uncertainty and includes a visible legal-information disclaimer.

## Key Features

- Document upload and validation for PDF, DOCX, and TXT
- Text extraction and logical chunking
- Structured AI analysis with grounded prompts
- Clause simplification: original wording, plain English, practical meaning, what to check, and professional review guidance
- Evidence-based Q&A that answers only from uploaded document content
- Contract comparison focused on meaningful legal-information changes instead of raw text diff only
- Checklist items users can mark complete
- Lawyer-prep output with questions to ask, information to bring, and areas to clarify
- Local deterministic fallback when `OPENAI_API_KEY` is not configured, so demos still work
- In-memory document storage for a privacy-conscious hackathon demo

## How It Works

1. User uploads a supported legal document.
2. Backend validates extension, MIME type, size, filename, and basic file signature.
3. Text is extracted from the document.
4. Text is chunked into retrievable sections.
5. The AI service analyzes the chunks with document-content isolation instructions.
6. The UI displays summary, attention areas, clause explanations, checklist, and lawyer-prep output.
7. User asks questions; the backend retrieves relevant chunks and answers from those excerpts only.
8. User can compare two document versions for meaningful changes.

## Architecture

```text
src/
  client/
    main.tsx          React product UI
    styles.css        Responsive, accessible product styling
  server/
    app.ts            Express app and safe error handling
    index.ts          API entrypoint
    ai/               AI service abstraction, prompts, schemas, fallback analyzer
    document/         Text extraction and chunking
    retrieval/        Lightweight keyword retrieval
    routes/           Document analysis, Q&A, and comparison endpoints
    security/         Upload and filename validation
    storage/          In-memory document store
  shared/
    types.ts          Shared product/API types
```

## AI Approach

- **Document processing:** Files are parsed into text with format-specific extractors.
- **Chunking:** Extracted text is divided into overlapping chunks with section labels where detectable.
- **Retrieval:** Q&A uses lightweight keyword retrieval to select relevant chunks before answering.
- **Prompting:** Prompts clearly separate system instructions, user instructions, and untrusted document content.
- **Structured outputs:** AI responses are requested as JSON and validated with Zod schemas.
- **Grounding:** The model is instructed to cite document chunks and say when the document is insufficient.
- **Safety controls:** The system avoids legal certainty, invented citations, and jurisdiction-specific claims unless supported by provided content.

## Security

- Validates file extension, MIME type, size, filename, and basic signatures.
- Rejects path traversal and dangerous filenames.
- Stores uploaded documents in memory only for the demo.
- Does not execute uploaded files.
- Treats uploaded document text as untrusted data to reduce prompt-injection risk.
- Uses environment variables for secrets.
- Includes `.env.example` and ignores `.env`.
- Returns user-safe errors rather than raw stack traces.
- Tests cover upload validation, path traversal, bad file signatures, prompt-injection handling, invalid document IDs, and core API flow.

## Legal Safety

ClauseWise provides legal information and document assistance, not professional legal advice. It does not claim to be a lawyer, guarantee outcomes, declare clauses legal or illegal, or invent missing terms. Users are encouraged to consult qualified professionals for serious deadlines, criminal matters, litigation, significant rights, or meaningful financial consequences.

## Installation

```bash
npm install
```

## Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Variables:

- `OPENAI_API_KEY`: optional API key for model-backed analysis.
- `OPENAI_MODEL`: model name, defaults to `gpt-4o-mini`.
- `PORT`: backend API port, defaults to `4174`.
- `MAX_UPLOAD_MB`: upload limit, defaults to `6`.

Without `OPENAI_API_KEY`, ClauseWise uses a deterministic local fallback suitable for demoing the workflow.

## Running Locally

```bash
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://127.0.0.1:5173
```

The API runs on:

```text
http://127.0.0.1:4174
```

## Testing

```bash
npm test
npm run build
npm audit
```

Current test coverage includes document chunking, retrieval, upload security validation, fallback AI behavior, prompt-injection handling, and the analyze-question API flow.

## Assumptions

- Hackathon demo storage can be in memory rather than a persistent database.
- Page-level citations are best-effort because TXT and many DOCX files do not preserve pages.
- The local fallback is for resilient demos; production-quality analysis should use the configured AI provider.
- Users upload documents they are authorized to process.

## Limitations

- Scanned image PDFs may not extract readable text because OCR is not included.
- The fallback analyzer is heuristic and less capable than model-backed analysis.
- Jurisdiction-specific legal conclusions are intentionally out of scope.
- In-memory documents disappear when the server restarts.
- Very large documents should use stronger indexing and summarization strategies in production.

## Future Improvements

- OCR for scanned PDFs.
- Persistent encrypted document vault with automatic expiry.
- More advanced semantic embeddings for retrieval.
- Clause-by-clause negotiation playbooks.
- Jurisdiction-aware guidance backed by verified legal sources.
- Exportable lawyer-prep PDF.
- Authentication and per-user workspaces.

## Hackathon Evaluation Alignment

### High Impact - Problem Alignment

ClauseWise directly addresses legal-information complexity by turning dense legal documents into summaries, practical attention areas, clause explanations, grounded answers, comparison insights, checklists, and lawyer-prep materials.

### High Impact - Code Quality

The app is split into UI, API, AI service, document processing, retrieval, validation, storage, shared types, and tests. The AI provider is isolated behind `AIService`, making it straightforward to replace or extend.

### Medium Impact - Security

Security controls include file validation, path traversal protection, prompt-injection isolation, secret management, safe error responses, in-memory processing, and tests for adversarial cases.

### Additional - Efficiency

The app uses a lightweight Express and React architecture, avoids database complexity, reuses chunks for Q&A, and keeps dependencies focused.

### Additional - Testing

Automated tests validate the document pipeline, security checks, fallback AI behavior, retrieval, and API flow.

### Additional - Accessibility

The UI uses semantic regions, labels, keyboard-accessible controls, visible error states, responsive layout, sufficient contrast, and text labels alongside icons.
