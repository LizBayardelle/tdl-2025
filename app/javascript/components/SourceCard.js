import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toTitleCase } from '../utils/titleCase';
import CollectionGroupingSelect from './CollectionGroupingSelect';

// =====================================================================
// SourceCard
// Canonical source rendering used across /sources, /concepts/:id, and
// /people/:id.  AdminStyleGuide treats `.srx-row-card` as the model
// other indexes mirror — keep the visual language stable when editing.
//
// Three variants:
//   - full : SourcesIndex row (all metadata, chips, hover actions, marker editor)
//   - list : ConceptShow row (compact list item, key-source highlight)
//   - tile : PersonShow tile (bare title + byline grid card)
// =====================================================================

const KIND_LABELS = {
  article: 'Article',
  book: 'Book',
  book_chapter: 'Chapter',
  website: 'Website',
  video: 'Video',
  report: 'Report',
  thesis: 'Thesis',
  dissertation: 'Dissertation',
  conference: 'Conference',
  podcast: 'Podcast',
  other: 'Other',
};

const SUGGESTED_MARKERS = ['To Read', 'Needs PDF', 'Key Source', 'Methods Reference', 'Outdated', 'Urgent'];

const stripHtml = (s) => {
  if (!s) return '';
  const decode = (t) => t
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');
  const strip = (t) => t
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  let out = strip(decode(String(s)));
  out = strip(decode(out));
  return out
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// =====================================================================
// Public component
// =====================================================================
export default function SourceCard({
  source,
  variant = 'full',
  selectable = false,
  selected = false,
  showAbstract = false,
  isKey = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onMarkersChange,
  availableMarkers,
  onCollectionsChange,
  onConceptsChange,
  // Per-collection grouping. Pass these only from collection-scoped views
  // (e.g. /collections/:id/sources). When `onGroupingChange` is omitted the
  // control is hidden — keeps the card unchanged in non-collection contexts.
  groupingId,
  groupings,
  canEditGrouping = false,
  onGroupingChange,
}) {
  if (variant === 'tile') return <SourceTile source={source} />;
  if (variant === 'list') return <SourceListRow source={source} isKey={isKey} />;
  return (
    <SourceFullCard
      source={source}
      selectable={selectable}
      selected={selected}
      showAbstract={showAbstract}
      onToggleSelect={onToggleSelect}
      onEdit={onEdit}
      onDelete={onDelete}
      onMarkersChange={onMarkersChange}
      availableMarkers={availableMarkers}
      onCollectionsChange={onCollectionsChange}
      onConceptsChange={onConceptsChange}
      groupingId={groupingId}
      groupings={groupings}
      canEditGrouping={canEditGrouping}
      onGroupingChange={onGroupingChange}
    />
  );
}

// =====================================================================
// FULL — SourcesIndex variant
// =====================================================================
function SourceFullCard({ source, selectable, selected, showAbstract, onToggleSelect, onEdit, onDelete, onMarkersChange, availableMarkers, onCollectionsChange, onConceptsChange, groupingId, groupings, canEditGrouping, onGroupingChange }) {
  const [showMarkers, setShowMarkers] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);
  const linkedPeople = Array.isArray(source.people) ? source.people : [];
  const authorsString = typeof source.authors === 'string' ? source.authors : '';
  const abstractText = stripHtml(source.abstract || source.summary || '');

  // Single muted dot-separated meta line: year · kind · journal · DOI ↗
  const metaParts = [];
  if (source.year) metaParts.push({ key: 'year', node: <span className="src-card-year">{source.year}</span> });
  if (source.kind) metaParts.push({ key: 'kind', node: <span className="src-card-kind">{KIND_LABELS[source.kind] || source.kind}</span> });
  if (source.journal_name) metaParts.push({ key: 'journal', node: <span className="src-card-journal">{source.journal_name}</span> });
  if (source.doi) metaParts.push({
    key: 'doi',
    node: (
      <a
        href={`https://doi.org/${source.doi}`}
        target="_blank"
        rel="noopener noreferrer"
        className="src-card-doi"
        onClick={(e) => e.stopPropagation()}
      >
        DOI <span className="src-card-doi-ext" aria-hidden="true">↗</span>
      </a>
    ),
  });

  return (
    <article className={`src-card src-card-full ${selected ? 'is-selected' : ''}`}>
      {selectable && (
        <label className="src-card-check">
          <input
            type="checkbox"
            className="sp-checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${source.title}`}
          />
        </label>
      )}
      <div className="src-card-main">
        <div className="src-card-prehead">
          <div className="src-card-meta">
            {metaParts.map((p, i) => (
              <React.Fragment key={p.key}>
                {i > 0 && <span className="src-card-meta-sep" aria-hidden="true">·</span>}
                {p.node}
              </React.Fragment>
            ))}
          </div>
          <div className="src-card-actions">
            {onGroupingChange && (
              <CollectionGroupingSelect
                value={groupingId}
                groupings={groupings || []}
                canEdit={canEditGrouping}
                onChange={(gid) => onGroupingChange(source.id, gid)}
                size="sm"
              />
            )}
            <div className="src-card-actions-hover">
              <button
                type="button"
                className="src-card-icon"
                onClick={onEdit}
                aria-label="Edit source"
                title="Edit"
              >
                <EditIcon />
              </button>
              <button
                type="button"
                className="src-card-icon src-card-icon-danger"
                onClick={onDelete}
                aria-label="Delete source"
                title="Delete"
              >
                <TrashIcon />
              </button>
            </div>
            <CiteThisMenu sourceId={source.id} />
            <a
              href={`/sources/${source.id}/study`}
              className="src-card-icon src-card-icon-primary"
              title="Take notes on this source"
              onClick={(e) => e.stopPropagation()}
            >
              <NoteIcon size={14} />
              <span className="src-card-icon-label">Take Notes</span>
            </a>
          </div>
        </div>

        <div className="src-card-titleline">
          <a href={`/sources/${source.id}`} className="src-card-title">
            <span className="src-card-title-text">{toTitleCase(source.title)}</span>
          </a>
          <a
            href={`/sources/${source.id}/study`}
            className={`src-card-pdflink${source.has_pdf ? ' is-present' : ' is-missing'}`}
            title={source.has_pdf ? 'Open PDF in study mode' : 'No PDF — open notes anyway'}
            onClick={(e) => e.stopPropagation()}
          >
            <PdfBadge hasPdf={!!source.has_pdf} />
          </a>
        </div>

        {(linkedPeople.length > 0 || authorsString) && (
          <div className="src-card-authors-line">
            {linkedPeople.length > 0 ? (
              <span className="src-card-authors-row">
                {linkedPeople.map(p => (
                  <a
                    key={p.id}
                    href={`/people/${p.id}`}
                    className="nc-pill is-person"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <i className="fas fa-user nc-pill-icon" aria-hidden="true" />
                    <span className="nc-pill-label">{toTitleCase(p.full_name)}</span>
                  </a>
                ))}
              </span>
            ) : (
              <span className="src-card-authors">{authorsString}</span>
            )}
          </div>
        )}

        {showAbstract && abstractText && (
          <p className="src-card-abstract">{abstractText}</p>
        )}

        <div className="src-card-tags">
          {source.markers?.map(m => (
            <span key={m} className="nc-pill is-marker" onClick={() => setShowMarkers(true)}>
              <i className="fas fa-highlighter nc-pill-icon" aria-hidden="true" />
              <span className="nc-pill-label">{m}</span>
            </span>
          ))}
          {onMarkersChange && (
            <button type="button" className="src-card-marker-add" onClick={() => setShowMarkers(s => !s)}>
              {source.markers?.length > 0 ? 'Edit Markers' : '+ Marker'}
            </button>
          )}
          {source.notes_count > 0 && (
            <span className="src-card-mini-stat" title={`${source.notes_count} notes`}>
              <NoteIcon size={11} /> {source.notes_count}
            </span>
          )}
          {source.concepts?.slice(0, 3).map(c => (
            <a key={c.id} href={`/concepts/${c.id}`} className="nc-pill is-concept">
              <i className="fas fa-lightbulb nc-pill-icon" aria-hidden="true" />
              <span className="nc-pill-label">{toTitleCase(c.label)}</span>
            </a>
          ))}
          {source.concepts?.length > 3 && (
            <span className="src-card-mini-stat">+{source.concepts.length - 3}</span>
          )}
          {onConceptsChange && (
            <button type="button" className="src-card-concept-add" onClick={() => setShowConcepts(s => !s)}>
              {source.concepts?.length > 0 ? 'Edit Concepts' : '+ Concept'}
            </button>
          )}
          {source.methodologies?.map(m => (
            <span key={m} className="nc-pill is-research">
              <i className="fas fa-flask nc-pill-icon" aria-hidden="true" />
              <span className="nc-pill-label">{m}</span>
            </span>
          ))}
          {source.statistical_tests?.slice(0, 4).map(t => (
            <a
              key={t.id}
              href={`/statistical_tests/${t.slug}`}
              className="nc-pill is-stat-test"
              title={t.detected_automatically ? 'Auto-detected from abstract' : 'Manually linked'}
              onClick={(e) => e.stopPropagation()}
            >
              <i className="fas fa-square-root-variable nc-pill-icon" aria-hidden="true" />
              <span className="nc-pill-label">{t.name}</span>
            </a>
          ))}
          {source.statistical_tests?.length > 4 && (
            <span className="src-card-mini-stat">+{source.statistical_tests.length - 4}</span>
          )}
          {source.tags?.map(t => (
            <span key={t} className="nc-pill is-tag">
              <i className="fas fa-tag nc-pill-icon" aria-hidden="true" />
              <span className="nc-pill-label">{t}</span>
            </span>
          ))}
          {source.collections?.map(c => (
            <a key={c.id} href={`/collections/${c.id}`} className="nc-pill is-collection">
              <i className="fas fa-folder nc-pill-icon" aria-hidden="true" />
              <span className="nc-pill-label">{c.name}</span>
            </a>
          ))}
          {onCollectionsChange && (
            <button type="button" className="src-card-collection-add" onClick={() => setShowCollections(s => !s)}>
              {source.collections?.length > 0 ? 'Edit Collections' : '+ Collection'}
            </button>
          )}
        </div>

        {showMarkers && onMarkersChange && (
          <MarkersEditor
            current={source.markers || []}
            available={availableMarkers}
            onChange={onMarkersChange}
            onClose={() => setShowMarkers(false)}
          />
        )}

        {showCollections && onCollectionsChange && (
          <CollectionsEditor
            sourceId={source.id}
            current={source.collections || []}
            onChange={onCollectionsChange}
            onClose={() => setShowCollections(false)}
          />
        )}

        {showConcepts && onConceptsChange && (
          <ConceptsEditor
            current={source.concepts || []}
            onChange={onConceptsChange}
            onClose={() => setShowConcepts(false)}
          />
        )}
      </div>
    </article>
  );
}

