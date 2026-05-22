import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import NoteCard, { NoteCardStyles } from './NoteCard';
import NoteFormModal from './NoteFormModal';
import TagFormModal from './TagFormModal';
import PersonFormModal from './PersonFormModal';
import ConceptFormModal from './ConceptFormModal';
import SourceFormModal from './SourceFormModal';
import PeopleSelector from './PeopleSelector';
import ConceptSelector from './ConceptSelector';
import SourceSelector from './SourceSelector';

// =====================================================================
// TagShow — /tags/:id detail page.  Mirrors /collections/:id (CollectionShow):
// header with name + actions, 2-col body with notes in the main column
// and a relationship sidebar (stats, people/concepts/sources pill clusters,
// concept-connection list).  Sources sidebar links out to /tags/:id/sources
// for the full faceted library view.
// =====================================================================

const TYPE_CONFIG = {
  people: {
    label: 'People', singular: 'Person',
    accent: 'var(--person)',
    icon: 'fa-user', listKey: 'people',
    pillType: 'is-person', idsParam: 'person_ids',
  },
  concepts: {
    label: 'Concepts', singular: 'Concept',
    accent: 'var(--concept)',
    icon: 'fa-lightbulb', listKey: 'concepts',
    pillType: 'is-concept', idsParam: 'concept_ids',
  },
  sources: {
    label: 'Sources', singular: 'Source',
    accent: 'var(--source)',
    icon: 'fa-book-open', listKey: 'sources',
    pillType: 'is-source', idsParam: 'source_ids',
  },
};

