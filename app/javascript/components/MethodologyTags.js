import React, { useState } from 'react';
import MagicSparkles from './icons/MagicSparkles';

// Renders research-type ("methodology") chips for a Source.  When the source
// has none yet AND the user can edit, surfaces an "Autodetect Research
// Type(s)" button that calls Haiku via /sources/tag_research_types and
// PATCHes the result back to the source.
//
// Props:
//   source    — { id, title, abstract, summary, kind, methodologies, authors }
//   onUpdate  — called with the updated source after auto-tag persists
//   canEdit   — show the autodetect button (default true)
//   compact   — render in a smaller / quieter layout (default false)
export default function MethodologyTags({ source, onUpdate, canEdit = true, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const methodologies = Array.isArray(source?.methodologies) ? source.methodologies : [];
  const csrf = () => document.querySelector('[name="csrf-token"]')?.content;

  const handleDetect = async () => {
    if (!source?.title) {
      setError('Source needs a title.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/sources/tag_research_types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({
          title: source.title,
          abstract: source.abstract,
          summary: source.summary,
          kind: source.kind,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || 'Auto-tag failed.');
        return;
      }
      const types = Array.isArray(data.types) ? data.types : [];
      if (types.length === 0) {
        setError('Nothing strong to suggest from this abstract.');
        return;
      }
      const merged = Array.from(new Set([...methodologies, ...types]));

      // Persist via PATCH.  Pass override_authors+authors to prevent the
      // controller's auto-author-rebuild path from clobbering our value.
      const patch = await fetch(`/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({
          source: {
            methodologies: merged,
            override_authors: true,
            authors: source.authors || '',
          }
        }),
      });
      if (!patch.ok) {
        setError('Could not save tags.');
        return;
      }
      // PATCH response is a stripped payload (no people/concepts, tags as
      // bare strings).  Update optimistically by spreading the existing
      // source so siblings like authors, concepts, tags keep their shape.
      onUpdate?.({ ...source, methodologies: merged });
    } catch (e) {
      console.error('Methodology detect error:', e);
      setError('Auto-tag failed.');
    } finally {
      setBusy(false);
    }
  };

  if (methodologies.length === 0 && !canEdit) return null;

  return (
    <div className={`mtags${compact ? ' is-compact' : ''}`}>
      {methodologies.map(m => (
        <span key={m} className="mtags-chip">{m}</span>
      ))}

      {canEdit && methodologies.length === 0 && (
        <button
          type="button"
          onClick={handleDetect}
          disabled={busy}
          className="mtags-detect"
          title="Have Haiku read the abstract and tag research types"
        >
          <MagicSparkles size={12} spinning={busy} />
          {busy ? 'Detecting…' : 'Autodetect Research Type(s)'}
        </button>
      )}

      {canEdit && methodologies.length > 0 && (
        <button
          type="button"
          onClick={handleDetect}
          disabled={busy}
          className="mtags-detect-quiet"
          title="Re-detect research types"
        >
          <MagicSparkles size={11} spinning={busy} />
        </button>
      )}

      {error && <span className="mtags-error">{error}</span>}

      <style>{`
        .mtags {
          display: inline-flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          font-family: var(--font-body);
        }
        .mtags-chip {
          font-style: italic;
          font-size: 11.5px;
          color: var(--ink-3);
          background: transparent;
          border: 1px solid var(--ink-line);
          padding: 1px 8px;
          border-radius: var(--r-sm);
          white-space: nowrap;
        }
        .mtags.is-compact .mtags-chip { font-size: 11px; padding: 0 6px; }

        .mtags-detect {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-body);
          font-size: 11.5px;
          color: var(--ink-3);
          background: transparent;
          border: 1px dashed var(--ink-line);
          padding: 2px 10px 2px 8px;
          border-radius: var(--r-sm);
          cursor: pointer;
          transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
        }
        .mtags-detect:hover:not(:disabled) {
          color: var(--source-2);
          border-color: var(--source);
          background: var(--source-tint);
        }
        .mtags-detect:disabled { opacity: 0.6; cursor: default; }

        .mtags-detect-quiet {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--ink-3);
          border-radius: var(--r-sm);
          cursor: pointer;
          transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
        }
        .mtags-detect-quiet:hover:not(:disabled) {
          color: var(--source-2);
          background: var(--source-tint);
        }
        .mtags-detect-quiet:disabled { opacity: 0.6; cursor: default; }

        .mtags-error {
          font-size: 11px;
          color: var(--error);
          font-family: var(--font-body);
        }
      `}</style>
    </div>
  );
}
