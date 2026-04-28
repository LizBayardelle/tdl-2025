import React, { useState, useEffect, useRef } from 'react';

// Floating, draggable Q&A panel for asking Haiku questions about the source's
// PDF.  Every answer comes with a literal quote + page number, verified
// server-side; if the model can't find a real answer, the panel renders an
// honest "couldn't find that" message rather than guessing.
//
// Props:
//   isOpen, onClose
//   sourceId
//   userUnlimited      — whether to allow asking
//   onJumpToPage(n)    — page-jump scroll handler
export default function AskThisPaperPanel({ isOpen, onClose, sourceId, userUnlimited, onJumpToPage }) {
  const [conversation, setConversation] = useState([]); // Array<{ question, answer, supporting_quote, page_number, confidence, askedAt }>
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [upgradeUrl, setUpgradeUrl] = useState(null);
  const [floatPos, setFloatPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 480) : 0,
    y: 96,
  }));
  const [dragOrigin, setDragOrigin] = useState(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  // Auto-scroll the conversation to the latest answer
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation, asking]);

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

  if (!isOpen) return null;

  const beginDrag = (e) => {
    if (e.target.closest('button, input, textarea, a')) return;
    const p = e.touches ? e.touches[0] : e;
    setDragOrigin({ dx: p.clientX - floatPos.x, dy: p.clientY - floatPos.y });
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (asking) return;
    const q = input.trim();
    if (q.length < 4) return;

    setAsking(true);
    const csrf = document.querySelector('[name="csrf-token"]')?.content;
    const placeholder = { question: q, answer: null, asking: true, askedAt: Date.now() };
    setConversation((c) => [...c, placeholder]);
    setInput('');

    try {
      const r = await fetch(`/sources/${sourceId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ question: q }),
      });
      const data = await r.json().catch(() => ({}));

      if (r.status === 402) {
        setNeedsUpgrade(true);
        setUpgradeUrl(data.upgrade_url || null);
        // Drop the placeholder
        setConversation((c) => c.filter(x => x !== placeholder));
        return;
      }

      if (!r.ok) {
        replacePlaceholder(placeholder, {
          question: q,
          answer: data.error || 'Something went wrong.',
          confidence: 'cannot_answer',
          askedAt: placeholder.askedAt,
        });
        return;
      }

      replacePlaceholder(placeholder, {
        question: q,
        answer: data.answer,
        supporting_quote: data.supporting_quote,
        page_number: data.page_number,
        confidence: data.confidence,
        askedAt: placeholder.askedAt,
      });
    } catch (err) {
      console.error('Ask error:', err);
      replacePlaceholder(placeholder, {
        question: q,
        answer: 'Network error — try again.',
        confidence: 'cannot_answer',
        askedAt: placeholder.askedAt,
      });
    } finally {
      setAsking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const replacePlaceholder = (placeholder, newEntry) => {
    setConversation((c) => c.map(x => x === placeholder ? newEntry : x));
  };

  return (
    <div
      className="atp-shell"
      style={{ top: `${floatPos.y}px`, left: `${floatPos.x}px`, userSelect: dragOrigin ? 'none' : 'auto' }}
    >
      <header
        className="atp-header"
        onMouseDown={beginDrag}
        onTouchStart={beginDrag}
      >
        <div className="atp-header-l">
          <i className="fas fa-grip-vertical atp-grip" title="Drag to move"></i>
          <h2 className="atp-title">
            <i className="fas fa-comments" style={{ marginRight: 8, opacity: 0.85 }}></i>
            Ask this Paper
          </h2>
        </div>
        <button type="button" className="atp-close" onClick={onClose} title="Close (Esc)">
          <i className="fas fa-times"></i>
        </button>
      </header>

      <div ref={scrollRef} className="atp-scroll">
        {needsUpgrade ? (
          <div className="atp-upgrade">
            <div className="atp-upgrade-icon">
              <i className="fas fa-lock" style={{ fontSize: 18 }}></i>
            </div>
            <h3 className="atp-upgrade-title">Unlimited tier required</h3>
            <p className="atp-upgrade-body">
              "Ask this Paper" sends the full PDF to Haiku and returns answers with verified quotes.
              That costs us per question, so it's an Unlimited-tier feature.
            </p>
            {upgradeUrl && (
              <a href={upgradeUrl} className="sp-action sp-action-primary atp-upgrade-cta">
                Upgrade to Unlimited
              </a>
            )}
          </div>
        ) : conversation.length === 0 ? (
          <div className="atp-empty">
            <p>Ask anything about this paper. Examples:</p>
            <ul>
              <li>"What was the sample size?"</li>
              <li>"Did they pre-register the study?"</li>
              <li>"What's the main contribution?"</li>
              <li>"Were any adverse events reported?"</li>
            </ul>
            <p className="atp-empty-fineprint">
              Every answer comes with a verified literal quote and page number. If the paper doesn't
              cover it, the answer will say so honestly.
            </p>
          </div>
        ) : (
          <ul className="atp-conv">
            {conversation.map((c, i) => (
              <li key={i} className="atp-pair">
                <div className="atp-q">
                  <i className="fas fa-question atp-q-icon"></i>
                  {c.question}
                </div>
                {c.asking ? (
                  <div className="atp-a is-loading">
                    <i className="fas fa-circle-notch fa-spin" style={{ marginRight: 8 }}></i>
                    Reading the paper…
                  </div>
                ) : (
                  <Answer entry={c} onJumpToPage={onJumpToPage} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={submit} className="atp-input-row">
        <input
          ref={inputRef}
          type="text"
          className="atp-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={userUnlimited ? "Ask the paper a question…" : "Ask the paper a question (Unlimited tier)…"}
          disabled={asking || needsUpgrade}
          maxLength={500}
        />
        <button
          type="submit"
          className="atp-send"
          disabled={asking || needsUpgrade || input.trim().length < 4}
          title="Ask"
        >
          {asking ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
        </button>
      </form>

      <style>{`
        .atp-shell {
          position: fixed;
          z-index: 9998;
          width: min(460px, calc(100vw - 16px));
          height: min(620px, calc(100vh - 32px));
          background: var(--paper);
          border-radius: var(--r-lg);
          box-shadow: 0 24px 64px rgba(15,23,35,0.32);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: var(--font-body);
        }
        .atp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--source);
          color: var(--paper);
          cursor: move;
          flex-shrink: 0;
        }
        .atp-header-l { display: flex; align-items: center; gap: 10px; }
        .atp-grip { color: rgba(255,255,255,0.65); font-size: 13px; }
        .atp-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          color: var(--paper);
        }
        .atp-close {
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
          transition: background var(--transition-fast);
        }
        .atp-close:hover { background: rgba(255,255,255,0.30); }

        .atp-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 16px 18px;
        }

        .atp-empty {
          color: var(--ink-2);
          font-size: 13.5px;
          line-height: 1.6;
        }
        .atp-empty p { margin: 0 0 10px; }
        .atp-empty ul {
          list-style: none;
          padding: 0;
          margin: 0 0 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .atp-empty li {
          background: var(--paper-warm);
          color: var(--ink-2);
          padding: 6px 10px;
          border-radius: var(--r-sm);
          font-size: 12.5px;
          font-style: italic;
        }
        .atp-empty-fineprint {
          font-size: 12px !important;
          color: var(--ink-3) !important;
          margin: 0 !important;
        }

        .atp-conv { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 18px; }
        .atp-pair { display: flex; flex-direction: column; gap: 8px; }
        .atp-q {
          font-family: var(--font-body);
          font-size: 13.5px;
          color: var(--ink);
          font-weight: 600;
          padding: 4px 0;
          display: flex;
          gap: 8px;
          align-items: baseline;
        }
        .atp-q-icon {
          color: var(--source-2);
          font-size: 11px;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .atp-a {
          font-family: var(--font-body);
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink);
          padding-left: 18px;
        }
        .atp-a.is-loading { color: var(--ink-3); font-style: italic; }

        .atp-input-row {
          display: flex;
          gap: 6px;
          padding: 10px 12px;
          background: var(--paper-soft);
          border-top: 1px solid var(--ink-line);
        }
        .atp-input {
          flex: 1;
          height: 36px;
          padding: 0 12px;
          background: var(--paper);
          border: 1px solid var(--ink-line);
          border-radius: var(--r-sm);
          font-family: var(--font-body);
          font-size: 13.5px;
          color: var(--ink);
          outline: none;
          transition: border-color var(--transition-fast);
        }
        .atp-input:focus { border-color: var(--source); }
        .atp-input:disabled { background: var(--paper-warm); color: var(--ink-3); cursor: not-allowed; }
        .atp-send {
          width: 36px;
          height: 36px;
          background: var(--source);
          border: none;
          border-radius: var(--r-sm);
          color: var(--paper);
          cursor: pointer;
          transition: background var(--transition-fast), opacity var(--transition-fast);
        }
        .atp-send:hover:not(:disabled) { background: var(--source-2); }
        .atp-send:disabled { opacity: 0.5; cursor: not-allowed; }

        .atp-upgrade {
          text-align: center;
          padding: 16px 0;
          color: var(--ink-2);
        }
        .atp-upgrade-icon {
          width: 48px;
          height: 48px;
          background: var(--source-tint);
          color: var(--source-2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
        }
        .atp-upgrade-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 600;
          color: var(--ink);
          margin: 0 0 8px;
        }
        .atp-upgrade-body {
          font-size: 13px;
          line-height: 1.6;
          color: var(--ink-2);
          margin: 0 auto 18px;
          max-width: 320px;
        }
        .atp-upgrade-cta { background: var(--source); border-color: var(--source); }
        .atp-upgrade-cta:hover { background: var(--source-2); border-color: var(--source-2); }

        @media (max-width: 600px) {
          .atp-shell { width: calc(100vw - 8px); height: 80vh; }
        }
      `}</style>
    </div>
  );
}

function Answer({ entry, onJumpToPage }) {
  const { answer, supporting_quote, page_number, confidence } = entry;
  const cantAnswer = confidence === 'cannot_answer';

  return (
    <div className={`atp-a${cantAnswer ? ' is-cant' : ''}`}>
      <div className="atp-a-row">
        <ConfidenceBadge confidence={confidence} />
      </div>
      <p className="atp-a-text">{answer}</p>
      {supporting_quote && page_number && (
        <div className="atp-a-quote">
          <blockquote>{supporting_quote}</blockquote>
          <button
            type="button"
            className="atp-a-jump"
            onClick={() => onJumpToPage?.(page_number)}
            title={`Scroll to page ${page_number}`}
          >
            <i className="fas fa-arrow-right"></i> Jump to p.{page_number}
          </button>
        </div>
      )}
      <style>{`
        .atp-a { display: flex; flex-direction: column; gap: 8px; }
        .atp-a.is-cant { color: var(--ink-3); }
        .atp-a-row { display: flex; align-items: center; gap: 8px; }
        .atp-a-text { margin: 0; }
        .atp-a-quote {
          background: var(--paper-warm);
          border-left: 3px solid var(--source);
          border-radius: 0 var(--r-sm) var(--r-sm) 0;
          padding: 8px 12px;
          font-size: 12.5px;
          line-height: 1.5;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .atp-a-quote blockquote {
          margin: 0;
          font-style: italic;
          color: var(--ink-2);
        }
        .atp-a-jump {
          align-self: flex-start;
          background: transparent;
          border: none;
          color: var(--source-2);
          font-family: var(--font-body);
          font-size: 11.5px;
          font-weight: 600;
          padding: 2px 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .atp-a-jump:hover { color: var(--source); text-decoration: underline; }
      `}</style>
    </div>
  );
}

function ConfidenceBadge({ confidence }) {
  const cfg = {
    high:          { label: 'Confident',  bg: 'var(--concept-tint)', fg: 'var(--concept-2)' },
    medium:        { label: 'Likely',     bg: 'var(--source-tint)',  fg: 'var(--source-2)' },
    low:           { label: 'Unsure',     bg: 'var(--paper-warm)',   fg: 'var(--ink-2)' },
    cannot_answer: { label: "Can't tell from this paper", bg: 'var(--paper-warm)', fg: 'var(--ink-3)' },
  };
  const { label, bg, fg } = cfg[confidence] || cfg.low;
  return (
    <span className="atp-conf-badge" style={{ background: bg, color: fg }}>
      {label}
      <style>{`
        .atp-conf-badge {
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: var(--r-sm);
          white-space: nowrap;
        }
      `}</style>
    </span>
  );
}
