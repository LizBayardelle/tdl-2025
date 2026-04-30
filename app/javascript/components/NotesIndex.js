import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SPStyles } from './SamplePage';
import NoteFormModal from './NoteFormModal';
import NoteShowModal from './NoteShowModal';
import TabletopShow from './TabletopShow';
import NoteCard, {
  NoteCardStyles,
  NOTE_TYPE_LABELS,
  tagName,
  tagKey,
  plain,
  highlightText,
  formatDate,
  PinIcon,
} from './NoteCard';

// =====================================================================
// NotesIndex
// The cross-source thinking surface.  Every note across every source,
// concept, and person — filtered, sorted, and (optionally) grouped so
// the user can move from one organizing dimension to another in a click.
//
// Notes are typically authored from /sources/:id/study; this page is
// where they're rediscovered, connected, and pruned.
// =====================================================================

const NOTE_TYPE_ORDER = ['note', 'question', 'synthesis', 'connection', 'todo', 'highlight'];

const SORT_OPTIONS = [
  { value: 'recent',     label: 'Recently Added' },
  { value: 'oldest',     label: 'Oldest First' },
  { value: 'noted_desc', label: 'Noted On (Newest)' },
  { value: 'noted_asc',  label: 'Noted On (Oldest)' },
  { value: 'title',      label: 'Title (A–Z)' },
  { value: 'linked',     label: 'Most Connected' },
];

const GROUP_OPTIONS = [
  { value: 'none',    label: 'No Grouping' },
  { value: 'type',    label: 'By Type' },
  { value: 'source',  label: 'By Source' },
  { value: 'concept', label: 'By Concept' },
  { value: 'person',  label: 'By Person' },
  { value: 'month',   label: 'By Month' },
];

// ---------- URL state ----------
function readFiltersFromUrl() {
  if (typeof window === 'undefined') return defaultFilters();
  const p = new URLSearchParams(window.location.search);
  return {
    q:              p.get('q') || '',
    types:          p.getAll('types[]'),
    concept_ids:    p.getAll('concept_ids[]').map(Number).filter(Boolean),
    source_ids:     p.getAll('source_ids[]').map(Number).filter(Boolean),
    person_ids:     p.getAll('person_ids[]').map(Number).filter(Boolean),
    collection_ids: p.getAll('collection_ids[]').map(Number).filter(Boolean),
    tags:           p.getAll('tags[]'),
    pinned_only:    p.get('pinned') === '1',
    has_quote:      p.get('has_quote') === '1',
    unattached:     p.get('unattached') === '1',
    sort:           p.get('sort') || 'recent',
    group:          p.get('group') || 'none',
    density:        p.get('density') || 'card',
  };
}

function defaultFilters() {
  return {
    q: '', types: [], concept_ids: [], source_ids: [], person_ids: [],
    collection_ids: [], tags: [],
    pinned_only: false, has_quote: false, unattached: false,
    sort: 'recent', group: 'none', density: 'card',
  };
}

function writeFiltersToUrl(f) {
  if (typeof window === 'undefined') return;
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  f.types.forEach(t => p.append('types[]', t));
  f.concept_ids.forEach(id => p.append('concept_ids[]', id));
  f.source_ids.forEach(id => p.append('source_ids[]', id));
  f.person_ids.forEach(id => p.append('person_ids[]', id));
  f.collection_ids.forEach(id => p.append('collection_ids[]', id));
  f.tags.forEach(t => p.append('tags[]', t));
  if (f.pinned_only) p.set('pinned', '1');
  if (f.has_quote) p.set('has_quote', '1');
  if (f.unattached) p.set('unattached', '1');
  if (f.sort && f.sort !== 'recent') p.set('sort', f.sort);
  if (f.group && f.group !== 'none') p.set('group', f.group);
  if (f.density && f.density !== 'card') p.set('density', f.density);
  const q = p.toString();
  window.history.replaceState(null, '', q ? `${window.location.pathname}?${q}` : window.location.pathname);
}

