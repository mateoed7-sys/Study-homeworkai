import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import { askClaude, describeError } from '../lib/anthropic';
import { chatSystemPrompt } from '../lib/prompts';
import type { ChatMessage, StudyContext } from '../types';

interface Props {
  context: StudyContext;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}

/** How much history to send; keeps long sessions from ballooning the request. */
const HISTORY_WINDOW = 24;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AskTab({ context, messages, setMessages }: Props) {
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    const outgoing: ChatMessage = { id: newId(), role: 'user', content: question };
    // Snapshot the history the model should see before the optimistic update.
    const history = [...messages, outgoing]
      .filter((message) => !message.failed)
      .slice(-HISTORY_WINDOW)
      .map((message) => ({ role: message.role, content: message.content }));

    setMessages((previous) => [...previous, outgoing]);
    setDraft('');
    setLoading(true);

    try {
      const reply = await askClaude({
        system: chatSystemPrompt(context),
        messages: history,
        maxTokens: 1400,
      });
      setMessages((previous) => [...previous, { id: newId(), role: 'assistant', content: reply }]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        { id: newId(), role: 'assistant', content: describeError(error), failed: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  }

  return (
    <section>
      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 && !loading && (
          <p className="empty">
            Ask anything about {context.subject.trim() || 'your subject'} — a concept to unpack, a
            homework problem to work through, a definition to sharpen.
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={[
              'bubble',
              message.role === 'user' ? 'bubble-user' : 'bubble-assistant',
              message.failed ? 'bubble-failed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {message.content}
          </div>
        ))}

        {loading && <div className="steeping">steeping an answer…</div>}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          className="field"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question…"
          rows={1}
          aria-label="Your question"
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
