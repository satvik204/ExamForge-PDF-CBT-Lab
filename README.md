# ExamForge PDF → CBT Lab

A standalone, static prototype designed to test **reliable PDF-to-CBT conversion** before integrating the converter into the main ExamForge site. No Google login, admin account, Firebase, database, or backend is needed.

## What works

- Upload a locally selected PDF and render its pages using PDF.js.
- Zoom and navigate pages; select a complete question by drawing a rectangle over the PDF.
- Recrop, edit metadata, remove saved crops, and keep the image of each question in the browser tab.
- Set subject, single-choice or numerical answer, question number, marks and exam duration.
- Fill/review an answer key, run a JEE-style CBT with timer, question palette, review marking, options, zoom, score and report.
- Generate an **EF1** code containing the question images and entered answers, compatible with the ASTRA ExamForge EF1 structure for tests within the host's size limit (typically 900 KB in the current ASTRA generator).

## Deliberate limits

- **Cropping is manual** in this first reliability test. We do not claim that question boundaries or answers are automatically detected. This avoids the original app's OCR mangling mathematical expressions and diagrams.
- The user must verify the answer key; this tool never guesses.
- PDF.js loads from a CDN and requires an internet connection on first visit. No user PDF data is sent to the CDN.
- The cropped question may contain four printed options in its image. CBT answer selection is **A/B/C/D** in the interface; there is no separate OCR of option text. Numerical answers use a number field.
- Export contains image data, which can exceed the main ExamForge site's 900 KB limit for large papers; the lab's CBT player itself can still run in-tab. We will optimize this during integration.
- No permanent storage; reloading clears the paper and crops. Export a CBT code before closing.
- If the original PDF has security restrictions or invalid contents, it may fail to render.

## Run locally

Either open `index.html` in a modern browser with Internet enabled or use a local static server for more consistent browser behavior:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish as a public GitHub Pages repository

1. On GitHub, create a new **Public** repository, e.g. `ExamForge-PDF-CBT-Lab`.
2. Upload **`index.html`, `styles.css`, `app.js`, `README.md`** to the repository root, or drag them from the downloaded ZIP.
3. Go to **Settings → Pages → Build and deployment** → choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. Once GitHub reports deployment, the web app appears at `https://YOUR_USERNAME.github.io/ExamForge-PDF-CBT-Lab/`.
5. Run the PDF sample test, crop one real question, enter its correct answer, take the test, and verify the export.

## Test checklist

- Upload `ExamForge_Sample_Question_Paper.pdf` (if you have it).
- Navigate to another PDF page and back, zoom to 150%.
- Crop question with all options; choose subject/answer, save; recrop it.
- Add numerical question; enter correct numerical answer.
- Start CBT, try magnification, palette, mark for review and submission.
- Export EF1 and copy it; verify the full code is present.

## Integration plan

Once image cropping and local CBT work: extract `loadPdf`, PDF.js rendering, normalized crop geometry, `cropImage`, question editor, and the EF1 exporter from `app.js` and integrate them into the main ExamForge converter. Integrate Google sign-in, admins, rooms and Firebase only afterward. The prototype has no third-party auth credentials.