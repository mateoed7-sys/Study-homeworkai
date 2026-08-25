import type { Dispatch, SetStateAction } from 'react';
import { askClaude, describeError } from '../lib/anthropic';
import { ParseError, parseJsonArray } from '../lib/json';
import { quizSystemPrompt, quizUserPrompt } from '../lib/prompts';
import type { QuizQuestion, QuizState, StudyContext } from '../types';
import Vial from './Vial';

interface Props {
  context: StudyContext;
  quiz: QuizState;
  setQuiz: Dispatch<SetStateAction<QuizState>>;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function isQuizQuestion(item: unknown): item is QuizQuestion {
  if (typeof item !== 'object' || item === null) return false;
  const q = item as Record<string, unknown>;
  return (
    typeof q.question === 'string' &&
    q.question.trim().length > 0 &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    q.options.every((option) => typeof option === 'string' && option.trim().length > 0) &&
    typeof q.answerIndex === 'number' &&
    Number.isInteger(q.answerIndex) &&
    q.answerIndex >= 0 &&
    q.answerIndex < q.options.length &&
    typeof q.explanation === 'string'
  );
}

export default function QuizTab({ context, quiz, setQuiz }: Props) {
  const { questions, picks, loading, error } = quiz;

  const answered = picks.filter((pick) => pick !== null).length;
  const correct = picks.reduce<number>(
    (total, pick, index) => (pick !== null && pick === questions[index]?.answerIndex ? total + 1 : total),
    0,
  );
  const ratio = answered > 0 ? correct / answered : 0;
  const percent = Math.round(ratio * 100);

  async function brew() {
    setQuiz((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const raw = await askClaude({
        system: quizSystemPrompt(context),
        messages: [{ role: 'user', content: quizUserPrompt() }],
        maxTokens: 2200,
      });
      const parsed = parseJsonArray(raw, isQuizQuestion).slice(0, 5);
      setQuiz({
        questions: parsed,
        picks: parsed.map(() => null),
        loading: false,
        error: null,
      });
    } catch (caught) {
      const message =
        caught instanceof ParseError
          ? `The quiz came back in a shape Cram could not read (${caught.message.toLowerCase().replace(/\.$/, '')}). Brew another one — it usually works on the next try.`
          : describeError(caught);
      setQuiz((previous) => ({ ...previous, loading: false, error: message }));
    }
  }

  function choose(questionIndex: number, optionIndex: number) {
    setQuiz((previous) => {
      if (previous.picks[questionIndex] !== null) return previous;
      const picks = [...previous.picks];
      picks[questionIndex] = optionIndex;
      return { ...previous, picks };
    });
  }

  if (loading && questions.length === 0) {
    return (
      <section className="panel">
        <p className="empty">steeping a quiz…</p>
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <section className="panel" style={{ textAlign: 'center' }}>
        <p className="empty">
          Five multiple-choice questions on {context.subject.trim() || 'your subject'}, drawn from
          your notes when you have given them.
        </p>
        {error && <div className="notice notice-error">{error}</div>}
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={() => void brew()} disabled={loading}>
            {loading ? 'Brewing…' : 'Brew a Quiz'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="quiz-head">
        <div className="score-line">
          Score
          <strong>
            {answered === 0 ? '—' : `${correct} / ${answered} · ${percent}%`}
          </strong>
        </div>
        <Vial ratio={ratio} active={answered > 0} />
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      <div className="panel">
        {questions.map((question, questionIndex) => {
          const pick = picks[questionIndex];
          const locked = pick !== null;

          return (
            <div className="question" key={`${questionIndex}-${question.question.slice(0, 24)}`}>
              <span className="question-number">Question {questionIndex + 1}</span>
              <p className="question-text">{question.question}</p>

              <div className="options">
                {question.options.map((option, optionIndex) => {
                  const isAnswer = optionIndex === question.answerIndex;
                  const isPick = optionIndex === pick;

                  let state = '';
                  if (locked) {
                    if (isAnswer) state = 'option-correct';
                    else if (isPick) state = 'option-wrong';
                    else state = 'option-muted';
                  }

                  return (
                    <button
                      type="button"
                      key={optionIndex}
                      className={`option ${state}`.trim()}
                      onClick={() => choose(questionIndex, optionIndex)}
                      disabled={locked}
                    >
                      <span className="option-mark">
                        {locked && isAnswer ? '✓' : locked && isPick ? '✕' : LETTERS[optionIndex]}
                      </span>
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>

              {locked && question.explanation.trim() && (
                <p className="explanation">{question.explanation}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="btn-row" style={{ marginTop: 18 }}>
        <button type="button" className="btn btn-secondary" onClick={() => void brew()} disabled={loading}>
          {loading ? 'Brewing…' : 'New Quiz'}
        </button>
      </div>
    </section>
  );
}
