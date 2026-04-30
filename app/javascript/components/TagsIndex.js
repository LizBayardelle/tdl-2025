import React, { useState, useEffect } from 'react';
import TagFormModal from './TagFormModal';
import PersonFormModal from './PersonFormModal';
import ConceptFormModal from './ConceptFormModal';
import SourceFormModal from './SourceFormModal';
import NoteFormModal from './NoteFormModal';
import NoteCard, { NoteCardStyles } from './NoteCard';
import PeopleSelector from './PeopleSelector';
import ConceptSelector from './ConceptSelector';
import SourceSelector from './SourceSelector';
import NoteSelector from './NoteSelector';
import MobileSidebarBackdrop from './MobileSidebarBackdrop';
import useIsMobile from '../hooks/useIsMobile';
import Modal from './Modal';

// Type → display config.  Used everywhere we render a section so the
// color/icon mapping stays consistent with /collections.
const TYPE_CONFIG = {
  people: {
    label: 'People', singular: 'Person',
    accent: 'var(--person)', tint: 'var(--person-tint)',
    icon: 'fa-user',
    listKey: 'people',
    idsParam: 'person_ids',
  },
  concepts: {
    label: 'Concepts', singular: 'Concept',
    accent: 'var(--concept)', tint: 'var(--concept-tint)',
    icon: 'fa-lightbulb',
    listKey: 'concepts',
    idsParam: 'concept_ids',
  },
  sources: {
    label: 'Sources', singular: 'Source',
    accent: 'var(--source)', tint: 'var(--source-tint)',
    icon: 'fa-book-open',
    listKey: 'sources',
    idsParam: 'source_ids',
  },
  notes: {
    label: 'Notes', singular: 'Note',
    accent: '#639CA1', tint: '#E1EEEF',
    icon: 'fa-pen-fancy',
    listKey: 'notes',
    idsParam: 'note_ids',
  },
};

const ITEM_LINK = {
  people:   (id) => `/people/${id}`,
  concepts: (id) => `/concepts/${id}`,
  sources:  (id) => `/sources/${id}`,
  notes:    (id) => `/notes/${id}`,
};

