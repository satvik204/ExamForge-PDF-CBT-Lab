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

## If auto-detection finds only 54 of 75 questions

The scanner now recognizes more NTA question-label variants, including labels split across PDF text lines. It preserves unique original printed Q numbers rather than renumbering the remaining crops, and displays missing printed numbers and pages with no heading detection.

1. Refresh GitHub Pages with Ctrl + Shift + R so the updated detection script loads.
2. Upload the same original paper and select Auto-detect & crop all questions again.
3. If fewer than 75 candidates remain, click **Download scan report** below the detection button. This JSON contains page numbers, detected question markers, their locations and missing numbers, **not the PDF or actual question text**.
4. Share the scan report and the exact PDF with the developer for layout-specific improvements. Do not use an incomplete crop set for a complete 75-question scored exam.
5. Manual Recrop is available to recover isolated missing questions, but it should not be necessary to manually crop all 75 questions.

**Important:** Detecting a printed number doesn't prove the crop contains all options, formulas or a multi-page continuation. Check flagged crops and the resulting CBT before using it for a serious test.

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