// ---------- Utility ----------
function monthKey(iso) {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key) {
  if (key === 'unknown') return 'Undated';
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function noteLinkCount(n) {
  return (n.concepts?.length || 0)
       + (n.source ? 1 : 0)
       + (n.people?.length || 0)
       + (n.tags?.length || 0)
       + (n.collections?.length || 0);
}

// =====================================================================
// Component
// =====================================================================
export default function NotesIndex() {
  const [filters, setFilters] = useState(readFiltersFromUrl);

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reference data for facets and chip lookups.
  const [allConcepts, setAllConcepts] = useState([]);
  const [allSources, setAllSources]   = useState([]);
  const [allPeople, setAllPeople]     = useState([]);
  const [allCollections, setAllCollections] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // ---- Bulk-select / send-to-tabletop ----
  const [selectMode, setSelectMode]             = useState(false);
  const [selectedIds, setSelectedIds]           = useState(() => new Set());
  const [tabletops, setTabletops]               = useState([]);
  const [chosenTabletopId, setChosenTabletopId] = useState('');
  const [newTabletopName, setNewTabletopName]   = useState('');
  const [sendMode, setSendMode]                 = useState('staged'); // 'staged' | 'grid'
  const [sending, setSending]                   = useState(false);
  const [sendBanner, setSendBanner]             = useState(null);

  // ---- Tabletop overlay (Phase D — open a tabletop without leaving /notes) ----
  const [overlayTabletopId, setOverlayTabletopId] = useState(null);
  const [tabletopMenuOpen, setTabletopMenuOpen]   = useState(false);
  const tabletopMenuRef = useRef(null);
  useEffect(() => {
    if (!tabletopMenuOpen) return;
    const onClick = (e) => {
      if (tabletopMenuRef.current && !tabletopMenuRef.current.contains(e.target)) setTabletopMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [tabletopMenuOpen]);

  const searchInputRef = useRef(null);

  // ---- Data load ----
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [notesRes, conceptsRes, sourcesRes, peopleRes, collectionsRes] = await Promise.all([
        fetch('/notes.json'),
        fetch('/concepts.json'),
        fetch('/sources.json?per_page=10000'),
        fetch('/people.json'),
        fetch('/collections.json'),
      ]);
      const [notesData, conceptsData, sourcesData, peopleData, collectionsData] = await Promise.all([
        notesRes.json(), conceptsRes.json(), sourcesRes.json(), peopleRes.json(), collectionsRes.json(),
      ]);
      setNotes(Array.isArray(notesData) ? notesData : []);
      setAllConcepts(Array.isArray(conceptsData) ? conceptsData : []);
      setAllSources(Array.isArray(sourcesData) ? sourcesData : (sourcesData.sources || []));
      setAllPeople(Array.isArray(peopleData) ? peopleData : []);
      setAllCollections(Array.isArray(collectionsData) ? collectionsData : (collectionsData.collections || collectionsData));
    } catch (err) {
      console.error('Notes load failed', err);
      setError('Could not load notes.  Refresh to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- Persist filter state to URL ----
  useEffect(() => { writeFiltersToUrl(filters); }, [filters]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (e.key === '/' && !inField) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'n' && !inField && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setEditingNote(null);
        setShowForm(true);
      } else if (e.key === 'Escape' && filters.q && document.activeElement === searchInputRef.current) {
        update({ q: '' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filters.q]);

  // ---- Mutators ----
  const update = (patch) => setFilters(f => ({ ...f, ...patch }));
  const toggleArr = (key, value) => setFilters(f => {
    const cur = f[key] || [];
    return { ...f, [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] };
  });
  const clearAll = () => setFilters(f => ({ ...defaultFilters(), sort: f.sort, group: f.group, density: f.density }));

  // Source → set of authoring person ids.  Used so the People facet can match
  // a note both when the person is tagged directly AND when the person wrote
  // the note's source.
  const sourceToPeopleIds = useMemo(() => {
    const m = new Map();
    allSources.forEach(s => {
      const ids = (s.people || []).map(p => p.id).filter(Boolean);
      if (ids.length) m.set(s.id, new Set(ids));
    });
    return m;
  }, [allSources]);

  // ---- Derived: filtered notes + facet counts on the *unfiltered* base ----
  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return notes.filter(n => {
      if (filters.pinned_only && !n.pinned) return false;
      if (filters.has_quote && !n.quote_text) return false;
      if (filters.unattached && (n.source || (n.concepts?.length > 0))) return false;
      if (filters.types.length > 0 && !filters.types.includes(n.note_type)) return false;
      if (filters.concept_ids.length > 0 && !n.concepts?.some(c => filters.concept_ids.includes(c.id))) return false;
      if (filters.source_ids.length > 0 && !(n.source && filters.source_ids.includes(n.source.id))) return false;
      if (filters.person_ids.length > 0) {
        const direct = n.people?.some(p => filters.person_ids.includes(p.id));
        const viaSource = n.source ? sourceToPeopleIds.get(n.source.id) : null;
        const transitive = viaSource && filters.person_ids.some(id => viaSource.has(id));
        if (!direct && !transitive) return false;
      }
      if (filters.collection_ids.length > 0 && !n.collections?.some(c => filters.collection_ids.includes(c.id))) return false;
      if (filters.tags.length > 0 && !n.tags?.some(t => filters.tags.includes(tagName(t)))) return false;
      if (q) {
        const hay = `${n.title || ''} ${plain(n.body || '')} ${n.context || ''} ${n.quote_text || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notes, filters, sourceToPeopleIds]);

  // ---- Sort (pinned floats only when grouping is none) ----
  const sorted = useMemo(() => {
    const cmps = {
      recent:     (a, b) => new Date(b.created_at) - new Date(a.created_at),
      oldest:     (a, b) => new Date(a.created_at) - new Date(b.created_at),
      noted_desc: (a, b) => new Date(b.noted_on || b.created_at) - new Date(a.noted_on || a.created_at),
      noted_asc:  (a, b) => new Date(a.noted_on || a.created_at) - new Date(b.noted_on || b.created_at),
      title:      (a, b) => (a.title || '').localeCompare(b.title || ''),
      linked:     (a, b) => noteLinkCount(b) - noteLinkCount(a),
    };
    const cmp = cmps[filters.sort] || cmps.recent;
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (filters.group === 'none') {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      }
      return cmp(a, b);
    });
    return arr;
  }, [filtered, filters.sort, filters.group]);

  // ---- Group ----
  const groups = useMemo(() => buildGroups(sorted, filters.group, { allConcepts, allSources, allPeople, sourceToPeopleIds }),
    [sorted, filters.group, allConcepts, allSources, allPeople, sourceToPeopleIds]);

  // ---- Facet counts (computed against the base — not filtered — list) ----
  const meta = useMemo(() => computeMeta(notes, { allConcepts, allSources, allPeople, allCollections, sourceToPeopleIds }),
    [notes, allConcepts, allSources, allPeople, allCollections, sourceToPeopleIds]);

  const activeFilterCount =
      filters.types.length
    + filters.concept_ids.length
    + filters.source_ids.length
    + filters.person_ids.length
    + filters.collection_ids.length
    + filters.tags.length
    + (filters.pinned_only ? 1 : 0)
    + (filters.has_quote ? 1 : 0)
    + (filters.unattached ? 1 : 0);

  const hasFilters = activeFilterCount > 0 || !!filters.q;

  // ---- Note actions ----
  const csrf = () => document.querySelector('[name="csrf-token"]')?.content;

  const togglePin = async (note) => {
    try {
      const res = await fetch(`/notes/${note.id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ note: { pinned: !note.pinned } }),
      });
      if (res.ok) {
        const updated = await res.json();
        setNotes(prev => prev.map(n => n.id === note.id ? { ...n, ...updated } : n));
      }
    } catch (err) { console.error('Pin failed', err); }
  };

  const deleteNote = async (note) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    try {
      const res = await fetch(`/notes/${note.id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf() },
      });
      if (res.ok) setNotes(prev => prev.filter(n => n.id !== note.id));
    } catch (err) { console.error('Delete failed', err); }
  };

  const onFormSuccess = () => {
    setShowForm(false);
    setEditingNote(null);
    fetchData();
  };

  // ---- Bulk-select handlers ----
  async function fetchTabletops() {
    try {
      const res = await fetch('/tabletops.json');
      if (res.ok) setTabletops(await res.json());
    } catch (err) { console.error('Tabletops load failed', err); }
  }

  function openTabletopMenu() {
    setTabletopMenuOpen(true);
    if (tabletops.length === 0) fetchTabletops();
  }
  function openOverlay(tabletopId) {
    setTabletopMenuOpen(false);
    setOverlayTabletopId(tabletopId);
  }
  async function createAndOpenOverlay() {
    const name = window.prompt('Name your new tabletop');
    if (!name || !name.trim()) return;
    try {
      const res = await fetch('/tabletops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ tabletop: { name: name.trim() } }),
      });
      if (!res.ok) throw new Error('create failed');
      const created = await res.json();
      setTabletops(prev => [created, ...prev]);
      setTabletopMenuOpen(false);
      setOverlayTabletopId(created.id);
    } catch (err) { console.error('Create + open failed', err); }
  }

  function enterSelectMode() {
    setSelectMode(true);
    setSendBanner(null);
    if (tabletops.length === 0) fetchTabletops();
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setChosenTabletopId('');
    setNewTabletopName('');
  }
  function toggleSelectNote(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function sendToTabletop() {
    if (selectedIds.size === 0) return;
    if (!chosenTabletopId) return;

    setSending(true);
    try {
      let targetId   = chosenTabletopId;
      let targetName = '';

      if (chosenTabletopId === '__new__') {
        const name = newTabletopName.trim();
        if (!name) { setSending(false); return; }
        const cres = await fetch('/tabletops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrf() },
          body: JSON.stringify({ tabletop: { name } }),
        });
        if (!cres.ok) throw new Error('Tabletop create failed');
        const created = await cres.json();
        targetId   = created.id;
        targetName = created.name;
        setTabletops(prev => [created, ...prev]);
      } else {
        const t = tabletops.find(x => String(x.id) === String(targetId));
        targetName = t?.name || 'tabletop';
      }

      const res = await fetch(`/tabletops/${targetId}/import_notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ note_ids: [...selectedIds], mode: sendMode }),
      });
      if (!res.ok) throw new Error('Import failed');
      const data = await res.json();

      setSendBanner({
        tabletopId:   data.tabletop_id || targetId,
        tabletopName: data.tabletop_name || targetName,
        added:        data.added || 0,
        skipped:      data.skipped || 0,
        mode:         data.mode || sendMode,
      });
      exitSelectMode();
    } catch (err) {
      console.error('Send failed', err);
      window.alert('Could not send notes to the tabletop.  Try again in a moment.');
    } finally {
      setSending(false);
    }
  }

  // ---------------------------------------------------------------
  if (loading) {
    return (
      <div className="sp-root nx">
        <SPStyles />
        <NoteCardStyles />
        <NxStyles />
        <div className="nx-loading">Loading notes.</div>
      </div>
    );
  }

  return (
    <div className="sp-root nx">
      <SPStyles />
      <NoteCardStyles />
      <NxStyles />

      <header className="nx-header">
        <div className="nx-header-text">
          <h1 className="nx-title">Notes</h1>
          <p className="nx-subtitle">
            {notes.length === 0
              ? 'No notes yet.'
              : `${filtered.length.toLocaleString()} of ${notes.length.toLocaleString()} note${notes.length === 1 ? '' : 's'}`}
            {hasFilters && (
              <> · <button type="button" className="nx-link" onClick={clearAll}>
                Clear {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}` : 'search'}
              </button></>
            )}
          </p>
        </div>
        <div className="nx-header-actions">
          {!selectMode && (
            <div className="nx-tt-menu" ref={tabletopMenuRef}>
              <button
                type="button"
                className="sp-action sp-action-secondary"
                onClick={openTabletopMenu}
                aria-haspopup="menu"
                aria-expanded={tabletopMenuOpen}
                title="Open a tabletop overlay over your notes"
              >
                Open Tabletop ▾
              </button>
              {tabletopMenuOpen && (
                <div className="nx-tt-menu-pop" role="menu">
                  {tabletops.length === 0 ? (
                    <div className="nx-tt-menu-empty">No tabletops yet.</div>
                  ) : (
                    tabletops.slice(0, 12).map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className="nx-tt-menu-item"
                        onClick={() => openOverlay(t.id)}
                        role="menuitem"
                      >
                        <span className="nx-tt-menu-dot" aria-hidden="true" />
                        <span className="nx-tt-menu-name">{t.name}</span>
                        <span className="nx-tt-menu-count">{t.items_count || 0}</span>
                      </button>
                    ))
                  )}
                  <div className="nx-tt-menu-divider" />
                  <button type="button" className="nx-tt-menu-item nx-tt-menu-item-new" onClick={createAndOpenOverlay} role="menuitem">
                    <span aria-hidden="true">+</span> New tabletop
                  </button>
                </div>
              )}
            </div>
          )}
          {!selectMode && filtered.length > 0 && (
            <button
              type="button"
              className="sp-action sp-action-secondary"
              onClick={enterSelectMode}
              title="Select notes to send to a tabletop"
            >
              Add to Tabletop
            </button>
          )}
          <button
            type="button"
            className="sp-action sp-action-secondary nx-new-note-btn"
            onClick={() => { setEditingNote(null); setShowForm(true); }}
            title="New note"
            aria-label="New note"
          >
            <span aria-hidden="true">+</span>
            <span className="nx-new-note-label"> New Note</span>
          </button>
        </div>
      </header>

      {sendBanner && (
        <div className="nx-send-banner" role="status">
          <span className="nx-send-banner-text">
            <strong>{sendBanner.added}</strong> note{sendBanner.added === 1 ? '' : 's'} sent to <strong>{sendBanner.tabletopName}</strong>
            {sendBanner.mode === 'staged' && <> — waiting in the tray.</>}
            {sendBanner.mode === 'grid'   && <> — placed in a grid.</>}
            {sendBanner.skipped > 0 && <> <span className="nx-send-banner-muted">({sendBanner.skipped} already there)</span></>}
          </span>
          <a href={`/tabletops/${sendBanner.tabletopId}`} className="sp-action sp-action-primary nx-send-banner-cta">
            Open Tabletop
          </a>
          <button type="button" className="nx-send-banner-close" onClick={() => setSendBanner(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {selectMode && (
        <div className="nx-bulk-bar">
          <span className="nx-bulk-count">
            {selectedIds.size === 0
              ? 'Click notes to select'
              : `${selectedIds.size} selected`}
          </span>
          <button
            type="button"
            className="nx-link"
            onClick={() => setSelectedIds(new Set(sorted.map(n => n.id)))}
            disabled={sorted.length === 0}
          >
            Select all {sorted.length}
          </button>
          {selectedIds.size > 0 && (
            <button type="button" className="nx-link" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          )}

          <div className="nx-bulk-spacer" />

          <div className="nx-bulk-mode" role="group" aria-label="Placement mode">
            <button
              type="button"
              className={`nx-bulk-mode-btn ${sendMode === 'staged' ? 'is-on' : ''}`}
              onClick={() => setSendMode('staged')}
              title="Send to the tray on the tabletop — you place them where you want"
            >To Tray</button>
            <button
              type="button"
              className={`nx-bulk-mode-btn ${sendMode === 'grid' ? 'is-on' : ''}`}
              onClick={() => setSendMode('grid')}
              title="Place immediately in a grid below existing items"
            >In Grid</button>
          </div>

          <span className="nx-bulk-label">Tabletop</span>
          <select
            className="nx-bulk-select"
            value={chosenTabletopId}
            onChange={(e) => { setChosenTabletopId(e.target.value); setNewTabletopName(''); }}
          >
            <option value="">Choose…</option>
            {tabletops.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            <option value="__new__">+ New tabletop</option>
          </select>
          {chosenTabletopId === '__new__' && (
            <input
              autoFocus
              type="text"
              className="nx-bulk-newname"
              placeholder="New tabletop name"
              value={newTabletopName}
              onChange={(e) => setNewTabletopName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendToTabletop(); }}
            />
          )}

          <button
            type="button"
            className="sp-action sp-action-primary"
            onClick={sendToTabletop}
            disabled={
              sending ||
              selectedIds.size === 0 ||
              !chosenTabletopId ||
              (chosenTabletopId === '__new__' && !newTabletopName.trim())
            }
          >
            {sending ? 'Sending…' : `Send ${selectedIds.size || ''}`.trim()}
          </button>
          <button type="button" className="sp-action sp-action-secondary" onClick={exitSelectMode}>
            Cancel
          </button>
        </div>
      )}

      {error && <div className="nx-error">{error}</div>}

      <div className="nx-body">
        <aside className={`nx-sidebar ${mobileFiltersOpen ? 'is-open' : ''}`}>
          <button
            type="button"
            className="nx-mobile-toggle"
            onClick={() => setMobileFiltersOpen(o => !o)}
            aria-expanded={mobileFiltersOpen}
          >
            <span>Filters</span>
            {activeFilterCount > 0 && <span className="nx-mobile-toggle-count">{activeFilterCount} active</span>}
            <Caret open={mobileFiltersOpen} />
          </button>

          <div className="nx-sidebar-body">
            <FilterSection label="Quick">
              <div className="nx-quick">
                <QuickToggle
                  checked={filters.pinned_only}
                  onChange={() => update({ pinned_only: !filters.pinned_only })}
                  label="Pinned only"
                  count={meta.pinned}
                />
                <QuickToggle
                  checked={filters.has_quote}
                  onChange={() => update({ has_quote: !filters.has_quote })}
                  label="With Quote"
                  count={meta.with_quote}
                />
                <QuickToggle
                  checked={filters.unattached}
                  onChange={() => update({ unattached: !filters.unattached })}
                  label="Unattached"
                  count={meta.unattached}
                />
              </div>
            </FilterSection>

            <FilterSection label="Type">
              {meta.types.length === 0 ? (
                <p className="nx-empty-line">No notes yet.</p>
              ) : (
                meta.types.map(t => (
                  <CheckboxRow
                    key={t.value}
                    checked={filters.types.includes(t.value)}
                    onChange={() => toggleArr('types', t.value)}
                    label={NOTE_TYPE_LABELS[t.value] || t.value}
                    count={t.count}
                    accent={t.value}
                  />
                ))
              )}
            </FilterSection>

            <FacetSection
              label="Concepts"
              accent="concept"
              items={meta.concepts}
              labelKey="label"
              selected={filters.concept_ids}
              onToggle={(id) => toggleArr('concept_ids', id)}
              noun="concepts"
            />

            <FacetSection
              label="Sources"
              accent="source"
              items={meta.sources}
              labelKey="title"
              selected={filters.source_ids}
              onToggle={(id) => toggleArr('source_ids', id)}
              noun="sources"
            />

            <FacetSection
              label="People"
              accent="person"
              items={meta.people}
              labelKey="full_name"
              selected={filters.person_ids}
              onToggle={(id) => toggleArr('person_ids', id)}
              noun="people"
            />

            <FacetSection
              label="Collections"
              items={meta.collections}
              labelKey="name"
              selected={filters.collection_ids}
              onToggle={(id) => toggleArr('collection_ids', id)}
              noun="collections"
            />

            {meta.tags.length > 0 && (
              <FilterSection label="Tags">
                <FacetSearchList
                  items={meta.tags.map(t => ({ id: t.name, label: t.name, count: t.count }))}
                  selectedSet={new Set(filters.tags)}
                  onToggle={(name) => toggleArr('tags', name)}
                  noun="tags"
                />
              </FilterSection>
            )}

            {hasFilters && (
              <button type="button" className="nx-clear-all" onClick={clearAll}>
                Clear All Filters
              </button>
            )}
          </div>
        </aside>

        <main className="nx-main">
          <div className="nx-toolbar">
            <div className="nx-search">
              <SearchIcon />
              <input
                ref={searchInputRef}
                type="text"
                className="nx-search-input"
                value={filters.q}
                onChange={(e) => update({ q: e.target.value })}
                placeholder="Search title, body, context, quote.    /"
              />
              {filters.q && (
                <button
                  type="button"
                  className="nx-search-clear"
                  onClick={() => update({ q: '' })}
                  aria-label="Clear search"
                >×</button>
              )}
            </div>

            <div className="nx-toolbar-controls">
              <SelectControl
                label="Sort"
                value={filters.sort}
                options={SORT_OPTIONS}
                onChange={(v) => update({ sort: v })}
              />
              <SelectControl
                label="Group"
                value={filters.group}
                options={GROUP_OPTIONS}
                onChange={(v) => update({ group: v })}
              />
              <DensityToggle
                value={filters.density}
                onChange={(v) => update({ density: v })}
              />
            </div>
          </div>

          {hasFilters && (
            <ActiveChipBar
              filters={filters}
              meta={meta}
              onRemove={(patch) => update(patch)}
              onRemoveFromArray={(key, value) => toggleArr(key, value)}
              onClearAll={clearAll}
            />
          )}

          {sorted.length === 0 ? (
            <EmptyState
              hasFilters={hasFilters}
              total={notes.length}
              onClear={clearAll}
              onCreate={() => { setEditingNote(null); setShowForm(true); }}
            />
          ) : filters.group === 'none' ? (
            <NoteList
              notes={sorted}
              density={filters.density}
              query={filters.q}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelectNote}
              onView={setViewingNote}
              onEdit={(n) => { setEditingNote(n); setShowForm(true); }}
              onDelete={deleteNote}
              onTogglePin={togglePin}
              onChipClick={(kind, value) => {
                if (kind === 'concept') toggleArr('concept_ids', value);
                else if (kind === 'source') toggleArr('source_ids', value);
                else if (kind === 'person') toggleArr('person_ids', value);
                else if (kind === 'tag') toggleArr('tags', value);
              }}
            />
          ) : (
            <div className="nx-groups">
              {groups.map(g => (
                <section key={g.key} className="nx-group">
                  <header className="nx-group-head">
                    <h2 className="nx-group-title">
                      {g.accent && <span className={`nx-group-dot nx-group-dot-${g.accent}`} aria-hidden="true" />}
                      {g.label}
                    </h2>
                    <span className="nx-group-count">{g.items.length}</span>
                  </header>
                  <NoteList
                    notes={g.items}
                    density={filters.density}
                    query={filters.q}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelectNote}
                    onView={setViewingNote}
                    onEdit={(n) => { setEditingNote(n); setShowForm(true); }}
                    onDelete={deleteNote}
                    onTogglePin={togglePin}
                    onChipClick={(kind, value) => {
                      if (kind === 'concept') toggleArr('concept_ids', value);
                      else if (kind === 'source') toggleArr('source_ids', value);
                      else if (kind === 'person') toggleArr('person_ids', value);
                      else if (kind === 'tag') toggleArr('tags', value);
                    }}
                  />
                </section>
              ))}
            </div>
          )}
        </main>
      </div>

      <NoteFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingNote(null); }}
        onSuccess={onFormSuccess}
        onDelete={onFormSuccess}
        item={editingNote}
      />

      <NoteShowModal
        isOpen={!!viewingNote}
        onClose={() => setViewingNote(null)}
        note={viewingNote}
        onEdit={() => { setEditingNote(viewingNote); setViewingNote(null); setShowForm(true); }}
        onDelete={() => { deleteNote(viewingNote); setViewingNote(null); }}
        onTogglePin={() => { if (viewingNote) togglePin(viewingNote); }}
      />

      {overlayTabletopId && (
        <div className="nx-tabletop-overlay-backdrop">
          <div className="nx-tabletop-overlay-host">
            <TabletopShow
              tabletopId={overlayTabletopId}
              embedded
              onClose={() => setOverlayTabletopId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Sidebar subcomponents
// =====================================================================
function FilterSection({ label, children, defaultOpen = true, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="nx-fs">
      <button
        type="button"
        className={`nx-fs-head ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {accent && <span className={`nx-fs-dot is-${accent}`} aria-hidden="true" />}
        <span className="nx-fs-label">{label}</span>
        <Caret open={open} />
      </button>
      {open && <div className="nx-fs-body">{children}</div>}
    </div>
  );
}

function QuickToggle({ checked, onChange, label, count }) {
  return (
    <label className="nx-quick-row">
      <input type="checkbox" className="sp-checkbox" checked={checked} onChange={onChange} />
      <span className="nx-quick-label">{label}</span>
      {count != null && <span className="nx-row-count">{count}</span>}
    </label>
  );
}

function CheckboxRow({ checked, onChange, label, count }) {
  return (
    <label className="nx-row">
      <input type="checkbox" className="sp-checkbox" checked={checked} onChange={onChange} />
      <span className="nx-row-label">{label}</span>
      {count != null && <span className="nx-row-count">{count}</span>}
    </label>
  );
}

function FacetSection({ label, items, labelKey, selected, onToggle, noun, accent }) {
  if (!items || items.length === 0) return null;
  return (
    <FilterSection label={label} accent={accent}>
      <FacetSearchList
        items={items.map(i => ({ id: i.id, label: i[labelKey], count: i.count }))}
        selectedSet={new Set(selected)}
        onToggle={onToggle}
        noun={noun}
      />
    </FilterSection>
  );
}

function FacetSearchList({ items, selectedSet, onToggle, noun = 'items' }) {
  const [q, setQ] = useState('');
  const showSearch = items.length > 8;

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const needle = q.toLowerCase();
    return items.filter(i => String(i.label || '').toLowerCase().includes(needle));
  }, [items, q]);

  const display = useMemo(() => {
    const sel = items.filter(i => selectedSet.has(i.id) && !filtered.find(f => f.id === i.id));
    return [...sel, ...filtered].slice(0, 60);
  }, [items, filtered, selectedSet]);

  return (
    <>
      {showSearch && (
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${items.length} ${noun}`}
          className="nx-facet-search"
        />
      )}
      <div className="nx-facet-list">
        {display.map(item => (
          <CheckboxRow
            key={item.id}
            checked={selectedSet.has(item.id)}
            onChange={() => onToggle(item.id)}
            label={item.label}
            count={item.count}
          />
        ))}
        {filtered.length > 60 && <p className="nx-facet-note">First 60.  Refine search.</p>}
      </div>
    </>
  );
}

// =====================================================================
// Toolbar subcomponents
// =====================================================================
function SelectControl({ label, value, options, onChange }) {
  return (
    <label className="nx-sel">
      <span className="nx-sel-label">{label}</span>
      <select className="nx-sel-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function DensityToggle({ value, onChange }) {
  return (
    <div className="nx-density" role="group" aria-label="View density">
      <button
        type="button"
        className={`nx-density-btn ${value === 'card' ? 'is-active' : ''}`}
        onClick={() => onChange('card')}
        title="Card view"
        aria-pressed={value === 'card'}
      >
        <CardIcon />
      </button>
      <button
        type="button"
        className={`nx-density-btn ${value === 'compact' ? 'is-active' : ''}`}
        onClick={() => onChange('compact')}
        title="Compact view"
        aria-pressed={value === 'compact'}
      >
        <RowsIcon />
      </button>
    </div>
  );
}

// =====================================================================
// Active chip bar
// =====================================================================
function ActiveChipBar({ filters, meta, onRemove, onRemoveFromArray, onClearAll }) {
  const chips = [];
  if (filters.q) chips.push({ key: 'q', label: `“${filters.q}”`, accent: 'neutral', onClear: () => onRemove({ q: '' }) });
  if (filters.pinned_only) chips.push({ key: 'p', label: 'Pinned', accent: 'neutral', onClear: () => onRemove({ pinned_only: false }) });
  if (filters.has_quote) chips.push({ key: 'qt', label: 'With Quote', accent: 'neutral', onClear: () => onRemove({ has_quote: false }) });
  if (filters.unattached) chips.push({ key: 'un', label: 'Unattached', accent: 'neutral', onClear: () => onRemove({ unattached: false }) });
  filters.types.forEach(t => chips.push({
    key: `t-${t}`, label: NOTE_TYPE_LABELS[t] || t, accent: 'neutral',
    onClear: () => onRemoveFromArray('types', t),
  }));
  filters.concept_ids.forEach(id => {
    const c = meta.concepts.find(x => x.id === id);
    if (c) chips.push({ key: `c-${id}`, label: c.label, accent: 'concept', onClear: () => onRemoveFromArray('concept_ids', id) });
  });
  filters.source_ids.forEach(id => {
    const s = meta.sources.find(x => x.id === id);
    if (s) chips.push({ key: `s-${id}`, label: s.title, accent: 'source', onClear: () => onRemoveFromArray('source_ids', id) });
  });
  filters.person_ids.forEach(id => {
    const p = meta.people.find(x => x.id === id);
    if (p) chips.push({ key: `pp-${id}`, label: p.full_name, accent: 'person', onClear: () => onRemoveFromArray('person_ids', id) });
  });
  filters.collection_ids.forEach(id => {
    const c = meta.collections.find(x => x.id === id);
    if (c) chips.push({ key: `co-${id}`, label: c.name, accent: 'neutral', onClear: () => onRemoveFromArray('collection_ids', id) });
  });
  filters.tags.forEach(t => chips.push({ key: `tag-${t}`, label: `#${t}`, accent: 'neutral', onClear: () => onRemoveFromArray('tags', t) }));

  if (chips.length === 0) return null;

  return (
    <div className="nx-chipbar">
      {chips.map(c => (
        <span key={c.key} className={`sp-chip is-${c.accent} sp-chip-removable nx-active-chip`}>
          <span className="nx-active-chip-label">{c.label}</span>
          <button type="button" className="sp-chip-x" onClick={c.onClear} aria-label={`Remove ${c.label}`}>×</button>
        </span>
      ))}
      <button type="button" className="nx-chipbar-clear" onClick={onClearAll}>Clear All</button>
    </div>
  );
}

// =====================================================================
// Note list / cards / rows
// =====================================================================
function NoteList({ notes, density, query, selectMode, selectedIds, onToggleSelect, onView, onEdit, onDelete, onTogglePin, onChipClick }) {
  return (
    <ul className={`nx-list nx-list-${density}`}>
      {notes.map(n => {
        const selected = !!(selectedIds && selectedIds.has(n.id));
        const baseProps = { note: n, query, onEdit, onDelete, onTogglePin, onChipClick, selectMode, selected, onToggleSelect };
        return density === 'compact'
          ? <NoteCompactRow key={n.id} {...baseProps} onView={onView} />
          : <NoteCard      key={n.id} {...baseProps} onView={onView} />;
      })}
    </ul>
  );
}

function NoteCompactRow({ note, query, onView, onTogglePin, onChipClick, selectMode, selected, onToggleSelect }) {
  const type = note.note_type || 'note';
  const excerpt = note.title || plain(note.body).slice(0, 140) || (note.quote_text ? `“${note.quote_text}”` : '(empty note)');
  const onActivate = selectMode ? (() => onToggleSelect(note.id)) : (() => onView(note));
  return (
    <li
      className={`nx-row-card ${note.pinned ? 'is-pinned' : ''} ${selectMode ? 'is-selectable' : ''} ${selected ? 'is-selected' : ''}`}
      onClick={onActivate}
      role="button"
      tabIndex={0}
      aria-pressed={selectMode ? selected : undefined}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } }}
    >
      {selectMode ? (
        <span className={`nx-row-check ${selected ? 'is-on' : ''}`} aria-hidden="true">
          {selected && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 6.5l2.5 2.5 4.5-5" />
            </svg>
          )}
        </span>
      ) : (
        <button
          type="button"
          className={`nx-pin nx-pin-row ${note.pinned ? 'is-on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onTogglePin(note); }}
          aria-pressed={!!note.pinned}
          title={note.pinned ? 'Unpin' : 'Pin'}
        >
          <PinIcon filled={!!note.pinned} small />
        </button>
      )}
      <span className="nx-type-eyebrow nx-type-eyebrow-sm">{NOTE_TYPE_LABELS[type] || type}</span>
      <span className="nx-row-text">{highlightText(excerpt, query)}</span>
      <div className="nx-row-meta">
        {note.source && (
          <a
            href={`/sources/${note.source.id}`}
            className="sp-chip is-source nx-row-chip"
            onClick={(e) => e.stopPropagation()}
            title={note.source.title}
          >{note.source.title}</a>
        )}
        {note.concepts?.length > 0 && (
          <button
            type="button"
            className="sp-chip is-concept nx-row-chip"
            onClick={(e) => { e.stopPropagation(); onChipClick('concept', note.concepts[0].id); }}
            title={`Filter by ${note.concepts[0].label}`}
          >
            {note.concepts[0].label}{note.concepts.length > 1 && ` +${note.concepts.length - 1}`}
          </button>
        )}
      </div>
      <time className="nx-row-date">{formatDate(note.noted_on || note.created_at)}</time>
    </li>
  );
}

// =====================================================================
// Empty state
// =====================================================================
function EmptyState({ hasFilters, total, onClear, onCreate }) {
  if (hasFilters) {
    return (
      <div className="sp-empty nx-empty">
        <div className="sp-empty-art" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="20" cy="20" r="10" className="sp-empty-stroke" />
            <line x1="28" y1="28" x2="36" y2="36" className="sp-empty-stroke" />
          </svg>
        </div>
        <h3 className="sp-empty-title">No matches</h3>
        <p className="sp-empty-sub">
          {total.toLocaleString()} note{total === 1 ? '' : 's'} in your library; none fit these filters.
        </p>
        <div className="nx-empty-actions">
          <button type="button" className="sp-action sp-action-secondary" onClick={onClear}>Clear filters</button>
        </div>
      </div>
    );
  }
  return (
    <div className="sp-empty nx-empty">
      <div className="sp-empty-art" aria-hidden="true">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <rect x="8" y="6" width="28" height="32" rx="2" className="sp-empty-stroke" />
          <line x1="14" y1="14" x2="30" y2="14" className="sp-empty-stroke" />
          <line x1="14" y1="20" x2="30" y2="20" className="sp-empty-stroke" />
          <line x1="14" y1="26" x2="24" y2="26" className="sp-empty-stroke" />
        </svg>
      </div>
      <h3 className="sp-empty-title">No notes yet</h3>
      <p className="sp-empty-sub">
        Highlight a passage in any source to start.  Notes are searchable across the library.
      </p>
      <div className="nx-empty-actions">
        <button type="button" className="sp-action sp-action-primary" onClick={onCreate}>New Note</button>
        <a href="/sources" className="sp-action sp-action-secondary">Browse Sources</a>
      </div>
    </div>
  );
}

// =====================================================================
// Helpers — facet meta + grouping
// =====================================================================
function computeMeta(notes, refs) {
  const types = {};
  let pinned = 0, with_quote = 0, unattached = 0;
  const conceptCounts = new Map();
  const sourceCounts = new Map();
  const personCounts = new Map();
  const collectionCounts = new Map();
  const tagCounts = new Map();
  const sourceToPeopleIds = refs.sourceToPeopleIds || new Map();

  notes.forEach(n => {
    const t = n.note_type || 'note';
    types[t] = (types[t] || 0) + 1;
    if (n.pinned) pinned += 1;
    if (n.quote_text) with_quote += 1;
    if (!n.source && (!n.concepts || n.concepts.length === 0)) unattached += 1;

    n.concepts?.forEach(c => conceptCounts.set(c.id, (conceptCounts.get(c.id) || 0) + 1));
    if (n.source) sourceCounts.set(n.source.id, (sourceCounts.get(n.source.id) || 0) + 1);

    // Two-step person counting: tagged directly OR an author of the source.
    // Dedupe per note so a tagged-and-authored person only counts once.
    const peopleSeen = new Set();
    n.people?.forEach(p => peopleSeen.add(p.id));
    if (n.source) {
      const ids = sourceToPeopleIds.get(n.source.id);
      if (ids) ids.forEach(pid => peopleSeen.add(pid));
    }
    peopleSeen.forEach(pid => personCounts.set(pid, (personCounts.get(pid) || 0) + 1));

    n.collections?.forEach(c => collectionCounts.set(c.id, (collectionCounts.get(c.id) || 0) + 1));
    n.tags?.forEach(t => {
      const name = tagName(t);
      if (name) tagCounts.set(name, (tagCounts.get(name) || 0) + 1);
    });
  });

  const concepts = (refs.allConcepts || [])
    .filter(c => conceptCounts.has(c.id))
    .map(c => ({ id: c.id, label: c.label, count: conceptCounts.get(c.id) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const sources = (refs.allSources || [])
    .filter(s => sourceCounts.has(s.id))
    .map(s => ({ id: s.id, title: s.title, count: sourceCounts.get(s.id) }))
    .sort((a, b) => b.count - a.count || (a.title || '').localeCompare(b.title || ''));

  const people = (refs.allPeople || [])
    .filter(p => personCounts.has(p.id))
    .map(p => ({ id: p.id, full_name: p.full_name, count: personCounts.get(p.id) }))
    .sort((a, b) => b.count - a.count || (a.full_name || '').localeCompare(b.full_name || ''));

  const collections = (refs.allCollections || [])
    .filter(c => collectionCounts.has(c.id))
    .map(c => ({ id: c.id, name: c.name, count: collectionCounts.get(c.id) }))
    .sort((a, b) => b.count - a.count || (a.name || '').localeCompare(b.name || ''));

  const tags = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const typeRows = NOTE_TYPE_ORDER
    .filter(v => types[v])
    .map(v => ({ value: v, count: types[v] }));

  return {
    types: typeRows,
    pinned, with_quote, unattached,
    concepts, sources, people, collections, tags,
  };
}

function buildGroups(notes, mode, refs) {
  if (mode === 'none') return [];

  const groups = new Map();
  const push = (key, label, items, accent) => {
    if (!groups.has(key)) groups.set(key, { key, label, items: [], accent });
    items.forEach(n => groups.get(key).items.push(n));
  };

  notes.forEach(n => {
    if (mode === 'type') {
      const t = n.note_type || 'note';
      push(`type-${t}`, NOTE_TYPE_LABELS[t] || t, [n]);
    } else if (mode === 'source') {
      if (n.source) push(`s-${n.source.id}`, n.source.title || 'Untitled source', [n], 'source');
      else push('s-none', 'Unattached', [n]);
    } else if (mode === 'concept') {
      if (n.concepts?.length) {
        n.concepts.forEach(c => push(`c-${c.id}`, c.label || 'Concept', [n], 'concept'));
      } else {
        push('c-none', 'No Concept', [n]);
      }
    } else if (mode === 'person') {
      // Same two-step logic: tagged directly + authors of the note's source.
      const personIds = new Set();
      const personNames = new Map();
      n.people?.forEach(p => { personIds.add(p.id); personNames.set(p.id, p.full_name); });
      if (n.source) {
        const authorIds = (refs.sourceToPeopleIds && refs.sourceToPeopleIds.get(n.source.id)) || new Set();
        authorIds.forEach(pid => {
          personIds.add(pid);
          if (!personNames.has(pid)) {
            const ref = refs.allPeople?.find(p => p.id === pid);
            if (ref) personNames.set(pid, ref.full_name);
          }
        });
      }
      if (personIds.size === 0) {
        push('p-none', 'No Person', [n]);
      } else {
        personIds.forEach(pid => push(`p-${pid}`, personNames.get(pid) || 'Person', [n], 'person'));
      }
    } else if (mode === 'month') {
      const k = monthKey(n.noted_on || n.created_at);
      push(`m-${k}`, monthLabel(k), [n]);
    }
  });

  const arr = [...groups.values()];

  // Order groups: source/concept/person by item count desc; type by NOTE_TYPE_ORDER; month by reverse chronology.
  if (mode === 'type') {
    arr.sort((a, b) => {
      const ai = NOTE_TYPE_ORDER.indexOf(a.key.replace('type-', ''));
      const bi = NOTE_TYPE_ORDER.indexOf(b.key.replace('type-', ''));
      return ai - bi;
    });
  } else if (mode === 'month') {
    arr.sort((a, b) => b.key.localeCompare(a.key));
  } else {
    arr.sort((a, b) => b.items.length - a.items.length);
  }

  return arr;
}

// =====================================================================
// Inline icons
// =====================================================================
function Caret({ open }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
      <path d="M3 5l3 3 3-3" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="2" y="3" width="12" height="4.5" rx="0.7" />
      <rect x="2" y="8.5" width="12" height="4.5" rx="0.7" />
    </svg>
  );
}
function RowsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  );
}

// =====================================================================
// Styles
// =====================================================================
function NxStyles() {
  return (
    <style>{`
      .nx {
        --nx-pad-x: 32px;
        --nx-sidebar: 264px;
        background: var(--paper);
        min-height: calc(100vh - 64px);
      }
      .nx-loading {
        font-family: var(--sans);
        color: var(--ink-3);
        text-align: center;
        padding: 96px 0;
        font-size: 13px;
      }
      .nx-error {
        margin: 0 var(--nx-pad-x) 16px;
        padding: 10px 14px;
        background: var(--source-tint);
        color: var(--source-2);
        border-left: 3px solid var(--source);
        border-radius: 0 var(--r-sm) var(--r-sm) 0;
        font-size: 13px;
      }

      /* ============ TABLETOP MENU (header dropdown) ============ */
      .nx-tt-menu { position: relative; }
      .nx-tt-menu-pop {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        min-width: 240px;
        max-width: 320px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        box-shadow: 0 12px 32px rgba(21, 25, 31, 0.10);
        padding: 4px 0;
        z-index: 50;
      }
      .nx-tt-menu-empty {
        padding: 14px;
        font-family: var(--sans);
        font-size: 12px;
        color: var(--ink-3);
        text-align: center;
      }
      .nx-tt-menu-item {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 10px;
        padding: 8px 14px;
        background: none;
        border: none;
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink);
        text-align: left;
        cursor: pointer;
      }
      .nx-tt-menu-item:hover { background: var(--hover); }
      .nx-tt-menu-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--primary);
        flex-shrink: 0;
      }
      .nx-tt-menu-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nx-tt-menu-count {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .nx-tt-menu-divider { height: 1px; background: var(--ink-line-soft); margin: 4px 0; }
      .nx-tt-menu-item-new { color: var(--primary); font-weight: 500; }

      /* ============ TABLETOP OVERLAY ============ */
      .nx-tabletop-overlay-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 18, 23, 0.55);
        z-index: 1000;
        padding: 24px;
        display: flex;
        align-items: stretch;
        justify-content: stretch;
      }
      .nx-tabletop-overlay-host {
        flex: 1;
        background: var(--paper-soft);
        border-radius: var(--r-lg);
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(21, 25, 31, 0.30);
        display: flex;
        flex-direction: column;
        min-height: 0;
        min-width: 0;
      }
      @media (max-width: 720px) {
        .nx-tabletop-overlay-backdrop { padding: 0; }
        .nx-tabletop-overlay-host { border-radius: 0; }
      }

      /* ============ SEND-TO-TABLETOP CONFIRMATION BANNER ============ */
      .nx-send-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        margin: 14px var(--nx-pad-x) 0;
        background: var(--concept-tint);
        color: var(--concept-2);
        border-left: 3px solid var(--concept);
        border-radius: 0 var(--r-sm) var(--r-sm) 0;
        font-family: var(--sans);
        font-size: 13px;
      }
      .nx-send-banner-text { flex: 1; line-height: 1.5; }
      .nx-send-banner-muted { color: var(--ink-3); }
      .nx-send-banner-cta { flex-shrink: 0; }
      .nx-send-banner-close {
        background: none;
        border: none;
        color: var(--ink-3);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 0 4px;
      }
      .nx-send-banner-close:hover { color: var(--ink); }

      /* ============ BULK BAR ============ */
      .nx-bulk-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        padding: 12px var(--nx-pad-x);
        margin-top: 8px;
        background: var(--paper-soft);
        border-top: 1px solid var(--ink-line);
        border-bottom: 1px solid var(--ink-line);
        font-family: var(--sans);
        font-size: 13px;
        position: sticky;
        top: 64px;
        z-index: 4;
      }
      .nx-bulk-count {
        font-family: var(--mono);
        font-variant-numeric: tabular-nums;
        color: var(--primary);
        font-weight: 600;
      }
      .nx-bulk-spacer { flex: 1; min-width: 12px; }
      .nx-bulk-label {
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ink-3);
      }
      .nx-bulk-select,
      .nx-bulk-newname {
        height: 32px;
        padding: 0 10px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink);
      }
      .nx-bulk-select { cursor: pointer; }
      .nx-bulk-select:focus,
      .nx-bulk-newname:focus { outline: none; border-color: var(--ink-2); }
      .nx-bulk-newname { min-width: 200px; }
      .nx-bulk-mode {
        display: inline-flex;
        height: 32px;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        overflow: hidden;
      }
      .nx-bulk-mode-btn {
        background: var(--paper);
        border: none;
        padding: 0 12px;
        font-family: var(--sans);
        font-size: 12px;
        font-weight: 500;
        color: var(--ink-2);
        cursor: pointer;
      }
      .nx-bulk-mode-btn + .nx-bulk-mode-btn { border-left: 1px solid var(--ink-line); }
      .nx-bulk-mode-btn:hover { background: var(--hover); color: var(--ink); }
      .nx-bulk-mode-btn.is-on {
        background: var(--primary);
        color: var(--paper);
      }

      /* ============ HEADER ============ */
      .nx-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        padding: 28px var(--nx-pad-x) 20px;
        border-bottom: 1px solid var(--ink-line);
        flex-wrap: wrap;
      }
      .nx-title {
        font-family: var(--serif);
        font-size: 36px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: -0.02em;
        margin: 0 0 4px;
        line-height: 1.1;
      }
      .nx-subtitle {
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink-3);
        margin: 0;
        line-height: 1.5;
      }
      .nx-link {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        color: var(--ink);
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }
      .nx-link:hover { color: var(--primary); }
      .nx-header-actions { display: flex; gap: 8px; align-items: center; }

      /* ============ BODY ============ */
      .nx-body {
        display: grid;
        grid-template-columns: var(--nx-sidebar) 1fr;
        align-items: start;
      }

      /* ============ SIDEBAR ============ */
      .nx-sidebar {
        position: sticky;
        top: 64px;
        align-self: stretch;
        border-right: 1px solid var(--ink-line);
        padding: 22px 18px 32px 28px;
        max-height: calc(100vh - 64px);
        overflow-y: auto;
      }
      .nx-sidebar-body { display: flex; flex-direction: column; gap: 22px; }
      .nx-mobile-toggle {
        display: none;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        background: var(--paper-soft);
        font-family: var(--sans);
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
        margin-bottom: 12px;
      }
      .nx-mobile-toggle-count {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        font-weight: 400;
      }

      .nx-fs { display: flex; flex-direction: column; gap: 6px; }
      .nx-fs-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 4px;
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ink-3);
        background: none;
        border: none;
        cursor: pointer;
        text-align: left;
      }
      .nx-fs-head:hover { color: var(--ink); }
      .nx-fs-label { flex: 1; }
      .nx-fs-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ink-3);
        flex-shrink: 0;
      }
      .nx-fs-dot.is-concept { background: var(--concept); }
      .nx-fs-dot.is-source  { background: var(--source);  }
      .nx-fs-dot.is-person  { background: var(--person);  }
      .nx-fs-body { display: flex; flex-direction: column; gap: 1px; padding: 4px 0 0; }

      .nx-quick { display: flex; flex-direction: column; gap: 1px; }
      .nx-quick-row,
      .nx-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 6px;
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        border-radius: var(--r-sm);
        line-height: 1.4;
      }
      .nx-quick-row:hover,
      .nx-row:hover { background: var(--hover); color: var(--ink); }
      .nx-quick-label,
      .nx-row-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nx-row-count {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }

      .nx-facet-search {
        width: 100%;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 5px 8px;
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--ink);
        outline: none;
        margin-bottom: 4px;
      }
      .nx-facet-search:focus { border-color: var(--ink-2); background: var(--paper); }
      /* Bordered, slightly inset container — makes it visually obvious that
         the list is scrollable when it overflows.  The inset bottom shadow
         hints at content below the fold. */
      .nx-facet-list {
        display: flex;
        flex-direction: column;
        gap: 1px;
        max-height: 220px;
        overflow-y: auto;
        padding: 4px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        box-shadow: inset 0 -8px 8px -8px rgba(15, 23, 35, 0.08);
      }
      .nx-facet-list::-webkit-scrollbar { width: 8px; }
      .nx-facet-list::-webkit-scrollbar-track { background: transparent; }
      .nx-facet-list::-webkit-scrollbar-thumb { background: var(--ink-line); border-radius: 4px; }
      .nx-facet-list::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }
      .nx-facet-note {
        margin: 6px 0 0;
        font-family: var(--sans);
        font-size: 11.5px;
        font-style: italic;
        color: var(--ink-3);
      }
      .nx-empty-line {
        margin: 0;
        padding: 4px 6px;
        font-family: var(--sans);
        font-size: 12px;
        font-style: italic;
        color: var(--ink-3);
      }
      .nx-clear-all {
        margin-top: 8px;
        padding: 8px 0;
        background: none;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        font-family: var(--sans);
        font-size: 12px;
        font-weight: 500;
        color: var(--ink-2);
        cursor: pointer;
      }
      .nx-clear-all:hover { background: var(--hover); color: var(--ink); border-color: var(--ink-3); }

      /* ============ MAIN ============ */
      .nx-main {
        min-width: 0;
        padding: 22px var(--nx-pad-x) 64px;
      }

      .nx-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        padding-bottom: 14px;
      }
      .nx-search {
        flex: 1;
        min-width: 220px;
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 0 10px;
        height: 36px;
        color: var(--ink-3);
      }
      .nx-search:focus-within { border-color: var(--ink-2); color: var(--ink); background: var(--paper); }
      .nx-search-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink);
      }
      .nx-search-input::placeholder { color: var(--ink-3); }
      .nx-search-clear {
        background: none;
        border: none;
        color: var(--ink-3);
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 0 4px;
      }
      .nx-search-clear:hover { color: var(--ink); }

      .nx-toolbar-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .nx-sel {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 10px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
      }
      .nx-sel:hover, .nx-sel:focus-within { border-color: var(--ink-3); }
      .nx-sel-label {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ink-3);
      }
      .nx-sel-input {
        background: transparent;
        border: none;
        outline: none;
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink);
        cursor: pointer;
        padding-right: 4px;
      }

      .nx-density {
        display: inline-flex;
        height: 36px;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        overflow: hidden;
      }
      .nx-density-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 100%;
        background: var(--paper);
        border: none;
        color: var(--ink-3);
        cursor: pointer;
        transition: background 0.12s, color 0.12s;
      }
      .nx-density-btn + .nx-density-btn { border-left: 1px solid var(--ink-line); }
      .nx-density-btn:hover { background: var(--hover); color: var(--ink); }
      .nx-density-btn.is-active { background: var(--paper-warm); color: var(--ink); }

      /* ============ ACTIVE CHIP BAR ============ */
      .nx-chipbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding-bottom: 12px;
      }
      .nx-active-chip { font-size: 12px; max-width: 280px; }
      .nx-active-chip-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .nx-chipbar-clear {
        background: none;
        border: none;
        font-family: var(--sans);
        font-size: 12px;
        color: var(--ink-3);
        cursor: pointer;
        margin-left: 4px;
      }
      .nx-chipbar-clear:hover { color: var(--ink); text-decoration: underline; }

      /* ============ GROUPS ============ */
      .nx-groups { display: flex; flex-direction: column; gap: 28px; }
      .nx-group { display: flex; flex-direction: column; gap: 10px; }
      .nx-group-head {
        display: flex;
        align-items: baseline;
        gap: 10px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--ink-line);
      }
      .nx-group-title {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: var(--serif);
        font-size: 22px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
        letter-spacing: -0.005em;
      }
      .nx-group-dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--ink-3);
      }
      .nx-group-dot-concept { background: var(--concept); }
      .nx-group-dot-source  { background: var(--source);  }
      .nx-group-dot-person  { background: var(--person);  }
      .nx-group-count {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }

      /* ============ LIST ============ */
      .nx-list { list-style: none; margin: 0; padding: 0; }
      .nx-list-card { display: flex; flex-direction: column; gap: 16px; }
      .nx-list-compact { border-top: 1px solid var(--ink-line-soft); }

      /* Card styles live in NoteCard.js (NoteCardStyles). The bits below
         are only used by the compact-row variant on this page. */
      .nx-row-check {
        width: 16px;
        height: 16px;
        border: 1.5px solid var(--ink-3);
        border-radius: 3px;
        background: var(--paper);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--paper);
      }
      .nx-row-check.is-on {
        background: var(--primary);
        border-color: var(--primary);
      }
      .nx-row-card.is-selected {
        background: rgba(31, 59, 115, 0.04);
        border-left-color: var(--primary);
      }
      .nx-type-eyebrow-sm { font-size: 9.5px; letter-spacing: 0.12em; }
      .nx-pin-row { width: 20px; height: 20px; }

      /* ============ COMPACT ROW ============ */
      .nx-row-card {
        display: grid;
        grid-template-columns: 22px auto 1fr auto auto;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--ink-line-soft);
        background: var(--paper);
        border-left: 3px solid transparent;
        cursor: pointer;
      }
      .nx-row-card:hover { background: var(--hover); border-left-color: var(--primary); }
      .nx-row-card.is-pinned { background: var(--paper-soft); border-left-color: var(--primary); }
      .nx-row-text {
        flex: 1;
        min-width: 0;
        font-family: var(--sans);
        font-size: 13.5px;
        color: var(--ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nx-row-meta {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        max-width: 280px;
        overflow: hidden;
      }
      .nx-row-chip { max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
      .nx-row-date {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
      }

      /* ============ EMPTY ============ */
      .nx-empty {
        max-width: 480px;
        margin: 48px auto 0;
        padding: 32px 24px;
      }
      .nx-empty .sp-empty-title {
        font-size: 18px;
        margin-bottom: 6px;
      }
      .nx-empty .sp-empty-sub {
        font-size: 13px;
        max-width: 360px;
        margin-bottom: 18px;
      }
      .nx-empty-actions {
        display: inline-flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
      }

      /* ============ RESPONSIVE ============ */
      @media (max-width: 900px) {
        .nx { --nx-pad-x: 18px; }
        .nx-body { grid-template-columns: 1fr; }
        .nx-sidebar {
          position: relative;
          top: 0;
          max-height: none;
          border-right: none;
          border-bottom: 1px solid var(--ink-line);
          padding: 14px var(--nx-pad-x);
        }
        .nx-mobile-toggle { display: flex; }
        .nx-sidebar-body { display: none; }
        .nx-sidebar.is-open .nx-sidebar-body { display: flex; }
        .nx-header { padding: 22px var(--nx-pad-x) 14px; }
        .nx-title { font-size: 28px; }
        .nx-main { padding: 16px var(--nx-pad-x) 48px; }

        /* Header buttons get tight: collapse "New Note" into a square +
           icon button so all three actions still fit on the row.  Open
           Tabletop and Add to Tabletop keep their labels for clarity. */
        .nx-new-note-label { display: none; }
        .nx-new-note-btn {
          width: 34px;
          padding: 0;
          font-size: 18px;
          line-height: 1;
          flex-shrink: 0;
        }
      }

      @media (max-width: 540px) {
        .nx-header { gap: 12px; }
        .nx-toolbar-controls { width: 100%; }
        .nx-sel { flex: 1; }
        .nx-row-card { grid-template-columns: 18px auto 1fr auto; }
        .nx-row-meta { display: none; }
      }
    `}</style>
  );
}