// =====================================================================
// LIST — ConceptShow variant
// =====================================================================
function SourceListRow({ source, isKey }) {
  const otherMarkers = (source.markers || []).filter((m) => m !== 'Key Source').slice(0, 3);
  return (
    <li className={`src-card-list-row ${isKey ? 'is-key' : ''}`}>
      <a href={`/sources/${source.id}`} className="src-card-list-title">{toTitleCase(source.title)}</a>
      <div className="src-card-list-meta">
        {isKey && <span className="src-card-list-key">Key Source</span>}
        {source.authors && <span>{source.authors}</span>}
        {source.year && <span className="src-card-list-year">{source.year}</span>}
        {source.kind && <span className="src-card-list-kind">{(KIND_LABELS[source.kind] || source.kind).replace(/_/g, ' ')}</span>}
        {source.journal_name && <span className="src-card-list-journal">{source.journal_name}</span>}
        {source.notes_count > 0 && (
          <span className="src-card-list-notes">
            {source.notes_count} note{source.notes_count === 1 ? '' : 's'}
          </span>
        )}
        {otherMarkers.map((m) => (
          <span key={m} className="src-card-list-marker">{m}</span>
        ))}
      </div>
    </li>
  );
}

// =====================================================================
// TILE — PersonShow variant
// =====================================================================
function SourceTile({ source }) {
  return (
    <a href={`/sources/${source.id}`} className="src-card-tile">
      <div className="src-card-tile-title">{toTitleCase(source.title)}</div>
      <div className="src-card-tile-meta">
        {source.authors && <span className="src-card-tile-authors">{source.authors}</span>}
        {source.year && <span className="src-card-tile-year">{source.year}</span>}
        {source.doi && <span className="src-card-tile-doi">DOI</span>}
      </div>
    </a>
  );
}

