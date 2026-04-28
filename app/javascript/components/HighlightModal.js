import React, { useState, useEffect, useRef } from 'react';
import MagicSparkles from './icons/MagicSparkles';

// HighlightModal — single modal for the entire highlight-to-note flow.
//
// Modes:
//   "quote"    — opens cold; user writes a note from the quote
//   "wire-in"  — opens AND immediately fires the AI extract
//
// Behavior: nothing is committed to the database until "Add Note" is
// clicked.  AI suggestions live in component state until then.  On submit,
// new entities are POSTed in parallel, then the note + highlight in one
// follow-up POST so the highlight inherits all the linked records.
//
// Props:
//   isOpen, onClose, onSaved(noteJson)
//   sourceId, sourceTitle
//   selection: { text, page, bounds }
//   initialMode: 'quote' | 'wire-in'
export default function HighlightModal({
  isOpen, onClose, onSaved,
  sourceId, sourceTitle,
  selection, initialMode = 'quote',
}) {
  const [noteType, setNoteType] = useState('highlight');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const [aiState, setAiState]     = useState('idle'); // idle | loading | done | error
  const [aiError, setAiError]     = useState(null);
  const [summary, setSummary]     = useState('');
  const [concepts, setConcepts]   = useState([]); // [{id, label}] (id null = new)
  const [people, setPeople]       = useState([]); // [{id, full_name, role?}]
  const [citations, setCitations] = useState([]); // [{title, authors, year, journal, doi}]
  const [chosenC, setChosenC] = useState(new Set()); // labels lc
  const [chosenP, setChosenP] = useState(new Set()); // names lc
  const [chosenS, setChosenS] = useState(new Set()); // indices

  // Drag state for floating mode
  const [floatPos, setFloatPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 600) : 0,
    y: 80,
  }));
  const [dragOrigin, setDragOrigin] = useState(null);
  const modalRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Reset on open and optionally fire AI
  useEffect(() => {
    if (!isOpen) return;
    setNoteType('highlight');
    setTitle('');
    setBody('');
    setAiState('idle');
    setAiError(null);
    setSummary('');
    setConcepts([]); setPeople([]); setCitations([]);
    setChosenC(new Set()); setChosenP(new Set()); setChosenS(new Set());
    setSaveError(null);

    if (initialMode === 'wire-in') {
      // Fire AI on open
      runAi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode]);

  // Drag listener (active only while dragging)
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

  // Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const csrf = () => document.querySelector('[name="csrf-token"]')?.content;

  const beginDrag = (e) => {
    if (e.target.closest('button, input, textarea, select, a')) return;
    const p = e.touches ? e.touches[0] : e;
    setDragOrigin({ dx: p.clientX - floatPos.x, dy: p.clientY - floatPos.y });
  };

  const runAi = async () => {
    if (!selection?.text) return;
    setAiState('loading');
    setAiError(null);
    try {
      const r = await fetch(`/sources/${sourceId}/passage_insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ text: selection.text }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setAiError(err.error || 'Could not generate suggestions');
        setAiState('error');
        return;
      }
      const data = await r.json();
      setSummary(data.summary || '');
      setConcepts(data.suggested_concepts || []);
      setPeople(data.suggested_people || []);
      setCitations(data.cited_sources || []);
      setChosenC(new Set((data.suggested_concepts || []).map(c => c.label.toLowerCase())));
      setChosenP(new Set((data.suggested_people || []).map(p => p.full_name.toLowerCase())));
      setChosenS(new Set((data.cited_sources || []).map((_, i) => i)));
      // Pre-fill body with summary if user hasn't typed anything yet
      if (!body) setBody(data.summary || '');
      setAiState('done');
    } catch (e) {
      console.error('Wire In error:', e);
      setAiError('Network error');
      setAiState('error');
    }
  };

  const toggle = (set, setSet, key) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSet(next);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    setSaving(true);
    setSaveError(null);

    try {
      const post = (url, body) => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify(body),
      }).then(r => r.ok ? r.json() : null);

      // Filter to chosen-only
      const chosenConcepts = concepts.filter(c => chosenC.has(c.label.toLowerCase()));
      const chosenPeople   = people.filter(p => chosenP.has(p.full_name.toLowerCase()));
      const chosenCitations = citations.filter((_, i) => chosenS.has(i));

      const newConceptLabels = chosenConcepts.filter(c => !c.id).map(c => c.label);
      const existingConceptIds = chosenConcepts.filter(c => c.id).map(c => c.id);

      const newPeople = chosenPeople.filter(p => !p.id);
      const existingPersonIds = chosenPeople.filter(p => p.id).map(p => p.id);

      const [createdConcepts, createdPeople, createdSources] = await Promise.all([
        Promise.all(newConceptLabels.map(label => post('/concepts', { concept: { label } }))),
        Promise.all(newPeople.map(p => post('/people', { person: { full_name: p.full_name, role: p.role } }))),
        Promise.all(chosenCitations.map(s => post('/sources', {
          source: {
            title: s.title,
            authors: s.authors || '',
            year: s.year || null,
            journal_name: s.journal || '',
            doi: s.doi || '',
            kind: 'article',
            markers: ['Needs PDF']
          }
        }))),
      ]);

      const allConceptIds = [...existingConceptIds, ...createdConcepts.filter(Boolean).map(c => c.id)];
      const allPersonIds  = [...existingPersonIds, ...createdPeople.filter(Boolean).map(p => p.id)];
      const newSources    = createdSources.filter(Boolean);
      const newSourceIds  = newSources.map(s => s.id);

      // Authorship inference: link people whose last name appears in a created
      // source's `authors` string.
      const peopleForAuthorship = [
        ...chosenPeople.filter(p => p.id),
        ...newPeople.map((p, i) => ({ id: createdPeople[i]?.id, full_name: p.full_name })).filter(p => p.id),
      ];
      if (newSources.length && peopleForAuthorship.length) {
        await Promise.all(newSources.map(src => {
          const matches = peopleForAuthorship
            .filter(p => authorMatches(src.authors || '', p.full_name))
            .map(p => p.id);
          if (matches.length === 0) return null;
          return fetch(`/sources/${src.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
            body: JSON.stringify({ source: { person_ids: matches } })
          }).catch(() => null);
        }));
      }

      // Fire-and-forget enrichment: for each new cited source, enqueue a
      // background job that finds the matching bibliography entry in this
      // source's PDF and resolves it via CitationResolver.  The chip in the
      // user's library quietly upgrades from "Author (Year)" to the real
      // title within a few seconds.
      createdSources.forEach((src, i) => {
        if (!src) return;
        const hint = chosenCitations[i];
        if (!hint) return;
        fetch(`/sources/${src.id}/enrich_from_citation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
          body: JSON.stringify({
            parent_source_id: sourceId,
            citation_hint: { authors: hint.authors || '', year: hint.year || null },
          }),
        }).catch(() => null);
      });

      // Now create the note + highlight
      const noteResp = await fetch('/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({
          note: {
            title: title || '',
            body: body || '',
            note_type: noteType,
            page_number: selection?.page,
            quote_text: selection?.text || null,
            quote_bounds: selection?.bounds,
            source_id: sourceId,
            concept_ids: allConceptIds,
            person_ids: allPersonIds,
            cited_source_ids: newSourceIds,
          }
        }),
      });
      if (!noteResp.ok) {
        const data = await noteResp.json().catch(() => ({}));
        setSaveError((data.errors || ['Failed to save note']).join(', '));
        setSaving(false);
        return;
      }
      const noteData = await noteResp.json();
      onSaved?.(noteData);
      onClose();
    } catch (e) {
      console.error('HighlightModal save failed:', e);
      setSaveError('Save failed — see console');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={modalRef}
      className="hlm-shell"
      style={{ top: `${floatPos.y}px`, left: `${floatPos.x}px`, userSelect: dragOrigin ? 'none' : 'auto' }}
    >
      <header
        className="hlm-header"
        onMouseDown={beginDrag}
        onTouchStart={beginDrag}
      >
        <div className="hlm-header-l">
          <i className="fas fa-grip-vertical hlm-grip" title="Drag to move" />
          <h2 className="hlm-title">
            <i className="fas fa-highlighter" style={{ marginRight: 8, opacity: 0.85 }}></i>
            Highlight Summary
          </h2>
          {selection?.page && <span className="hlm-page">p.{selection.page}</span>}
        </div>
        <button type="button" className="hlm-close" onClick={onClose} title="Close (Esc)">
          <i className="fas fa-times"></i>
        </button>
      </header>

      <form onSubmit={handleSubmit} className="hlm-body">
        {/* Quote */}
        {selection?.text && (
          <div className="hlm-quote">
            <div className="hlm-quote-label">Quoted passage</div>
            <blockquote className="hlm-quote-body">{selection.text}</blockquote>
          </div>
        )}

        {/* Note fields */}
        <div className="hlm-fields">
          <div className="sp-field" style={{ flex: '0 0 130px' }}>
            <label className="sp-label">Type</label>
            <select className="sp-input" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
              <option value="highlight">Highlight</option>
              <option value="note">Note</option>
              <option value="question">Question</option>
              <option value="synthesis">Synthesis</option>
              <option value="connection">Connection</option>
              <option value="todo">To Do</option>
            </select>
          </div>
          <div className="sp-field" style={{ flex: 1 }}>
            <label className="sp-label">Title <span className="sp-help">optional</span></label>
            <input
              type="text"
              className="sp-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
            />
          </div>
        </div>

        <div className="sp-field">
          <label className="sp-label">Body</label>
          <textarea
            className="sp-textarea"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your note…"
          />
        </div>

        {/* AI section */}
        <div className="hlm-ai">
          {aiState === 'idle' && (
            <button type="button" className="hlm-ai-cta" onClick={runAi}>
              <MagicSparkles size={14} />
              <span>Summarize &amp; Wire In</span>
              <small>Have Haiku read the passage and suggest concepts, people, and cited sources to attach.</small>
            </button>
          )}
          {aiState === 'loading' && (
            <div className="hlm-ai-busy">
              <MagicSparkles size={14} spinning={true} />
              <span>Reading the passage…</span>
            </div>
          )}
          {aiState === 'error' && (
            <div className="hlm-ai-error">
              <span>{aiError}</span>
              <button type="button" className="hlm-ai-retry" onClick={runAi}>Try again</button>
            </div>
          )}
          {aiState === 'done' && (
            <div className="hlm-ai-done">
              <div className="hlm-ai-head">
                <div className="hlm-ai-eyebrow">
                  <MagicSparkles size={11} /> Suggestions
                </div>
                <button type="button" className="hlm-ai-rerun" onClick={runAi} title="Re-summarize">
                  <i className="fas fa-rotate-right"></i>
                </button>
              </div>

              {concepts.length > 0 && (
                <ChipSection label="Concepts" tone="concept">
                  {concepts.map((c, i) => {
                    const key = c.label.toLowerCase();
                    return (
                      <Chip key={`c-${i}`} tone="concept" active={chosenC.has(key)} isNew={!c.id}
                            onClick={() => toggle(chosenC, setChosenC, key)}>
                        {c.label}
                      </Chip>
                    );
                  })}
                </ChipSection>
              )}
              {people.length > 0 && (
                <ChipSection label="People" tone="person">
                  {people.map((p, i) => {
                    const key = p.full_name.toLowerCase();
                    return (
                      <Chip key={`p-${i}`} tone="person" active={chosenP.has(key)} isNew={!p.id}
                            onClick={() => toggle(chosenP, setChosenP, key)}>
                        {p.full_name}
                      </Chip>
                    );
                  })}
                </ChipSection>
              )}
              {citations.length > 0 && (
                <ChipSection label="Cited sources" tone="source">
                  {citations.map((s, i) => (
                    <Chip key={`s-${i}`} tone="source" active={chosenS.has(i)} isNew={true}
                          onClick={() => toggle(chosenS, setChosenS, i)}
                          title={[s.authors, s.year].filter(Boolean).join(' · ')}>
                      {s.title.length > 60 ? s.title.slice(0, 60) + '…' : s.title}
                    </Chip>
                  ))}
                </ChipSection>
              )}

              {concepts.length === 0 && people.length === 0 && citations.length === 0 && (
                <div className="hlm-ai-empty">Nothing strong to suggest from this passage.</div>
              )}
            </div>
          )}
        </div>

        {saveError && <div className="hlm-save-error">{saveError}</div>}

        <footer className="hlm-footer">
          <button type="button" className="sp-action sp-action-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="sp-action sp-action-primary" disabled={saving}>
            {saving ? (
              <><i className="fas fa-circle-notch fa-spin" style={{ marginRight: 6 }}></i> Saving…</>
            ) : 'Add Note'}
          </button>
        </footer>
      </form>

      <style>{`
        .hlm-shell {
          position: fixed;
          z-index: 9999;
          width: min(580px, calc(100vw - 16px));
          max-height: calc(100vh - 32px);
          background: var(--paper);
          border-radius: var(--r-lg);
          box-shadow: 0 24px 64px rgba(15,23,35,0.32);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: var(--font-body);
        }
        .hlm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--source);
          color: var(--paper);
          cursor: move;
          flex-shrink: 0;
        }
        .hlm-header-l { display: flex; align-items: center; gap: 10px; }
        .hlm-grip { color: rgba(255,255,255,0.65); font-size: 13px; }
        .hlm-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          color: var(--paper);
        }
        .hlm-page {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: rgba(255,255,255,0.85);
          padding-left: 4px;
        }
        .hlm-close {
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
        .hlm-close:hover { background: rgba(255,255,255,0.30); }

        .hlm-body {
          padding: 16px 20px 12px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .hlm-quote {
          background: var(--paper-warm);
          border-left: 3px solid var(--source);
          padding: 8px 12px;
          border-radius: 0 var(--r-sm) var(--r-sm) 0;
        }
        .hlm-quote-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink-3);
          margin-bottom: 4px;
        }
        .hlm-quote-body {
          margin: 0;
          font-size: 13px;
          font-style: italic;
          line-height: 1.5;
          color: var(--ink);
          max-height: 120px;
          overflow-y: auto;
          white-space: pre-wrap;
        }

        .hlm-fields {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .hlm-ai {
          margin-top: 4px;
          padding-top: 12px;
          border-top: 1px solid var(--ink-line);
        }
        .hlm-ai-cta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          width: 100%;
          background: var(--source-tint);
          border: 1px dashed var(--source);
          color: var(--source-2);
          padding: 12px 14px;
          border-radius: var(--r-md);
          cursor: pointer;
          font-family: var(--font-body);
          transition: background var(--transition-fast);
        }
        .hlm-ai-cta > span:not(small) { font-weight: 600; font-size: 13px; }
        .hlm-ai-cta > span:first-of-type {
          display: inline-flex; align-items: center; gap: 8px;
        }
        .hlm-ai-cta small {
          font-size: 11.5px;
          color: var(--ink-3);
          font-weight: 400;
          line-height: 1.4;
        }
        .hlm-ai-cta:hover { background: color-mix(in srgb, var(--source-tint) 60%, var(--source) 40%); color: var(--paper); }
        .hlm-ai-cta:hover small { color: rgba(255,255,255,0.85); }

        .hlm-ai-busy {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--ink-2);
          padding: 10px 4px;
        }

        .hlm-ai-error {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 12px;
          background: rgba(122, 46, 46, 0.06);
          color: var(--error);
          border-radius: var(--r-sm);
          font-size: 12.5px;
        }
        .hlm-ai-retry {
          background: transparent;
          border: 1px solid var(--error);
          color: var(--error);
          font-size: 11.5px;
          padding: 3px 10px;
          border-radius: var(--r-sm);
          cursor: pointer;
        }

        .hlm-ai-done { display: flex; flex-direction: column; gap: 10px; }
        .hlm-ai-head { display: flex; align-items: center; justify-content: space-between; }
        .hlm-ai-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--source-2);
        }
        .hlm-ai-rerun {
          background: transparent;
          border: none;
          color: var(--ink-3);
          font-size: 12px;
          width: 24px;
          height: 24px;
          border-radius: var(--r-sm);
          cursor: pointer;
        }
        .hlm-ai-rerun:hover { background: var(--hover); color: var(--ink); }
        .hlm-ai-empty { font-size: 12px; color: var(--ink-3); padding: 6px 0; }

        .hlm-save-error {
          padding: 8px 12px;
          background: rgba(122, 46, 46, 0.08);
          color: var(--error);
          font-size: 12.5px;
          border-radius: var(--r-sm);
        }

        .hlm-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 4px 4px;
          border-top: 1px solid var(--ink-line);
          margin-top: 8px;
        }

        @media (max-width: 600px) {
          .hlm-shell { width: calc(100vw - 8px); }
          .hlm-fields { flex-direction: column; }
          .hlm-fields .sp-field { width: 100%; flex: 1 1 auto !important; }
        }
      `}</style>
    </div>
  );
}

function ChipSection({ label, tone, children }) {
  return (
    <div className="hlm-chips">
      <div className={`hlm-chips-label is-${tone}`}>{label}</div>
      <div className="hlm-chips-row">{children}</div>
      <style>{`
        .hlm-chips { display: flex; flex-direction: column; gap: 4px; }
        .hlm-chips-label {
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .hlm-chips-label.is-concept { color: var(--concept-2); }
        .hlm-chips-label.is-person  { color: var(--person-2);  }
        .hlm-chips-label.is-source  { color: var(--source-2);  }
        .hlm-chips-row { display: flex; flex-wrap: wrap; gap: 5px; }
      `}</style>
    </div>
  );
}

function Chip({ tone, active, isNew, onClick, children, title }) {
  const cls = `hlm-chip is-${tone}${active ? ' is-active' : ''}${isNew ? ' is-new' : ''}`;
  return (
    <button type="button" className={cls} onClick={onClick} title={title}>
      {children}{isNew && <span className="hlm-chip-flag"> +</span>}
      <style>{`
        .hlm-chip {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 3px 9px;
          font-size: 11.5px;
          font-weight: 500;
          font-family: var(--font-body);
          border-radius: var(--r-sm);
          background: var(--paper-warm);
          color: var(--ink-3);
          border: 1px solid transparent;
          cursor: pointer;
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .hlm-chip.is-concept.is-active { background: var(--concept-tint); color: var(--concept-2); }
        .hlm-chip.is-person.is-active  { background: var(--person-tint);  color: var(--person-2); }
        .hlm-chip.is-source.is-active  { background: var(--source-tint);  color: var(--source-2); }
        .hlm-chip.is-concept.is-new { border-color: var(--concept); border-style: dashed; }
        .hlm-chip.is-person.is-new  { border-color: var(--person);  border-style: dashed; }
        .hlm-chip.is-source.is-new  { border-color: var(--source);  border-style: dashed; }
        .hlm-chip.is-active.is-new { border-style: solid; }
        .hlm-chip-flag {
          font-family: var(--font-mono);
          font-size: 9.5px;
          opacity: 0.75;
        }
      `}</style>
    </button>
  );
}

function authorMatches(authorsStr, personName) {
  const a = String(authorsStr || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  if (!a) return false;
  const name = String(personName || '').trim();
  if (!name) return false;
  const parts = name.split(/\s+/);
  const last = parts[parts.length - 1].toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  if (last.length < 3) return false;
  const escaped = last.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(a);
}
