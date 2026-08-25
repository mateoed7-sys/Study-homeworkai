import { useEffect, useRef, useState, type FormEvent } from 'react';

interface Props {
  subject: string;
  notes: string;
  locked: boolean;
  onCommit: (subject: string, notes: string) => void;
  onEdit: () => void;
}

const PLACEHOLDER = 'AP Bio — cellular respiration';

export default function SubjectBar({ subject, notes, locked, onCommit, onEdit }: Props) {
  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftNotes, setDraftNotes] = useState(notes);
  const [notesOpen, setNotesOpen] = useState(notes.trim().length > 0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reopening the bar to edit starts from whatever is currently committed.
  useEffect(() => {
    if (!locked) {
      setDraftSubject(subject);
      setDraftNotes(notes);
      setNotesOpen(notes.trim().length > 0);
      inputRef.current?.focus();
    }
  }, [locked, subject, notes]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draftSubject.trim()) return;
    onCommit(draftSubject, draftNotes);
  }

  if (locked) {
    return (
      <div className="subject">
        <div className="pill">
          <span className="pill-body">
            <span className="pill-subject" title={subject}>
              {subject}
            </span>
            {notes.trim() && <span className="pill-meta">✦ reference notes attached</span>}
          </span>
          <button type="button" className="btn btn-quiet" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="subject">
      <form className="panel subject-form" onSubmit={handleSubmit}>
        <label className="eyebrow" htmlFor="subject-input">
          What are you studying?
        </label>
        <input
          id="subject-input"
          ref={inputRef}
          className="field"
          type="text"
          value={draftSubject}
          onChange={(event) => setDraftSubject(event.target.value)}
          placeholder={PLACEHOLDER}
          autoComplete="off"
          maxLength={200}
        />
        <p className="hint">
          e.g. “Circe” by Madeline Miller · Unit 4 kinematics · Spanish subjunctive
        </p>

        <button
          type="button"
          className="disclosure"
          onClick={() => setNotesOpen((open) => !open)}
          aria-expanded={notesOpen}
          aria-controls="notes-input"
        >
          {notesOpen ? '−' : '+'} paste notes or reading material (optional)
        </button>

        {notesOpen && (
          <textarea
            id="notes-input"
            className="field"
            value={draftNotes}
            onChange={(event) => setDraftNotes(event.target.value)}
            placeholder="Lecture notes, a chapter, a problem set, the syllabus unit — anything Cram should treat as the source of truth."
          />
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={!draftSubject.trim()}>
          Start studying
        </button>
      </form>
    </div>
  );
}