// =====================================================================
// MarkersEditor — inline editor used by the full variant.
// =====================================================================
function MarkersEditor({ current, available, onChange, onClose }) {
  const [draft, setDraft] = useState(current);
  const [custom, setCustom] = useState('');

  const toggle = (m) => {
    setDraft(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };
  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!draft.includes(v)) setDraft(prev => [...prev, v]);
    setCustom('');
  };
  const save = () => {
    onChange(draft);
    onClose();
  };

  const allOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    [...SUGGESTED_MARKERS, ...(available || []), ...current, ...draft].forEach(m => {
      if (!seen.has(m)) { seen.add(m); out.push(m); }
    });
    return out;
  }, [available, current, draft]);

  return (
    <div className="src-card-markers-editor">
      <div className="src-card-markers-list">
        {allOptions.map(m => (
          <label key={m} className="src-card-marker-option">
            <input type="checkbox" className="sp-checkbox" checked={draft.includes(m)} onChange={() => toggle(m)} />
            <span>{m}</span>
          </label>
        ))}
      </div>
      <div className="src-card-markers-custom">
        <input
          type="text"
          className="src-card-markers-input"
          placeholder="Add Custom Marker"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
        />
        <button type="button" className="sp-action sp-action-secondary" onClick={addCustom}>Add</button>
      </div>
      <div className="src-card-markers-actions">
        <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="sp-action sp-action-primary" onClick={save}>Save</button>
      </div>
    </div>
  );
}

