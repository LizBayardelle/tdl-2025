import React, { useState, useEffect, useMemo, useRef } from 'react';

// =====================================================================
// SearchPage — full search results at /search?q=...
// Reads the query from the data attribute on its mount, fetches richer
// results from the JSON endpoint, and lets the user filter by entity
// type without a full reload.
// =====================================================================

const TYPES = [
  { key: 'all',         label: 'All' },
  { key: 'concepts',    label: 'Concepts' },
  { key: 'sources',     label: 'Sources' },
  { key: 'people',      label: 'People' },
  { key: 'notes',       label: 'Notes' },
  { key: 'tags',        label: 'Tags' },
  { key: 'collections', label: 'Collections' },
];

export default function SearchPage({ initialQuery }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (initialQuery) runSearch(initialQuery);
  }, []);

  const runSearch = async (q) => {
    if (!q || !q.trim()) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/search.json?q=${encodeURIComponent(q)}&limit=40`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const payload = await res.json();
      setData(payload);
    } catch (err) {
      console.error(err);
      setError('Search could not complete.  Try again.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Update the URL so refresh / share works
    const url = new URL(window.location.href);
    url.searchParams.set('q', q);
    window.history.replaceState({}, '', url.toString());
    runSearch(q);
  };

  const total = useMemo(() => {
    if (!data || !data.totals) return 0;
    return Object.values(data.totals).reduce((sum, n) => sum + (n || 0), 0);
  }, [data]);

  const showSection = (key) => filter === 'all' || filter === key;

  return (
    <div className="search-page">
      <SearchPageStyles />

      <div className="search-shell">
        <header className="search-header">
          <h1 className="search-title">Search</h1>

          <form className="search-input-row" onSubmit={onSubmit}>
            <div className="search-input-wrap">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder="Search across sources, concepts, people, notes, tags, collections"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            <button type="submit" className="sp-action sp-action-primary search-submit">Search</button>
          </form>

          {data && data.query && (
            <p className="search-summary">
              {loading
                ? 'Searching…'
                : total === 0
                  ? <>No matches for <em>{data.query}</em>.</>
                  : <>{total} match{total === 1 ? '' : 'es'} for <em>{data.query}</em>.</>
              }
            </p>
          )}
        </header>

        {error && <div className="search-error">{error}</div>}

        {data && total > 0 && (
          <>
            <div className="search-filters">
              {TYPES.map((t) => {
                const count = t.key === 'all' ? total : (data.totals?.[t.key] || 0);
                if (t.key !== 'all' && count === 0) return null;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`search-filter ${filter === t.key ? 'is-active' : ''}`}
                    onClick={() => setFilter(t.key)}
                  >
                    {t.label}<span className="search-filter-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {data.concepts.length > 0 && showSection('concepts') && (
              <ResultGroup label="Concepts" total={data.totals.concepts}>
                {data.concepts.map((c) => <ConceptResult key={c.id} item={c} />)}
              </ResultGroup>
            )}

            {data.sources.length > 0 && showSection('sources') && (
              <ResultGroup label="Sources" total={data.totals.sources}>
                {data.sources.map((s) => <SourceResult key={s.id} item={s} />)}
              </ResultGroup>
            )}

            {data.people.length > 0 && showSection('people') && (
              <ResultGroup label="People" total={data.totals.people}>
                {data.people.map((p) => <PersonResult key={p.id} item={p} />)}
              </ResultGroup>
            )}

            {data.notes.length > 0 && showSection('notes') && (
              <ResultGroup label="Notes" total={data.totals.notes}>
                {data.notes.map((n) => <NoteResult key={n.id} item={n} />)}
              </ResultGroup>
            )}

            {data.tags.length > 0 && showSection('tags') && (
              <ResultGroup label="Tags" total={data.totals.tags}>
                {data.tags.map((t) => <TagResult key={t.id} item={t} />)}
              </ResultGroup>
            )}

            {data.collections.length > 0 && showSection('collections') && (
              <ResultGroup label="Collections" total={data.totals.collections}>
                {data.collections.map((c) => <CollectionResult key={c.id} item={c} />)}
              </ResultGroup>
            )}
          </>
        )}

        {!data && !loading && initialQuery === '' && (
          <div className="search-empty">
            <p className="search-empty-title">Search the library.</p>
            <p className="search-empty-text">
              Try a concept name, an author, a DOI fragment, or any phrase that appears in your notes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Result rows ----

function ResultGroup({ label, total, children }) {
  const shown = React.Children.count(children);
  return (
    <section className="search-group">
      <div className="search-group-head">
        <h2 className="search-group-title">{label}</h2>
        <span className="search-group-count">
          {total > shown ? <>showing {shown} of {total}</> : <>{total}</>}
        </span>
      </div>
      <div className="search-group-list">{children}</div>
    </section>
  );
}

function ConceptResult({ item }) {
  return (
    <a href={`/concepts/${item.id}`} className="search-result">
      <div className="search-result-head">
        <span className="search-result-eyebrow is-concept">Concept</span>
        {item.concept_type && <span className="search-result-tag">{humanize(item.concept_type)}</span>}
      </div>
      <div className="search-result-title">{item.label}</div>
      {item.summary && <div className="search-result-text">{truncate(stripHtml(item.summary), 220)}</div>}
    </a>
  );
}

function SourceResult({ item }) {
  return (
    <a href={`/sources/${item.id}`} className="search-result">
      <div className="search-result-head">
        <span className="search-result-eyebrow is-source">Source</span>
        {item.kind && <span className="search-result-tag">{humanize(item.kind)}</span>}
      </div>
      <div className="search-result-title">{item.title || 'Untitled source'}</div>
      <div className="search-result-text">
        {[item.authors, item.year, item.journal_name].filter(Boolean).join(' · ')}
      </div>
    </a>
  );
}

function PersonResult({ item }) {
  return (
    <a href={`/people/${item.id}`} className="search-result">
      <div className="search-result-head">
        <span className="search-result-eyebrow is-person">Person</span>
        {item.role && <span className="search-result-tag">{item.role}</span>}
      </div>
      <div className="search-result-title">{item.full_name}</div>
      {item.summary && <div className="search-result-text">{truncate(stripHtml(item.summary), 220)}</div>}
    </a>
  );
}

function NoteResult({ item }) {
  const body = stripHtml(item.body || '');
  const title = item.title || truncate(body, 80) || 'Untitled note';
  return (
    <a href={`/notes/${item.id}`} className="search-result">
      <div className="search-result-head">
        <span className="search-result-eyebrow">Note</span>
        {item.note_type && item.note_type !== 'note' && <span className="search-result-tag">{humanize(item.note_type)}</span>}
        {item.pinned && <span className="search-result-tag">Pinned</span>}
      </div>
      <div className="search-result-title">{title}</div>
      {body && body !== title && <div className="search-result-text">{truncate(body, 220)}</div>}
      {(item.source || (item.concepts && item.concepts.length > 0)) && (
        <div className="search-result-meta">
          {item.source && <span>on {item.source.title}</span>}
          {item.concepts && item.concepts.slice(0, 3).map((c) => (
            <span key={c.id} className="sp-chip is-concept">{c.label}</span>
          ))}
        </div>
      )}
    </a>
  );
}

function TagResult({ item }) {
  return (
    <a href="/tags" className="search-result">
      <div className="search-result-head">
        <span className="search-result-eyebrow">Tag</span>
        <span className="search-result-tag">{item.taggings_count || 0} item{(item.taggings_count || 0) === 1 ? '' : 's'}</span>
      </div>
      <div className="search-result-title">{item.name}</div>
      {item.description && <div className="search-result-text">{truncate(item.description, 220)}</div>}
    </a>
  );
}

function CollectionResult({ item }) {
  return (
    <a href={`/collections/${item.id}`} className="search-result">
      <div className="search-result-head">
        <span className="search-result-eyebrow">Collection</span>
      </div>
      <div className="search-result-title">{item.name || 'Untitled collection'}</div>
      {item.description && <div className="search-result-text">{truncate(item.description, 220)}</div>}
    </a>
  );
}

// ---- Helpers ----

function stripHtml(s) {
  if (!s) return '';
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function humanize(s) {
  if (!s) return s;
  return String(s).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11l3 3" strokeLinecap="round" />
    </svg>
  );
}

// ---- Styles ----

function SearchPageStyles() {
  return (
    <style>{`
      .search-page {
        flex: 1;
        background: var(--paper);
        padding: 32px 24px 64px;
      }
      .search-shell { max-width: 920px; margin: 0 auto; }

      .search-header { margin-bottom: 28px; }
      .search-title {
        font-family: var(--font-display);
        font-size: 32px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 0 0 18px;
      }
      .search-input-row { display: flex; gap: 8px; align-items: center; }
      .search-input-wrap {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
        height: 44px;
        padding: 0 14px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        color: var(--ink-3);
        transition: border-color var(--transition-fast);
      }
      .search-input-wrap:focus-within { border-color: var(--ink-2); color: var(--ink); }
      .search-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-family: var(--font-body);
        font-size: 15px;
        color: var(--ink);
        min-width: 0;
      }
      .search-input::placeholder { color: var(--ink-3); }
      .search-submit { height: 44px; padding: 0 18px; }

      .search-summary {
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink-3);
        margin: 14px 0 0;
        line-height: 1.5;
      }
      .search-summary em { font-family: var(--font-display); color: var(--ink); font-style: italic; }

      .search-error {
        background: rgba(122, 46, 46, 0.06);
        border: 1px solid var(--error);
        border-radius: var(--r-sm);
        padding: 12px 14px;
        color: var(--error);
        font-family: var(--font-body);
        font-size: 13px;
        margin-bottom: 16px;
      }

      .search-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--ink-line);
      }
      .search-filter {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 500;
        color: var(--ink-3);
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        padding: 5px 10px;
        cursor: pointer;
        transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
      }
      .search-filter:hover { background: var(--paper-soft); color: var(--ink); }
      .search-filter.is-active {
        background: var(--paper-warm);
        color: var(--ink);
        border-color: var(--ink-line);
        font-weight: 600;
      }
      .search-filter-count {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .search-filter.is-active .search-filter-count { color: var(--ink-2); }

      .search-group { margin-bottom: 32px; }
      .search-group-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .search-group-title {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin: 0;
      }
      .search-group-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .search-group-list {
        display: flex;
        flex-direction: column;
        gap: 0;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        overflow: hidden;
        background: var(--paper);
      }

      .search-result {
        display: block;
        padding: 16px 20px;
        text-decoration: none;
        color: inherit;
        border-bottom: 1px solid var(--ink-line-soft);
        transition: background var(--transition-fast);
      }
      .search-result:last-child { border-bottom: none; }
      .search-result:hover { background: var(--paper-soft); }
      .search-result-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .search-result-eyebrow {
        font-family: var(--font-body);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .search-result-eyebrow.is-concept { color: var(--concept); }
      .search-result-eyebrow.is-source  { color: var(--source); }
      .search-result-eyebrow.is-person  { color: var(--person); }
      .search-result-tag {
        font-family: var(--font-body);
        font-size: 10.5px;
        color: var(--ink-3);
        background: var(--paper-warm);
        padding: 1px 6px;
        border-radius: 2px;
      }
      .search-result-title {
        font-family: var(--font-display);
        font-size: 16px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.3;
        letter-spacing: -0.005em;
      }
      .search-result-text {
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink-2);
        line-height: 1.55;
        margin-top: 4px;
      }
      .search-result-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 12px;
        align-items: center;
        margin-top: 8px;
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
      }

      .search-empty {
        padding: 80px 24px;
        text-align: center;
      }
      .search-empty-title {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        margin: 0 0 6px;
      }
      .search-empty-text {
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-3);
        max-width: 420px;
        margin: 0 auto;
        line-height: 1.6;
      }

      @media (max-width: 600px) {
        .search-page { padding: 20px 16px 48px; }
        .search-input-row { flex-direction: column; align-items: stretch; }
        .search-submit { width: 100%; }
        .search-title { font-size: 26px; }
        .search-result { padding: 14px 16px; }
      }
    `}</style>
  );
}
