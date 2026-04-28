import React, { useState, useEffect, useRef } from 'react';

// ShowNoteModal — read-only, draggable, no-backdrop floating window for
// viewing a note in full.  Click the Edit button to hand off to the
// existing edit modal.
//
// Props:
//   isOpen, onClose, onEdit
//   note: full note JSON (title, body, note_type, quote_text, page_number,
//                         created_at, concepts, people, tags, collections, source)
export default function ShowNoteModal({ isOpen, onClose, onEdit, note }) {
  const [floatPos, setFloatPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 600) : 0,
    y: 96,
  }));
  const [dragOrigin, setDragOrigin] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (!dragOrigin) return;
    const onMove = (e) => {
      const p = e.touches ? e.touches[0] : e;
      setFloatPos({
        x: Math.max(0, Math.min(window.innerWidth - 200, p.clientX - dragOrigin.dx)),
        y: Math.max(0, Math.min(window.innerHeight - 80, p.clientY - dragOrigin.dy)),
      });
    };
    const onUp = () => setDragOrigin(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [dragOrigin]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !note) return null;

  const beginDrag = (e) => {
    if (e.target.closest('button, a')) return;
    const p = e.touches ? e.touches[0] : e;
    setDragOrigin({ dx: p.clientX - floatPos.x, dy: p.clientY - floatPos.y });
  };

  const noteType = note.note_type || 'note';

  const formatDate = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(); } catch { return ''; }
  };

  return (
    <div
      ref={modalRef}
      className="snm-shell"
      style={{ top: `${floatPos.y}px`, left: `${floatPos.x}px`, userSelect: dragOrigin ? 'none' : 'auto' }}
    >
      <header
        className="snm-header"
        onMouseDown={beginDrag}
        onTouchStart={beginDrag}
      >
        <div className="snm-header-l">
          <i className="fas fa-grip-vertical snm-grip" title="Drag to move" />
          <h2 className="snm-title">
            <i className="fas fa-sticky-note" style={{ marginRight: 8, opacity: 0.85 }}></i>
            {note.title || 'Note'}
          </h2>
          {noteType !== 'note' && <span className={`snm-type-badge is-${noteType}`}>{noteType}</span>}
        </div>
        <button type="button" className="snm-close" onClick={onClose} title="Close (Esc)">
          <i className="fas fa-times"></i>
        </button>
      </header>

      <div className="snm-body">
        {note.quote_text && (
          <div className="snm-quote">
            <div className="snm-quote-label">
              Quoted passage{note.page_number ? ` · p. ${note.page_number}` : ''}
            </div>
            <blockquote className="snm-quote-body">{note.quote_text}</blockquote>
          </div>
        )}

        {note.body && (
          <div className="snm-content note-content" dangerouslySetInnerHTML={{ __html: note.body }} />
        )}

        {note.concepts?.length > 0 && (
          <ChipsBlock label="Concepts" tone="concept">
            {note.concepts.map(c => (
              <a key={c.id} href={`/concepts/${c.id}`} target="_blank" rel="noopener noreferrer" className="snm-chip is-concept">
                {c.label} <i className="fas fa-arrow-up-right-from-square snm-chip-icon"></i>
              </a>
            ))}
          </ChipsBlock>
        )}

        {note.people?.length > 0 && (
          <ChipsBlock label="People" tone="person">
            {note.people.map(p => (
              <a key={p.id} href={`/people/${p.id}`} target="_blank" rel="noopener noreferrer" className="snm-chip is-person">
                {p.full_name} <i className="fas fa-arrow-up-right-from-square snm-chip-icon"></i>
              </a>
            ))}
          </ChipsBlock>
        )}

        {note.source && (
          <ChipsBlock label="Source" tone="source">
            <a href={`/sources/${note.source.id}`} target="_blank" rel="noopener noreferrer" className="snm-chip is-source">
              {note.source.title} <i className="fas fa-arrow-up-right-from-square snm-chip-icon"></i>
            </a>
          </ChipsBlock>
        )}

        {note.collections?.length > 0 && (
          <ChipsBlock label="Collections" tone="neutral">
            {note.collections.map(c => (
              <a key={c.id} href={`/collections/${c.id}`} target="_blank" rel="noopener noreferrer" className="snm-chip is-neutral">
                {c.name} <i className="fas fa-arrow-up-right-from-square snm-chip-icon"></i>
              </a>
            ))}
          </ChipsBlock>
        )}

        {Array.isArray(note.tags) && note.tags.length > 0 && (
          <ChipsBlock label="Tags" tone="neutral">
            {note.tags.map((t, i) => (
              <span key={i} className="snm-chip is-neutral">{typeof t === 'string' ? t : t.name}</span>
            ))}
          </ChipsBlock>
        )}

        <div className="snm-meta">
          {note.page_number && <span>Page {note.page_number}</span>}
          {note.created_at && <span>Created {formatDate(note.created_at)}</span>}
          {note.updated_at && note.updated_at !== note.created_at && <span>Updated {formatDate(note.updated_at)}</span>}
        </div>
      </div>

      <footer className="snm-footer">
        <button type="button" className="sp-action sp-action-quiet" onClick={onClose}>Close</button>
        <button type="button" className="sp-action sp-action-primary" onClick={onEdit}>
          <i className="fas fa-pen" style={{ marginRight: 6 }}></i> Edit
        </button>
      </footer>

      <style>{`
        .snm-shell {
          position: fixed;
          z-index: 9998;
          width: min(560px, calc(100vw - 16px));
          max-height: calc(100vh - 32px);
          background: var(--paper);
          border-radius: var(--r-lg);
          box-shadow: 0 24px 64px rgba(15,23,35,0.32);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: var(--font-body);
        }
        .snm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--source);
          color: var(--paper);
          cursor: move;
          flex-shrink: 0;
        }
        .snm-header-l { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .snm-grip { color: rgba(255,255,255,0.65); font-size: 13px; }
        .snm-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          color: var(--paper);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .snm-type-badge {
          font-family: var(--font-body);
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          background: rgba(255,255,255,0.20);
          color: rgba(255,255,255,0.95);
          padding: 2px 8px;
          border-radius: var(--r-sm);
          white-space: nowrap;
        }
        .snm-close {
          background: rgba(255,255,255,0.15);
          border: none;
          color: var(--paper);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background var(--transition-fast);
        }
        .snm-close:hover { background: rgba(255,255,255,0.30); }

        .snm-body {
          padding: 18px 22px 14px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .snm-quote {
          background: var(--paper-warm);
          border-left: 3px solid var(--source);
          padding: 10px 14px;
          border-radius: 0 var(--r-sm) var(--r-sm) 0;
        }
        .snm-quote-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink-3);
          margin-bottom: 6px;
        }
        .snm-quote-body {
          margin: 0;
          font-size: 13.5px;
          font-style: italic;
          line-height: 1.6;
          color: var(--ink);
          white-space: pre-wrap;
        }

        .snm-content {
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.65;
          color: var(--ink);
        }
        .snm-content p { margin: 0 0 8px; }
        .snm-content p:last-child { margin: 0; }
        .snm-content blockquote {
          margin: 8px 0;
          padding: 6px 12px;
          border-left: 3px solid var(--ink-line);
          color: var(--ink-2);
          font-style: italic;
        }
        .snm-content ul, .snm-content ol { margin: 0 0 8px; padding-left: 22px; }
        .snm-content li { margin: 0 0 4px; }

        .snm-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          padding-top: 10px;
          border-top: 1px solid var(--ink-line-soft);
          font-size: 11.5px;
          color: var(--ink-3);
        }

        .snm-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 18px;
          border-top: 1px solid var(--ink-line);
          flex-shrink: 0;
        }

        .snm-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: var(--r-sm);
          text-decoration: none;
          line-height: 1.45;
          border: 1px solid;
          transition: background var(--transition-fast);
          cursor: pointer;
        }
        .snm-chip.is-concept { background: var(--concept-tint); color: var(--concept-2); border-color: var(--concept); }
        .snm-chip.is-person  { background: var(--person-tint);  color: var(--person-2);  border-color: var(--person);  }
        .snm-chip.is-source  { background: var(--source-tint);  color: var(--source-2);  border-color: var(--source);  }
        .snm-chip.is-neutral { background: var(--paper-warm);   color: var(--ink-2);     border-color: var(--ink-line); }
        .snm-chip:hover { filter: brightness(0.96); }
        .snm-chip-icon { font-size: 8px; opacity: 0.65; }

        @media (max-width: 600px) {
          .snm-shell { width: calc(100vw - 8px); }
        }
      `}</style>
    </div>
  );
}

function ChipsBlock({ label, tone, children }) {
  return (
    <div className="snm-chips-block">
      <div className={`snm-chips-label is-${tone}`}>{label}</div>
      <div className="snm-chips-row">{children}</div>
      <style>{`
        .snm-chips-block { display: flex; flex-direction: column; gap: 6px; }
        .snm-chips-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .snm-chips-label.is-concept { color: var(--concept-2); }
        .snm-chips-label.is-person  { color: var(--person-2);  }
        .snm-chips-label.is-source  { color: var(--source-2);  }
        .snm-chips-label.is-neutral { color: var(--ink-3);     }
        .snm-chips-row { display: flex; flex-wrap: wrap; gap: 6px; }
      `}</style>
    </div>
  );
}
