import React, { useState, useEffect, useMemo } from 'react';
import TagFormModal from './TagFormModal';

// =====================================================================
// TagsIndex — flat library page mirroring /collections.  Header with
// search + sort + "New Tag", grid of cards, each card linking to
// /tags/:id (TagShow handles the detail view).  Per-type counts come
// from the index payload's `counts` object.
// =====================================================================

function csrfToken() {
  return document.querySelector('[name="csrf-token"]')?.content;
}

export default function TagsIndex() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('popularity');

  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchTags(); /* eslint-disable-next-line */ }, [sortBy]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/tags.json?sort=${sortBy}`);
      if (res.ok) setTags(await res.json());
      else setError('Failed to load tags');
    } catch {
      setError('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const handleCreated = (newTag) => {
    setCreating(false);
    if (newTag?.id) window.location.href = `/tags/${newTag.id}`;
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return tags;
    const q = query.trim().toLowerCase();
    return tags.filter((t) =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }, [tags, query]);

  const totalTaggings = useMemo(
    () => tags.reduce((sum, t) => sum + (t.taggings_count || 0), 0),
    [tags]
  );

  if (loading) {
    return (
      <div className="tx-loading">
        <TXStyles />
        Loading tags.
      </div>
    );
  }

  return (
    <div className="tx-page">
      <TXStyles />

      <header className="tx-head">
        <div className="tx-head-text">
          <h1 className="tx-title">Tags</h1>
          <p className="tx-sub">
            {tags.length} tag{tags.length === 1 ? '' : 's'} · {totalTaggings} application{totalTaggings === 1 ? '' : 's'}
          </p>
        </div>
        <div className="tx-head-actions">
          <div className="tx-search">
            <i className="fas fa-search tx-search-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tags."
              className="tx-search-input"
            />
            {query && (
              <button type="button" className="tx-search-clear" onClick={() => setQuery('')} aria-label="Clear">×</button>
            )}
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="tx-sort">
            <option value="popularity">Most used</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <button
            type="button"
            className="sp-action sp-action-primary tx-new-cta"
            onClick={() => setCreating(true)}
          >
            <i className="fas fa-plus" /> New Tag
          </button>
        </div>
      </header>

      {error && (
        <div className="tx-error" role="alert">
          {error}
          <button type="button" className="tx-error-x" onClick={() => setError('')} aria-label="Dismiss">×</button>
        </div>
      )}

      {tags.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : filtered.length === 0 ? (
        <p className="tx-section-empty">No matches.</p>
      ) : (
        <div className="tx-grid">
          {filtered.map((t) => <TagCard key={t.id} tag={t} />)}
        </div>
      )}

      <TagFormModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onSuccess={handleCreated}
      />
    </div>
  );
}

function TagCard({ tag }) {
  const counts = tag.counts || {};
  const breakdown = [
    counts.sources  > 0 && { label: 'sources',  value: counts.sources  },
    counts.notes    > 0 && { label: 'notes',    value: counts.notes    },
    counts.concepts > 0 && { label: 'concepts', value: counts.concepts },
    counts.people   > 0 && { label: 'people',   value: counts.people   },
  ].filter(Boolean);
  const totalCount = tag.taggings_count ?? 0;

  return (
    <a href={`/tags/${tag.id}`} className="tx-card">
      <header className="tx-card-head">
        <i className="fas fa-tag tx-card-icon" />
        <h3 className="tx-card-name">{tag.name}</h3>
      </header>

      {tag.description && <p className="tx-card-desc">{tag.description}</p>}

      <footer className="tx-card-foot">
        {breakdown.length > 0 ? (
          <div className="tx-card-stats">
            {breakdown.map((b) => (
              <span key={b.label} className="tx-card-stat">
                <strong>{b.value}</strong> {b.label}
              </span>
            ))}
          </div>
        ) : (
          <span className="tx-card-itemcount">{totalCount} application{totalCount === 1 ? '' : 's'}</span>
        )}
        <span className="tx-card-arrow">→</span>
      </footer>
    </a>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="tx-empty">
      <i className="fas fa-tag tx-empty-icon" />
      <h2 className="tx-empty-title">No tags yet</h2>
      <p className="tx-empty-text">
        Tags are loose labels — the same #methodology can sit on a source, a note, and a person, with no project structure required.
      </p>
      <button type="button" className="sp-action sp-action-primary tx-empty-cta" onClick={onCreate}>
        <i className="fas fa-plus" /> Create your first tag
      </button>
    </div>
  );
}

function TXStyles() {
  return (
    <style>{`
      .tx-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 80px 24px;
        font-family: var(--font-body);
        color: var(--ink-3);
      }

      .tx-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px 32px 80px;
      }

      .tx-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .tx-head-text { min-width: 0; }
      .tx-title {
        font-family: var(--font-display);
        font-size: 30px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        line-height: 1.15;
        letter-spacing: -0.02em;
      }
      .tx-sub {
        margin: 4px 0 0;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
      }
      .tx-head-actions {
        display: inline-flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }

      .tx-search {
        position: relative;
        display: inline-flex;
        align-items: center;
      }
      .tx-search-icon {
        position: absolute;
        left: 10px;
        font-size: 11px;
        color: var(--ink-4);
      }
      .tx-search-input {
        font-family: var(--font-body);
        font-size: 13px;
        padding: 8px 28px 8px 28px;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        width: 220px;
        background: var(--paper);
      }
      .tx-search-input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
      }
      .tx-search-clear {
        position: absolute;
        right: 4px;
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 4px 8px;
        color: var(--ink-3);
      }
      .tx-sort {
        font-family: var(--font-body);
        font-size: 13px;
        padding: 8px 10px;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        background: var(--paper);
        color: var(--ink);
      }

      .tx-new-cta {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }
      .tx-new-cta:hover {
        background: var(--primary-dark);
        border-color: var(--primary-dark);
      }
      .tx-new-cta i { margin-right: 6px; }

      .tx-error {
        padding: 10px 12px;
        background: color-mix(in srgb, var(--error) 10%, transparent);
        color: var(--error);
        border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12.5px;
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 16px;
      }
      .tx-error-x {
        background: transparent;
        border: none;
        color: var(--error);
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 0 4px;
      }

      .tx-section-empty {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-4);
        font-style: italic;
        margin: 0;
        padding: 24px 0;
      }

      .tx-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 14px;
      }

      .tx-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px 16px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
        min-height: 130px;
      }
      .tx-card:hover {
        border-color: var(--primary);
        box-shadow: 0 4px 12px rgba(31, 59, 115, 0.10);
        transform: translateY(-1px);
      }

      .tx-card-head {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tx-card-icon {
        font-size: 12px;
        color: var(--primary);
        opacity: 0.8;
        flex-shrink: 0;
      }
      .tx-card-name {
        font-family: var(--font-display);
        font-size: 16px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
        line-height: 1.3;
        flex: 1;
        min-width: 0;
        word-wrap: break-word;
      }

      .tx-card-desc {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        line-height: 1.5;
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .tx-card-foot {
        margin-top: auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--ink-line);
      }
      .tx-card-stats {
        display: inline-flex;
        gap: 10px;
        flex-wrap: wrap;
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-3);
      }
      .tx-card-stat strong {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--primary);
        font-weight: 700;
        margin-right: 2px;
      }
      .tx-card-itemcount {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
      }
      .tx-card-arrow {
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-3);
        opacity: 0;
        transition: opacity 0.15s, transform 0.15s;
      }
      .tx-card:hover .tx-card-arrow {
        opacity: 1;
        transform: translateX(2px);
      }

      .tx-empty {
        text-align: center;
        padding: 80px 24px;
        font-family: var(--font-body);
      }
      .tx-empty-icon {
        font-size: 56px;
        color: var(--primary);
        opacity: 0.4;
        margin-bottom: 16px;
      }
      .tx-empty-title {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--ink);
        margin: 0 0 6px;
      }
      .tx-empty-text {
        font-size: 14px;
        color: var(--ink-3);
        margin: 0 auto 18px;
        max-width: 460px;
        line-height: 1.5;
      }
      .tx-empty-cta {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }
      .tx-empty-cta:hover {
        background: var(--primary-dark);
        border-color: var(--primary-dark);
      }
      .tx-empty-cta i { margin-right: 6px; }

      @media (max-width: 768px) {
        .tx-page { padding: 16px 16px 56px; }
        .tx-head { flex-direction: column; align-items: stretch; }
        .tx-head-actions { width: 100%; }
        .tx-search { flex: 1; }
        .tx-search-input { flex: 1; width: auto; }
      }
    `}</style>
  );
}
