import type { Dispatch, SetStateAction } from 'react';
import { askClaude, describeError } from '../lib/anthropic';
import { ParseError, parseJsonArray } from '../lib/json';
import { flashcardSystemPrompt, flashcardUserPrompt } from '../lib/prompts';
import type { DeckState, Flashcard, StudyContext } from '../types';

interface Props {
  context: StudyContext;
  deck: DeckState;
  setDeck: Dispatch<SetStateAction<DeckState>>;
}

const FIRST_DRAW = 10;
const MORE_DRAW = 8;

function isFlashcard(item: unknown): item is Flashcard {
  if (typeof item !== 'object' || item === null) return false;
  const card = item as Record<string, unknown>;
  return (
    typeof card.q === 'string' &&
    card.q.trim().length > 0 &&
    typeof card.a === 'string' &&
    card.a.trim().length > 0
  );
}

function parseFailureMessage(error: unknown): string {
  if (error instanceof ParseError) {
    return `The cards came back in a shape Cram could not read (${error.message
      .toLowerCase()
      .replace(/\.$/, '')}). Draw again — it usually works on the next try.`;
  }
  return describeError(error);
}

export default function FlashcardsTab({ context, deck, setDeck }: Props) {
  const { cards, index, flipped, loading, loadingMore, error } = deck;
  const card = cards[index];

  async function draw() {
    setDeck((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const raw = await askClaude({
        system: flashcardSystemPrompt(context),
        messages: [{ role: 'user', content: flashcardUserPrompt(FIRST_DRAW, []) }],
        maxTokens: 2400,
      });
      const parsed = parseJsonArray(raw, isFlashcard).slice(0, FIRST_DRAW);
      setDeck({ cards: parsed, index: 0, flipped: false, loading: false, loadingMore: false, error: null });
    } catch (caught) {
      setDeck((previous) => ({ ...previous, loading: false, error: parseFailureMessage(caught) }));
    }
  }

  async function drawMore() {
    setDeck((previous) => ({ ...previous, loadingMore: true, error: null }));

    try {
      const raw = await askClaude({
        system: flashcardSystemPrompt(context),
        messages: [
          {
            role: 'user',
            content: flashcardUserPrompt(
              MORE_DRAW,
              cards.map((existing) => existing.q),
            ),
          },
        ],
        maxTokens: 2200,
      });
      const parsed = parseJsonArray(raw, isFlashcard).slice(0, MORE_DRAW);

      setDeck((previous) => {
        const seen = new Set(previous.cards.map((existing) => existing.q.trim().toLowerCase()));
        const fresh = parsed.filter((incoming) => !seen.has(incoming.q.trim().toLowerCase()));

        if (fresh.length === 0) {
          return {
            ...previous,
            loadingMore: false,
            error: 'Those all duplicated cards you already have. Try again for new ground.',
          };
        }

        return {
          ...previous,
          cards: [...previous.cards, ...fresh],
          index: previous.cards.length,
          flipped: false,
          loadingMore: false,
          error: null,
        };
      });
    } catch (caught) {
      setDeck((previous) => ({ ...previous, loadingMore: false, error: parseFailureMessage(caught) }));
    }
  }

  function step(delta: number) {
    setDeck((previous) => {
      const next = previous.index + delta;
      if (next < 0 || next >= previous.cards.length) return previous;
      return { ...previous, index: next, flipped: false };
    });
  }

  if (loading && cards.length === 0) {
    return (
      <section className="panel">
        <p className="empty">steeping a deck…</p>
      </section>
    );
  }

  if (!card) {
    return (
      <section className="panel" style={{ textAlign: 'center' }}>
        <p className="empty">
          Ten cards on {context.subject.trim() || 'your subject'} — term on the front, the answer
          worth writing down on the back.
        </p>
        {error && <div className="notice notice-error">{error}</div>}
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={() => void draw()} disabled={loading}>
            {loading ? 'Drawing…' : 'Draw Flashcards'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="deck-head">
        <span>Flashcards</span>
        <span>{flipped ? 'tap to close' : 'tap to reveal'}</span>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      <button
        type="button"
        className={`card ${flipped ? 'is-flipped' : ''}`.trim()}
        onClick={() => setDeck((previous) => ({ ...previous, flipped: !previous.flipped }))}
        aria-label={flipped ? 'Show the front of the card' : 'Show the answer'}
      >
        <span className="card-inner">
          <span className="card-face card-front">
            <span className="card-label">Front</span>
            <span>{card.q}</span>
          </span>
          <span className="card-face card-back">
            <span className="card-label">Back</span>
            <span>{card.a}</span>
          </span>
        </span>
      </button>

      <div className="card-nav">
        <button type="button" className="btn btn-quiet" onClick={() => step(-1)} disabled={index === 0}>
          ‹ Prev
        </button>
        <span className="counter">
          {index + 1} of {cards.length}
        </span>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => step(1)}
          disabled={index >= cards.length - 1}
        >
          Next ›
        </button>
      </div>

      <div className="btn-row" style={{ marginTop: 20 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void drawMore()}
          disabled={loadingMore || loading}
        >
          {loadingMore ? 'Drawing…' : '+ More cards'}
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => void draw()}
          disabled={loading || loadingMore}
        >
          {loading ? 'Drawing…' : 'New deck'}
        </button>
      </div>
    </section>
  );
}
