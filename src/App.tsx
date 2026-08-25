import { useCallback, useState } from 'react';
import AskTab from './components/AskTab';
import FlashcardsTab from './components/FlashcardsTab';
import QuizTab from './components/QuizTab';
import SubjectBar from './components/SubjectBar';
import { hasApiKey } from './lib/anthropic';
import {
  emptyDeck,
  emptyQuiz,
  type ChatMessage,
  type DeckState,
  type QuizState,
  type StudyContext,
  type TabId,
} from './types';

const TABS: { id: TabId; label: string }[] = [
  { id: 'ask', label: 'Ask' },
  { id: 'quiz', label: 'Quiz Me' },
  { id: 'cards', label: 'Flashcards' },
];

export default function App() {
  const [context, setContext] = useState<StudyContext>({ subject: '', notes: '' });
  const [locked, setLocked] = useState(false);
  const [tab, setTab] = useState<TabId>('ask');

  // Every tab's state lives up here so switching tabs never loses work.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quiz, setQuiz] = useState<QuizState>(emptyQuiz);
  const [deck, setDeck] = useState<DeckState>(emptyDeck);

  const keyPresent = hasApiKey();

  const commit = useCallback(
    (subject: string, notes: string) => {
      const next = { subject: subject.trim(), notes: notes.trim() };
      if (!next.subject) return;

      // A different subject makes the old quiz, deck, and chat meaningless — wipe them all.
      // Committing an unchanged subject (opened Edit, changed nothing) keeps everything.
      const changed = next.subject !== context.subject || next.notes !== context.notes;
      if (changed) {
        setMessages([]);
        setQuiz(emptyQuiz);
        setDeck(emptyDeck);
        setTab('ask');
      }

      setContext(next);
      setLocked(true);
    },
    [context.subject, context.notes],
  );

  return (
    <div className="shell">
      <header className="masthead">
        <h1>Cram</h1>
        <p>study &amp; homework companion</p>
      </header>

      {!keyPresent && (
        <div className="notice notice-error">
          No API key found. Copy <code>.env.example</code> to <code>.env</code>, set{' '}
          <code>VITE_ANTHROPIC_API_KEY</code>, and restart the dev server — Cram cannot reach the
          model until then.
        </div>
      )}

      <SubjectBar
        subject={context.subject}
        notes={context.notes}
        locked={locked}
        onCommit={commit}
        onEdit={() => setLocked(false)}
      />

      {locked && (
        <>
          <nav className="tabs" role="tablist" aria-label="Study modes">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                className="tab"
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'ask' && (
              <AskTab context={context} messages={messages} setMessages={setMessages} />
            )}
            {tab === 'quiz' && <QuizTab context={context} quiz={quiz} setQuiz={setQuiz} />}
            {tab === 'cards' && <FlashcardsTab context={context} deck={deck} setDeck={setDeck} />}
          </div>
        </>
      )}

      <footer className="footer">Answers are generated — check anything that matters.</footer>
    </div>
  );
}
