import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ShareModal from './ShareModal';
import Modal from './Modal';
import NoteCard, { NoteCardStyles } from './NoteCard';
import NoteFormModal from './NoteFormModal';
import PersonFormModal from './PersonFormModal';
import ConceptFormModal from './ConceptFormModal';
import SourceFormModal from './SourceFormModal';
import PeopleSelector from './PeopleSelector';
import ConceptSelector from './ConceptSelector';
import SourceSelector from './SourceSelector';

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

// Position-based colors for read-only grouping display. Matches the ladder
// used by CollectionGroupingSelect so a "Core" in position 0 reads with the
// same accent across the bibliography, sources index, and this sidebar.
const GROUPING_COLORS = [
  'var(--primary)',
  'var(--source, var(--primary))',
  'var(--concept, var(--ink-2))',
  'var(--person, var(--ink-2))',
  'var(--ink-3)'
];

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

function csrfToken() {
  return document.querySelector('[name="csrf-token"]')?.content;
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

function formatPermission(p) {
  if (!p) return '';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export default function CollectionShow({ collectionId }) {
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [shareOpen, setShareOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDocClick = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const [openLink, setOpenLink] = useState(null);
  const [openCreate, setOpenCreate] = useState(null);
  const [selectedIds, setSelectedIds] = useState({ people: [], concepts: [], sources: [] });
  const [noteModal, setNoteModal] = useState(null);

  const fetchCollection = useCallback(async () => {
    try {
      const res = await fetch(`/collections/${collectionId}.json`);
      if (res.ok) {
        setCollection(await res.json());
        setError('');
      } else if (res.status === 403) {
        setError("You don't have access to this collection.");
      } else if (res.status === 404) {
        setError('Collection not found.');
      } else {
        setError('Failed to load collection.');
      }
    } catch (e) {
      console.error('Failed to load collection', e);
      setError('Failed to load collection.');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => { fetchCollection(); }, [fetchCollection]);

  const handleDelete = async () => {
    if (!confirm('Delete this collection?  Items inside it stay where they are.')) return;
    try {
      const res = await fetch(`/collections/${collectionId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken() },
      });
      if (res.ok) window.location.href = '/collections';
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleToggleActive = async () => {
    const next = !(collection.active !== false);
    try {
      const res = await fetch(`/collections/${collectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ collection: { active: next } }),
      });
      if (res.ok) {
        const data = await res.json();
        setCollection((prev) => ({ ...prev, ...data }));
      }
    } catch (e) {
      console.error('Toggle active failed', e);
    }
  };

  const handleRemoveItem = async (itemType, itemId) => {
    try {
      const res = await fetch(`/collections/${collectionId}/remove_item`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ item_type: itemType, item_id: itemId }),
      });
      if (res.ok) await fetchCollection();
    } catch (e) {
      console.error('Remove item failed', e);
    }
  };

  const handleUpdated = (updated) => {
    setCollection((prev) => ({ ...prev, ...updated }));
    setEditing(false);
  };

  const startLink = (type) => {
    const ids = (collection[TYPE_CONFIG[type].listKey] || []).map((it) => it.id);
    setSelectedIds((prev) => ({ ...prev, [type]: ids }));
    setOpenLink(type);
  };

  const handleLink = async (type) => {
    const cfg = TYPE_CONFIG[type];
    const before = new Set((collection[cfg.listKey] || []).map((it) => it.id));
    const after  = new Set(selectedIds[type]);
    const toAdd    = [...after].filter((id) => !before.has(id));
    const toRemove = [...before].filter((id) => !after.has(id));
    try {
      await Promise.all([
        ...toAdd.map((id) => addItem(collectionId, cfg.itemType, id)),
        ...toRemove.map((id) => removeItem(collectionId, cfg.itemType, id)),
      ]);
      await fetchCollection();
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
      try { await addItem(collectionId, cfg.itemType, created.id); }
      catch (e) { console.error('Auto-attach to collection failed', e); }
    }
    setOpenCreate(null);
    fetchCollection();
  };

  const handleDeleteNote = async (note) => {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    try {
      const r = await fetch(`/notes/${note.id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json', 'X-CSRF-Token': csrfToken() },
      });
      if (r.ok) fetchCollection();
      else alert('Could not delete the note.');
    } catch (e) {
      console.error('Delete note failed', e);
      alert('Could not delete the note.');
    }
  };

  if (loading) {
    return (
      <div className="cs-loading">
        <CSStyles />
        Loading collection.
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="cs-loading">
        <CSStyles />
        <p>{error || 'Collection not found.'}</p>
        <a href="/collections" className="cs-back">← Back to Collections</a>
      </div>
    );
  }

  const isOwner = collection.is_owner;
  const canEdit = isOwner || collection.share_permission === 'collaborator';
  const isArchived = collection.active === false;
  const notes = collection.notes || [];

  return (
    <>
      <CSStyles />
      <NoteCardStyles />

      <NoteFormModal
        isOpen={!!noteModal}
        onClose={() => setNoteModal(null)}
        item={noteModal === 'new' ? null : noteModal}
        prefill={noteModal === 'new' ? { collection_ids: [collection.id] } : undefined}
        onSuccess={async () => { setNoteModal(null); await fetchCollection(); }}
      />

      <div className="cs-page">
        <a href="/collections" className="cs-back">← Collections</a>

        <header className="cs-head">
          <div className="cs-titleline">
            <h1 className="cs-title">{collection.name}</h1>
            {isArchived && <span className="cs-archived-badge">Archived</span>}
          </div>
          <div className="cs-actions">
            <a
              href={`/collections/${collection.id}/bibliography`}
              className="sp-action sp-action-quiet"
              title="Annotated bibliography"
            >
              <i className="fas fa-book-bookmark" /> Annotated Bibliography
            </a>
            {isOwner && (
              <button type="button" className="sp-action sp-action-quiet" onClick={() => setShareOpen(true)} title="Share">
                <i className="fas fa-share-alt" /> Share
              </button>
            )}
            {isOwner && (
              <div className="cs-more" ref={moreRef}>
                <button
                  type="button"
                  className="sp-action sp-action-quiet cs-more-trigger"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  onClick={(e) => { e.stopPropagation(); setMoreOpen((v) => !v); }}
                  title="More actions"
                >
                  <i className="fas fa-ellipsis" />
                </button>
                {moreOpen && (
                  <div className="cs-more-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="cs-more-item"
                      onClick={() => { setMoreOpen(false); setEditing(true); }}
                    >
                      <i className="fas fa-pen cs-more-icon" /> Edit
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="cs-more-item"
                      onClick={() => { setMoreOpen(false); handleToggleActive(); }}
                    >
                      <i className={`fas ${isArchived ? 'fa-box-open' : 'fa-box-archive'} cs-more-icon`} />
                      {isArchived ? ' Unarchive' : ' Archive'}
                    </button>
                    <div className="cs-more-divider" />
                    <button
                      type="button"
                      role="menuitem"
                      className="cs-more-item cs-more-item-danger"
                      onClick={() => { setMoreOpen(false); handleDelete(); }}
                    >
                      <i className="fas fa-trash cs-more-icon" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {collection.description && <p className="cs-desc">{collection.description}</p>}

        {!isOwner && (
          <div className="cs-share-info">
            <span className="cs-share-label">Shared by:</span>
            <span className="cs-share-value">{collection.owner_email}</span>
            <span className="cs-share-perm">{formatPermission(collection.share_permission)}</span>
          </div>
        )}

        {isOwner && Array.isArray(collection.shares) && collection.shares.length > 0 && (
          <div className="cs-share-info is-owner">
            <div className="cs-share-info-head">
              <i className="fas fa-users" /> Shared with
            </div>
            <ul className="cs-share-list">
              {collection.shares.map((s) => (
                <li key={s.id}>
                  <span>{s.email}</span>
                  <span className="cs-share-perm">{formatPermission(s.permission)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="cs-2col">
          <main className="cs-2col-main">
            <NotesPanel
              notes={notes}
              canEdit={canEdit}
              onCreateNew={() => setNoteModal('new')}
              onEditNote={(note) => setNoteModal(note)}
              onDeleteNote={handleDeleteNote}
              onRemoveFromCollection={canEdit ? (note) => handleRemoveItem('Note', note.id) : null}
            />
          </main>

          <aside className="cs-2col-side">
            <div className="cs-side-stats">
              {Object.keys(TYPE_CONFIG).map((type) => (
                <div key={type} className="cs-side-stat">
                  <span className="cs-side-stat-value">{(collection[TYPE_CONFIG[type].listKey] || []).length}</span>
                  <span className="cs-side-stat-label">{TYPE_CONFIG[type].label}</span>
                </div>
              ))}
            </div>
            {Object.keys(TYPE_CONFIG).map((type) => (
              <SideSection
                key={type}
                type={type}
                cfg={TYPE_CONFIG[type]}
                items={collection[TYPE_CONFIG[type].listKey] || []}
                groupings={type === 'sources' ? (collection.groupings || []) : null}
                canEdit={canEdit}
                collectionId={collection.id}
                browseAllHref={type === 'sources' ? `/collections/${collection.id}/sources` : null}
                onLink={() => startLink(type)}
                onCreate={() => setOpenCreate(type)}
                onRemove={(id) => handleRemoveItem(TYPE_CONFIG[type].itemType, id)}
              />
            ))}
          </aside>
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          shareable={{ id: collection.id, name: collection.name, type: 'Collection' }}
        />
      )}

      <CollectionFormModal
        isOpen={editing}
        item={editing ? collection : null}
        onClose={() => setEditing(false)}
        onSuccess={handleUpdated}
      />

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
            <div className="cs-modal-body">
              <Selector
                {...{ [selectorProp]: selectedIds[type] }}
                onChange={(ids) => setSelectedIds((prev) => ({ ...prev, [type]: ids }))}
                themeColor={cfg.accent}
              />
            </div>
            <div className="cs-modal-footer">
              <button type="button" className="sp-action sp-action-secondary" onClick={() => setOpenLink(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="sp-action sp-action-primary cs-modal-save"
                style={{ background: cfg.accent, borderColor: cfg.accent }}
                onClick={() => handleLink(type)}
              >
                Save ({selectedIds[type].length})
              </button>
            </div>
          </Modal>
        );
      })}

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

function NotesPanel({ notes, canEdit, onCreateNew, onEditNote, onDeleteNote, onRemoveFromCollection }) {
  if (notes.length === 0) {
    return canEdit ? (
      <button type="button" className="cs-notes-void" onClick={onCreateNew}>
        <span className="cs-notes-void-plus">+</span>
        <span className="cs-notes-void-label">Add a note for this collection</span>
        <span className="cs-notes-void-hint">
          Quick logs, decisions, takeaways — anything tied to this project lives here.
        </span>
      </button>
    ) : (
      <div className="cs-notes-empty">
        <p>No notes in this collection yet.</p>
      </div>
    );
  }
  return (
    <section className="cs-notes">
      <header className="cs-notes-head">
        <h2 className="cs-notes-heading">
          Notes <span className="cs-notes-count">{notes.length}</span>
        </h2>
        {canEdit && (
          <button type="button" className="sp-action sp-action-primary cs-notes-cta" onClick={onCreateNew}>
            <i className="fas fa-pen-fancy" /> New Note
          </button>
        )}
      </header>
      <ul className="nx-list nx-list-card">
        {notes.map((note) => {
          const editable = canEdit && !note.from_source;
          return (
            <NoteCard
              key={note.from_source ? `s-${note.id}` : note.id}
              note={note}
              onView={editable ? onEditNote : undefined}
              onEdit={editable ? onEditNote : undefined}
              onDelete={editable ? onDeleteNote : undefined}
              omitChips={['collection']}
            />
          );
        })}
      </ul>
    </section>
  );
}

function SideSection({ type, cfg, items, groupings, canEdit, browseAllHref, onLink, onCreate, onRemove }) {
  const COLLAPSED = 10;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSED);
  const overflow = items.length - visible.length;
  const canCollapse = items.length > COLLAPSED;

  // Show source chips grouped by collection grouping only once at least one
  // source has been assigned — keeps the default state visually quiet for new
  // users who haven't touched the feature.
  const groupedSources = useMemo(() => {
    if (type !== 'sources') return null;
    if (!groupings || groupings.length === 0) return null;
    if (!visible.some((s) => s.grouping_id)) return null;
    const known = new Set(groupings.map((g) => g.id));
    const buckets = new Map(groupings.map((g) => [g.id, []]));
    buckets.set(null, []);
    visible.forEach((s) => {
      const key = s.grouping_id != null && known.has(s.grouping_id) ? s.grouping_id : null;
      buckets.get(key).push(s);
    });
    const sections = groupings.map((g) => ({
      key: g.id,
      label: g.name,
      color: GROUPING_COLORS[Math.min(g.position, GROUPING_COLORS.length - 1)],
      items: buckets.get(g.id) || []
    }));
    sections.push({
      key: 'unsorted',
      label: 'Unsorted',
      color: 'var(--ink-4)',
      items: buckets.get(null) || []
    });
    return sections.filter(({ items: list }) => list.length > 0);
  }, [type, visible, groupings]);

  const groupingNameById = useMemo(() => {
    if (!groupings) return new Map();
    return new Map(groupings.map((g) => [g.id, g.name]));
  }, [groupings]);

  const renderChip = (it) => {
    const label = it.label || it.full_name || it.title || 'Untitled';
    const tooltipBits = [label];
    if (type === 'sources' && it.year) tooltipBits[0] = `${label} (${it.year})`;
    if (type === 'sources' && it.grouping_id) tooltipBits.push(groupingNameById.get(it.grouping_id));
    return (
      <a
        key={it.id}
        href={ITEM_LINK[type](it.id)}
        className={`nc-pill ${cfg.chipClass}`}
        title={tooltipBits.filter(Boolean).join(' — ')}
      >
        <i className={`fas ${cfg.icon} nc-pill-icon`} aria-hidden="true" />
        <span className="nc-pill-label">{label}</span>
      </a>
    );
  };

  return (
    <div className="cs-side-section" style={{ '--cs-side-color': cfg.accent }}>
      <header className="cs-side-head">
        <span className="cs-side-label">
          <span className="cs-side-dot" aria-hidden="true" />
          {cfg.label}
        </span>
        <span className="cs-side-count">{items.length}</span>
      </header>

      {items.length === 0 ? (
        <p className="cs-side-empty">None linked yet.</p>
      ) : groupedSources ? (
        <div className="cs-side-tiergroups">
          {groupedSources.map(({ key, label, color, items: tierItems }) => (
            <div key={key} className="cs-side-tiergroup" style={{ color }}>
              <div className="cs-side-tiergroup-head">
                <span className="cs-side-tiergroup-label">{label}</span>
                <span className="cs-side-tiergroup-count">{tierItems.length}</span>
              </div>
              <div className="cs-side-chips">
                {tierItems.map(renderChip)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cs-side-chips">
          {visible.map(renderChip)}
        </div>
      )}

      {canCollapse && (
        <button
          type="button"
          className="cs-side-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : `Show ${overflow} more`}
        </button>
      )}

      {browseAllHref && items.length > 0 && (
        <a href={browseAllHref} className="cs-side-browse">
          Browse all {cfg.label.toLowerCase()} <i className="fas fa-arrow-right" />
        </a>
      )}

      {canEdit && (
        <div className="cs-side-foot">
          <button
            type="button"
            className="cs-side-foot-btn"
            onClick={onLink}
            title={`Link existing ${cfg.label.toLowerCase()}`}
          >
            <i className="fas fa-link" /> Link
          </button>
          <button
            type="button"
            className="cs-side-foot-btn"
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
      <form onSubmit={handleSubmit} className="cs-cfm-body">
        {error && <div className="cs-cfm-error">{error}</div>}
        <div className="cs-cfm-field">
          <label className="cs-cfm-label">Name</label>
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
        <div className="cs-cfm-field">
          <label className="cs-cfm-label">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-textarea"
            rows={3}
            placeholder="Optional — what this collection is for."
          />
        </div>
        <div className="cs-cfm-foot">
          <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="sp-action sp-action-primary cs-cfm-save"
            disabled={submitting || !name.trim()}
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CSStyles() {
  return (
    <style>{`
      .cs-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 24px;
        gap: 12px;
        font-family: var(--font-body);
        color: var(--ink-3);
      }

      .cs-page {
        max-width: 1080px;
        margin: 0 auto;
        padding: 16px 32px 80px;
      }

      .cs-back {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        text-decoration: none;
        margin-bottom: 12px;
        transition: color 0.12s;
      }
      .cs-back:hover { color: var(--primary); }

      .cs-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 8px;
      }
      .cs-titleline {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }
      .cs-title {
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
      .cs-actions {
        display: inline-flex;
        gap: 4px;
        flex-shrink: 0;
      }
      .cs-actions .sp-action i { margin-right: 6px; }

      .cs-more { position: relative; display: inline-block; }
      .cs-more-trigger {
        width: 34px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .cs-more-trigger i { margin-right: 0 !important; }
      .cs-more-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        min-width: 180px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-lg);
        padding: 4px;
        z-index: 200;
        display: flex;
        flex-direction: column;
      }
      .cs-more-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: transparent;
        border: none;
        border-radius: var(--r-sm);
        cursor: pointer;
        text-align: left;
        text-decoration: none;
        color: var(--ink);
        font-family: var(--font-body);
        font-size: 13px;
        transition: background var(--transition-fast);
      }
      .cs-more-item:hover { background: var(--hover); }
      .cs-more-icon {
        width: 16px;
        color: var(--ink-3);
        font-size: 12px;
        text-align: center;
        flex-shrink: 0;
      }
      .cs-more-item-danger { color: var(--error); }
      .cs-more-item-danger .cs-more-icon { color: var(--error); }
      .cs-more-item-danger:hover { background: color-mix(in srgb, var(--error) 10%, transparent); }
      .cs-more-divider {
        height: 1px;
        background: var(--ink-line-soft);
        margin: 4px 2px;
      }

      .cs-archived-badge {
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

      .cs-desc {
        font-family: var(--font-body);
        font-size: 14.5px;
        line-height: 1.65;
        color: var(--ink-2);
        margin: 0 0 20px;
        max-width: 720px;
      }

      .cs-share-info {
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
      .cs-share-info.is-owner { display: block; }
      .cs-share-info-head {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: var(--ink-2);
        margin-bottom: 8px;
      }
      .cs-share-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .cs-share-list li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12.5px;
      }
      .cs-share-label { font-weight: 500; color: var(--ink-3); }
      .cs-share-value { color: var(--ink); font-weight: 500; }
      .cs-share-perm {
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

      .cs-2col {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
        gap: 32px;
        margin-top: 18px;
      }
      .cs-2col-main { min-width: 0; }
      .cs-2col-side {
        display: flex;
        flex-direction: column;
        gap: 22px;
        position: sticky;
        top: 16px;
        align-self: flex-start;
      }

      .cs-side-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--ink-line);
      }
      .cs-side-stat { display: flex; flex-direction: column; gap: 2px; }
      .cs-side-stat-value {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--primary);
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
      }
      .cs-side-stat-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      .cs-side-section { display: flex; flex-direction: column; gap: 6px; }
      .cs-side-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .cs-side-label {
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
      .cs-side-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--cs-side-color, var(--ink-3));
        flex-shrink: 0;
        position: relative;
        top: 1px;
      }
      .cs-side-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
      }
      .cs-side-empty {
        margin: 0;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-4);
        font-style: italic;
      }
      .cs-side-tiergroups {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 4px;
      }
      .cs-side-tiergroup-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: currentColor;
        margin-bottom: 4px;
      }
      .cs-side-tiergroup-count {
        font-weight: 600;
        font-size: 10px;
        color: var(--ink-4);
        letter-spacing: 0;
      }

      .cs-side-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }
      .cs-side-toggle {
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
        color: var(--cs-side-color, var(--primary));
        opacity: 0.75;
        transition: opacity 0.12s;
      }
      .cs-side-toggle:hover { opacity: 1; text-decoration: underline; text-underline-offset: 3px; }
      .cs-side-browse {
        align-self: flex-start;
        margin-top: 4px;
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 600;
        color: var(--cs-side-color, var(--primary));
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: gap 0.15s;
      }
      .cs-side-browse:hover { gap: 10px; text-decoration: underline; text-underline-offset: 3px; }
      .cs-side-browse i { font-size: 10px; }

      .cs-side-foot {
        display: inline-flex;
        gap: 14px;
        margin-top: 6px;
      }
      .cs-side-foot-btn {
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
      .cs-side-foot-btn:hover { color: var(--cs-side-color, var(--ink-2)); }
      .cs-side-foot-btn i { font-size: 9.5px; opacity: 0.85; }

      .cs-notes-void {
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
      .cs-notes-void:hover {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 4%, var(--paper-soft));
        color: var(--ink-2);
      }
      .cs-notes-void-plus {
        font-family: var(--font-display);
        font-size: 36px;
        line-height: 1;
        color: var(--primary);
      }
      .cs-notes-void-label {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
      }
      .cs-notes-void-hint {
        font-family: var(--font-body);
        font-size: 13px;
        max-width: 420px;
      }
      .cs-notes-empty {
        padding: 32px 16px;
        text-align: center;
        color: var(--ink-4);
        font-family: var(--font-body);
        font-size: 13px;
      }
      .cs-notes { display: flex; flex-direction: column; gap: 14px; }
      .cs-notes-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }
      .cs-notes-heading {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
      }
      .cs-notes-count {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--ink-3);
        font-weight: 400;
      }
      .cs-notes-cta { background: var(--primary); border-color: var(--primary); color: var(--paper); }
      .cs-notes-cta:hover { background: var(--primary-dark); border-color: var(--primary-dark); }

      .cs-modal-body { padding: 16px 24px; min-height: 320px; }
      .cs-modal-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        padding: 14px 24px;
        border-top: 1px solid var(--ink-line);
        background: var(--paper-soft);
      }
      .cs-modal-save { color: var(--paper); }

      .cs-cfm-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 22px 24px 14px;
      }
      .cs-cfm-error {
        padding: 10px 14px;
        background: color-mix(in srgb, var(--error) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
        border-radius: var(--r-md);
        color: var(--error);
        font-family: var(--font-body);
        font-size: 13px;
      }
      .cs-cfm-field { display: flex; flex-direction: column; gap: 6px; }
      .cs-cfm-label {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--primary);
      }
      .cs-cfm-foot {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 14px 0 6px;
        border-top: 1px solid var(--ink-line);
        margin-top: 4px;
      }
      .cs-cfm-save {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }
      .cs-cfm-save:hover:not(:disabled) {
        background: var(--primary-dark);
        border-color: var(--primary-dark);
      }

      @media (max-width: 900px) {
        .cs-2col { grid-template-columns: 1fr; }
        .cs-2col-side { position: static; order: 1; }
        .cs-2col-main { order: 2; }
      }
      @media (max-width: 768px) {
        .cs-page { padding: 12px 16px 56px; }
        .cs-title { font-size: 24px; }
        .cs-head { flex-direction: column; align-items: stretch; }
      }
    `}</style>
  );
}
