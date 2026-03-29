# VQuest - TCS UI MCQ Practice App

VQuest is a deployable React-based MCQ practice game for Web/UI, SQL, and PL/SQL with:

- **16 sets**
- **20 questions per set**
- **320 total verified, rephrased questions**
- **`localStorage` persistence** for resume + history + weak-topic tracking
- polished UI with positive visual tone and animations

## Why this app was built this way

Your key requirement was correctness and relevance first. So the workflow is data-first:

1. collect candidate questions
2. verify/rewrite for technical correctness
3. enforce exact count and integrity checks
4. use only then in the React quiz UI

## Question data files

All question artifacts live in `src/data/`:

- `raw-candidates.json` - collected + normalized candidate pool (pre-verification metadata included)
- `verified-question-bank.json` - canonical final dataset consumed by app
- `verification-report.json` - check summary (set count, duplicates, option integrity, etc.)

## Source confidence model

The dataset metadata tracks source categories:

- official docs/pattern references (high confidence)
- prep-pattern references (medium confidence)
- community recollection references (used only after rephrasing + validation)

Policy enforced: **`rephrased_only`** (no verbatim external question copying).

## Local development

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (default: `http://localhost:5173`).

## Validation and build

```bash
# regenerate + validate 16x20 question bank
node scripts/build-question-bank.mjs

# lint
npm run lint

# production build
npm run build
```

## Deployment

This is a standard Vite React app and can be deployed to Netlify, Vercel, GitHub Pages, or similar static hosts.

Basic deploy-ready output:

```bash
npm run build
# deploy the dist/ folder
```

## localStorage keys used

- `vquest:history` - set-wise attempt history
- `vquest:weak-areas` - weakness tracking by topic/subtopic
- `vquest:current-attempt` - resumable in-progress attempt

## Notes on exam prediction

No public source can guarantee exact future internal exam questions. This app optimizes for:

- high technical correctness
- strong pattern alignment with TCS-style UI assessments
- transparent source confidence and review metadata
