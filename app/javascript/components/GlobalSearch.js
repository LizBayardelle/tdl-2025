import React, { useState, useEffect, useRef, useMemo } from 'react';

// =====================================================================
// GlobalSearch — typeahead that lives in the main nav.
// Dropdown shows a few results per category.  Pressing Enter (or
// clicking "View all") sends the user to /search?q=<query>.
// =====================================================================

const PER_GROUP = 4;

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Cmd/Ctrl-K to focus
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/search.json?q=${encodeURIComponent(query)}&limit=${PER_GROUP}`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error('Search error:', err);
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query]);

  const total = useMemo(() => {
    if (!results) return 0;
    return ['concepts', 'sources', 'people', 'notes', 'tags', 'collections']
      .reduce((sum, k) => sum + (results[k]?.length || 0), 0);
  }, [results]);

  const submit = (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    window.location.href = `/search?q=${encodeURIComponent(q)}`;
  };

  return (
    <form ref={containerRef} className="gs-root" onSubmit={submit} role="search">
      <div className={`gs-input-wrap ${open ? 'is-open' : ''}`}>
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          className="gs-input"
          placeholder="Search the library"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          autoComplete="off"
          spellCheck="false"
        />
        <kbd className="gs-kbd">⌘K</kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="gs-dropdown" role="listbox">
          {loading && !results && <div className="gs-status">Searching…</div>}

          {results && total === 0 && !loading && (
            <div className="gs-status">No matches for <em>{results.query}</em>.</div>
          )}

          {results && total > 0 && (
            <>
              <Group label="Concepts"    items={results.concepts}    type="concept" onPick={() => setOpen(false)} />
              <Group label="Sources"     items={results.sources}     type="source"  onPick={() => setOpen(false)} />
              <Group label="People"      items={results.people}      type="person"  onPick={() => setOpen(false)} />
              <Group label="Notes"       items={results.notes}       type="note"    onPick={() => setOpen(false)} />
              <Group label="Tags"        items={results.tags}        type="tag"     onPick={() => setOpen(false)} />
              <Group label="Collections" items={results.collections} type="collection" onPick={() => setOpen(false)} />

              <a
                href={`/search?q=${encodeURIComponent(query)}`}
                className="gs-all"
                onClick={() => setOpen(false)}
              >
                View all results <span className="gs-all-arrow">→</span>
              </a>
            </>
          )}
        </div>
      )}
    </form>
  );
}

function Group({ label, items, type, onPick }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="gs-group">
      <div className="gs-group-label">{label}</div>
      {items.map((item) => (
        <ResultRow key={`${type}-${item.id}`} item={item} type={type} onPick={onPick} />
      ))}
    </div>
  );
}

function ResultRow({ item, type, onPick }) {
  const link = (() => {
    switch (type) {
      case 'concept':    return `/concepts/${item.id}`;
      case 'source':     return `/sources/${item.id}`;
      case 'person':     return `/people/${item.id}`;
      case 'note':       return `/notes/${item.id}`;
      case 'tag':        return '/tags';
      case 'collection': return `/collections/${item.id}`;
      default:           return '#';
    }
  })();

  const title = (() => {
    if (type === 'concept')    return item.label;
    if (type === 'source')     return item.title || 'Untitled';
    if (type === 'person')     return item.full_name;
    if (type === 'note')       return item.title || stripHtml(item.body || '').slice(0, 80) || 'Untitled note';
    if (type === 'tag')        return item.name;
    if (type === 'collection') return item.name || 'Untitled collection';
    return '';
  })();

  const subtitle = (() => {
    if (type === 'concept')    return item.summary ? truncate(stripHtml(item.summary), 80) : (item.concept_type ? humanize(item.concept_type) : '');
    if (type === 'source')     return [item.authors, item.year].filter(Boolean).join(' · ');
    if (type === 'person')     return item.role || (item.summary ? truncate(stripHtml(item.summary), 80) : '');
    if (type === 'note')       return item.source?.title || (item.concepts?.[0]?.label ? `→ ${item.concepts[0].label}` : '');
    if (type === 'tag')        return `${item.taggings_count || 0} item${(item.taggings_count || 0) === 1 ? '' : 's'}`;
    if (type === 'collection') return item.description ? truncate(item.description, 80) : '';
    return '';
  })();

  const dotClass = (type === 'concept' || type === 'source' || type === 'person')
    ? `gs-dot is-${type}`
    : 'gs-dot is-neutral';

  return (
    <a href={link} className="gs-row" onClick={onPick}>
      <span className={dotClass} aria-hidden="true" />
      <span className="gs-row-text">
        <span className="gs-row-title">{title}</span>
        {subtitle && <span className="gs-row-sub">{subtitle}</span>}
      </span>
    </a>
  );
}

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

export { GlobalSearch };
