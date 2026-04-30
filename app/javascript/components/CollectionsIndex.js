import React, { useState, useEffect } from 'react';
import ShareModal from './ShareModal';
import MobileSidebarBackdrop from './MobileSidebarBackdrop';
import useIsMobile from '../hooks/useIsMobile';

// Type → display config.  Used everywhere we render an item card so the
// color/icon mapping stays consistent.
const TYPE_CONFIG = {
  sources:  { label: 'Sources',  singular: 'Source',  accent: 'var(--source)',  tint: 'var(--source-tint)',  icon: 'fa-book-open' },
  concepts: { label: 'Concepts', singular: 'Concept', accent: 'var(--concept)', tint: 'var(--concept-tint)', icon: 'fa-lightbulb' },
  people:   { label: 'People',   singular: 'Person',  accent: 'var(--person)',  tint: 'var(--person-tint)',  icon: 'fa-user' },
  notes:    { label: 'Notes',    singular: 'Note',    accent: '#639CA1',        tint: '#E1EEEF',             icon: 'fa-pen-fancy' },
};

const ITEM_LINK = {
  sources:  (id) => `/sources/${id}`,
  concepts: (id) => `/concepts/${id}`,
  people:   (id) => `/people/${id}`,
  notes:    (id) => `/notes/${id}`,
};

