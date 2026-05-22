import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'tdl_highlight_nudge_seen';

// Auto-shows once per browser to introduce the highlight-to-note feature.
// Renders a small persistent header trigger ("✨ How highlighting works")
// that reopens the modal anytime.
export default function HighlightNudge() {
  const [open, setOpen] = useState(false);

  // Auto-open on first visit unless user has already dismissed.
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch (_) { /* localStorage may be blocked */ }
  }, []);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="hl-nudge-trigger"
        onClick={() => setOpen(true)}
        title="Help: how highlighting works"
        aria-haspopup="dialog"
      >
        <i className="fas fa-circle-question" style={{ fontSize: 12 }}></i>
        <span className="hl-nudge-trigger-label">Highlight to Take Notes</span>
      </button>

      {open && createPortal(
        <div className="hl-nudge-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="hl-nudge-modal" role="dialog" aria-labelledby="hl-nudge-title">
            <button type="button" className="hl-nudge-close" onClick={() => setOpen(false)} title="Close">
              <i className="fas fa-times"></i>
            </button>

            <div className="hl-nudge-eyebrow">
              <i className="fas fa-wand-magic-sparkles"></i> Try this
            </div>
            <h2 id="hl-nudge-title" className="hl-nudge-title">
              Highlight anything in the PDF.
            </h2>
            <p className="hl-nudge-lede">
              Select any passage. A tiny pill appears with two choices.
            </p>

            <div className="hl-nudge-options">
              <Option
                icon="fa-quote-left"
                label="Quote"
                tone="ink"
                desc="Drops the passage into the note form on the left, ready to add your thinking."
              />
              <Option
                icon="fa-wand-magic-sparkles"
                label="Summarize & Wire In"
                tone="source"
                desc="Haiku reads the passage and wires it into your library:"
              >
                <ul className="hl-nudge-bullets">
                  <li>
                    <span className="hl-dot is-concept" />
                    <span>Concept tags from your library (or new ones)</span>
                  </li>
                  <li>
                    <span className="hl-dot is-person" />
                    <span>People mentioned (matched to your library — or created fresh)</span>
                  </li>
                  <li>
                    <span className="hl-dot is-source" />
                    <span>
                      Cited sources — parsed straight from a bibliography, dropped into your library{' '}
                      <em>marked&nbsp;"Needs&nbsp;PDF"</em>. Detected authors auto-link to the new source.
                    </span>
                  </li>
                </ul>
              </Option>
            </div>

            <div className="hl-nudge-coda">
              <p>
                Saved highlights stay <span className="hl-nudge-mark">painted on the page</span> across sessions, with colored stripes for each kind of tag. Click a stripe to reopen the note.
              </p>
            </div>

            <div className="hl-nudge-actions">
              <button type="button" className="sp-action sp-action-primary" onClick={dismiss}>
                Got it — let me play
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .hl-nudge-trigger {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--source);
          border: 1px solid var(--source);
          color: var(--paper);
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          padding: 5px 12px;
          border-radius: var(--r-sm);
          cursor: pointer;
          transition: background var(--transition-fast), border-color var(--transition-fast);
        }
        .hl-nudge-trigger:hover {
          background: var(--source-2);
          border-color: var(--source-2);
        }

        /* Mobile: collapse to a single "?" icon button to save header space. */
        @media (max-width: 768px) {
          .hl-nudge-trigger-label { display: none; }
          .hl-nudge-trigger {
            padding: 0;
            width: 30px;
            height: 30px;
            justify-content: center;
          }
          .hl-nudge-trigger i { font-size: 14px !important; }
        }

        .hl-nudge-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 35, 0.5);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: hl-nudge-fade 0.18s ease;
        }
        @keyframes hl-nudge-fade { from { opacity: 0; } to { opacity: 1; } }

        .hl-nudge-modal {
          background: var(--paper);
          border-radius: var(--r-lg);
          box-shadow: 0 20px 60px rgba(15, 23, 35, 0.35);
          max-width: 560px;
          width: 100%;
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          padding: 36px 36px 32px;
          font-family: var(--font-body);
          color: var(--ink);
          position: relative;
        }
        .hl-nudge-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          color: var(--ink-3);
          cursor: pointer;
          border-radius: 50%;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hl-nudge-close:hover { background: var(--hover); color: var(--ink); }

        .hl-nudge-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--source-2);
          background: var(--source-tint);
          padding: 4px 10px;
          border-radius: var(--r-sm);
          margin-bottom: 16px;
        }
        .hl-nudge-title {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.01em;
          line-height: 1.2;
          color: var(--ink);
          margin: 0 0 8px;
        }
        .hl-nudge-lede {
          font-size: 14px;
          line-height: 1.55;
          color: var(--ink-2);
          margin: 0 0 22px;
        }

        .hl-nudge-options {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 22px;
        }

        .hl-nudge-coda {
          padding: 14px 16px;
          background: var(--paper-warm);
          border-radius: var(--r-md);
          margin-bottom: 22px;
        }
        .hl-nudge-coda p {
          margin: 0;
          font-size: 13px;
          line-height: 1.55;
          color: var(--ink-2);
        }
        .hl-nudge-mark {
          background: rgba(255, 220, 90, 0.5);
          padding: 0 3px;
          border-radius: 2px;
        }

        .hl-nudge-actions {
          display: flex;
          justify-content: flex-end;
        }

        .hl-nudge-bullets {
          list-style: none;
          padding: 0;
          margin: 8px 0 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .hl-nudge-bullets li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 13px;
          line-height: 1.5;
          color: var(--ink);
        }
        .hl-nudge-bullets em {
          font-style: italic;
          color: var(--ink-2);
        }
        .hl-dot {
          width: 8px;
          height: 8px;
          border-radius: 2px;
          margin-top: 7px;
          flex-shrink: 0;
        }
        .hl-dot.is-concept { background: var(--concept); }
        .hl-dot.is-person  { background: var(--person);  }
        .hl-dot.is-source  { background: var(--source);  }

        @media (max-width: 600px) {
          .hl-nudge-modal { padding: 24px 20px 20px; }
          .hl-nudge-title { font-size: 22px; }
        }
      `}</style>
    </>
  );
}

function Option({ icon, label, tone, desc, children }) {
  return (
    <div className={`hl-nudge-opt is-${tone}`}>
      <div className="hl-nudge-opt-head">
        <span className={`hl-nudge-opt-icon is-${tone}`}>
          <i className={`fas ${icon}`}></i>
        </span>
        <span className="hl-nudge-opt-label">{label}</span>
      </div>
      <div className="hl-nudge-opt-body">
        <p className="hl-nudge-opt-desc">{desc}</p>
        {children}
      </div>
      <style>{`
        .hl-nudge-opt {
          border: 1px solid var(--ink-line);
          border-radius: var(--r-md);
          padding: 14px 16px;
          background: var(--paper);
        }
        .hl-nudge-opt-head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }
        .hl-nudge-opt-icon {
          width: 28px;
          height: 28px;
          border-radius: var(--r-sm);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        .hl-nudge-opt-icon.is-ink    { background: var(--paper-warm); color: var(--ink); }
        .hl-nudge-opt-icon.is-source { background: var(--source);     color: var(--paper); }
        .hl-nudge-opt-label {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 600;
          color: var(--ink);
        }
        .hl-nudge-opt-desc {
          font-size: 13px;
          line-height: 1.5;
          color: var(--ink-2);
          margin: 0;
        }
      `}</style>
    </div>
  );
}
