# ExamForge PDF → CBT Lab

Public, static PDF-to-CBT prototype. Its primary workflow is now **automatic question detection and batch cropping** from text-selectable JEE question paper PDFs. The original images preserve mathematical typesetting, equations and diagrams without OCR rewriting. The manual crop tool remains for correcting uncertain results.

## Quick start

Open the GitHub Pages site or `index.html` in Chrome with internet access, then:

1. Upload your JEE question-paper PDF (up to 60 MB).
2. Open **Question crops** and choose the paper's subject sequence (for many NTA prints: Mathematics → Physics → Chemistry).
3. Click **⚡ Auto-detect & crop all questions**. The app scans PDF text coordinates, finds numbered questions, and generates batches of original-PDF image crops.
4. Review the detected count and flagged items. Ideally it finds **75**. Use **Recrop** for any incomplete, short, long, or page-spanning question. Check subject ordering and MCQ/numerical assignments, especially if the document's layout differs.
5. Enter and **verify** the corresponding question paper's answer key. The program does not guess the key.
6. Start CBT with timer, palette, zoom, mark-for-review and scoring. Optionally export ExamForge EF1 code; image-embedded codes may exceed the main ExamForge live room limit.

## How the new auto-detector works

- `auto-detect.js` obtains text items and coordinates from PDF.js. It recognizes explicit markers such as `Question Number : 1`, `Q. 1`, `Q1`, and conservative numbered paragraph headings. It also attempts two-column splitting.
- It computes each crop's bounding rectangle from the current question marker to the next marker, then **renders the PDF page** to a canvas and saves each question image.
- Scanning and batch crop generation run inside your browser. PDFs are not uploaded to our server.
- It warns if the detected count is not 75 and flags suspicious or page-ending crops. It preserves manual selection, preview and recropping for corrections.
- **Limitations:** Scanned/image-only pages have no selectable text; those require OCR or manual intervention. A question can span two pages, and complicated multi-column layouts, papers containing answer keys, unusual question labels and answer-option numbering can cause missing/extra crops. Crops and subject/type inference must be checked before an exam is considered accurate. This is an improved prototype, not a guaranteed 75/75 detector.
- If scanned PDFs become a common source, the next step is an explicitly reviewed OCR fallback, not pretending PDF text extraction sees pixels.

## Local development

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. Alternatively, publish the four root files `index.html`, `styles.css`, `auto-detect.js`, `app.js` (plus this README) on GitHub Pages.

## Validation

```bash
node tests/auto-detect.mjs
```

The tests cover JavaScript syntax, HTML IDs, script order, numbered-question patterns, and a synthetic 75-question detector. A successful test **does not prove** reliable extraction on every publisher's PDFs; test with a real JEE paper and inspect crops and diagrams.

## Future integration

Keep this public prototype separate from your existing ExamForge authentication, admin panels, Firebase rooms, reports and Google sign-in. After you verify the conversion flow against real papers, integrate the scanner and crop-review experience into the main ExamForge PDF converter only.
