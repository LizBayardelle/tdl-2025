import React, { useState, useEffect, useMemo } from 'react';

function csrfToken() {
  return document.querySelector('[name="csrf-token"]')?.content;
}

export default function CollectionsIndex() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchCollections(); }, []);

  // Auto-open the create form when arriving via the nav's "+ New Collection"
  // (which links to /collections?new=1).  Strip the param so a refresh
  // doesn't re-open the form.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      setShowCreateForm(true);
      params.delete('new');
      const q = params.toString();
      window.history.replaceState(null, '', q ? `${window.location.pathname}?${q}` : window.location.pathname);
    }
  }, []);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/collections.json');
      if (res.ok) setCollections(await res.json());
      else setError('Failed to load collections');
    } catch {
      setError('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ collection: { name: newName.trim(), description: newDescription.trim() } }),
      });
      if (res.ok) {
        const newCollection = await res.json();
        window.location.href = `/collections/${newCollection.id}`;
      } else {
        const data = await res.json();
        setError(data.errors?.join(', ') || 'Failed to create collection');
      }
    } catch {
      setError('Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  const { mine, shared, totalItems } = useMemo(() => {
    const filtered = query.trim()
      ? collections.filter((c) => {
          const q = query.trim().toLowerCase();
          return (c.name || '').toLowerCase().includes(q)
              || (c.description || '').toLowerCase().includes(q);
        })
      : collections;
    return {
      mine:   filtered.filter((c) => c.is_owner),
      shared: filtered.filter((c) => !c.is_owner),
      totalItems: collections.reduce((sum, c) => sum + (c.items_count || 0), 0),
    };
  }, [collections, query]);

  if (loading) {
    return (
      <div className="cx-loading">
        <CXStyles />
        Loading collections.
      </div>
    );
  }

  return (
    <div className="cx-page">
      <CXStyles />

      <header className="cx-head">
        <div className="cx-head-text">
          <h1 className="cx-title">Collections</h1>
          <p className="cx-sub">{collections.length} collection{collections.length === 1 ? '' : 's'} · {totalItems} item{totalItems === 1 ? '' : 's'}</p>
        </div>
        <div className="cx-head-actions">
          <div className="cx-search">
            <i className="fas fa-search cx-search-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search collections."
              className="cx-search-input"
            />
            {query && (
              <button type="button" className="cx-search-clear" onClick={() => setQuery('')} aria-label="Clear">×</button>
            )}
          </div>
          <button
            type="button"
            className="sp-action sp-action-primary cx-new-cta"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            <i className="fas fa-plus" /> New Collection
          </button>
        </div>
      </header>

      {showCreateForm && (
        <form className="cx-create" onSubmit={handleCreate}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Collection name"
            className="form-input"
            autoFocus
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="form-input"
          />
          <div className="cx-create-actions">
            <button type="button" className="sp-action sp-action-secondary" onClick={() => { setShowCreateForm(false); setNewName(''); setNewDescription(''); }}>
              Cancel
            </button>
            <button
              type="submit"
              className="sp-action sp-action-primary cx-create-primary"
              disabled={creating || !newName.trim()}
            >
              {creating ? 'Creating…' : 'Create & Open'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="cx-error" role="alert">
          {error}
          <button type="button" className="cx-error-x" onClick={() => setError('')} aria-label="Dismiss">×</button>
        </div>
      )}

      {collections.length === 0 ? (
        <EmptyState onCreate={() => setShowCreateForm(true)} />
      ) : (
        <>
          <CardSection
            label="My Collections"
            collections={mine}
            empty={query.trim() ? 'No matches.' : 'No collections yet.'}
          />

          {(shared.length > 0 || (query.trim() && collections.some((c) => !c.is_owner))) && (
            <CardSection
              label="Shared with Me"
              collections={shared}
              shared
              empty={query.trim() ? 'No matches.' : null}
            />
          )}
        </>
      )}
    </div>
  );
}

function CardSection({ label, collections, empty, shared }) {
  if (collections.length === 0 && !empty) return null;
  return (
    <section className="cx-section">
      <h2 className="cx-section-label">{label} ({collections.length})</h2>
      {collections.length === 0 ? (
        <p className="cx-section-empty">{empty}</p>
      ) : (
        <div className="cx-grid">
          {collections.map((c) => <CollectionCard key={c.id} collection={c} shared={shared} />)}
        </div>
      )}
    </section>
  );
}

function CollectionCard({ collection, shared }) {
  const counts = collection.counts || {};
  const archived = collection.active === false;
  const itemCount = collection.items_count ?? 0;

  // Server doesn't send per-type counts on the index payload today — fall back
  // to total items_count.  Per-type breakdown surfaces only on the show page.
  const breakdown = [
    counts.sources != null  && { label: 'sources',  value: counts.sources  },
    counts.notes != null    && { label: 'notes',    value: counts.notes    },
    counts.concepts != null && { label: 'concepts', value: counts.concepts },
    counts.people != null   && { label: 'people',   value: counts.people   },
  ].filter(Boolean);

  return (
    <a
      href={`/collections/${collection.id}`}
      className={`cx-card${archived ? ' is-archived' : ''}`}
    >
      <header className="cx-card-head">
        <i className={`fas ${archived ? 'fa-box-archive' : (shared ? 'fa-share-alt' : 'fa-folder')} cx-card-icon`} />
        <h3 className="cx-card-name">{collection.name}</h3>
        {archived && <span className="cx-card-archived">Archived</span>}
      </header>

      {collection.description && (
        <p className="cx-card-desc">{collection.description}</p>
      )}

      {shared && collection.owner_email && (
        <p className="cx-card-shared">
          <i className="fas fa-user-circle" /> from {collection.owner_email}
          {collection.share_permission && (
            <span className="cx-card-perm">{collection.share_permission}</span>
          )}
        </p>
      )}

      <footer className="cx-card-foot">
        {breakdown.length > 0 ? (
          <div className="cx-card-stats">
            {breakdown.map((b) => (
              <span key={b.label} className="cx-card-stat">
                <strong>{b.value}</strong> {b.label}
              </span>
            ))}
          </div>
        ) : (
          <span className="cx-card-itemcount">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
        )}
        <span className="cx-card-arrow">→</span>
      </footer>
    </a>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="cx-empty">
      <i className="fas fa-folder-open cx-empty-icon" />
      <h2 className="cx-empty-title">No collections yet</h2>
      <p className="cx-empty-text">
        Group sources, notes, concepts, and people by project — dissertations, lit reviews, course bibliographies.
      </p>
      <button type="button" className="sp-action sp-action-primary cx-empty-cta" onClick={onCreate}>
        <i className="fas fa-plus" /> Create your first collection
      </button>
    </div>
  );
}

