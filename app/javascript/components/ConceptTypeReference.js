import React, { useEffect } from 'react';
import { NODE_TYPES } from '../config/nodeTypes';

// =====================================================================
// ConceptTypeReference
// Modal showing the full concept type taxonomy: name, description, and
// examples for each of the nine categories.  Triggered by a "?" button
// next to any concept-type selector.
// =====================================================================

export default function ConceptTypeReference({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ctr-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="ctr-title">
      <CTRStyles />
      <div className="ctr-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ctr-head">
          <div>
            <div className="ctr-eyebrow">Concept types</div>
            <h2 id="ctr-title" className="ctr-title">The nine categories</h2>
            <p className="ctr-sub">Pick the one that fits.  When in doubt, lean toward the broader category.</p>
          </div>
          <button type="button" className="ctr-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <div className="ctr-list">
          {NODE_TYPES.map((t) => (
            <div key={t.value} className="ctr-item">
              <div className="ctr-item-name">{t.label}</div>
              <div className="ctr-item-desc">{t.description}</div>
              <div className="ctr-item-examples">
                {t.examples.map((ex) => (
                  <span key={ex} className="ctr-example">{ex}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Small inline button used next to type selectors.
export function ConceptTypeHelpButton({ onClick }) {
  return (
    <button
      type="button"
      className="ctr-help-btn"
      onClick={onClick}
      aria-label="View concept type guide"
      title="View concept type guide"
    >
      <CTRStyles />
      ?
    </button>
  );
}

function CTRStyles() {
  return (
    <style>{`
      .ctr-help-btn {
        width: 22px;
        height: 22px;
        border: 1px solid var(--ink-line);
        border-radius: 50%;
        background: var(--paper);
        color: var(--ink-3);
        font-family: var(--font-display);
        font-size: 12px;
        font-weight: 600;
        font-style: italic;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        line-height: 1;
        padding: 0;
        transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
      }
      .ctr-help-btn:hover {
        background: var(--paper-warm);
        color: var(--ink);
        border-color: var(--ink-3);
      }

      .ctr-overlay {
        position: fixed;
        inset: 0;
        background: rgba(21, 25, 31, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 500;
        padding: 24px;
        animation: ctrFade 0.15s ease;
      }
      @keyframes ctrFade { from { opacity: 0; } to { opacity: 1; } }

      .ctr-modal {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        max-width: 640px;
        width: 100%;
        max-height: calc(100vh - 48px);
        overflow-y: auto;
        box-shadow: var(--shadow-lg);
      }

      .ctr-head {
        padding: 24px 24px 16px;
        border-bottom: 1px solid var(--ink-line);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
      }
      .ctr-eyebrow {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 6px;
      }
      .ctr-title {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--ink);
        margin: 0 0 6px;
        letter-spacing: -0.01em;
      }
      .ctr-sub {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        margin: 0;
        line-height: 1.55;
      }
      .ctr-close {
        width: 28px;
        height: 28px;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--ink-3);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .ctr-close:hover { background: var(--paper-soft); color: var(--ink); border-color: var(--ink-line); }

      .ctr-list { padding: 8px 0; }
      .ctr-item {
        padding: 14px 24px;
        border-bottom: 1px solid var(--ink-line-soft);
      }
      .ctr-item:last-child { border-bottom: none; }
      .ctr-item-name {
        font-family: var(--font-display);
        font-size: 15px;
        font-weight: 600;
        color: var(--ink);
        margin-bottom: 3px;
        letter-spacing: -0.005em;
      }
      .ctr-item-desc {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        line-height: 1.55;
        margin-bottom: 8px;
      }
      .ctr-item-examples { display: flex; flex-wrap: wrap; gap: 6px; }
      .ctr-example {
        font-family: var(--font-display);
        font-size: 12px;
        font-style: italic;
        color: var(--ink-3);
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        padding: 2px 8px;
        border-radius: var(--r-sm);
      }

      @media (max-width: 600px) {
        .ctr-overlay { padding: 12px; }
        .ctr-head { padding: 18px 18px 14px; }
        .ctr-item { padding: 12px 18px; }
      }
    `}</style>
  );
}
