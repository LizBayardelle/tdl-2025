import React, { useState, useEffect, useMemo } from 'react';

function humanizeKind(kind) {
  return kind ? kind.replace(/_/g, ' ') : '';
}

function metaLine(source) {
  return [source.authors, source.year, humanizeKind(source.kind)]
    .filter(Boolean)
    .join('  ·  ');
}

// Alphabetical by author byline (falling back to title), then year — the
// conventional annotated-bibliography ordering.
function sourceSort(a, b) {
  const ka = (a.authors || a.title || '').toLowerCase();
  const kb = (b.authors || b.title || '').toLowerCase();
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return (a.year || 0) - (b.year || 0);
}

// Export styles offered by the sidebar — "formatted" mirrors the editor UI;
// the rest are citation styles rendered server-side by CitationFormatter.
const EXPORT_FORMATS = [
  { id: 'formatted', label: 'Formatted' },
  { id: 'apa', label: 'APA' },
  { id: 'chicago', label: 'Chicago' },
  { id: 'mla', label: 'MLA' },
];

export default function CollectionBibliographyExport({ collectionId, collectionName, isOwner }) {
  const [entries, setEntries] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [format, setFormat] = useState('formatted'); // 'formatted' | 'apa' | 'chicago' | 'mla'
  const [includeInternal, setIncludeInternal] = useState(true);
  const [includeAbstracts, setIncludeAbstracts] = useState(false);

  useEffect(() => {
    document.title = `${collectionName || 'Collection'} — Annotated Bibliography`;
  }, [collectionName]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/collections/${collectionId}/bibliography_entries.json?with_citations=1`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || []);
          setSources(data.sources || []);
        } else {
          setError('Could not load this bibliography.');
        }
      } catch (e) {
        console.error('Failed to load bibliography export', e);
        setError('Could not load this bibliography.');
      } finally {
        setLoading(false);
      }
    })();
  }, [collectionId]);

  const rows = useMemo(() => {
    const byId = Object.fromEntries(sources.map((s) => [s.id, s]));
    return entries
      .map((e) => ({ entry: e, source: byId[e.source_id] }))
      .filter((x) => x.source)
      .sort((a, b) => sourceSort(a.source, b.source));
  }, [entries, sources]);

  if (loading) return <div className="bx-state"><BXStyles />Loading…</div>;
  if (error) return <div className="bx-state"><BXStyles />{error}</div>;

  return (
    <>
      <BXStyles />
      <div className="bx-layout">
        <aside className="bx-sidebar">
          <a href={`/collections/${collectionId}/bibliography`} className="bx-back">
            ← Back to bibliography
          </a>

          <button type="button" className="bx-print" onClick={() => window.print()}>
            <i className="fas fa-print" /> Print / Save as PDF
          </button>

          <div className="bx-panel">
            <span className="bx-panel-label">Style</span>
            <div className="bx-styles">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`bx-style-opt${format === f.id ? ' is-active' : ''}`}
                  onClick={() => setFormat(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {format === 'formatted' && (
            <div className="bx-panel">
              <span className="bx-panel-label">Formatted options</span>
              {isOwner && (
                <label className="bx-check">
                  <input
                    type="checkbox"
                    checked={includeInternal}
                    onChange={(e) => setIncludeInternal(e.target.checked)}
                  />
                  Include internal notes
                </label>
              )}
              <label className="bx-check">
                <input
                  type="checkbox"
                  checked={includeAbstracts}
                  onChange={(e) => setIncludeAbstracts(e.target.checked)}
                />
                Include abstracts
              </label>
            </div>
          )}
        </aside>

        <div className="bx-canvas">
          {rows.length === 0 ? (
            <div className="bx-state">Nothing annotated yet — add annotations before exporting.</div>
          ) : format === 'formatted' ? (
            <FormattedDocument
              collectionName={collectionName}
              rows={rows}
              isOwner={isOwner}
              includeInternal={includeInternal}
              includeAbstracts={includeAbstracts}
            />
          ) : (
            <CitationDocument collectionName={collectionName} rows={rows} style={format} />
          )}
        </div>
      </div>
    </>
  );
}

// Citation-style annotated bibliography (APA, Chicago, or MLA): a
// hanging-indent reference with the formal annotation as an indented block
// below it, double-spaced throughout.
function CitationDocument({ collectionName, rows, style }) {
  return (
    <article className="bx-page bx-cite">
      <header className="bx-cite-head">
        <h1>Annotated Bibliography</h1>
        {collectionName && <p className="bx-cite-sub">{collectionName}</p>}
      </header>
      {rows.map(({ entry, source }) => (
        <div key={entry.id} className="bx-cite-entry">
          <p className="bx-cite-ref">{source.citations?.[style] || `${source.title}.`}</p>
          {entry.formal_annotation && (
            <p className="bx-cite-annotation">{entry.formal_annotation}</p>
          )}
        </div>
      ))}
    </article>
  );
}

// Formatted style: mirrors the editor UI — abstract (optional), internal
// note as a pinned card (optional), formal annotation as a clean paragraph.
function FormattedDocument({ collectionName, rows, isOwner, includeInternal, includeAbstracts }) {
  return (
    <article className="bx-page bx-fmt">
      <header className="bx-fmt-head">
        <p className="bx-fmt-eyebrow">Annotated Bibliography</p>
        <h1 className="bx-fmt-title">{collectionName}</h1>
        <p className="bx-fmt-count">{rows.length} source{rows.length === 1 ? '' : 's'}</p>
      </header>
      {rows.map(({ entry, source }) => (
        <section key={entry.id} className="bx-fmt-entry">
          <h2 className="bx-fmt-entry-title">{source.title}</h2>
          <p className="bx-fmt-entry-meta">{metaLine(source)}</p>

          {includeAbstracts && source.abstract && (
            <div className="bx-fmt-abstract">
              <span className="bx-fmt-label">Abstract</span>
              <p className="bx-fmt-body bx-fmt-abstract-body">{source.abstract}</p>
            </div>
          )}

          {isOwner && includeInternal && entry.internal_annotation && (
            <div className="bx-fmt-internal">
              <span className="bx-fmt-label">Internal note</span>
              <p className="bx-fmt-body">{entry.internal_annotation}</p>
            </div>
          )}

          <div className="bx-fmt-formal">
            <span className="bx-fmt-label">Formal annotation</span>
            {entry.formal_annotation ? (
              <p className="bx-fmt-body">{entry.formal_annotation}</p>
            ) : (
              <p className="bx-fmt-body bx-fmt-empty">No formal annotation yet.</p>
            )}
          </div>
        </section>
      ))}
    </article>
  );
}

function BXStyles() {
  return (
    <style>{`
      .bx-state {
        padding: 80px 24px;
        text-align: center;
        font-family: var(--font-body);
        color: var(--ink-3);
      }

      .bx-layout { display: flex; align-items: flex-start; min-height: 100vh; }

      .bx-sidebar {
        width: 248px;
        flex-shrink: 0;
        box-sizing: border-box;
        position: sticky;
        top: 0;
        height: 100vh;
        overflow-y: auto;
        background: var(--paper);
        border-right: 1px solid var(--ink-line);
        padding: 20px 18px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .bx-back {
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 600;
        color: var(--ink-3);
        text-decoration: none;
      }
      .bx-back:hover { color: var(--primary); }

      .bx-print {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        background: var(--primary);
        border: 1px solid var(--primary);
        border-radius: var(--r-md);
        padding: 11px 14px;
        font-family: var(--font-body);
        font-size: 13px;
        font-weight: 600;
        color: var(--paper);
        cursor: pointer;
      }
      .bx-print:hover { background: var(--primary-dark); border-color: var(--primary-dark); }

      .bx-panel { display: flex; flex-direction: column; gap: 8px; }
      .bx-panel-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      .bx-styles { display: flex; flex-direction: column; gap: 4px; }
      .bx-style-opt {
        text-align: left;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 8px 12px;
        font-family: var(--font-body);
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-2);
        cursor: pointer;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
      }
      .bx-style-opt:hover { border-color: var(--ink-3); color: var(--ink); }
      .bx-style-opt.is-active {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }

      .bx-check {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-2);
        cursor: pointer;
        line-height: 1.4;
      }
      .bx-check input { margin-top: 1px; flex-shrink: 0; }

      .bx-canvas {
        flex: 1;
        min-width: 0;
        background: var(--paper-soft);
        padding: 32px 24px 72px;
      }

      .bx-page {
        background: #fff;
        max-width: 8.5in;
        margin: 0 auto;
        padding: 0.85in 0.9in;
        box-shadow: 0 2px 20px rgba(0, 0, 0, 0.12);
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* ---- Citation styles (APA / Chicago / MLA) ---- */
      .bx-cite {
        font-family: 'Times New Roman', Times, 'Source Serif 4', serif;
        font-size: 12pt;
        line-height: 2;
        color: #000;
      }
      .bx-cite-head { margin-bottom: 1em; }
      .bx-cite-head h1 {
        text-align: center;
        font-size: 12pt;
        font-weight: 700;
        margin: 0;
      }
      .bx-cite-sub {
        text-align: center;
        font-style: italic;
        margin: 0;
      }
      .bx-cite-entry { margin-bottom: 0.6em; }
      .bx-cite-ref {
        margin: 0;
        padding-left: 0.5in;
        text-indent: -0.5in;
      }
      .bx-cite-annotation {
        margin: 0 0 0 0.5in;
        white-space: pre-wrap;
      }

      /* ---- Formatted style — mirrors the editor UI ---- */
      .bx-fmt { font-family: var(--font-body); color: var(--ink); }
      .bx-fmt-head {
        border-bottom: 2px solid var(--ink-line);
        padding-bottom: 14px;
        margin-bottom: 22px;
      }
      .bx-fmt-eyebrow {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--source, var(--ink-3));
        margin: 0 0 4px;
      }
      .bx-fmt-title {
        font-family: var(--font-display);
        font-size: 28px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        letter-spacing: -0.02em;
      }
      .bx-fmt-count {
        font-size: 12.5px;
        color: var(--ink-3);
        margin: 6px 0 0;
      }
      .bx-fmt-entry {
        padding: 16px 0 18px;
        border-bottom: 1px solid var(--ink-line);
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .bx-fmt-entry:last-child { border-bottom: none; }
      .bx-fmt-entry-title {
        font-family: var(--font-display);
        font-size: 16px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        line-height: 1.3;
      }
      .bx-fmt-entry-meta {
        font-size: 12.5px;
        color: var(--ink-3);
        margin: 3px 0 12px;
      }
      .bx-fmt-label {
        display: block;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--primary);
        margin-bottom: 5px;
      }
      .bx-fmt-abstract { margin-bottom: 12px; }
      .bx-fmt-internal {
        background: color-mix(in srgb, var(--source, var(--primary)) 7%, var(--paper));
        border: 1px solid color-mix(in srgb, var(--source, var(--primary)) 22%, var(--ink-line));
        border-left: 3px solid var(--source, var(--primary));
        border-radius: var(--r-md);
        padding: 10px 13px;
        margin-bottom: 12px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .bx-fmt-body {
        font-size: 13.5px;
        line-height: 1.65;
        color: var(--ink);
        white-space: pre-wrap;
        margin: 0;
      }
      .bx-fmt-internal .bx-fmt-body { color: var(--ink-2); }
      .bx-fmt-abstract-body { color: var(--ink-3); }
      .bx-fmt-empty { color: var(--ink-4); font-style: italic; }

      @media print {
        .bx-sidebar { display: none; }
        .bx-layout { display: block; min-height: 0; }
        .bx-canvas { background: #fff; padding: 0; }
        .bx-page {
          max-width: none;
          margin: 0;
          padding: 0;
          box-shadow: none;
        }
      }

      @media (max-width: 720px) {
        .bx-layout { display: block; }
        .bx-sidebar {
          width: auto;
          height: auto;
          position: static;
          overflow: visible;
          border-right: none;
          border-bottom: 1px solid var(--ink-line);
        }
      }

      @page { margin: 1in; }
    `}</style>
  );
}