function CXStyles() {
  return (
    <style>{`
      .cx-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 80px 24px;
        font-family: var(--font-body);
        color: var(--ink-3);
      }

      .cx-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px 32px 80px;
      }

      .cx-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .cx-head-text { min-width: 0; }
      .cx-title {
        font-family: var(--font-display);
        font-size: 30px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        line-height: 1.15;
        letter-spacing: -0.02em;
      }
      .cx-sub {
        margin: 4px 0 0;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
      }
      .cx-head-actions {
        display: inline-flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }

      .cx-search {
        position: relative;
        display: inline-flex;
        align-items: center;
      }
      .cx-search-icon {
        position: absolute;
        left: 10px;
        font-size: 11px;
        color: var(--ink-4);
      }
      .cx-search-input {
        font-family: var(--font-body);
        font-size: 13px;
        padding: 8px 28px 8px 28px;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        width: 240px;
        background: var(--paper);
      }
      .cx-search-input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
      }
      .cx-search-clear {
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

      .cx-new-cta {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }
      .cx-new-cta:hover {
        background: var(--primary-dark);
        border-color: var(--primary-dark);
      }
      .cx-new-cta i { margin-right: 6px; }

      .cx-create {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        margin-bottom: 20px;
        max-width: 560px;
      }
      .cx-create-actions { display: flex; gap: 8px; justify-content: flex-end; }
      .cx-create-primary {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }
      .cx-create-primary:hover:not(:disabled) {
        background: var(--primary-dark);
        border-color: var(--primary-dark);
      }

      .cx-error {
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
      .cx-error-x {
        background: transparent;
        border: none;
        color: var(--error);
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 0 4px;
      }

      .cx-section { margin-bottom: 32px; }
      .cx-section-label {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin: 0 0 10px;
      }
      .cx-section-empty {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-4);
        font-style: italic;
        margin: 0;
        padding: 12px 0;
      }

      .cx-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 14px;
      }

      .cx-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 16px 18px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
        min-height: 160px;
      }
      .cx-card:hover {
        border-color: var(--primary);
        box-shadow: 0 4px 12px rgba(31, 59, 115, 0.10);
        transform: translateY(-1px);
      }
      .cx-card.is-archived {
        opacity: 0.7;
        background: var(--paper-soft);
      }

      .cx-card-head {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .cx-card-icon {
        font-size: 13px;
        color: var(--primary);
        opacity: 0.8;
        flex-shrink: 0;
      }
      .cx-card-name {
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
      .cx-card-archived {
        font-family: var(--font-body);
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 2px 6px;
        flex-shrink: 0;
      }

      .cx-card-desc {
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

      .cx-card-shared {
        margin: 0;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .cx-card-shared i { font-size: 10px; opacity: 0.7; }
      .cx-card-perm {
        font-family: var(--font-body);
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        background: var(--primary);
        color: var(--paper);
        padding: 1px 6px;
        border-radius: var(--r-sm);
      }

      .cx-card-foot {
        margin-top: auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--ink-line);
      }
      .cx-card-stats {
        display: inline-flex;
        gap: 10px;
        flex-wrap: wrap;
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-3);
      }
      .cx-card-stat strong {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--primary);
        font-weight: 700;
        margin-right: 2px;
      }
      .cx-card-itemcount {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
      }
      .cx-card-arrow {
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-3);
        opacity: 0;
        transition: opacity 0.15s, transform 0.15s;
      }
      .cx-card:hover .cx-card-arrow {
        opacity: 1;
        transform: translateX(2px);
      }

      .cx-empty {
        text-align: center;
        padding: 80px 24px;
        font-family: var(--font-body);
      }
      .cx-empty-icon {
        font-size: 56px;
        color: var(--primary);
        opacity: 0.4;
        margin-bottom: 16px;
      }
      .cx-empty-title {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--ink);
        margin: 0 0 6px;
      }
      .cx-empty-text {
        font-size: 14px;
        color: var(--ink-3);
        margin: 0 0 18px;
        max-width: 460px;
        margin-left: auto;
        margin-right: auto;
        line-height: 1.5;
      }
      .cx-empty-cta {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }
      .cx-empty-cta:hover {
        background: var(--primary-dark);
        border-color: var(--primary-dark);
      }
      .cx-empty-cta i { margin-right: 6px; }

      @media (max-width: 768px) {
        .cx-page { padding: 16px 16px 56px; }
        .cx-head { flex-direction: column; align-items: stretch; }
        .cx-head-actions { width: 100%; }
        .cx-search-input { flex: 1; width: auto; }
      }
    `}</style>
  );
}