const ITEM_LINK = {
  sources:  (id) => `/sources/${id}`,
  concepts: (id) => `/concepts/${id}`,
  people:   (id) => `/people/${id}`,
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

export default function TagShow({ tagId }) {
  const [tag, setTag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [openLink, setOpenLink] = useState(null);
  const [openCreate, setOpenCreate] = useState(null);
  const [selectedIds, setSelectedIds] = useState({ people: [], concepts: [], sources: [] });
  const [noteModal, setNoteModal] = useState(null);

  const fetchTag = useCallback(async () => {
    try {
      const res = await fetch(`/tags/${tagId}.json`);
      if (res.ok) {
        setTag(await res.json());
        setError('');
      } else if (res.status === 404) {
        setError('Tag not found.');
      } else {
        setError('Failed to load tag.');
      }
    } catch (e) {
      console.error('Failed to load tag', e);
      setError('Failed to load tag.');
    } finally {
      setLoading(false);
    }
  }, [tagId]);

  useEffect(() => { fetchTag(); }, [fetchTag]);

  const handleDelete = async () => {
    if (!confirm("Delete this tag?  Items keep their content; they just lose this tag.")) return;
    try {
      const res = await fetch(`/tags/${tagId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken() },
      });
      if (res.ok) window.location.href = '/tags';
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleUpdated = (updated) => {
    setTag((prev) => ({ ...prev, ...updated }));
    setEditing(false);
  };

  const startLink = (type) => {
    const ids = (tag[TYPE_CONFIG[type].listKey] || []).map((it) => it.id);
    setSelectedIds((prev) => ({ ...prev, [type]: ids }));
    setOpenLink(type);
  };

  // Tag application is a single PATCH with the desired id list — the
  // server reconciles add/remove from there.
  const handleLink = async (type) => {
    const cfg = TYPE_CONFIG[type];
    try {
      const res = await fetch(`/tags/${tagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ tag: { [cfg.idsParam]: selectedIds[type] } }),
      });
      if (res.ok) {
        await fetchTag();
        setOpenLink(null);
        setSelectedIds((prev) => ({ ...prev, [type]: [] }));
      } else {
        alert(`Could not update ${cfg.label.toLowerCase()}.`);
      }
    } catch (e) {
      console.error(`Link ${type} failed`, e);
      alert(`Could not update ${cfg.label.toLowerCase()}.`);
    }
  };

  const handleDeleteNote = async (note) => {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    try {
      const r = await fetch(`/notes/${note.id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json', 'X-CSRF-Token': csrfToken() },
      });
      if (r.ok) fetchTag();
      else alert('Could not delete the note.');
    } catch (e) {
      console.error('Delete note failed', e);
      alert('Could not delete the note.');
    }
  };

  if (loading) {
    return (
      <div className="ts-loading">
        <TSStyles />
        Loading tag.
      </div>
    );
  }

  if (error || !tag) {
    return (
      <div className="ts-loading">
        <TSStyles />
        <p>{error || 'Tag not found.'}</p>
        <a href="/tags" className="ts-back">← Back to Tags</a>
      </div>
    );
  }

  const notes = tag.notes || [];
  const connections = tag.connections || [];
  const stats = Object.keys(TYPE_CONFIG)
    .map((type) => ({ type, count: (tag[TYPE_CONFIG[type].listKey] || []).length }));

  return (
    <>
      <TSStyles />
      <NoteCardStyles />

      <NoteFormModal
        isOpen={!!noteModal}
        onClose={() => setNoteModal(null)}
        item={noteModal === 'new' ? null : noteModal}
        defaultTags={noteModal === 'new' ? [tag.name] : undefined}
        onSuccess={async () => { setNoteModal(null); await fetchTag(); }}
      />

      <div className="ts-page">
        <a href="/tags" className="ts-back">← Tags</a>

        <header className="ts-head">
          <div className="ts-titleline">
            <i className="fas fa-tag ts-title-icon" aria-hidden="true" />
            <h1 className="ts-title">{tag.name}</h1>
          </div>
          <div className="ts-actions">
            <button type="button" className="sp-action sp-action-quiet" onClick={() => setEditing(true)} title="Edit tag">
              <i className="fas fa-pen" /> Edit
            </button>
            <button type="button" className="sp-action sp-action-quiet sp-action-danger" onClick={handleDelete} title="Delete tag">
              <i className="fas fa-trash" /> Delete
            </button>
          </div>
        </header>

        {tag.description && <p className="ts-desc">{tag.description}</p>}

        <div className="ts-2col">
          <main className="ts-2col-main">
            <NotesPanel
              notes={notes}
              onCreateNew={() => setNoteModal('new')}
              onEditNote={(note) => setNoteModal(note)}
              onDeleteNote={handleDeleteNote}
            />
          </main>

          <aside className="ts-2col-side">
            <div className="ts-side-stats">
              {stats.map(({ type, count }) => {
                // Sources gets a real link out to the full /tags/:id/sources view.
                // Other types don't have a dedicated browse page yet — render as plain stats.
                const href = type === 'sources' && count > 0 ? `/tags/${tag.id}/sources` : null;
                const className = `ts-side-stat${href ? ' is-link' : ''}`;
                const inner = (
                  <>
                    <span className="ts-side-stat-value">{count}</span>
                    <span className="ts-side-stat-label">{TYPE_CONFIG[type].label}</span>
                  </>
                );
                return href ? (
                  <a key={type} href={href} className={className} title={`Browse all sources tagged ${tag.name}`}>{inner}</a>
                ) : (
                  <div key={type} className={className}>{inner}</div>
                );
              })}
            </div>
            {Object.keys(TYPE_CONFIG).map((type) => (
              <SideSection
                key={type}
                type={type}
                cfg={TYPE_CONFIG[type]}
                items={tag[TYPE_CONFIG[type].listKey] || []}
                browseAllHref={type === 'sources' ? `/tags/${tag.id}/sources` : null}
                onLink={() => startLink(type)}
                onCreate={() => setOpenCreate(type)}
              />
            ))}
            {connections.length > 0 && <RelationshipsSection connections={connections} />}
          </aside>
        </div>
      </div>

      <TagFormModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        item={editing ? tag : null}
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
            title={`Apply Tag to ${cfg.label}`}
            titleColor={cfg.accent}
            size="large"
          >
            <div className="ts-modal-body">
              <Selector
                {...{ [selectorProp]: selectedIds[type] }}
                onChange={(ids) => setSelectedIds((prev) => ({ ...prev, [type]: ids }))}
                themeColor={cfg.accent}
              />
            </div>
            <div className="ts-modal-footer">
              <button type="button" className="sp-action sp-action-secondary" onClick={() => setOpenLink(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="sp-action sp-action-primary ts-modal-save"
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
        defaultTags={[tag.name]}
        onSuccess={async () => { setOpenCreate(null); await fetchTag(); }}
      />
      <ConceptFormModal
        isOpen={openCreate === 'concepts'}
        onClose={() => setOpenCreate(null)}
        defaultTags={[tag.name]}
        onSuccess={async () => { setOpenCreate(null); await fetchTag(); }}
      />
      <SourceFormModal
        isOpen={openCreate === 'sources'}
        onClose={() => setOpenCreate(null)}
        defaultTags={[tag.name]}
        onSuccess={async () => { setOpenCreate(null); await fetchTag(); }}
      />
    </>
  );
}

function NotesPanel({ notes, onCreateNew, onEditNote, onDeleteNote }) {
  if (notes.length === 0) {
    return (
      <button type="button" className="ts-notes-void" onClick={onCreateNew}>
        <span className="ts-notes-void-plus">+</span>
        <span className="ts-notes-void-label">Add a note for this tag</span>
        <span className="ts-notes-void-hint">
          Quick logs, decisions, takeaways — anything tied to this tag lives here.
        </span>
      </button>
    );
  }
  return (
    <section className="ts-notes">
      <header className="ts-notes-head">
        <h2 className="ts-notes-heading">
          Notes <span className="ts-notes-count">{notes.length}</span>
        </h2>
        <button type="button" className="sp-action sp-action-primary ts-notes-cta" onClick={onCreateNew}>
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

function SideSection({ type, cfg, items, browseAllHref, onLink, onCreate }) {
  const COLLAPSED = 10;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSED);
  const overflow = items.length - visible.length;
  const canCollapse = items.length > COLLAPSED;

  return (
    <div className="ts-side-section" style={{ '--ts-side-color': cfg.accent }}>
      <header className="ts-side-head">
        <span className="ts-side-label">
          <span className="ts-side-dot" aria-hidden="true" />
          {cfg.label}
        </span>
        <span className="ts-side-count">{items.length}</span>
      </header>

      {items.length === 0 ? (
        <p className="ts-side-empty">None tagged yet.</p>
      ) : (
        <div className="ts-side-chips">
          {visible.map((it) => {
            const label = it.label || it.full_name || it.title || 'Untitled';
            const tooltip = type === 'sources' && it.year ? `${label} (${it.year})` : label;
            return (
              <a
                key={it.id}
                href={ITEM_LINK[type](it.id)}
                className={`nc-pill ${cfg.pillType}`}
                title={tooltip}
              >
                <i className={`fas ${cfg.icon} nc-pill-icon`} aria-hidden="true" />
                <span className="nc-pill-label">{label}</span>
              </a>
            );
          })}
        </div>
      )}

      {canCollapse && (
        <button
          type="button"
          className="ts-side-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : `Show ${overflow} more`}
        </button>
      )}

      {browseAllHref && items.length > 0 && (
        <a href={browseAllHref} className="ts-side-browse">
          Browse all {cfg.label.toLowerCase()} <i className="fas fa-arrow-right" />
        </a>
      )}

      <div className="ts-side-foot">
        <button type="button" className="ts-side-foot-btn" onClick={onLink} title={`Apply to existing ${cfg.label.toLowerCase()}`}>
          <i className="fas fa-link" /> Link
        </button>
        <button type="button" className="ts-side-foot-btn" onClick={onCreate} title={`Create new ${cfg.singular.toLowerCase()}`}>
          <i className="fas fa-plus" /> New
        </button>
      </div>
    </div>
  );
}

function RelationshipsSection({ connections }) {
  return (
    <div className="ts-side-section" style={{ '--ts-side-color': 'var(--ink-3)' }}>
      <header className="ts-side-head">
        <span className="ts-side-label">
          <i className="fas fa-link" /> Relationships
        </span>
        <span className="ts-side-count">{connections.length}</span>
      </header>
      <ul className="ts-side-rel-list">
        {connections.slice(0, 8).map((c) => (
          <li key={c.id} className="ts-side-rel">
            <a href={`/concepts/${c.src?.id}`} className="ts-side-rel-end">{c.src?.label}</a>
            <span className="ts-side-rel-verb">{c.rel_type?.replace(/_/g, ' ')}</span>
            <a href={`/concepts/${c.dst?.id}`} className="ts-side-rel-end">{c.dst?.label}</a>
          </li>
        ))}
        {connections.length > 8 && (
          <li className="ts-side-more-row">+{connections.length - 8} more</li>
        )}
      </ul>
    </div>
  );
}

function TSStyles() {
  return (
    <style>{`
      .ts-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 24px;
        gap: 12px;
        font-family: var(--font-body);
        color: var(--ink-3);
      }

      .ts-page {
        max-width: 1080px;
        margin: 0 auto;
        padding: 16px 32px 80px;
      }

      .ts-back {
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
      .ts-back:hover { color: var(--primary); }

      .ts-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 8px;
      }
      .ts-titleline {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .ts-title-icon {
        font-size: 22px;
        color: var(--primary);
        opacity: 0.85;
        flex-shrink: 0;
      }
      .ts-title {
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
      .ts-actions {
        display: inline-flex;
        gap: 4px;
        flex-shrink: 0;
      }
      .ts-actions .sp-action i { margin-right: 6px; }

      .ts-desc {
        font-family: var(--font-body);
        font-size: 14.5px;
        line-height: 1.65;
        color: var(--ink-2);
        margin: 0 0 20px;
        max-width: 720px;
      }

      /* ---------- 2-col body ---------- */
      .ts-2col {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
        gap: 32px;
        margin-top: 18px;
      }
      .ts-2col-main { min-width: 0; }
      .ts-2col-side {
        display: flex;
        flex-direction: column;
        gap: 22px;
        position: sticky;
        top: 16px;
        align-self: flex-start;
      }

      /* ---------- Sidebar stats tile ---------- */
      .ts-side-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--ink-line);
      }
      .ts-side-stat { display: flex; flex-direction: column; gap: 2px; }
      a.ts-side-stat.is-link {
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        transition: transform 0.12s;
      }
      a.ts-side-stat.is-link:hover .ts-side-stat-value { color: var(--source); }
      a.ts-side-stat.is-link:hover .ts-side-stat-label {
        color: var(--source);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .ts-side-stat-value {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--primary);
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
      }
      .ts-side-stat-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      /* ---------- Sidebar chip-cluster section ---------- */
      .ts-side-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .ts-side-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .ts-side-label {
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
      .ts-side-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--ts-side-color, var(--ink-3));
        flex-shrink: 0;
        position: relative;
        top: 1px;
      }
      .ts-side-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
      }
      .ts-side-empty {
        margin: 0;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-4);
        font-style: italic;
      }
      .ts-side-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }
      .ts-side-toggle {
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
        color: var(--ts-side-color, var(--primary));
        opacity: 0.75;
        transition: opacity 0.12s;
      }
      .ts-side-toggle:hover { opacity: 1; text-decoration: underline; text-underline-offset: 3px; }
      .ts-side-browse {
        align-self: flex-start;
        margin-top: 4px;
        font-family: var(--font-body);
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--ts-side-color, var(--primary));
        text-decoration: none;
        opacity: 0.85;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: opacity 0.12s, gap 0.12s;
      }
      .ts-side-browse:hover { opacity: 1; gap: 8px; }
      .ts-side-browse i { font-size: 9px; }
      .ts-side-foot {
        display: inline-flex;
        gap: 14px;
        margin-top: 6px;
      }
      .ts-side-foot-btn {
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
      .ts-side-foot-btn:hover { color: var(--ts-side-color, var(--ink-2)); }
      .ts-side-foot-btn i { font-size: 9.5px; opacity: 0.85; }

      /* ---------- Relationships list ---------- */
      .ts-side-rel-list {
        list-style: none;
        margin: 6px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .ts-side-rel {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-2);
        display: inline-flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 4px;
      }
      .ts-side-rel-end {
        color: var(--concept-2);
        text-decoration: none;
      }
      .ts-side-rel-end:hover { text-decoration: underline; }
      .ts-side-rel-verb {
        font-style: italic;
        color: var(--ink-3);
      }
      .ts-side-more-row {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-4);
        font-style: italic;
      }

      /* ---------- Notes panel ---------- */
      .ts-notes-void {
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
      .ts-notes-void:hover {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 4%, var(--paper-soft));
        color: var(--ink-2);
      }
      .ts-notes-void-plus {
        font-family: var(--font-display);
        font-size: 36px;
        line-height: 1;
        color: var(--primary);
      }
      .ts-notes-void-label {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
      }
      .ts-notes-void-hint {
        font-family: var(--font-body);
        font-size: 13px;
        max-width: 420px;
      }
      .ts-notes { display: flex; flex-direction: column; gap: 14px; }
      .ts-notes-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }
      .ts-notes-heading {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
      }
      .ts-notes-count {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--ink-3);
        font-weight: 400;
      }
      .ts-notes-cta { background: var(--primary); border-color: var(--primary); color: var(--paper); }
      .ts-notes-cta:hover { background: var(--primary-dark); border-color: var(--primary-dark); }

      /* ---------- Modals ---------- */
      .ts-modal-body { padding: 16px 24px; min-height: 320px; }
      .ts-modal-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        padding: 14px 24px;
        border-top: 1px solid var(--ink-line);
        background: var(--paper-soft);
      }
      .ts-modal-save { color: var(--paper); }

      /* ---------- Responsive ---------- */
      @media (max-width: 900px) {
        .ts-2col { grid-template-columns: 1fr; }
        .ts-2col-side { position: static; order: 1; }
        .ts-2col-main { order: 2; }
      }
      @media (max-width: 768px) {
        .ts-page { padding: 18px 16px 56px; }
        .ts-title { font-size: 24px; }
        .ts-head { flex-direction: column; align-items: stretch; }
      }
    `}</style>
  );
}
