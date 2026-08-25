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

> **Heads up:** Vite inlines `VITE_`-prefixed variables into the bundle, so the key is readable by
> anyone who can load the page. That is fine for a tool you run locally; if you ever deploy Cram,
> put a small proxy in front of the API and keep the key server-side.

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
src/
  App.tsx                  top-level state: subject, notes, tab, chat, quiz, deck
  types.ts                 shared types and empty states
  lib/
    anthropic.ts           the Messages API client and error mapping
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
