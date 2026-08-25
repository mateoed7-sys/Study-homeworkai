export interface StudyContext {
  subject: string;
  notes: string;
}

export type TabId = 'ask' | 'quiz' | 'cards';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface QuizState {
  questions: QuizQuestion[];
  /** picks[i] is the option index the student chose, or null while unanswered. */
  picks: (number | null)[];
  loading: boolean;
  error: string | null;
}

export interface Flashcard {
  q: string;
  a: string;
}

export interface DeckState {
  cards: Flashcard[];
  index: number;
  flipped: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

export const emptyQuiz: QuizState = {
  questions: [],
  picks: [],
  loading: false,
  error: null,
};

export const emptyDeck: DeckState = {
  cards: [],
  index: 0,
  flipped: false,
  loading: false,
  loadingMore: false,
  error: null,
};
