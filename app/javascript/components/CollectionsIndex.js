import React, { useState, useEffect } from 'react';
import ShareModal from './ShareModal';
import MobileSidebarBackdrop from './MobileSidebarBackdrop';
import useIsMobile from '../hooks/useIsMobile';
import Modal from './Modal';
import NoteCard, { NoteCardStyles } from './NoteCard';
import NoteFormModal from './NoteFormModal';
import PersonFormModal from './PersonFormModal';
import ConceptFormModal from './ConceptFormModal';
import SourceFormModal from './SourceFormModal';
import PeopleSelector from './PeopleSelector';
import ConceptSelector from './ConceptSelector';
import SourceSelector from './SourceSelector';

// Type → display config.  Sidebar chip-cluster sections + per-type
// selectors share the same metadata.  Map matches /tags so the two hubs
// look and feel the same.
const TYPE_CONFIG = {
  people: {
    label: 'People', singular: 'Person',
    accent: 'var(--person)', tint: 'var(--person-tint)',
    icon: 'fa-user', listKey: 'people',
    chipClass: 'is-person', itemType: 'Person',
  },
  concepts: {
    label: 'Concepts', singular: 'Concept',
    accent: 'var(--concept)', tint: 'var(--concept-tint)',
    icon: 'fa-lightbulb', listKey: 'concepts',
    chipClass: 'is-concept', itemType: 'Concept',
  },
  sources: {
    label: 'Sources', singular: 'Source',
    accent: 'var(--source)', tint: 'var(--source-tint)',
    icon: 'fa-book-open', listKey: 'sources',
    chipClass: 'is-source', itemType: 'Source',
  },
};

const ITEM_LINK = {
  sources:  (id) => `/sources/${id}`,
  concepts: (id) => `/concepts/${id}`,
  people:   (id) => `/people/${id}`,
  notes:    (id) => `/notes/${id}`,
};