export default function CollectionsIndex() {
  const isMobile = useIsMobile();
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Share modal
  const [shareCollection, setShareCollection] = useState(null);

  useEffect(() => { fetchCollections(); }, []);

  // Auto-select first collection on initial load
  useEffect(() => {
    if (collections.length > 0 && !selectedCollection) {
      handleCollectionClick(collections[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections]);

  useEffect(() => {
    const handleResize = () => setSidebarOpen(window.innerWidth >= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  const handleCollectionClick = async (collection) => {
    try {
      const res = await fetch(`/collections/${collection.id}.json`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCollection({ ...collection, ...data });
        if (window.innerWidth < 768) setSidebarOpen(false);
      }
    } catch (e) {
      console.error('Failed to load collection details', e);
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
        const withMeta = { ...newCollection, is_owner: true, items_count: 0 };
        setCollections([withMeta, ...collections]);
        setNewName('');
        setNewDescription('');
        setShowCreateForm(false);
        handleCollectionClick(withMeta);
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

  const handleDelete = async (id) => {
    if (!confirm('Delete this collection?  Items inside it stay where they are.')) return;
    try {
      const res = await fetch(`/collections/${id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken() },
      });
      if (res.ok) {
        setCollections((prev) => prev.filter((c) => c.id !== id));
        if (selectedCollection?.id === id) setSelectedCollection(null);
      }
    } catch {
      setError('Failed to delete collection');
    }
  };

  const handleRemoveItem = async (collectionId, itemType, itemId) => {
    try {
      const res = await fetch(`/collections/${collectionId}/remove_item`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ item_type: itemType, item_id: itemId }),
      });
      if (res.ok) {
        const refreshed = await fetch(`/collections/${collectionId}.json`);
        if (refreshed.ok) {
          const data = await refreshed.json();
          setSelectedCollection((prev) => ({ ...prev, ...data }));
          setCollections((prev) =>
            prev.map((c) => (c.id === collectionId ? { ...c, items_count: Math.max(0, (c.items_count || 1) - 1) } : c)),
          );
        }
      }
    } catch (e) {
      console.error('Failed to remove item', e);
    }
  };

  if (loading) {
    return (
      <div className="cx-loading">
        <CXStyles />
        Loading collections.
      </div>
    );
  }

  const myCollections     = collections.filter((c) => c.is_owner);
  const sharedCollections = collections.filter((c) => !c.is_owner);
  const totalItems        = collections.reduce((sum, c) => sum + (c.items_count || 0), 0);

  return (
    <>
      <div className="cx-shell">
        <CXStyles />
        <MobileSidebarBackdrop isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <button
          type="button"
          className="cx-sidebar-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
          style={{ left: sidebarOpen ? '280px' : '0' }}
          aria-label="Toggle collection list"
        >
          <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`} />
        </button>

        {sidebarOpen && (
          <aside className={`cx-sidebar${isMobile ? ' is-mobile' : ''}`}>
            <header className="cx-sidebar-head">
              <div>
                <h2 className="cx-sidebar-title">Collections</h2>
                <p className="cx-sidebar-sub">{collections.length} · {totalItems} items</p>
              </div>
              <button
                type="button"
                className="cx-newbtn"
                onClick={() => setShowCreateForm((v) => !v)}
                title="New collection"
                aria-label="New collection"
              >
                <i className="fas fa-plus" />
              </button>
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
                  <button
                    type="submit"
                    className="sp-action sp-action-primary cx-create-primary"
                    disabled={creating || !newName.trim()}
                  >
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    type="button"
                    className="sp-action sp-action-secondary"
                    onClick={() => { setShowCreateForm(false); setNewName(''); setNewDescription(''); }}
                  >
                    Cancel
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

            <CollectionsList
              label="My Collections"
              collections={myCollections}
              selectedId={selectedCollection?.id}
              onSelect={handleCollectionClick}
              empty="No collections yet"
            />

            {sharedCollections.length > 0 && (
              <CollectionsList
                label="Shared with Me"
                collections={sharedCollections}
                selectedId={selectedCollection?.id}
                onSelect={handleCollectionClick}
                shared
              />
            )}
          </aside>
        )}

        <main className="cx-main">
          {selectedCollection ? (
            <CollectionDetail
              collection={selectedCollection}
              onShare={() => setShareCollection({ id: selectedCollection.id, name: selectedCollection.name, type: 'Collection' })}
              onDelete={() => handleDelete(selectedCollection.id)}
              onRemoveItem={handleRemoveItem}
            />
          ) : (
            <div className="cx-empty-main">
              <i className="fas fa-folder-open cx-empty-icon" />
              <p className="cx-empty-text">Select a collection to view its contents.</p>
            </div>
          )}
        </main>
      </div>

      {shareCollection && (
        <ShareModal
          isOpen={!!shareCollection}
          onClose={() => setShareCollection(null)}
          shareable={shareCollection}
        />
      )}
    </>
  );
}

function csrfToken() {
  return document.querySelector('[name="csrf-token"]')?.content;
}

// =====================================================================
// Sidebar list — My / Shared section
// =====================================================================
function CollectionsList({ label, collections, selectedId, onSelect, empty, shared }) {
  return (
    <section className="cx-list">
      <h3 className="cx-list-label">{label} ({collections.length})</h3>
      {collections.length === 0 ? (
        <p className="cx-list-empty">{empty}</p>
      ) : (
        <ul>
          {collections.map((c) => (
            <li
              key={c.id}
              className={`cx-list-item${selectedId === c.id ? ' is-active' : ''}`}
              onClick={() => onSelect(c)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c); } }}
            >
              <i className={`fas ${shared ? 'fa-share-alt' : 'fa-folder'} cx-list-icon`} />
              <div className="cx-list-text">
                <div className="cx-list-name">{c.name}</div>
                {shared && c.owner_email && (
                  <div className="cx-list-sub">from {c.owner_email.split('@')[0]}</div>
                )}
              </div>
              <span className="cx-list-count">{c.items_count || 0}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// =====================================================================
// Detail pane — modeled on SourceShow chrome
// =====================================================================
function CollectionDetail({ collection, onShare, onDelete, onRemoveItem }) {
  const isOwner = collection.is_owner;
  const totalItems = collection.items_count || 0;
  const isEmpty = totalItems === 0;
  const stats = ['sources', 'concepts', 'people', 'notes']
    .map((type) => ({ type, count: collection[type]?.length || 0 }))
    .filter((s) => s.count > 0);

  return (
    <div className="cx-detail">
      <header className="cx-detail-head">
        <div className="cx-detail-titleline">
          <i className="fas fa-folder-open cx-detail-folder" />
          <h1 className="cx-detail-title">{collection.name}</h1>
        </div>
        {isOwner && (
          <div className="cx-detail-actions">
            <button type="button" className="sp-action sp-action-quiet" onClick={onShare} title="Share">
              <i className="fas fa-share-alt" /> Share
            </button>
            <button type="button" className="sp-action sp-action-quiet sp-action-danger" onClick={onDelete} title="Delete">
              <i className="fas fa-trash" /> Delete
            </button>
          </div>
        )}
      </header>

      {collection.description && (
        <p className="cx-detail-desc">{collection.description}</p>
      )}

      {!isOwner && (
        <div className="cx-share-info">
          <span className="cx-share-label">Shared by:</span>
          <span className="cx-share-value">{collection.owner_email}</span>
          <span className="cx-share-perm">{formatPermission(collection.share_permission)}</span>
        </div>
      )}

      {isOwner && Array.isArray(collection.shares) && collection.shares.length > 0 && (
        <div className="cx-share-info is-owner">
          <div className="cx-share-info-head">
            <i className="fas fa-users" /> Shared with
          </div>
          <ul className="cx-share-list">
            {collection.shares.map((s) => (
              <li key={s.id}>
                <span>{s.email}</span>
                <span className="cx-share-perm">{formatPermission(s.permission)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.length > 0 && (
        <div className="cx-stats">
          {stats.map(({ type, count }) => (
            <div key={type} className="cx-stat" style={{ '--cx-stat-color': TYPE_CONFIG[type].accent }}>
              <i className={`fas ${TYPE_CONFIG[type].icon}`} />
              <div className="cx-stat-text">
                <div className="cx-stat-value">{count}</div>
                <div className="cx-stat-label">{TYPE_CONFIG[type].label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isEmpty ? (
        <div className="cx-detail-empty">
          <i className="fas fa-inbox cx-detail-empty-icon" />
          <p>This collection is empty.</p>
          <p className="cx-detail-empty-hint">Add items from their detail pages.</p>
        </div>
      ) : (
        <div className="cx-sections">
          {Object.keys(TYPE_CONFIG).map((type) => {
            const items = collection[type] || [];
            if (items.length === 0) return null;
            const cfg = TYPE_CONFIG[type];
            return (
              <section key={type} className="cx-section">
                <h2 className="cx-section-head" style={{ '--cx-section-color': cfg.accent }}>
                  <i className={`fas ${cfg.icon}`} /> {cfg.label}
                  <span className="cx-section-count">{items.length}</span>
                </h2>
                <div className="cx-items-grid">
                  {items.map((item) => (
                    <ItemCard
                      key={`${type}-${item.id}`}
                      item={item}
                      type={type}
                      cfg={cfg}
                      canRemove={isOwner}
                      onRemove={() => onRemoveItem(collection.id, cfg.singular, item.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, type, cfg, canRemove, onRemove }) {
  const label = item.title || item.label || item.full_name || (item.body ? item.body.slice(0, 60) : 'Untitled');
  return (
    <article className="cx-item-card" style={{ '--cx-item-color': cfg.accent }}>
      <a href={ITEM_LINK[type](item.id)} className="cx-item-link" title={label}>
        {label}
      </a>
      {canRemove && (
        <button
          type="button"
          className="cx-item-remove"
          onClick={(e) => { e.preventDefault(); onRemove(); }}
          aria-label={`Remove from collection`}
          title="Remove from collection"
        >
          <i className="fas fa-times" />
        </button>
      )}
    </article>
  );
}

function formatPermission(p) {
  if (!p) return '';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

// =====================================================================
// Styles
// =====================================================================
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

      .cx-shell {
        display: flex;
        height: calc(100vh - 64px);
        overflow: hidden;
        position: relative;
      }

      /* ---------- Toggle ---------- */
      .cx-sidebar-toggle {
        position: absolute;
        top: 100px;
        z-index: 210;
        background: var(--primary);
        color: var(--paper);
        border: none;
        border-radius: 0 var(--r-sm) var(--r-sm) 0;
        width: 24px;
        height: 48px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: var(--shadow);
        transition: left 0.3s ease, background 0.15s;
      }
      .cx-sidebar-toggle:hover { background: var(--primary-dark); }
      .cx-sidebar-toggle i { font-size: 11px; }

      /* ---------- Sidebar ---------- */
      .cx-sidebar {
        width: 280px;
        flex-shrink: 0;
        background: var(--paper-soft);
        border-right: 1px solid var(--ink-line);
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .cx-sidebar.is-mobile {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        z-index: 200;
        box-shadow: 4px 0 16px rgba(0, 0, 0, 0.18);
      }
      .cx-sidebar-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .cx-sidebar-title {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        letter-spacing: -0.005em;
      }
      .cx-sidebar-sub {
        margin: 2px 0 0;
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-3);
      }
      .cx-newbtn {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--primary);
        color: var(--paper);
        border: none;
        cursor: pointer;
        font-size: 13px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 1px 3px rgba(31, 59, 115, 0.25);
        transition: background 0.15s, transform 0.15s;
      }
      .cx-newbtn:hover {
        background: var(--primary-dark);
        transform: translateY(-1px);
      }

      .cx-create {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
      }
      .cx-create-actions { display: flex; gap: 6px; }
      .cx-create-actions > * { flex: 1; }
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

      /* ---------- Sidebar lists ---------- */
      .cx-list { display: flex; flex-direction: column; gap: 4px; }
      .cx-list-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin: 0 0 6px;
      }
      .cx-list-empty {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-4);
        font-style: italic;
        margin: 0;
        padding: 8px 4px;
      }
      .cx-list ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
      .cx-list-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: var(--r-sm);
        cursor: pointer;
        font-family: var(--font-body);
        color: var(--ink);
        transition: background 0.12s, color 0.12s;
      }
      .cx-list-item:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); }
      .cx-list-item.is-active {
        background: var(--primary);
        color: var(--paper);
      }
      .cx-list-icon {
        font-size: 11px;
        opacity: 0.7;
        flex-shrink: 0;
      }
      .cx-list-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .cx-list-name {
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cx-list-sub {
        font-size: 10.5px;
        opacity: 0.7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 1px;
      }
      .cx-list-count {
        font-family: var(--font-mono);
        font-size: 11px;
        opacity: 0.7;
        flex-shrink: 0;
      }

      /* ---------- Main pane ---------- */
      .cx-main {
        flex: 1;
        overflow-y: auto;
        background: var(--paper);
      }
      .cx-empty-main {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--ink-3);
        font-family: var(--font-body);
        gap: 12px;
      }
      .cx-empty-icon {
        font-size: 56px;
        color: var(--primary);
        opacity: 0.4;
      }
      .cx-empty-text {
        margin: 0;
        font-size: 14px;
      }

      /* ---------- Detail ---------- */
      .cx-detail {
        max-width: 1080px;
        margin: 0 auto;
        padding: 24px 32px 80px;
      }

      .cx-detail-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 8px;
      }
      .cx-detail-titleline {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }
      .cx-detail-folder {
        color: var(--primary);
        font-size: 22px;
        flex-shrink: 0;
      }
      .cx-detail-title {
        font-family: var(--font-display);
        font-size: 32px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        line-height: 1.15;
        letter-spacing: -0.02em;
        text-wrap: balance;
        min-width: 0;
      }
      .cx-detail-actions {
        display: inline-flex;
        gap: 4px;
        flex-shrink: 0;
      }
      .cx-detail-actions .sp-action i { margin-right: 6px; }

      .cx-detail-desc {
        font-family: var(--font-body);
        font-size: 14.5px;
        line-height: 1.65;
        color: var(--ink-2);
        margin: 0 0 20px;
        max-width: 720px;
      }

      /* ---------- Share info boxes ---------- */
      .cx-share-info {
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 12px 14px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .cx-share-info.is-owner { display: block; }
      .cx-share-info-head {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: var(--ink-2);
        margin-bottom: 8px;
      }
      .cx-share-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .cx-share-list li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12.5px;
      }
      .cx-share-label {
        font-weight: 500;
        color: var(--ink-3);
      }
      .cx-share-value {
        color: var(--ink);
        font-weight: 500;
      }
      .cx-share-perm {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        background: var(--primary);
        color: var(--paper);
        padding: 2px 8px;
        border-radius: var(--r-sm);
      }

      /* ---------- Stats grid ---------- */
      .cx-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin-bottom: 28px;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--ink-line);
      }
      .cx-stat {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-left: 3px solid var(--cx-stat-color, var(--ink-3));
        border-radius: var(--r-md);
      }
      .cx-stat i {
        font-size: 18px;
        color: var(--cx-stat-color, var(--ink-3));
      }
      .cx-stat-value {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.1;
      }
      .cx-stat-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      /* ---------- Sections + items ---------- */
      .cx-sections { display: flex; flex-direction: column; gap: 32px; }
      .cx-section { display: flex; flex-direction: column; gap: 12px; }
      .cx-section-head {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--cx-section-color, var(--ink));
        margin: 0;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        letter-spacing: -0.005em;
      }
      .cx-section-head i { font-size: 14px; }
      .cx-section-count {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--ink-3);
        font-weight: 400;
        margin-left: 2px;
      }

      .cx-items-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
      }

      /* Item card — type-colored top accent, hover lift, hover-only X
         button.  Compact since collections often hold many items. */
      .cx-item-card {
        position: relative;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-top: 3px solid var(--cx-item-color, var(--ink-3));
        border-radius: var(--r-md);
        padding: 12px 14px;
        box-shadow:
          0 1px 2px rgba(21, 25, 31, 0.04),
          0 8px 18px rgba(21, 25, 31, 0.05);
        transition: box-shadow 0.18s, border-color 0.18s, transform 0.18s;
      }
      .cx-item-card:hover {
        border-color: var(--cx-item-color, var(--ink-3));
        box-shadow:
          0 1px 2px rgba(21, 25, 31, 0.05),
          0 14px 28px rgba(21, 25, 31, 0.10);
        transform: translateY(-1px);
      }
      .cx-item-link {
        display: block;
        font-family: var(--font-body);
        font-size: 13.5px;
        font-weight: 500;
        line-height: 1.4;
        color: var(--ink);
        text-decoration: none;
        padding-right: 22px;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .cx-item-card:hover .cx-item-link { color: var(--cx-item-color, var(--ink)); }
      .cx-item-remove {
        position: absolute;
        top: 6px;
        right: 6px;
        background: transparent;
        border: none;
        color: var(--ink-4);
        cursor: pointer;
        padding: 4px 6px;
        border-radius: var(--r-sm);
        font-size: 11px;
        opacity: 0;
        transition: opacity 0.15s, background 0.15s, color 0.15s;
      }
      .cx-item-card:hover .cx-item-remove,
      .cx-item-card:focus-within .cx-item-remove { opacity: 1; }
      @media (hover: none) { .cx-item-remove { opacity: 1; } }
      .cx-item-remove:hover {
        background: rgba(122, 46, 46, 0.08);
        color: var(--error);
      }

      /* ---------- Detail empty state ---------- */
      .cx-detail-empty {
        text-align: center;
        padding: 56px 16px;
        color: var(--ink-3);
        font-family: var(--font-body);
      }
      .cx-detail-empty p { margin: 0; font-size: 14px; }
      .cx-detail-empty-hint {
        margin-top: 6px !important;
        font-size: 12.5px;
        color: var(--ink-4);
      }
      .cx-detail-empty-icon {
        display: block;
        font-size: 40px;
        color: var(--ink-line);
        margin-bottom: 12px;
      }

      /* ---------- Responsive ---------- */
      @media (max-width: 768px) {
        .cx-detail { padding: 18px 16px 56px; }
        .cx-detail-title { font-size: 24px; }
        .cx-detail-head { flex-direction: column; align-items: stretch; }
      }
    `}</style>
  );
}
