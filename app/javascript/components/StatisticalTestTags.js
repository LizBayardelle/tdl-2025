import React, { useState } from 'react';
import MagicSparkles from './icons/MagicSparkles';

// Renders statistical-test chips for a Source.  Mirrors MethodologyTags'
// pattern: chips for existing tags, an autodetect button when there are
// none, a quiet re-detect button when there are some.  Each chip links to
// the public /stats/:slug detail page.
//
// Two-phase autodetect: first tries the abstract (cheap). If that comes
// back empty AND the source qualifies (empirical kind + PDF attached),
// transparently retries with PDF body text. The button text/icon reflect
// each phase.
//
// When the most recent search came up empty, renders "Searched, no tests
// found" so users don't keep clicking. A quiet retry icon stays available
// for cases where the abstract or PDF has changed since.
//
// Props:
//   source    — { id, title, abstract, summary, kind, statistical_tests, statistical_tests_searched_at, has_pdf, authors }
//   onUpdate  — called with the updated source after auto-tag persists
//   canEdit   — show the autodetect button (default true)
//   compact   — render in a smaller / quieter layout (default false)
const EMPIRICAL_KINDS = new Set(['article', 'conference', 'thesis', 'dissertation', 'report', 'book_chapter']);

export default function StatisticalTestTags({ source, onUpdate, canEdit = true, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'abstract' | 'pdf'
  const [error, setError] = useState(null);

  const tests = Array.isArray(source?.statistical_tests) ? source.statistical_tests : [];
  const existingIds = tests.map(t => t.id);
  const wasSearched = !!source?.statistical_tests_searched_at;
  const eligibleForPdf = source && EMPIRICAL_KINDS.has(source.kind) && source.has_pdf;
  const csrf = () => document.querySelector('[name="csrf-token"]')?.content;

  const callTagger = async ({ includePdf }) => {
    const r = await fetch('/sources/tag_statistical_tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
      body: JSON.stringify({
        source_id: source.id,
        title: source.title,
        abstract: source.abstract,
        summary: source.summary,
        kind: source.kind,
        include_pdf: includePdf,
      }),
    });
    return { ok: r.ok, data: await r.json() };
  };

  const handleDetect = async () => {
    if (!source?.title) {
      setError('Source needs a title.');
      return;
    }
    setBusy(true);
    setError(null);

    let result = null;
    try {
      // Phase 1 — abstract only
      setPhase('abstract');
      const first = await callTagger({ includePdf: false });
      if (!first.ok) {
        setError(first.data.error || 'Auto-tag failed.');
        return;
      }
      result = first.data;

      // Phase 2 — escalate to PDF if abstract found nothing and the source qualifies
      if ((result.tests || []).length === 0 && eligibleForPdf) {
        setPhase('pdf');
        const second = await callTagger({ includePdf: true });
        if (!second.ok) {
          setError(second.data.error || 'PDF search failed.');
          return;
        }
        result = second.data;
      }

      const suggested = Array.isArray(result.tests) ? result.tests : [];

      // Persist the searched-at marker locally regardless of result, so a
      // subsequent re-render shows the "Searched, no tests found" state
      // without needing a refetch.
      const searchedAt = new Date().toISOString();

      if (suggested.length === 0) {
        onUpdate?.({ ...source, statistical_tests_searched_at: searchedAt });
        return;
      }

      const newOnes = suggested.filter(t => !existingIds.includes(t.id));
      if (newOnes.length === 0) {
        onUpdate?.({ ...source, statistical_tests_searched_at: searchedAt });
        return;
      }
      const mergedIds = [...existingIds, ...newOnes.map(t => t.id)];

      const patch = await fetch(`/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({
          source: {
            statistical_test_ids: mergedIds,
            override_authors: true,
            authors: source.authors || '',
          }
        }),
      });
      if (!patch.ok) {
        setError('Could not save tags.');
        return;
      }
      const merged = [
        ...tests,
        ...newOnes.map(t => ({ id: t.id, name: t.name, slug: t.slug, detected_automatically: true })),
      ];
      onUpdate?.({ ...source, statistical_tests: merged, statistical_tests_searched_at: searchedAt });
    } catch (e) {
      console.error('Statistical test detect error:', e);
      setError('Auto-tag failed.');
    } finally {
      setBusy(false);
      setPhase('idle');
    }
  };

  const buttonLabel = (() => {
    if (phase === 'abstract') return 'Searching abstract…';
    if (phase === 'pdf')      return 'Searching PDF text…';
    return 'Autodetect Statistical Test(s)';
  })();

  if (tests.length === 0 && !canEdit) return null;

  const showInitialButton = canEdit && tests.length === 0 && !wasSearched;
  const showQuietRetry    = canEdit && (tests.length > 0 || wasSearched);

  return (
    <div className={`stags${compact ? ' is-compact' : ''}`}>
      {tests.map(t => (
        <a key={t.id} href={`/stats/${t.slug}`} className="nc-pill is-stat-test" title={`View ${t.name} details`}>
          <i className="fas fa-square-root-variable nc-pill-icon" aria-hidden="true" />
          <span className="nc-pill-label">{t.name}</span>
        </a>
      ))}

      {showInitialButton && (
        <button
          type="button"
          onClick={handleDetect}
          disabled={busy}
          className="stags-detect"
          title="Have Haiku read the abstract and tag statistical tests"
        >
          <MagicSparkles size={12} spinning={busy} />
          {busy ? buttonLabel : 'Autodetect Statistical Test(s)'}
        </button>
      )}

      {showQuietRetry && (
        <button
          type="button"
          onClick={handleDetect}
          disabled={busy}
          className="stags-detect-quiet"
          title={tests.length > 0 ? 'Re-detect statistical tests' : 'Search again (e.g., after attaching a PDF or editing the abstract)'}
        >
          <MagicSparkles size={11} spinning={busy} />
        </button>
      )}

      {/* Inline status text while searching, so the user sees which phase we're in even when the button itself is the quiet icon. */}
      {busy && tests.length > 0 && (
        <span className="stags-phase">{buttonLabel}</span>
      )}

      {/* Persistent "we already looked" note — only shown when the search came up empty. */}
      {!busy && wasSearched && tests.length === 0 && (
        <span className="stags-empty-note">Searched, no tests found.</span>
      )}

      {error && <span className="stags-error">{error}</span>}

      <style>{`
        .stags {
          display: inline-flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          font-family: var(--font-body);
        }

        .stags-detect {
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
        .stags-detect:hover:not(:disabled) {
          color: var(--source-2);
          border-color: var(--source);
          background: var(--source-tint);
        }
        .stags-detect:disabled { opacity: 0.6; cursor: default; }

        .stags-detect-quiet {
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
        .stags-detect-quiet:hover:not(:disabled) {
          color: var(--source-2);
          background: var(--source-tint);
        }
        .stags-detect-quiet:disabled { opacity: 0.6; cursor: default; }

        .stags-phase {
          font-style: italic;
          font-size: 11px;
          color: var(--ink-3);
          font-family: var(--font-body);
        }

        .stags-empty-note {
          font-style: italic;
          font-size: 11px;
          color: var(--ink-4);
          font-family: var(--font-body);
        }

        .stags-error {
          font-size: 11px;
          color: var(--error);
          font-family: var(--font-body);
        }
      `}</style>
    </div>
  );
}
