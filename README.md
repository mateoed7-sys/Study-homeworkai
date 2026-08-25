# Cram

A study and homework companion with a dark-academic bent: pick a subject, optionally paste your
notes, then ask questions, brew a quiz, or draw a deck of flashcards. Everything runs in the
browser and talks straight to the Anthropic Messages API.

## Running it

```bash
npm install
cp .env.example .env      # then paste your key into .env
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

Your key goes in `.env` as:

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Get one at [console.anthropic.com](https://console.anthropic.com/settings/keys). `.env` is
gitignored. Vite only reads `.env` at startup, so restart the dev server after editing it.

The dev server also prints a `Network:` URL. Open that on a phone on the same wi-fi to use the
real mobile layout.

## Two ways it reaches the API

| | `npm run dev` | deployed build |
| --- | --- | --- |
| Calls | `api.anthropic.com` directly from the browser | `/api/anthropic` on your host |
| Key comes from | `VITE_ANTHROPIC_API_KEY` in `.env` | `ANTHROPIC_API_KEY` in the host's env |
| Key in the JS bundle | yes | **no** |

`import.meta.env.PROD` picks the branch at build time, so the direct-call code and the key it
reads are dropped from production bundles entirely — a build made with a populated `.env`
contains neither the key nor `api.anthropic.com`. Set `VITE_FORCE_PROXY=1` to exercise the proxy
path from a dev server.

## Deploying

The repo is Vercel-shaped: `api/anthropic.js` becomes a serverless function, the Vite build is
served as static files, and `vercel.json` raises the function timeout to 60s so a ten-card draw
does not get cut off.

After deploying, set `ANTHROPIC_API_KEY` in the project's **Settings → Environment Variables**
and redeploy. Until then the app loads but every action reports that the deployment has no key,
naming that exact setting.

### The proxy is public

Anyone who finds the URL can spend your API credits through it. `api/anthropic.js` mitigates the
obvious abuse — the model is pinned server-side so a caller cannot swap in a pricier one,
`max_tokens` is capped at 4096, request size and message count are bounded, and there is a coarse
20-requests-per-minute per-IP throttle (per instance, so a cold start forgets it).

That is enough to make casual abuse unrewarding, not enough to stop someone determined. If the
URL will be shared or indexed, put Vercel's Deployment Protection in front of the project, which
requires a login before any request reaches the function.

## How it works

- **Subject bar** — the subject and any pasted notes live in top-level app state and are prepended
  as shared context to every request from every tab. Once you hit *Start studying* the bar
  collapses to a pill; *Edit* reopens it. Committing a **changed** subject or notes clears the
  chat, the quiz, and the deck, since none of it applies to the new topic. Reopening and
  committing the same values changes nothing.
- **Ask** — a chat with a tutor system prompt: concise and exam-useful, walks through homework
  reasoning and ends on a check-in question instead of handing over the answer, unless you ask for
  the answer outright. Enter sends, Shift+Enter adds a newline. The last 24 turns go with each
  request.
- **Quiz Me** — asks for five multiple-choice questions as raw JSON. Clicking an option locks that
  question, marks the correct answer in moss green and a wrong pick in wine red, and shows the
  explanation. The vial beside the score fills with your percentage — green at 70% or better,
  amber below that, wine under 40%.
- **Flashcards** — ten cards, tap to flip. *+ More cards* asks for eight more and passes the
  existing fronts along so the model avoids repeats; anything that comes back duplicated anyway is
  filtered before it reaches the deck.

Quiz and flashcard responses are stripped of markdown code fences, sliced to the outermost JSON
array, parsed, and shape-checked. A malformed response shows a retry message rather than crashing
the tab. Every API call is wrapped, and missing keys, rejected keys, rate limits, and network
failures each get their own inline message.

## Layout

```
api/
  anthropic.js           serverless proxy: holds the key, pins the model, caps abuse
src/
  App.tsx                  top-level state: subject, notes, tab, chat, quiz, deck
  types.ts                 shared types and empty states
  lib/
    anthropic.ts           API client: direct in dev, proxied in prod
    json.ts                fence stripping and validated array parsing
    prompts.ts             system/user prompts for all three tabs
  components/
    SubjectBar.tsx         subject + notes form, collapsed pill
    AskTab.tsx             chat
    QuizTab.tsx            multiple choice + scoring
    FlashcardsTab.tsx      flip deck
    Vial.tsx               the score indicator
  styles.css               the whole theme
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the built bundle |
| `npm run typecheck` | Typecheck only |