const SELECTORS = {
  people:   PeopleSelector,
  concepts: ConceptSelector,
  sources:  SourceSelector,
};
const SELECTOR_PROPS = {
  people:   'selectedPersonIds',
  concepts: 'selectedConceptIds',
  sources:  'selectedSourceIds',
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
  // Edit modal
  const [editingCollection, setEditingCollection] = useState(null);

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

  const refreshSelected = async (collectionId) => {
    const id = collectionId ?? selectedCollection?.id;
    if (!id) return;
    try {
      const res = await fetch(`/collections/${id}.json`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCollection((prev) => ({ ...prev, ...data }));
        setCollections((prev) =>
          prev.map((c) => (c.id === id ? { ...c, items_count: data.items_count } : c))
        );
      }
    } catch (e) { console.error('Refresh failed', e); }
  };

  const handleCollectionUpdated = (updated) => {
    setSelectedCollection((prev) => ({ ...prev, ...updated }));
    setCollections((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    setEditingCollection(null);
  };

  const handleToggleActive = async (collection) => {
    const next = !(collection.active !== false);
    try {
      const res = await fetch(`/collections/${collection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ collection: { active: next } }),
      });
      if (res.ok) {
        const data = await res.json();
        setCollections((prev) => prev.map((c) => (c.id === collection.id ? { ...c, ...data } : c)));
        setSelectedCollection((prev) => (prev?.id === collection.id ? { ...prev, ...data } : prev));
      } else {
        setError('Failed to update collection');
      }
    } catch {
      setError('Failed to update collection');
    }
  };

  if (loading) {
    return (
      <div className="cx-loading">
        <CXStyles />
        <NoteCardStyles />
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
        <NoteCardStyles />
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
              onEdit={() => setEditingCollection(selectedCollection)}
              onRefresh={refreshSelected}
              onToggleActive={() => handleToggleActive(selectedCollection)}
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

      <CollectionFormModal
        isOpen={!!editingCollection}
        item={editingCollection}
        onClose={() => setEditingCollection(null)}
        onSuccess={handleCollectionUpdated}
      />
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
          {collections.map((c) => {
            const archived = c.active === false;
            return (
              <li
                key={c.id}
                className={`cx-list-item${selectedId === c.id ? ' is-active' : ''}${archived ? ' is-archived' : ''}`}
                onClick={() => onSelect(c)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c); } }}
              >
                <i className={`fas ${archived ? 'fa-box-archive' : (shared ? 'fa-share-alt' : 'fa-folder')} cx-list-icon`} />
                <div className="cx-list-text">
                  <div className="cx-list-name">{c.name}</div>
                  {shared && c.owner_email && (
                    <div className="cx-list-sub">from {c.owner_email.split('@')[0]}</div>
                  )}
                </div>
                <span className="cx-list-count">{c.items_count || 0}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// =====================================================================
// Detail pane — notes-centric hub modeled on /tags TagDetail.  Hero +
// 2-col layout: NotesPanel main, sidebar with chip clusters and the
// canonical sources/concepts/people lists.
// =====================================================================
function CollectionDetail({ collection, onShare, onDelete, onRemoveItem, onEdit, onRefresh, onToggleActive }) {
  const isOwner = collection.is_owner;
  const canEdit = isOwner || collection.share_permission === 'collaborator';
  const isArchived = collection.active === false;

  // Per-type modals: link existing + create new — same pattern as /tags.
  const [openLink, setOpenLink] = useState(null);   // 'people' | 'concepts' | 'sources' | null
  const [openCreate, setOpenCreate] = useState(null);
  const [selectedIds, setSelectedIds] = useState({ people: [], concepts: [], sources: [] });

  // Notes are the heart of the collection.  null = closed, 'new' = create,
  // else edit object — same convention as TagsIndex.
  const [noteModal, setNoteModal] = useState(null);

  const stats = Object.keys(TYPE_CONFIG)
    .map((type) => ({ type, count: (collection[TYPE_CONFIG[type].listKey] || []).length }))
    .filter((s) => s.count > 0);
  const notes = collection.notes || [];

  const startLink = (type) => {
    const ids = (collection[TYPE_CONFIG[type].listKey] || []).map((it) => it.id);
    setSelectedIds((prev) => ({ ...prev, [type]: ids }));
    setOpenLink(type);
  };

  // Diff selection against current set: POST add_item for new picks,
  // DELETE remove_item for deselections.  Bulk concurrent for snappier UX.
  const handleLink = async (type) => {
    const cfg = TYPE_CONFIG[type];
    const before = new Set((collection[cfg.listKey] || []).map((it) => it.id));
    const after  = new Set(selectedIds[type]);
    const toAdd    = [...after].filter((id) => !before.has(id));
    const toRemove = [...before].filter((id) => !after.has(id));
    try {
      await Promise.all([
        ...toAdd.map((id) => addItem(collection.id, cfg.itemType, id)),
        ...toRemove.map((id) => removeItem(collection.id, cfg.itemType, id)),
      ]);
      await onRefresh();
      setOpenLink(null);
      setSelectedIds((prev) => ({ ...prev, [type]: [] }));
    } catch (e) {
      console.error(`Link ${type} failed`, e);
      alert(`Could not update ${cfg.label.toLowerCase()}.`);
    }
  };

  const handleCreated = async (type, created) => {
    const cfg = TYPE_CONFIG[type];
    if (created?.id) {
      try { await addItem(collection.id, cfg.itemType, created.id); }
      catch (e) { console.error('Auto-attach to collection failed', e); }
    }
    setOpenCreate(null);
    onRefresh();
  };

  const handleDeleteNote = async (note) => {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    try {
      const r = await fetch(`/notes/${note.id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json', 'X-CSRF-Token': csrfToken() },
      });
      if (r.ok) onRefresh();
      else alert('Could not delete the note.');
    } catch (e) {
      console.error('Delete note failed', e);
      alert('Could not delete the note.');
    }
  };

  return (
    <>
      <NoteFormModal
        isOpen={!!noteModal}
        onClose={() => setNoteModal(null)}
        item={noteModal === 'new' ? null : noteModal}
        prefill={noteModal === 'new' ? { collection_ids: [collection.id] } : undefined}
        onSuccess={async () => { setNoteModal(null); await onRefresh(); }}
      />

      <div className="cx-detail">
        <header className="cx-detail-head">
          <div className="cx-detail-titleline">
            <h1 className="cx-detail-title">{collection.name}</h1>
            {isArchived && <span className="cx-archived-badge">Archived</span>}
          </div>
          <div className="cx-detail-actions">
            {isOwner && (
              <button type="button" className="sp-action sp-action-quiet" onClick={onEdit} title="Edit collection">
                <i className="fas fa-pen" /> Edit
              </button>
            )}
            {isOwner && (
              <button type="button" className="sp-action sp-action-quiet" onClick={onShare} title="Share">
                <i className="fas fa-share-alt" /> Share
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                className="sp-action sp-action-quiet"
                onClick={onToggleActive}
                title={isArchived ? 'Unarchive collection' : 'Archive collection'}
              >
                <i className={`fas ${isArchived ? 'fa-box-open' : 'fa-box-archive'}`} /> {isArchived ? 'Unarchive' : 'Archive'}
              </button>
            )}
            {isOwner && (
              <button type="button" className="sp-action sp-action-quiet sp-action-danger" onClick={onDelete} title="Delete">
                <i className="fas fa-trash" /> Delete
              </button>
            )}
          </div>
        </header>

        {collection.description && <p className="cx-detail-desc">{collection.description}</p>}

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

        <div className="cx-2col">
          <main className="cx-2col-main">
            <NotesPanel
              notes={notes}
              canEdit={canEdit}
              onCreateNew={() => setNoteModal('new')}
              onEditNote={(note) => setNoteModal(note)}
              onDeleteNote={handleDeleteNote}
              onRemoveFromCollection={canEdit ? (note) => onRemoveItem(collection.id, 'Note', note.id) : null}
            />
          </main>

          <aside className="cx-2col-side">
            <div className="cx-side-stats">
              {Object.keys(TYPE_CONFIG).map((type) => (
                <div key={type} className="cx-side-stat">
                  <span className="cx-side-stat-value">{(collection[TYPE_CONFIG[type].listKey] || []).length}</span>
                  <span className="cx-side-stat-label">{TYPE_CONFIG[type].label}</span>
                </div>
              ))}
            </div>
            {Object.keys(TYPE_CONFIG).map((type) => (
              <SideSection
                key={type}
                type={type}
                cfg={TYPE_CONFIG[type]}
                items={collection[TYPE_CONFIG[type].listKey] || []}
                canEdit={canEdit}
                collectionId={collection.id}
                onLink={() => startLink(type)}
                onCreate={() => setOpenCreate(type)}
                onRemove={(id) => onRemoveItem(collection.id, TYPE_CONFIG[type].itemType, id).then(onRefresh)}
              />
            ))}
          </aside>
        </div>
      </div>

      {/* Link Existing modals (per type) */}
      {Object.keys(TYPE_CONFIG).map((type) => {
        const cfg = TYPE_CONFIG[type];
        const Selector = SELECTORS[type];
        const selectorProp = SELECTOR_PROPS[type];
        return (
          <Modal
            key={`link-${type}`}
            isOpen={openLink === type}
            onClose={() => setOpenLink(null)}
            title={`Link ${cfg.label} to Collection`}
            titleColor={cfg.accent}
            size="large"
          >
            <div className="cx-modal-body">
              <Selector
                {...{ [selectorProp]: selectedIds[type] }}
                onChange={(ids) => setSelectedIds((prev) => ({ ...prev, [type]: ids }))}
                themeColor={cfg.accent}
              />
            </div>
            <div className="cx-modal-footer">
              <button type="button" className="sp-action sp-action-secondary" onClick={() => setOpenLink(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="sp-action sp-action-primary cx-modal-save"
                style={{ background: cfg.accent, borderColor: cfg.accent }}
                onClick={() => handleLink(type)}
              >
                Save ({selectedIds[type].length})
              </button>
            </div>
          </Modal>
        );
      })}

      {/* Create New modals — auto-attach to this collection on success */}
      <PersonFormModal
        isOpen={openCreate === 'people'}
        onClose={() => setOpenCreate(null)}
        onSuccess={(p) => handleCreated('people', p)}
      />
      <ConceptFormModal
        isOpen={openCreate === 'concepts'}
        onClose={() => setOpenCreate(null)}
        onSuccess={(c) => handleCreated('concepts', c)}
      />
      <SourceFormModal
        isOpen={openCreate === 'sources'}
        onClose={() => setOpenCreate(null)}
        onSuccess={(s) => handleCreated('sources', s)}
      />
    </>
  );
}

async function addItem(collectionId, itemType, itemId) {
  const r = await fetch(`/collections/${collectionId}/add_item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
    body: JSON.stringify({ item_type: itemType, item_id: itemId }),
  });
  if (!r.ok) throw new Error(`add_item ${r.status}`);
}

async function removeItem(collectionId, itemType, itemId) {
  const r = await fetch(`/collections/${collectionId}/remove_item`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
    body: JSON.stringify({ item_type: itemType, item_id: itemId }),
  });
  if (!r.ok) throw new Error(`remove_item ${r.status}`);
}

// =====================================================================
// Notes panel — central column.  Big void when empty, list of NoteCards
// when populated.  Click a card to edit; "+ New Note" creates and
// auto-attaches to this collection.  Mirrors /tags NotesPanel.
// =====================================================================
function NotesPanel({ notes, canEdit, onCreateNew, onEditNote, onDeleteNote, onRemoveFromCollection }) {
  if (notes.length === 0) {
    return canEdit ? (
      <button type="button" className="cx-notes-void" onClick={onCreateNew}>
        <span className="cx-notes-void-plus">+</span>
        <span className="cx-notes-void-label">Add a note for this collection</span>
        <span className="cx-notes-void-hint">
          Quick logs, decisions, takeaways — anything tied to this project lives here.
        </span>
      </button>
    ) : (
      <div className="cx-notes-empty">
        <p>No notes in this collection yet.</p>
      </div>
    );
  }
  return (
    <section className="cx-notes">
      <header className="cx-notes-head">
        <h2 className="cx-notes-heading">
          Notes <span className="cx-notes-count">{notes.length}</span>
        </h2>
        {canEdit && (
          <button type="button" className="sp-action sp-action-primary cx-notes-cta" onClick={onCreateNew}>
            <i className="fas fa-pen-fancy" /> New Note
          </button>
        )}
      </header>
      <ul className="nx-list nx-list-card">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onView={canEdit ? onEditNote : undefined}
            onEdit={canEdit ? onEditNote : undefined}
            onDelete={canEdit ? onDeleteNote : undefined}
            omitChips={['collection']}
          />
        ))}
      </ul>
    </section>
  );
}

// =====================================================================
// Sidebar section — chip clusters per type, with calm Link/New footer
// buttons.  Mirrors the /tags SideSection with one extra affordance:
// per-chip remove (since collections support direct removal).
// =====================================================================
function SideSection({ type, cfg, items, canEdit, collectionId, onLink, onCreate, onRemove }) {
  // Default cap of 10 per section.  Click "Show more" to reveal the rest;
  // click "Show less" to recollapse.  Per-section local state so opening
  // one cluster doesn't change the others.
  const COLLAPSED = 10;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSED);
  const overflow = items.length - visible.length;
  const canCollapse = items.length > COLLAPSED;

  return (
    <div className="cx-side-section" style={{ '--cx-side-color': cfg.accent }}>
      <header className="cx-side-head">
        <span className="cx-side-label">
          <span className="cx-side-dot" aria-hidden="true" />
          {cfg.label}
        </span>
        <span className="cx-side-count">{items.length}</span>
      </header>

      {items.length === 0 ? (
        <p className="cx-side-empty">None linked yet.</p>
      ) : (
        <div className="cx-side-chips">
          {visible.map((it) => {
            const label = it.label || it.full_name || it.title || 'Untitled';
            const tooltip = type === 'sources' && it.year ? `${label} (${it.year})` : label;
            return (
              <a
                key={it.id}
                href={ITEM_LINK[type](it.id)}
                className={`sp-chip ${cfg.chipClass} cx-side-chip`}
                title={tooltip}
              >
                {label}
              </a>
            );
          })}
        </div>
      )}

      {canCollapse && (
        <button
          type="button"
          className="cx-side-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : `Show ${overflow} more`}
        </button>
      )}

      {canEdit && (
        <div className="cx-side-foot">
          <button
            type="button"
            className="cx-side-foot-btn"
            onClick={onLink}
            title={`Link existing ${cfg.label.toLowerCase()}`}
          >
            <i className="fas fa-link" /> Link
          </button>
          <button
            type="button"
            className="cx-side-foot-btn"
            onClick={onCreate}
            title={`Create new ${cfg.singular.toLowerCase()}`}
          >
            <i className="fas fa-plus" /> New
          </button>
        </div>
      )}
    </div>
  );
}

function formatPermission(p) {
  if (!p) return '';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

// =====================================================================
// Edit-collection modal — minimal name + description form.  Mirrors
// TagFormModal in chrome.
// =====================================================================
function CollectionFormModal({ isOpen, item, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(item?.name || '');
    setDescription(item?.description || '');
    setError('');
  }, [isOpen, item]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const url = item?.id ? `/collections/${item.id}` : '/collections';
      const method = item?.id ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ collection: { name: name.trim(), description: description.trim() } }),
      });
      if (r.ok) {
        const data = await r.json();
        onSuccess({ ...item, ...data });
      } else {
        const data = await r.json();
        setError(data.errors?.join(', ') || 'Failed to save collection');
      }
    } catch (e) {
      console.error('Save collection failed', e);
      setError('Failed to save collection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Collection" size="medium">
      <form onSubmit={handleSubmit} className="cx-cfm-body">
        {error && <div className="cx-cfm-error">{error}</div>}
        <div className="cx-cfm-field">
          <label className="cx-cfm-label">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
            placeholder="Dissertation Lit Review"
            autoFocus
            required
          />
        </div>
        <div className="cx-cfm-field">
          <label className="cx-cfm-label">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-textarea"
            rows={3}
            placeholder="Optional — what this collection is for."
          />
        </div>
        <div className="cx-cfm-foot">
          <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="sp-action sp-action-primary cx-cfm-save"
            disabled={submitting || !name.trim()}
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
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
      .cx-list-item.is-archived .cx-list-name { font-style: italic; }
      .cx-list-item.is-archived:not(.is-active) { opacity: 0.55; }

      .cx-archived-badge {
        font-family: var(--font-body);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 3px 8px;
        align-self: center;
        flex-shrink: 0;
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

      /* ---------- 2-col body: notes main + chip-cluster sidebar ---------- */
      .cx-2col {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
        gap: 32px;
        margin-top: 18px;
      }
      .cx-2col-main { min-width: 0; }
      .cx-2col-side {
        display: flex;
        flex-direction: column;
        gap: 22px;
        position: sticky;
        top: 16px;
        align-self: flex-start;
      }

      /* ---------- Sidebar stat tiles (mirrors tx-side-stats) ---------- */
      .cx-side-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--ink-line);
      }
      .cx-side-stat { display: flex; flex-direction: column; gap: 2px; }
      .cx-side-stat-value {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--primary);
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
      }
      .cx-side-stat-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      /* ---------- Sidebar chip-cluster sections ---------- */
      .cx-side-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cx-side-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .cx-side-label {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .cx-side-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--cx-side-color, var(--ink-3));
        flex-shrink: 0;
        position: relative;
        top: 1px;
      }
      .cx-side-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
      }
      .cx-side-empty {
        margin: 0;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-4);
        font-style: italic;
      }
      .cx-side-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }
      .cx-side-chip {
        text-decoration: none;
        max-width: 240px;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: filter 0.12s;
      }
      a.cx-side-chip:hover { filter: brightness(0.95); }
      .cx-side-toggle {
        align-self: flex-start;
        margin-top: 4px;
        padding: 2px 0;
        background: none;
        border: none;
        cursor: pointer;
        font-family: var(--font-body);
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--cx-side-color, var(--primary));
        opacity: 0.75;
        transition: opacity 0.12s;
      }
      .cx-side-toggle:hover { opacity: 1; text-decoration: underline; text-underline-offset: 3px; }
      .cx-side-foot {
        display: inline-flex;
        gap: 14px;
        margin-top: 6px;
      }
      .cx-side-foot-btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: color 0.12s;
      }
      .cx-side-foot-btn:hover { color: var(--cx-side-color, var(--ink-2)); }
      .cx-side-foot-btn i { font-size: 9.5px; opacity: 0.85; }

      /* ---------- Notes panel (main column) ---------- */
      .cx-notes-void {
        width: 100%;
        background: var(--paper-soft);
        border: 2px dashed var(--ink-line);
        border-radius: var(--r-lg);
        padding: 56px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
        cursor: pointer;
        font-family: inherit;
        color: var(--ink-3);
        transition: border-color 0.15s, background 0.15s, color 0.15s;
      }
      .cx-notes-void:hover {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 4%, var(--paper-soft));
        color: var(--ink-2);
      }
      .cx-notes-void-plus {
        font-family: var(--font-display);
        font-size: 36px;
        line-height: 1;
        color: var(--primary);
      }
      .cx-notes-void-label {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
      }
      .cx-notes-void-hint {
        font-family: var(--font-body);
        font-size: 13px;
        max-width: 420px;
      }
      .cx-notes-empty {
        padding: 32px 16px;
        text-align: center;
        color: var(--ink-4);
        font-family: var(--font-body);
        font-size: 13px;
      }
      .cx-notes { display: flex; flex-direction: column; gap: 14px; }
      .cx-notes-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }
      .cx-notes-heading {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
      }
      .cx-notes-count {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--ink-3);
        font-weight: 400;
      }
      .cx-notes-cta { background: var(--primary); border-color: var(--primary); color: var(--paper); }
      .cx-notes-cta:hover { background: var(--primary-dark); border-color: var(--primary-dark); }

      /* ---------- Modals ---------- */
      .cx-modal-body { padding: 16px 24px; min-height: 320px; }
      .cx-modal-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        padding: 14px 24px;
        border-top: 1px solid var(--ink-line);
        background: var(--paper-soft);
      }
      .cx-modal-save { color: var(--paper); }

      /* Edit-collection modal */
      .cx-cfm-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 22px 24px 14px;
      }
      .cx-cfm-error {
        padding: 10px 14px;
        background: color-mix(in srgb, var(--error) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
        border-radius: var(--r-md);
        color: var(--error);
        font-family: var(--font-body);
        font-size: 13px;
      }
      .cx-cfm-field { display: flex; flex-direction: column; gap: 6px; }
      .cx-cfm-label {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--primary);
      }
      .cx-cfm-foot {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 14px 0 6px;
        border-top: 1px solid var(--ink-line);
        margin-top: 4px;
      }
      .cx-cfm-save {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }
      .cx-cfm-save:hover:not(:disabled) {
        background: var(--primary-dark);
        border-color: var(--primary-dark);
      }

      /* ---------- Responsive ---------- */
      @media (max-width: 900px) {
        .cx-2col { grid-template-columns: 1fr; }
        .cx-2col-side { position: static; order: 1; }
        .cx-2col-main { order: 2; }
      }
      @media (max-width: 768px) {
        .cx-detail { padding: 18px 16px 56px; }
        .cx-detail-title { font-size: 24px; }
        .cx-detail-head { flex-direction: column; align-items: stretch; }
      }
    `}</style>
  );
}
