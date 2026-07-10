# DO AS I SAY

Real-time PDF/Word conversion and editing app. No mocks — every route calls a
real library (pdf-lib, pdfjs, docx, mammoth) and real free-tier services
(Cloudinary for storage, Groq for AI instruction parsing).

## What it actually does

- Upload a PDF or DOCX → stored on Cloudinary (no login required, unsigned upload)
- Extracts real text fields with position/size (PDF) or paragraphs (DOCX)
- Edit any field directly in a form, or type a plain-English instruction and
  let Groq's free LLM decide which fields to change (the AI never touches the
  file itself — it only outputs {id, newText} pairs; your own code applies
  them precisely)
- Convert PDF → Word (rebuilds real paragraphs from the PDF's text layer)
- Add a new watermark or QR code
- Existing background art/watermarks/logos in the original file are never
  redrawn or cleared — only the exact text you edit gets touched — so
  anything you don't edit stays exactly as it was

### Honest limitation
Editing existing PDF text works by masking the old glyphs with a rectangle
sized to that exact text run, then drawing new text on top. If a watermark
literally sits under the specific characters you're changing, that sliver
gets covered along with the old text — everything else on the page is
untouched. This is a real constraint of vector PDF editing, not a bug.

## 1. Get free accounts (5 min, no credit card)

- Cloudinary: https://cloudinary.com/users/register/free
  → Dashboard gives you Cloud Name, API Key, API Secret
  → Settings → Upload → Add upload preset → set "Signing Mode" to **Unsigned** → name it `do_as_i_say_unsigned`
- Groq: https://console.groq.com/keys → create a free API key

## 2. Set up in Termux

```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y
node -v   # confirm Node 18+

git clone https://github.com/kenwestzm-lab/do-as-i-say.git
cd do-as-i-say
npm install

cp .env.local.example .env.local
# edit .env.local with: pkg install nano -y && nano .env.local
# fill in your real Cloudinary + Groq values from step 1

npm run dev
# open http://localhost:3000 in your phone browser to test locally
```

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "DO AS I SAY - initial real working version"
git branch -M main
git remote add origin https://github.com/kenwestzm-lab/do-as-i-say.git
git push -u origin main
```

(If the repo doesn't exist yet, create it first at github.com/new under the
kenwestzm-lab account, then run the commands above.)

## 4. Deploy on Vercel

1. Go to https://vercel.com/new (your project space: kenwestzm-2723s-projects)
2. Import the `do-as-i-say` repo from GitHub
3. In "Environment Variables" add the same 5 values from your `.env.local`:
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
   `CLOUDINARY_UPLOAD_PRESET`, `GROQ_API_KEY`
4. Deploy — Vercel auto-detects Next.js, no config needed
5. Your app is live at `do-as-i-say-<something>.vercel.app`

## Project structure

```
app/
  page.js                → the whole UI
  api/upload/route.js    → Cloudinary upload
  api/extract/route.js   → pulls editable fields from PDF/DOCX
  api/regenerate/route.js→ applies edits, converts, returns new file
  api/ai-edit/route.js   → Groq turns a prompt into structured edits
lib/
  pdf.js                 → pdf-lib + pdfjs real PDF logic
  docx.js                → docx + mammoth real Word logic
  cloudinary.js           → storage helper
```

## Roadmap ideas (not yet built)
- Live PDF preview with click-to-edit overlay instead of a plain form
- Image/logo replacement (currently text-only edits)
- Multi-page batch AI edits
- Signature/stamp placement tool