// =====================================================================
// CollectionsEditor — inline editor for placing a source into the user's
// collections.  Mirrors MarkersEditor (and reuses its styles): batches
// add/remove until Save, and supports creating a collection inline.
//
// Unlike markers (a plain array column saved by the parent), collection
// membership needs the /collections list plus per-collection add_item /
// remove_item calls — so this editor owns the network work itself and
// only hands the parent the resulting pill set via onChange.
// =====================================================================
function CollectionsEditor({ sourceId, current, onChange, onClose }) {
  const currentIds = useMemo(() => current.map(c => c.id), [current]);
  const [available, setAvailable] = useState(null); // null while loading
  const [draftIds, setDraftIds] = useState(() => new Set(currentIds));
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const csrf = () => document.querySelector('[name="csrf-token"]')?.content;

  // Load the collections the user can add items to (owned + collaborator).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/collections.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setAvailable((Array.isArray(data) ? data : []).map(c => ({
          id: c.id,
          name: c.name,
          writable: c.is_owner || c.share_permission === 'collaborator',
          active: c.active !== false,
        })));
      } catch (err) {
        console.error('Collections load failed', err);
        if (!cancelled) { setAvailable([]); setError('Could not load collections.'); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Rows shown: writable + active collections, plus any collection the
  // source already sits in — a non-writable one renders as a locked,
  // checked row so the editor never silently hides a real membership.
  const rows = useMemo(() => {
    if (available == null) return [];
    const currentSet = new Set(currentIds);
    const seen = new Set();
    const out = [];
    available
      .filter(c => (c.writable && c.active) || currentSet.has(c.id))
      .forEach(c => { seen.add(c.id); out.push(c); });
    current.forEach(c => {
      if (seen.has(c.id)) return;
      out.push({ id: c.id, name: c.name, writable: false, active: true });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [available, current, currentIds]);

  const nameFor = useMemo(() => {
    const m = new Map(current.map(c => [c.id, c.name]));
    (available || []).forEach(c => { if (!m.has(c.id)) m.set(c.id, c.name); });
    return m;
  }, [available, current]);

  const toggle = (id) => {
    setDraftIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addCustom = async () => {
    const name = custom.trim();
    if (!name || saving) return;
    const existing = (available || []).find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setDraftIds(prev => new Set(prev).add(existing.id));
      setCustom('');
      return;
    }
    try {
      const res = await fetch('/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ collection: { name } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const c = await res.json();
      setAvailable(prev => [...(prev || []), { id: c.id, name: c.name, writable: true, active: true }]);
      setDraftIds(prev => new Set(prev).add(c.id));
      setCustom('');
      setError(null);
    } catch (err) {
      console.error('Collection create failed', err);
      setError('Could not create that collection.');
    }
  };

  const save = async () => {
    if (saving || available == null) return;
    const have = new Set(currentIds);
    const toAdd = [...draftIds].filter(id => !have.has(id));
    const toRemove = [...have].filter(id => !draftIds.has(id));
    if (toAdd.length === 0 && toRemove.length === 0) { onClose(); return; }

    setSaving(true);
    setError(null);

    const call = (id, path, method) =>
      fetch(`/collections/${id}/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ item_type: 'Source', item_id: sourceId }),
      })
        .then(res => ({ id, ok: res.ok || res.status === 204 }))
        .catch(err => { console.error(`Collection ${path} failed`, err); return { id, ok: false }; });

    const addResults = await Promise.all(toAdd.map(id => call(id, 'add_item', 'POST')));
    const removeResults = await Promise.all(toRemove.map(id => call(id, 'remove_item', 'DELETE')));

    const finalIds = new Set(currentIds);
    addResults.forEach(r => { if (r.ok) finalIds.add(r.id); });
    removeResults.forEach(r => { if (r.ok) finalIds.delete(r.id); });

    onChange(
      [...finalIds]
        .map(id => ({ id, name: nameFor.get(id) }))
        .filter(c => c.name)
        .sort((a, b) => a.name.localeCompare(b.name))
    );

    if ([...addResults, ...removeResults].some(r => !r.ok)) {
      setDraftIds(finalIds);
      setError('Some changes could not be saved.');
      setSaving(false);
    } else {
      onClose();
    }
  };

  return (
    <div className="src-card-markers-editor">
      {available == null ? (
        <p className="src-card-collections-note">Loading collections.</p>
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="src-card-collections-note">No collections yet — create one below.</p>
          ) : (
            <div className="src-card-markers-list">
              {rows.map(c => (
                <label
                  key={c.id}
                  className="src-card-marker-option"
                  title={c.writable ? undefined : 'You can view but not change this collection.'}
                >
                  <input
                    type="checkbox"
                    className="sp-checkbox"
                    checked={draftIds.has(c.id)}
                    disabled={!c.writable}
                    onChange={() => toggle(c.id)}
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="src-card-markers-custom">
            <input
              type="text"
              className="src-card-markers-input"
              placeholder="Create New Collection"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            />
            <button type="button" className="sp-action sp-action-secondary" onClick={addCustom}>Create</button>
          </div>
          {error && <p className="src-card-collections-error">{error}</p>}
          <div className="src-card-markers-actions">
            <button type="button" className="sp-action sp-action-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="sp-action sp-action-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving.' : 'Save'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================================
// ConceptsEditor — inline editor for tagging a source with concepts.
// Same button/editor pattern as MarkersEditor (and reuses its styles);
// because a researcher's concept vocabulary is large and open-ended this
// one is search-first and supports creating a concept inline.  The Save
// hands the parent the new concept set; the parent PATCHes concept_ids.
// =====================================================================
function ConceptsEditor({ current, onChange, onClose }) {
  const [available, setAvailable] = useState(null); // null while loading
  const [draftIds, setDraftIds] = useState(() => new Set(current.map(c => c.id)));
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const csrf = () => document.querySelector('[name="csrf-token"]')?.content;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/concepts.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setAvailable((Array.isArray(data) ? data : []).map(c => ({ id: c.id, label: c.label })));
      } catch (err) {
        console.error('Concepts load failed', err);
        if (!cancelled) { setAvailable([]); setError('Could not load concepts.'); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Label lookup spanning the fetched list + whatever the source already
  // carries, so Save can hand back {id, label} for every checked concept.
  const labelFor = useMemo(() => {
    const m = new Map(current.map(c => [c.id, c.label]));
    (available || []).forEach(c => { if (!m.has(c.id)) m.set(c.id, c.label); });
    return m;
  }, [available, current]);

  // Checked concepts always show; the rest are filtered by the query and
  // capped so a large vocabulary doesn't blow the card out vertically.
  const rows = useMemo(() => {
    if (available == null) return [];
    const q = query.trim().toLowerCase();
    const checked = [];
    const rest = [];
    available.forEach(c => {
      if (draftIds.has(c.id)) checked.push(c);
      else if (!q || c.label.toLowerCase().includes(q)) rest.push(c);
    });
    const byLabel = (a, b) => a.label.localeCompare(b.label);
    return [...checked.sort(byLabel), ...rest.sort(byLabel)].slice(0, 60);
  }, [available, draftIds, query]);

  const exactExists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (available || []).some(c => c.label.toLowerCase() === q);
  }, [available, query]);

  const toggle = (id) => {
    setDraftIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const createConcept = async () => {
    const label = query.trim();
    if (!label || creating || exactExists) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ concept: { label } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const c = await res.json();
      setAvailable(prev => [...(prev || []), { id: c.id, label: c.label }]);
      setDraftIds(prev => new Set(prev).add(c.id));
      setQuery('');
    } catch (err) {
      console.error('Concept create failed', err);
      setError('Could not create that concept.');
    } finally {
      setCreating(false);
    }
  };

  const save = () => {
    if (available == null) return;
    onChange(
      [...draftIds]
        .map(id => ({ id, label: labelFor.get(id) }))
        .filter(c => c.label)
        .sort((a, b) => a.label.localeCompare(b.label))
    );
    onClose();
  };

  return (
    <div className="src-card-markers-editor">
      {available == null ? (
        <p className="src-card-collections-note">Loading concepts.</p>
      ) : (
        <>
          <input
            type="text"
            className="src-card-concepts-search"
            placeholder="Search concepts."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !exactExists) { e.preventDefault(); createConcept(); } }}
          />
          {rows.length === 0 ? (
            <p className="src-card-collections-note">
              {query.trim() ? 'No matching concepts.' : 'No concepts yet — create one below.'}
            </p>
          ) : (
            <div className="src-card-concepts-list">
              {rows.map(c => (
                <label key={c.id} className="src-card-marker-option">
                  <input
                    type="checkbox"
                    className="sp-checkbox"
                    checked={draftIds.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span>{toTitleCase(c.label)}</span>
                </label>
              ))}
            </div>
          )}
          {query.trim() && !exactExists && (
            <button
              type="button"
              className="src-card-concept-create"
              onClick={createConcept}
              disabled={creating}
            >
              {creating ? 'Creating.' : `+ Create "${query.trim()}"`}
            </button>
          )}
          {error && <p className="src-card-collections-error">{error}</p>}
          <div className="src-card-markers-actions">
            <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="sp-action sp-action-primary" onClick={save}>Save</button>
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================================
// CiteThisMenu — same dropdown that lived in SourcesIndex.
// =====================================================================
const CITE_FORMATS = [
  { v: 'apa',             l: 'APA (full)' },
  { v: 'apa_in_text',     l: 'APA (in-text)' },
  { v: 'mla',             l: 'MLA (full)' },
  { v: 'mla_in_text',     l: 'MLA (in-text)' },
  { v: 'chicago',         l: 'Chicago (full)' },
  { v: 'chicago_in_text', l: 'Chicago (in-text)' },
  { v: 'bibtex',          l: 'BibTeX' },
  { v: 'ris',             l: 'RIS' },
];

function CiteThisMenu({ sourceId }) {
  const [open, setOpen] = useState(false);
  const [busyFormat, setBusyFormat] = useState(null);
  const [copiedFormat, setCopiedFormat] = useState(null);
  const [error, setError] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSelect = async (format) => {
    if (busyFormat) return;
    setBusyFormat(format);
    setError(null);
    try {
      const csrf = document.querySelector('[name="csrf-token"]')?.content;
      const res = await fetch('/sources/citations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ ids: [sourceId], format }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const body = (data.body || '').trim();
      if (!body) throw new Error('Empty citation');
      await navigator.clipboard.writeText(body);
      setCopiedFormat(format);
      setTimeout(() => {
        setCopiedFormat((curr) => (curr === format ? null : curr));
        setOpen(false);
      }, 900);
    } catch (err) {
      console.error(err);
      setError('Could not copy citation');
      setTimeout(() => setError(null), 2200);
    } finally {
      setBusyFormat(null);
    }
  };

  return (
    <div className="src-card-cite-wrap" ref={wrapRef}>
      <button
        type="button"
        className="src-card-icon"
        onClick={() => setOpen((o) => !o)}
        aria-label="Cite this source"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Cite this"
      >
        <QuoteIcon />
        <span className="src-card-icon-label">Cite</span>
      </button>
      {open && (
        <div className="src-card-cite-menu" role="menu">
          <div className="src-card-cite-menu-head">Copy citation as</div>
          {CITE_FORMATS.map((o) => {
            const isCopied = copiedFormat === o.v;
            return (
              <button
                key={o.v}
                type="button"
                role="menuitem"
                className="src-card-cite-menu-item"
                onClick={() => handleSelect(o.v)}
                disabled={!!busyFormat}
              >
                <span>{o.l}</span>
                {isCopied && <span className="src-card-cite-menu-status is-ok">Copied</span>}
              </button>
            );
          })}
          {error && <div className="src-card-cite-menu-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Icons
// =====================================================================
function PdfBadge({ hasPdf }) {
  return (
    <span
      className={`src-card-pdf-badge${hasPdf ? ' is-present' : ' is-missing'}`}
      title={hasPdf ? 'PDF attached' : 'No PDF attached'}
      aria-label={hasPdf ? 'PDF attached' : 'No PDF attached'}
    >
      <svg width="14" height="16" viewBox="0 0 14 16" fill="none" aria-hidden="true">
        <path
          d="M2.5 1h6L12 4.5V14a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
          fill={hasPdf ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M8.5 1v3.5H12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
        {hasPdf && (
          <text
            x="7"
            y="11.6"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="4.4"
            fontWeight="700"
            fill="var(--paper)"
          >PDF</text>
        )}
      </svg>
    </span>
  );
}
function NoteIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 2.5h7l3 3V13a.5.5 0 01-.5.5h-9.5A.5.5 0 012.5 13V3a.5.5 0 01.5-.5z" strokeLinejoin="round" />
      <path d="M5.5 8h5M5.5 10.5h3.5" strokeLinecap="round" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M11 2.5l2.5 2.5L6 12.5H3.5V10L11 2.5z" strokeLinejoin="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 4h10M6 4V2.5h4V4M5 4l.6 9a1 1 0 001 .9h2.8a1 1 0 001-.9L11 4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function QuoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M5.5 4.5c-1.5 0-2.5 1.2-2.5 2.7 0 1.4 1 2.3 2.2 2.3.3 0 .6 0 .8-.1-.2 1-.9 1.7-2 2.1M11.5 4.5c-1.5 0-2.5 1.2-2.5 2.7 0 1.4 1 2.3 2.2 2.3.3 0 .6 0 .8-.1-.2 1-.9 1.7-2 2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// =====================================================================
// Styles — render once per page that uses SourceCard.
// =====================================================================
export function SourceCardStyles() {
  return (
    <style>{`
      /* =================================================================
         FULL variant — primary card used on /sources
         ================================================================= */
      .src-card-full {
        display: flex;
        gap: 14px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-top: 3px solid var(--source);
        border-radius: var(--r-md);
        padding: 12px 22px 18px;
        box-shadow:
          0 1px 2px rgba(21, 25, 31, 0.04),
          0 12px 32px rgba(21, 25, 31, 0.06);
        transition: box-shadow 0.18s, border-color 0.18s, transform 0.18s, background 0.12s;
        position: relative;
      }
      .src-card-full:hover {
        border-color: var(--source);
        box-shadow:
          0 1px 2px rgba(21, 25, 31, 0.05),
          0 18px 36px rgba(21, 25, 31, 0.10);
        transform: translateY(-1px);
      }
      .src-card-full.is-selected {
        border-color: var(--source);
        background: var(--source-tint);
        box-shadow:
          inset 4px 0 0 var(--source),
          0 1px 2px rgba(21, 25, 31, 0.05),
          0 18px 36px rgba(21, 25, 31, 0.08);
      }
      .src-card-check {
        display: flex;
        align-items: flex-start;
        padding-top: 6px;
        cursor: pointer;
      }
      .src-card-main { flex: 1; min-width: 0; display: block; }

      /* Pre-header: muted dot-separated metadata strip + action group */
      .src-card-prehead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
        min-height: 22px;
      }
      .src-card-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 8px;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        min-width: 0;
      }
      .src-card-meta-sep { color: var(--ink-4); user-select: none; }
      .src-card-year { font-family: var(--font-mono); color: var(--ink-3); font-variant-numeric: tabular-nums; }
      .src-card-kind {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--source-2);
        font-weight: 600;
      }
      .src-card-journal { color: var(--ink-3); font-style: italic; }
      .src-card-doi {
        color: var(--source-2);
        text-decoration: none;
        font-family: var(--font-mono);
        font-size: 11px;
      }
      .src-card-doi:hover { text-decoration: underline; }
      .src-card-doi-ext { font-family: var(--font-body); font-size: 10px; }

      .src-card-actions {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      .src-card-icon {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        padding: 0 10px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        color: var(--ink-3);
        cursor: pointer;
        text-decoration: none;
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
      }
      .src-card-icon:hover {
        background: var(--source-tint);
        color: var(--source-2);
        border-color: color-mix(in srgb, var(--source) 30%, transparent);
      }
      .src-card-icon-label { line-height: 1; }
      .src-card-icon-danger:hover {
        background: rgba(122, 46, 46, 0.06);
        color: var(--error);
        border-color: color-mix(in srgb, var(--error) 30%, transparent);
      }

      /* Edit/Delete fade in on hover/focus, tap-visible on touch. */
      .src-card-actions-hover {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        opacity: 0;
        transition: opacity 0.15s;
      }
      .src-card-full:hover .src-card-actions-hover,
      .src-card-full:focus-within .src-card-actions-hover { opacity: 1; }
      @media (hover: none) {
        .src-card-actions-hover { opacity: 1; }
      }
      .src-card-actions-hover .src-card-icon {
        width: 28px;
        padding: 0;
        justify-content: center;
      }

      /* Cite-this dropdown */
      .src-card-cite-wrap { position: relative; display: inline-flex; }
      .src-card-cite-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 30;
        min-width: 200px;
        padding: 4px;
        background: var(--paper, #fff);
        border: 1px solid var(--ink-6, rgba(0,0,0,0.12));
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        display: flex;
        flex-direction: column;
      }
      .src-card-cite-menu-head {
        padding: 6px 10px 4px;
        font-family: var(--font-body);
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--ink-3);
      }
      .src-card-cite-menu-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 7px 10px;
        background: none;
        border: 0;
        border-radius: 5px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-1);
        text-align: left;
        cursor: pointer;
      }
      .src-card-cite-menu-item:hover:not(:disabled) {
        background: var(--paper-warm, var(--paper-soft));
        color: var(--source-2);
      }
      .src-card-cite-menu-item:disabled { cursor: default; opacity: 0.6; }
      .src-card-cite-menu-status { font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); }
      .src-card-cite-menu-status.is-ok { color: var(--source-2); }
      .src-card-cite-menu-error { padding: 6px 10px; font-size: 11.5px; color: var(--danger, #b00020); }

      @media (max-width: 720px) {
        /* Keep "Take Notes" and "Cite" labels visible on mobile —
           icon-only collapse is too cryptic on small screens. */
      }

      /* Stack metadata above actions on narrow screens — both rows
         full-width.  Hover affordances don't apply on phones, so
         show Edit/Delete unconditionally and center the action row. */
      @media (max-width: 600px) {
        .src-card-prehead {
          flex-direction: column;
          align-items: stretch;
          gap: 6px;
        }
        .src-card-actions {
          justify-content: center;
          flex-wrap: wrap;
        }
        .src-card-actions-hover { opacity: 1; }
      }

      /* Title row: title (flex) + PDF link icon at right */
      .src-card-titleline {
        display: flex;
        align-items: baseline;
        gap: 10px;
        min-width: 0;
      }
      .src-card-title {
        font-family: var(--font-display);
        font-size: 15.5px;
        font-weight: 600;
        color: var(--source);
        line-height: 1.35;
        text-decoration: none;
        min-width: 0;
        flex: 1;
      }
      .src-card-title,
      .src-card-title:hover,
      .src-card-title-text,
      .src-card-title:hover .src-card-title-text { text-decoration: none; }
      .src-card-title-text { min-width: 0; }
      .src-card-title:hover { color: var(--source-2); }
      .src-card-pdflink {
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        position: relative;
        top: 2px;
        line-height: 1;
        text-decoration: none;
      }
      .src-card-pdf-badge {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        line-height: 1;
        transition: color var(--transition-fast), opacity var(--transition-fast);
      }
      .src-card-pdf-badge.is-present { color: var(--source); }
      .src-card-pdf-badge.is-missing { color: var(--ink-4); opacity: 0.55; }
      .src-card-pdflink:hover .src-card-pdf-badge.is-present { color: var(--source-2); }
      .src-card-pdflink:hover .src-card-pdf-badge.is-missing { color: var(--ink-3); opacity: 0.85; }

      /* Authors line */
      .src-card-authors-line {
        margin-top: 8px;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-2);
      }
      .src-card-authors { color: var(--ink-2); }
      .src-card-authors-row {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 6px;
      }
      .src-card-abstract {
        margin: 14px 0 0;
        font-family: var(--font-body);
        font-size: 13px;
        line-height: 1.55;
        color: var(--ink-2);
      }

      /* Single wrapped chip row — mixes nc-pill chips of every category
         (markers, concepts, methods, stat tests, tags, collections).
         Color carries the meaning; ratios vary widely between sources. */
      .src-card-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 6px;
        margin-top: 12px;
        align-items: center;
      }

      .src-card-marker-add,
      .src-card-collection-add,
      .src-card-concept-add {
        font-family: var(--font-body);
        font-size: 11.5px;
        background: transparent;
        color: var(--ink-3);
        border: 1px dashed var(--ink-line);
        padding: 1px 8px;
        border-radius: var(--r-sm);
        cursor: pointer;
      }
      .src-card-marker-add:hover,
      .src-card-collection-add:hover,
      .src-card-concept-add:hover { color: var(--source-2); border-color: var(--source); }
      .src-card-mini-stat {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-3);
      }

      /* Inline marker editor — also reused by the collections editor */
      .src-card-collections-note {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        margin: 0 0 10px;
      }
      .src-card-collections-error {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--error);
        margin: 8px 0 0;
      }
      .src-card-concepts-search {
        width: 100%;
        height: 32px;
        padding: 0 10px;
        margin-bottom: 10px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink);
      }
      .src-card-concepts-search:focus { outline: none; border-color: var(--source); }
      .src-card-concepts-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 4px;
        max-height: 220px;
        overflow-y: auto;
        margin-bottom: 10px;
      }
      .src-card-concept-create {
        display: inline-block;
        margin-bottom: 10px;
        background: transparent;
        border: 1px dashed var(--ink-line);
        border-radius: var(--r-sm);
        padding: 4px 10px;
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--source-2);
        cursor: pointer;
      }
      .src-card-concept-create:hover { border-color: var(--source); }
      .src-card-concept-create:disabled { opacity: 0.6; cursor: default; }
      .src-card-markers-editor {
        margin-top: 12px;
        padding: 12px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
      }
      .src-card-markers-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 4px;
        margin-bottom: 10px;
      }
      .src-card-marker-option {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        padding: 3px 6px;
        border-radius: var(--r-sm);
      }
      .src-card-marker-option:hover { background: var(--hover); }
      .src-card-markers-custom { display: flex; gap: 6px; margin-bottom: 10px; }
      .src-card-markers-input {
        flex: 1;
        height: 32px;
        padding: 0 10px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink);
      }
      .src-card-markers-input:focus { outline: none; border-color: var(--source); }
      .src-card-markers-actions { display: flex; gap: 8px; justify-content: flex-end; }

      /* =================================================================
         LIST variant — ConceptShow / cross-entity contexts
         Small card per row, hover-border, source-tint for key sources.
         ================================================================= */
      .src-card-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .src-card-list-row {
        list-style: none;
        padding: 10px 14px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        transition: border-color 0.12s;
      }
      .src-card-list-row:hover { border-color: var(--source); }
      .src-card-list-row.is-key {
        border-color: color-mix(in srgb, var(--source) 50%, var(--ink-line));
        background: color-mix(in srgb, var(--source-tint) 35%, var(--paper));
      }
      .src-card-list-title {
        font-family: var(--font-display);
        font-size: 14px;
        font-weight: 500;
        color: var(--ink);
        line-height: 1.35;
        text-decoration: none;
      }
      .src-card-list-title:hover { color: var(--source-2); }
      .src-card-list-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
        margin-top: 4px;
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        align-items: baseline;
      }
      .src-card-list-key {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
        color: var(--source);
        background: var(--source-tint);
        padding: 1px 8px;
        border-radius: var(--r-sm);
      }
      .src-card-list-year {
        font-family: var(--font-mono);
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .src-card-list-kind {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--source-2);
      }
      .src-card-list-journal { font-style: italic; }
      .src-card-list-notes { color: var(--ink-2); }
      .src-card-list-marker {
        font-size: 11px;
        color: var(--ink-2);
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        padding: 1px 8px;
        border-radius: var(--r-sm);
      }

      /* =================================================================
         TILE variant — PersonShow tile grid
         ================================================================= */
      .src-card-tile-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 10px;
      }
      .src-card-tile {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        text-decoration: none;
        color: inherit;
        transition: border-color 0.12s, transform 0.12s;
      }
      .src-card-tile:hover {
        border-color: var(--source);
        transform: translateY(-1px);
      }
      .src-card-tile-title {
        font-family: var(--font-display);
        font-size: 13.5px;
        font-weight: 500;
        color: var(--ink);
        line-height: 1.35;
      }
      .src-card-tile-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 8px;
        font-size: 11.5px;
        color: var(--ink-3);
      }
      .src-card-tile-authors {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .src-card-tile-year {
        font-family: var(--font-mono);
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .src-card-tile-doi {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--source-2);
      }
    `}</style>
  );
}