export default function TagsIndex() {
  const isMobile = useIsMobile();
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('popularity');
  const [creatingTag, setCreatingTag] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);

  useEffect(() => { fetchTags(); /* eslint-disable-next-line */ }, [sortBy]);

  // Auto-select first tag on initial load.
  useEffect(() => {
    if (tags.length > 0 && !selectedTag) handleTagClick(tags[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags]);

  useEffect(() => {
    const onResize = () => setSidebarOpen(window.innerWidth >= 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/tags.json?sort=${sortBy}`);
      if (res.ok) setTags(await res.json());
    } catch (e) {
      console.error('Failed to load tags', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = async (tag) => {
    try {
      const res = await fetch(`/tags/${tag.id}.json`);
      if (res.ok) {
        setSelectedTag(await res.json());
        if (window.innerWidth < 768) setSidebarOpen(false);
      }
    } catch (e) {
      console.error('Failed to load tag', e);
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!confirm('Delete this tag?  It stays applied nowhere — items keep their content.')) return;
    try {
      const res = await fetch(`/tags/${tagId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken() },
      });
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== tagId));
        if (selectedTag?.id === tagId) setSelectedTag(null);
      }
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleTagCreated = (newTag) => {
    setTags((prev) => [{ ...newTag, taggings_count: 0 }, ...prev]);
    setCreatingTag(false);
    handleTagClick(newTag);
  };

  if (loading) {
    return (
      <div className="tx-loading">
        <TXStyles />
        <NoteCardStyles />
        Loading tags.
      </div>
    );
  }

  return (
    <>
      <div className="tx-shell">
        <TXStyles />
        <NoteCardStyles />
        <MobileSidebarBackdrop isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <button
          type="button"
          className="tx-sidebar-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
          style={{ left: sidebarOpen ? '280px' : '0' }}
          aria-label="Toggle tag list"
        >
          <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`} />
        </button>

        {sidebarOpen && (
          <aside className={`tx-sidebar${isMobile ? ' is-mobile' : ''}`}>
            <header className="tx-sidebar-head">
              <div>
                <h2 className="tx-sidebar-title">Tags</h2>
                <p className="tx-sidebar-sub">{tags.length} tag{tags.length === 1 ? '' : 's'}</p>
              </div>
              <button
                type="button"
                className="tx-newbtn"
                onClick={() => setCreatingTag(true)}
                title="New tag"
                aria-label="New tag"
              >
                <i className="fas fa-plus" />
              </button>
            </header>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="form-input tx-sort"
            >
              <option value="popularity">Most used</option>
              <option value="alphabetical">Alphabetical</option>
            </select>

            {tags.length === 0 ? (
              <p className="tx-list-empty">No tags yet.</p>
            ) : (
              <ul className="tx-list">
                {tags.map((tag) => (
                  <li
                    key={tag.id}
                    className={`tx-list-item${selectedTag?.id === tag.id ? ' is-active' : ''}`}
                    onClick={() => handleTagClick(tag)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTagClick(tag); } }}
                  >
                    <div className="tx-list-text">
                      <div className="tx-list-name">{tag.name}</div>
                      {tag.description && <div className="tx-list-sub">{tag.description}</div>}
                    </div>
                    <span className="tx-list-count">{tag.taggings_count || 0}</span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        <main className="tx-main">
          {selectedTag ? (
            <TagDetail
              tag={selectedTag}
              onUpdate={setSelectedTag}
              onDelete={() => handleDeleteTag(selectedTag.id)}
            />
          ) : (
            <div className="tx-empty-main">
              <i className="fas fa-tag tx-empty-icon" />
              <p className="tx-empty-text">Select a tag to view what it's applied to.</p>
            </div>
          )}
        </main>
      </div>

      <TagFormModal
        isOpen={creatingTag}
        onClose={() => setCreatingTag(false)}
        onSuccess={handleTagCreated}
      />
    </>
  );
}

function csrfToken() {
  return document.querySelector('[name="csrf-token"]')?.content;
}

// =====================================================================
// Detail pane — modeled on CollectionsIndex's CollectionDetail
// =====================================================================
function TagDetail({ tag, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);

  // Per-type modals: link existing + create new
  const [openLink, setOpenLink] = useState(null);   // 'people' | 'concepts' | 'sources' | 'notes' | null
  const [openCreate, setOpenCreate] = useState(null);
  const [selectedIds, setSelectedIds] = useState({ people: [], concepts: [], sources: [], notes: [] });

  const fetchTagDetails = async () => {
    try {
      const res = await fetch(`/tags/${tag.id}.json`);
      if (res.ok) onUpdate(await res.json());
    } catch (e) {
      console.error('Failed to refresh tag', e);
    }
  };

  const handleLink = async (type) => {
    const cfg = TYPE_CONFIG[type];
    try {
      const res = await fetch(`/tags/${tag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ tag: { [cfg.idsParam]: selectedIds[type] } }),
      });
      if (res.ok) {
        await fetchTagDetails();
        setOpenLink(null);
        setSelectedIds((prev) => ({ ...prev, [type]: [] }));
      } else {
        alert(`Error linking ${cfg.label.toLowerCase()}`);
      }
    } catch (e) {
      console.error(`Link ${type} failed`, e);
    }
  };

  const startLink = (type) => {
    const ids = (tag[TYPE_CONFIG[type].listKey] || []).map((it) => it.id);
    setSelectedIds((prev) => ({ ...prev, [type]: ids }));
    setOpenLink(type);
  };

  const stats = Object.keys(TYPE_CONFIG)
    .map((type) => ({ type, count: (tag[TYPE_CONFIG[type].listKey] || []).length }))
    .filter((s) => s.count > 0);
  const connectionsCount = (tag.connections || []).length;
  const isEmpty = stats.length === 0 && connectionsCount === 0;

  // Notes are the project's heart — opening one (or creating new) routes
  // through NoteFormModal.  null = closed, 'new' = create, else edit object.
  const [noteModal, setNoteModal] = useState(null);

  const notes = tag.notes || [];

  const handleDeleteNote = async (note) => {
    if (!window.confirm('Delete this note? This can\'t be undone.')) return;
    try {
      const r = await fetch(`/notes/${note.id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]')?.content,
        },
      });
      if (r.ok) await fetchTagDetails();
      else alert('Could not delete the note.');
    } catch (e) {
      console.error('Delete note failed:', e);
      alert('Could not delete the note.');
    }
  };

  return (
    <>
      <TagFormModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        item={tag}
        onSuccess={(updated) => { onUpdate(updated); setEditing(false); }}
      />

      <NoteFormModal
        isOpen={!!noteModal}
        onClose={() => setNoteModal(null)}
        item={noteModal === 'new' ? null : noteModal}
        defaultTags={noteModal === 'new' ? [tag.name] : undefined}
        onSuccess={async () => { setNoteModal(null); await fetchTagDetails(); }}
      />

      <div className="tx-detail">
        <header className="tx-detail-head">
          <div className="tx-detail-titleline">
            <h1 className="tx-detail-title">{tag.name}</h1>
          </div>
          <div className="tx-detail-actions">
            <button type="button" className="sp-action sp-action-quiet" onClick={() => setEditing(true)} title="Edit tag">
              <i className="fas fa-pen" /> Edit
            </button>
            <button type="button" className="sp-action sp-action-quiet sp-action-danger" onClick={onDelete} title="Delete tag">
              <i className="fas fa-trash" /> Delete
            </button>
          </div>
        </header>

        {tag.description && <p className="tx-detail-desc">{tag.description}</p>}

        <div className="tx-2col">
          <main className="tx-2col-main">
            <NotesPanel
              notes={notes}
              onCreateNew={() => setNoteModal('new')}
              onEditNote={(note) => setNoteModal(note)}
              onDeleteNote={handleDeleteNote}
            />
          </main>

          <aside className="tx-2col-side">
            {(stats.length > 0 || connectionsCount > 0) && (
              <div className="tx-side-stats">
                {stats.map(({ type, count }) => (
                  <div key={type} className="tx-side-stat">
                    <span className="tx-side-stat-value">{count}</span>
                    <span className="tx-side-stat-label">{TYPE_CONFIG[type].label}</span>
                  </div>
                ))}
                {connectionsCount > 0 && (
                  <div className="tx-side-stat">
                    <span className="tx-side-stat-value">{connectionsCount}</span>
                    <span className="tx-side-stat-label">Relations</span>
                  </div>
                )}
              </div>
            )}
            {['people', 'concepts', 'sources'].map((type) => (
              <SideSection
                key={type}
                type={type}
                cfg={TYPE_CONFIG[type]}
                items={tag[TYPE_CONFIG[type].listKey] || []}
                onLink={() => startLink(type)}
                onCreate={() => setOpenCreate(type)}
              />
            ))}
            {connectionsCount > 0 && (
              <RelationshipsSection connections={tag.connections} />
            )}
            {isEmpty && (
              <div className="tx-side-startup">
                <p>Use the <i className="fas fa-link" /> and <i className="fas fa-plus" /> buttons in each section to fill out this project's context.</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Link Existing modals */}
      {Object.keys(TYPE_CONFIG).map((type) => {
        const cfg = TYPE_CONFIG[type];
        const Selector = SELECTORS[type];
        const selectorProp = SELECTOR_PROPS[type];
        return (
          <Modal
            key={`link-${type}`}
            isOpen={openLink === type}
            onClose={() => setOpenLink(null)}
            title={`Apply Tag to ${cfg.label}`}
            titleColor={cfg.accent}
            size="large"
          >
            <div className="tx-modal-body">
              <Selector
                {...{ [selectorProp]: selectedIds[type] }}
                onChange={(ids) => setSelectedIds((prev) => ({ ...prev, [type]: ids }))}
                themeColor={cfg.accent}
              />
            </div>
            <div className="tx-modal-footer">
              <button
                type="button"
                className="sp-action sp-action-secondary"
                onClick={() => setOpenLink(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sp-action sp-action-primary tx-modal-save"
                style={{ background: cfg.accent, borderColor: cfg.accent }}
                onClick={() => handleLink(type)}
              >
                Save ({selectedIds[type].length})
              </button>
            </div>
          </Modal>
        );
      })}

      {/* Create New modals — pre-populated with the current tag */}
      <PersonFormModal
        isOpen={openCreate === 'people'}
        onClose={() => setOpenCreate(null)}
        defaultTags={[tag.name]}
        onSuccess={async () => { setOpenCreate(null); await fetchTagDetails(); }}
      />
      <ConceptFormModal
        isOpen={openCreate === 'concepts'}
        onClose={() => setOpenCreate(null)}
        defaultTags={[tag.name]}
        onSuccess={async () => { setOpenCreate(null); await fetchTagDetails(); }}
      />
      <SourceFormModal
        isOpen={openCreate === 'sources'}
        onClose={() => setOpenCreate(null)}
        defaultTags={[tag.name]}
        onSuccess={async () => { setOpenCreate(null); await fetchTagDetails(); }}
      />
    </>
  );
}

// =====================================================================
// Notes panel — central column.  Big void when empty, list of cards
// when populated.  Click a card to edit; "+ New Note" creates pre-tagged.
// =====================================================================
function NotesPanel({ notes, onCreateNew, onEditNote, onDeleteNote }) {
  if (notes.length === 0) {
    return (
      <button type="button" className="tx-notes-void" onClick={onCreateNew}>
        <span className="tx-notes-void-plus">+</span>
        <span className="tx-notes-void-label">Add a note for this project</span>
        <span className="tx-notes-void-hint">
          Quick logs, decisions, takeaways — anything tied to this tag lives here.
        </span>
      </button>
    );
  }

  return (
    <section className="tx-notes">
      <header className="tx-notes-head">
        <h2 className="tx-notes-heading">
          Notes <span className="tx-notes-count">{notes.length}</span>
        </h2>
        <button
          type="button"
          className="sp-action sp-action-primary tx-notes-cta"
          onClick={onCreateNew}
        >
          <i className="fas fa-pen-fancy" /> New Note
        </button>
      </header>
      <ul className="nx-list nx-list-card">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onView={onEditNote}
            onEdit={onEditNote}
            onDelete={onDeleteNote}
            omitChips={['tag']}
          />
        ))}
      </ul>
    </section>
  );
}

// =====================================================================
// Sidebar section — modeled on /sources/:id's SidebarBlock.
// People + Concepts render as chip clusters (sp-chip is-person /
// is-concept).  Sources render as a text-link list with 2-line clamp
// on titles, hovering to source-blue.  Link / Create live in a small
// footer row so the heading stays calm.
// =====================================================================
function SideSection({ type, cfg, items, onLink, onCreate }) {
  // Cap at 10 by default; click "Show more" to reveal the rest.  Per-section
  // local state, so opening one cluster doesn't change the others.
  const COLLAPSED = 10;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSED);
  const overflow = items.length - visible.length;
  const canCollapse = items.length > COLLAPSED;
  const chipClass = (
    type === 'people'   ? 'is-person'  :
    type === 'concepts' ? 'is-concept' :
    type === 'sources'  ? 'is-source'  : 'is-neutral'
  );

  return (
    <div className="tx-side-section" style={{ '--tx-side-color': cfg.accent }}>
      <header className="tx-side-head">
        <span className="tx-side-label">
          <span className="tx-side-dot" aria-hidden="true" />
          {cfg.label}
        </span>
        <span className="tx-side-count">{items.length}</span>
      </header>

      {items.length === 0 ? (
        <p className="tx-side-empty">None linked yet.</p>
      ) : (
        <div className="tx-side-chips">
          {visible.map((it) => {
            const label = it.label || it.full_name || it.title || 'Untitled';
            const tooltip = type === 'sources' && it.year ? `${label} (${it.year})` : label;
            return (
              <a
                key={it.id}
                href={ITEM_LINK[type](it.id)}
                className={`sp-chip ${chipClass} tx-side-chip`}
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
          className="tx-side-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : `Show ${overflow} more`}
        </button>
      )}

      <div className="tx-side-foot">
        <button
          type="button"
          className="tx-side-foot-btn"
          onClick={onLink}
          title={`Link existing ${cfg.label.toLowerCase()}`}
        >
          <i className="fas fa-link" /> Link
        </button>
        <button
          type="button"
          className="tx-side-foot-btn"
          onClick={onCreate}
          title={`Create new ${cfg.singular.toLowerCase()}`}
        >
          <i className="fas fa-plus" /> New
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Relationships sidebar section — read-only list of concept connections.
// =====================================================================
function RelationshipsSection({ connections }) {
  return (
    <div className="tx-side-section" style={{ '--tx-side-color': 'var(--ink-3)' }}>
      <header className="tx-side-head">
        <span className="tx-side-label">
          <i className="fas fa-link" /> Relationships
        </span>
        <span className="tx-side-count">{connections.length}</span>
      </header>
      <ul className="tx-side-list">
        {connections.slice(0, 8).map((c) => (
          <li key={c.id} className="tx-side-rel">
            <a href={`/concepts/${c.src_concept_id}`} className="tx-side-rel-end">{c.src_concept_label}</a>
            <span className="tx-side-rel-verb">{c.rel_type?.replace(/_/g, ' ')}</span>
            <a href={`/concepts/${c.dst_concept_id}`} className="tx-side-rel-end">{c.dst_concept_label}</a>
          </li>
        ))}
        {connections.length > 8 && (
          <li className="tx-side-more-row">+{connections.length - 8} more</li>
        )}
      </ul>
    </div>
  );
}

const SELECTORS = {
  people:   PeopleSelector,
  concepts: ConceptSelector,
  sources:  SourceSelector,
  notes:    NoteSelector,
};
const SELECTOR_PROPS = {
  people:   'selectedPersonIds',
  concepts: 'selectedConceptIds',
  sources:  'selectedSourceIds',
  notes:    'selectedNoteIds',
};


function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// =====================================================================
// Styles
// =====================================================================
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

      .tx-shell {
        display: flex;
        height: calc(100vh - 64px);
        overflow: hidden;
        position: relative;
      }

      /* ---------- Sidebar toggle ---------- */
      .tx-sidebar-toggle {
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
      .tx-sidebar-toggle:hover { background: var(--primary-dark); }
      .tx-sidebar-toggle i { font-size: 11px; }

      /* ---------- Sidebar ---------- */
      .tx-sidebar {
        width: 280px;
        flex-shrink: 0;
        background: var(--paper-soft);
        border-right: 1px solid var(--ink-line);
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .tx-sidebar.is-mobile {
        position: fixed;
        top: 0; left: 0; bottom: 0;
        z-index: 200;
        box-shadow: 4px 0 16px rgba(0, 0, 0, 0.18);
      }
      .tx-sidebar-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .tx-sidebar-title {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        letter-spacing: -0.005em;
      }
      .tx-sidebar-sub {
        margin: 2px 0 0;
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-3);
      }
      .tx-newbtn {
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
      .tx-newbtn:hover {
        background: var(--primary-dark);
        transform: translateY(-1px);
      }
      .tx-sort {
        font-size: 12.5px;
        padding: 6px 8px;
      }

      .tx-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tx-list-empty {
        margin: 0;
        padding: 12px 4px;
        font-family: var(--font-body);
        font-size: 12px;
        font-style: italic;
        color: var(--ink-4);
      }
      .tx-list-item {
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
      .tx-list-item:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); }
      .tx-list-item.is-active {
        background: var(--primary);
        color: var(--paper);
      }
      .tx-list-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .tx-list-name {
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tx-list-sub {
        font-size: 10.5px;
        opacity: 0.7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 1px;
      }
      .tx-list-count {
        font-family: var(--font-mono);
        font-size: 11px;
        opacity: 0.7;
        flex-shrink: 0;
      }

      /* ---------- Main pane ---------- */
      .tx-main {
        flex: 1;
        overflow-y: auto;
        background: var(--paper);
      }
      .tx-empty-main {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--ink-3);
        font-family: var(--font-body);
        gap: 12px;
      }
      .tx-empty-icon {
        font-size: 56px;
        color: var(--primary);
        opacity: 0.4;
      }
      .tx-empty-text { margin: 0; font-size: 14px; }

      /* ---------- Detail ---------- */
      .tx-detail {
        max-width: 1080px;
        margin: 0 auto;
        padding: 24px 32px 80px;
      }

      .tx-detail-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 8px;
      }
      .tx-detail-titleline {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }
      .tx-detail-title {
        font-family: var(--font-display);
        font-size: 38px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        line-height: 1.1;
        letter-spacing: -0.02em;
        text-wrap: balance;
        min-width: 0;
      }
      .tx-detail-actions {
        display: inline-flex;
        gap: 4px;
        flex-shrink: 0;
      }
      .tx-detail-actions .sp-action i { margin-right: 6px; }
      .tx-detail-desc {
        font-family: var(--font-body);
        font-size: 16px;
        line-height: 1.65;
        color: var(--ink-2);
        margin: 12px 0 28px;
        max-width: 720px;
      }

      /* ---------- 2/3 + 1/3 layout — mirrors ss-row2 in SourceShow ---------- */
      .tx-2col {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 40px;
        align-items: start;
      }
      .tx-2col-main { min-width: 0; }
      .tx-2col-side {
        position: sticky;
        top: 24px;
        align-self: start;
        max-height: calc(100vh - 48px);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding-left: 22px;
        border-left: 1px solid var(--ink-line);
      }

      /* Sidebar stats — 2x2 grid with display-font numbers, mirrors
         ss-side-stats in SourceShow exactly. */
      .tx-side-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px 16px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--ink-line);
      }
      .tx-side-stat { display: flex; flex-direction: column; gap: 2px; }
      .tx-side-stat-value {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--primary);
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
      }
      .tx-side-stat-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      /* ---------- Notes panel (main column) ---------- */
      .tx-notes-void {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        min-height: 420px;
        padding: 56px 32px;
        background: var(--paper);
        border: 2px dashed var(--ink-line);
        border-radius: var(--r-md);
        cursor: pointer;
        text-align: center;
        font-family: inherit;
        transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
      }
      .tx-notes-void:hover {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 5%, var(--paper));
        transform: translateY(-1px);
      }
      .tx-notes-void-plus {
        font-family: var(--font-display);
        font-size: 80px;
        font-weight: 300;
        line-height: 1;
        color: var(--ink-line);
        transition: color 0.18s ease;
      }
      .tx-notes-void:hover .tx-notes-void-plus { color: var(--primary); }
      .tx-notes-void-label {
        font-family: var(--font-display);
        font-size: 24px;
        font-weight: 500;
        color: var(--ink-2);
        letter-spacing: -0.01em;
      }
      .tx-notes-void:hover .tx-notes-void-label { color: var(--primary-dark); }
      .tx-notes-void-hint {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        max-width: 380px;
        line-height: 1.55;
      }

      .tx-notes { display: flex; flex-direction: column; gap: 14px; }
      .tx-notes-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .tx-notes-heading {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        letter-spacing: -0.01em;
      }
      .tx-notes-count {
        font-family: var(--font-mono);
        font-size: 14px;
        color: var(--ink-3);
        margin-left: 6px;
      }
      .tx-notes-cta {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }
      .tx-notes-cta:hover {
        background: var(--primary-dark);
        border-color: var(--primary-dark);
      }

      .tx-note-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      /* Note cards on this page render via the shared NoteCard component;
         see NoteCard.js / NoteCardStyles for their styles. */

      /* ---------- Sidebar sections — modeled on ss-side-block ---------- */
      .tx-side-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .tx-side-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .tx-side-label {
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
      .tx-side-label i {
        font-size: 11px;
        color: var(--tx-side-color, var(--ink-3));
        position: relative;
        top: 1px;
      }
      .tx-side-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--tx-side-color, var(--ink-3));
        flex-shrink: 0;
        position: relative;
        top: 1px;
      }
      .tx-side-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
      }

      .tx-side-empty {
        margin: 0;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-4);
        font-style: italic;
      }

      /* Chip cluster (people, concepts) */
      .tx-side-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }
      .tx-side-chip {
        text-decoration: none;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: filter 0.12s;
      }
      /* Source titles can be long — let them eat a full row before
         ellipsizing so the chip cluster doesn't all collapse into the
         narrow column width. */
      .tx-side-section .tx-side-chip { max-width: 240px; }
      .tx-side-chip:hover { filter: brightness(0.95); }

      /* Text-link list (sources) — mirrors ss-side-name */
      .tx-side-list {
        list-style: none;
        margin: 6px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .tx-side-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .tx-side-name {
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink);
        text-decoration: none;
        line-height: 1.4;
        flex: 1;
        min-width: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .tx-side-name:hover { color: var(--tx-side-color, var(--ink-2)); }
      .tx-side-meta {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--ink-3);
        flex-shrink: 0;
      }
      .tx-side-more-row {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-4);
        font-style: italic;
      }
      .tx-side-toggle {
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
        color: var(--tx-side-color, var(--primary));
        opacity: 0.75;
        transition: opacity 0.12s;
      }
      .tx-side-toggle:hover { opacity: 1; text-decoration: underline; text-underline-offset: 3px; }

      /* Section footer — Link / New buttons in calmer text-only form,
         mirroring CollectionPicker on /sources/:id. */
      .tx-side-foot {
        display: inline-flex;
        gap: 14px;
        margin-top: 6px;
      }
      .tx-side-foot-btn {
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
      .tx-side-foot-btn:hover { color: var(--tx-side-color, var(--ink-2)); }
      .tx-side-foot-btn i { font-size: 9.5px; opacity: 0.85; }

      .tx-side-rel {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 6px;
        font-family: var(--font-body);
        font-size: 12px;
      }
      .tx-side-rel-end {
        color: var(--concept-2);
        text-decoration: none;
        font-weight: 500;
      }
      .tx-side-rel-end:hover { color: var(--concept); }
      .tx-side-rel-verb {
        font-size: 10.5px;
        color: var(--ink-4);
        font-style: italic;
      }

      .tx-side-startup {
        padding: 14px 16px;
        background: color-mix(in srgb, var(--primary) 5%, var(--paper));
        border: 1px dashed color-mix(in srgb, var(--primary) 35%, var(--ink-line));
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-2);
        line-height: 1.5;
      }
      .tx-side-startup p { margin: 0; }
      .tx-side-startup i { color: var(--primary); margin: 0 2px; }

      /* ---------- Modals ---------- */
      .tx-modal-body {
        height: 400px;
        padding: 20px 20px 0;
      }
      .tx-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid var(--ink-line);
      }
      .tx-modal-save { color: var(--paper) !important; }
      .tx-modal-save:hover {
        filter: brightness(0.92);
      }

      /* ---------- Responsive ---------- */
      @media (max-width: 900px) {
        .tx-2col { grid-template-columns: 1fr; gap: 28px; }
        .tx-2col-side {
          position: static;
          max-height: none;
          overflow-y: visible;
          padding-left: 0;
          border-left: none;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--ink-line);
          order: 1;
        }
        .tx-2col-main { order: 2; }
      }
      @media (max-width: 768px) {
        .tx-detail { padding: 18px 16px 56px; }
        .tx-detail-title { font-size: 24px; }
        .tx-detail-head { flex-direction: column; align-items: stretch; }
      }
    `}</style>
  );
}
