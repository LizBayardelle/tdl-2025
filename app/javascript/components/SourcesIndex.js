import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import SourceFormModal from './SourceFormModal';
import PdfUploadModal from './PdfUploadModal';
import SourceCard, { SourceCardStyles } from './SourceCard';
import { toTitleCase } from '../utils/titleCase';
import Toggle from './ui/Toggle';

// =====================================================================
// SourcesIndex
// Library view of every source in the user's accessible library.  Built
// for the 5,000-paper case: faceted server-side filtering, marker
// editing in-row, bulk select for citation export.
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

const SORT_OPTIONS = [
  { value: 'created_at-desc', label: 'Recently Added' },
  { value: 'title-asc',       label: 'Title (A–Z)' },
  { value: 'title-desc',      label: 'Title (Z–A)' },
  { value: 'year-desc',       label: 'Year (Newest)' },
  { value: 'year-asc',        label: 'Year (Oldest)' },
  { value: 'notes_count-desc',label: 'Most Notes' },
];

const PER_PAGE = 25;

// ---------- URL state helpers ----------
function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    q:              params.get('q') || '',
    kind:           params.get('kind') || '',
    concept_ids:    params.getAll('concept_ids[]').map(Number).filter(Boolean),
    person_ids:     params.getAll('person_ids[]').map(Number).filter(Boolean),
    tags:           params.getAll('tags[]'),
    collection_ids: params.getAll('collection_ids[]').map(Number).filter(Boolean),
    markers:        params.getAll('markers[]'),
    methodologies:  params.getAll('methodologies[]'),
    year_min:       params.get('year_min') || '',
    year_max:       params.get('year_max') || '',
    has_pdf:        params.get('has_pdf') === '1',
    has_notes:      params.get('has_notes') === '1',
    sort:           params.get('sort') || 'created_at-desc',
  };
}

function writeFiltersToUrl(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.kind) params.set('kind', filters.kind);
  filters.concept_ids.forEach(id => params.append('concept_ids[]', id));
  filters.person_ids.forEach(id => params.append('person_ids[]', id));
  filters.tags.forEach(t => params.append('tags[]', t));
  filters.collection_ids.forEach(id => params.append('collection_ids[]', id));
  filters.markers.forEach(m => params.append('markers[]', m));
  filters.methodologies.forEach(m => params.append('methodologies[]', m));
  if (filters.year_min) params.set('year_min', filters.year_min);
  if (filters.year_max) params.set('year_max', filters.year_max);
  if (filters.has_pdf) params.set('has_pdf', '1');
  if (filters.has_notes) params.set('has_notes', '1');
  if (filters.sort && filters.sort !== 'created_at-desc') params.set('sort', filters.sort);
  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

const EMPTY_META = { kinds: [], years: [], authors: [], concepts: [], tags: [], collections: [], markers: [], methodologies: [], pdf_count: 0, notes_count: 0, total: 0 };

// =====================================================================
// Component
// =====================================================================
export default function SourcesIndex() {
  const initial = readFiltersFromUrl();
  const [filters, setFilters] = useState({
    q:              initial.q,
    kind:           initial.kind,
    concept_ids:    initial.concept_ids,
    person_ids:     initial.person_ids,
    tags:           initial.tags,
    collection_ids: initial.collection_ids,
    markers:        initial.markers,
    methodologies:  initial.methodologies,
    year_min:       initial.year_min,
    year_max:       initial.year_max,
    has_pdf:        initial.has_pdf,
    has_notes:      initial.has_notes,
    sort:           initial.sort,
  });

  const [sources, setSources] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_count: 0, total_pages: 0 });
  const [filterMeta, setFilterMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [showPdf, setShowPdf] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Show/hide abstracts on row cards.  Persisted across sessions.
  const [showAbstracts, setShowAbstracts] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('sources_index_show_abstracts') === '1';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sources_index_show_abstracts', showAbstracts ? '1' : '0');
  }, [showAbstracts]);

  const debounceRef = useRef(null);
  const isFirstRender = useRef(true);

  // Build query string from filters
  const buildQuery = useCallback((page) => {
    const p = new URLSearchParams();
    if (filters.q) p.set('q', filters.q);
    if (filters.kind) p.set('kind', filters.kind);
    filters.concept_ids.forEach(id => p.append('concept_ids[]', id));
    filters.person_ids.forEach(id => p.append('person_ids[]', id));
    filters.tags.forEach(t => p.append('tags[]', t));
    filters.collection_ids.forEach(id => p.append('collection_ids[]', id));
    filters.markers.forEach(m => p.append('markers[]', m));
    filters.methodologies.forEach(m => p.append('methodologies[]', m));
    if (filters.year_min) p.set('year_min', filters.year_min);
    if (filters.year_max) p.set('year_max', filters.year_max);
    if (filters.has_pdf) p.set('has_pdf', '1');
    if (filters.has_notes) p.set('has_notes', '1');
    const [sortBy, sortDir] = (filters.sort || 'created_at-desc').split('-');
    p.set('sort_by', sortBy);
    p.set('sort_dir', sortDir);
    p.set('page', page);
    p.set('per_page', PER_PAGE);
    return p.toString();
  }, [filters]);

  // Fetch
  const fetchSources = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/sources.json?${buildQuery(targetPage)}`);
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setSources(data.sources || []);
      setPagination(data.pagination || { page: 1, total_count: 0, total_pages: 0 });
      if (data.filters) setFilterMeta({ ...EMPTY_META, ...data.filters });
    } catch (err) {
      console.error('Sources load failed', err);
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  // Debounced refetch when filters change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const isText = !isFirstRender.current;
    debounceRef.current = setTimeout(() => {
      writeFiltersToUrl(filters);
      setPage(1);
      fetchSources(1);
    }, isText ? 250 : 0);
    isFirstRender.current = false;
    return () => clearTimeout(debounceRef.current);
  }, [filters, fetchSources]);

  // ---- Filter mutators ----
  const update = (patch) => setFilters(f => ({ ...f, ...patch }));
  const toggleInArray = (key, value) => {
    setFilters(f => {
      const current = f[key] || [];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...f, [key]: next };
    });
  };
  const clearAll = () => setFilters({
    q: '', kind: '', concept_ids: [], person_ids: [], tags: [],
    collection_ids: [], markers: [], methodologies: [],
    year_min: '', year_max: '',
    has_pdf: false, has_notes: false, sort: filters.sort,
  });

  const activeFilterCount =
    (filters.kind ? 1 : 0) +
    filters.concept_ids.length +
    filters.person_ids.length +
    filters.tags.length +
    filters.collection_ids.length +
    filters.markers.length +
    filters.methodologies.length +
    (filters.year_min ? 1 : 0) +
    (filters.year_max ? 1 : 0) +
    (filters.has_pdf ? 1 : 0) +
    (filters.has_notes ? 1 : 0);

  // ---- Bulk select ----
  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllOnPage = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      sources.forEach(s => next.add(s.id));
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // ---- Marker update ----
  const updateMarkers = async (sourceId, markers) => {
    const csrf = document.querySelector('[name="csrf-token"]')?.content;
    try {
      const res = await fetch(`/sources/${sourceId}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ source: { markers } }),
      });
      if (res.ok) {
        setSources(prev => prev.map(s => s.id === sourceId ? { ...s, markers } : s));
      }
    } catch (err) {
      console.error('Marker save failed', err);
    }
  };

  const deleteSource = async (source) => {
    const ok = window.confirm(
      `Delete "${source.title}"?\n\n` +
      `This removes the source, its PDF, and all its highlights.  ` +
      `Notes you've taken on it become unattached.  ` +
      `This can't be undone.`
    );
    if (!ok) return;
    const csrf = document.querySelector('[name="csrf-token"]')?.content;
    try {
      const res = await fetch(`/sources/${source.id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf, 'Accept': 'application/json' },
      });
      if (res.ok || res.status === 204) {
        setSources(prev => prev.filter(s => s.id !== source.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Could not delete: ${data.error || res.status}`);
      }
    } catch (err) {
      console.error('Delete failed', err);
      alert('Could not delete the source — check your connection and try again.');
    }
  };

  // ---- Pagination ----
  const goToPage = (n) => {
    setPage(n);
    fetchSources(n);
    document.querySelector('.srx-main')?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- Sort ----
  const setSort = (value) => update({ sort: value });

  return (
    <div className="srx">
      <SrxStyles />
      <SourceCardStyles />

      <header className="srx-header">
        <div>
          <h1 className="srx-title">Sources</h1>
          <p className="srx-subtitle">
            {loading
              ? 'Loading.'
              : `${pagination.total_count.toLocaleString()} source${pagination.total_count === 1 ? '' : 's'}`}
            {activeFilterCount > 0 && (
              <> · <button type="button" className="srx-link" onClick={clearAll}>Clear {activeFilterCount} Filter{activeFilterCount === 1 ? '' : 's'}</button></>
            )}
          </p>
        </div>
        <div className="srx-header-actions">
          {bulkMode ? (
            <>
              <button type="button" className="sp-action sp-action-secondary" onClick={() => { setBulkMode(false); clearSelection(); }}>
                Cancel
              </button>
              <button
                type="button"
                className="sp-action sp-action-primary"
                disabled={selectedIds.size === 0}
                onClick={() => setShowExport(true)}
              >
                Export {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="sp-action sp-action-secondary" onClick={() => setBulkMode(true)}>
                Select for Export
              </button>
              <button type="button" className="sp-action sp-action-secondary" onClick={() => { setEditingSource(null); setShowForm(true); }}>
                Manual Input
              </button>
              <a href="/uploads" className="sp-action sp-action-secondary" title="Bulk Upload">Bulk Upload</a>
              <button type="button" className="sp-action sp-action-primary" onClick={() => setShowPdf(true)}>
                Upload PDF
              </button>
            </>
          )}
        </div>
      </header>

      <div className="srx-body">
        <aside className={`srx-sidebar ${mobileFiltersOpen ? 'is-open' : 'is-collapsed'}`}>
          <button
            type="button"
            className="srx-mobile-toggle"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            aria-expanded={mobileFiltersOpen}
          >
            <span className="srx-mobile-toggle-label">Filters</span>
            {activeFilterCount > 0 && (
              <span className="srx-mobile-toggle-count">{activeFilterCount} active</span>
            )}
            <span className="srx-mobile-toggle-caret" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5l3 3 3-3" />
              </svg>
            </span>
          </button>

          <div className="srx-sidebar-body">
            <FilterSection label="Quick">
              <div className="srx-quick-toggles">
                <Toggle
                  checked={filters.has_pdf}
                  onChange={() => update({ has_pdf: !filters.has_pdf })}
                  label="Has PDF"
                  count={filterMeta.pdf_count}
                />
                <Toggle
                  checked={filters.has_notes}
                  onChange={() => update({ has_notes: !filters.has_notes })}
                  label="Has Notes"
                  count={filterMeta.notes_count}
                />
              </div>
            </FilterSection>

            <FilterSection label="Markers">
              {filterMeta.markers.length === 0 ? (
                <p className="srx-filter-empty">Mark sources to filter here.</p>
              ) : (
                filterMeta.markers.map(m => (
                  <CheckboxRow
                    key={m.name}
                    checked={filters.markers.includes(m.name)}
                    onChange={() => toggleInArray('markers', m.name)}
                    label={m.name}
                    count={m.count}
                  />
                ))
              )}
            </FilterSection>

            <FilterSection label="Type">
              {filterMeta.kinds.length === 0 ? (
                <p className="srx-filter-empty">No types yet.</p>
              ) : (
                filterMeta.kinds.map(({ value, count }) => (
                  <CheckboxRow
                    key={value}
                    checked={filters.kind === value}
                    onChange={() => update({ kind: filters.kind === value ? '' : value })}
                    label={KIND_LABELS[value] || value}
                    count={count}
                  />
                ))
              )}
            </FilterSection>

            <FilterSection label="Research Type">
              {filterMeta.methodologies.length === 0 ? (
                <p className="srx-filter-empty">No research types tagged yet.</p>
              ) : (
                filterMeta.methodologies.map(m => (
                  <CheckboxRow
                    key={m.name}
                    checked={filters.methodologies.includes(m.name)}
                    onChange={() => toggleInArray('methodologies', m.name)}
                    label={m.name}
                    count={m.count}
                  />
                ))
              )}
            </FilterSection>

            <FacetSection
              label="Concepts"
              accent="concept"
              noun="concepts"
              items={filterMeta.concepts}
              labelKey="label"
              selected={filters.concept_ids}
              onToggle={(id) => toggleInArray('concept_ids', id)}
            />

            <FacetSection
              label="Authors"
              accent="person"
              noun="authors"
              items={filterMeta.authors}
              labelKey="full_name"
              selected={filters.person_ids}
              onToggle={(id) => toggleInArray('person_ids', id)}
            />

            <FacetSection
              label="Collections"
              noun="collections"
              items={filterMeta.collections}
              labelKey="name"
              selected={filters.collection_ids}
              onToggle={(id) => toggleInArray('collection_ids', id)}
            />

            {filterMeta.tags.length > 0 && (
              <FilterSection label="Tags">
                <FacetSearchList
                  noun="tags"
                  items={filterMeta.tags.map(t => ({ id: t.name, label: t.name, count: t.count }))}
                  selectedSet={new Set(filters.tags)}
                  onToggle={(t) => toggleInArray('tags', t)}
                />
              </FilterSection>
            )}

            <FilterSection label="Year">
              <div className="srx-year-row">
                <input
                  type="number"
                  className="srx-year-input"
                  placeholder="From"
                  value={filters.year_min}
                  onChange={(e) => update({ year_min: e.target.value })}
                />
                <span className="srx-year-dash">–</span>
                <input
                  type="number"
                  className="srx-year-input"
                  placeholder="To"
                  value={filters.year_max}
                  onChange={(e) => update({ year_max: e.target.value })}
                />
              </div>
            </FilterSection>

            {activeFilterCount > 0 && (
              <button type="button" className="srx-clear-all" onClick={clearAll}>
                Clear All Filters
              </button>
            )}
          </div>
        </aside>

        <main className="srx-main">
          <div className="srx-toolbar">
            <div className="srx-search">
              <SearchIcon />
              <input
                type="text"
                value={filters.q}
                onChange={(e) => update({ q: e.target.value })}
                placeholder="Search title, author, abstract, DOI."
                className="srx-search-input"
              />
              {filters.q && (
                <button type="button" className="srx-search-clear" onClick={() => update({ q: '' })} aria-label="Clear search">×</button>
              )}
            </div>
            <select
              value={filters.sort}
              onChange={(e) => setSort(e.target.value)}
              className="srx-sort"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label
              className={`srx-density-toggle${showAbstracts ? ' is-on' : ''}`}
              title="Show abstracts on each card"
            >
              <input
                type="checkbox"
                checked={showAbstracts}
                onChange={(e) => setShowAbstracts(e.target.checked)}
              />
              <span>Show abstracts</span>
            </label>
          </div>

          {activeFilterCount > 0 && (
            <ActiveFilterBar
              filters={filters}
              meta={filterMeta}
              onRemove={(patch) => update(patch)}
              onRemoveFromArray={(key, value) => toggleInArray(key, value)}
              onClearAll={clearAll}
            />
          )}

          {bulkMode && (
            <div className="srx-bulk-bar">
              <span className="srx-bulk-count">
                {selectedIds.size} Selected
                {sources.length > 0 && (
                  <> · <button type="button" className="srx-link" onClick={selectAllOnPage}>Select Page</button></>
                )}
                {selectedIds.size > 0 && (
                  <> · <button type="button" className="srx-link" onClick={clearSelection}>Clear</button></>
                )}
              </span>
            </div>
          )}

          {loading ? (
            <div className="srx-message">Loading.</div>
          ) : sources.length === 0 ? (
            <EmptyState hasFilters={activeFilterCount > 0 || filters.q} onClear={clearAll} onCreate={() => { setEditingSource(null); setShowForm(true); }} />
          ) : (
            <div className="srx-list">
              {sources.map(source => (
                <SourceCard
                  key={source.id}
                  source={source}
                  variant="full"
                  selectable={bulkMode}
                  selected={selectedIds.has(source.id)}
                  showAbstract={showAbstracts}
                  onToggleSelect={() => toggleSelected(source.id)}
                  onEdit={() => { setEditingSource(source); setShowForm(true); }}
                  onDelete={() => deleteSource(source)}
                  onMarkersChange={(markers) => updateMarkers(source.id, markers)}
                />
              ))}
            </div>
          )}

          {pagination.total_pages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.total_pages}
              totalCount={pagination.total_count}
              onPageChange={goToPage}
            />
          )}
        </main>
      </div>

      <SourceFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingSource(null); fetchSources(page); }}
        onSuccess={() => { setShowForm(false); setEditingSource(null); fetchSources(page); }}
        item={editingSource}
      />

      <PdfUploadModal
        isOpen={showPdf}
        onClose={() => setShowPdf(false)}
        onSuccess={() => { setShowPdf(false); fetchSources(page); }}
      />

      <ExportCitationsModal
        open={showExport}
        ids={Array.from(selectedIds)}
        onClose={() => setShowExport(false)}
      />
    </div>
  );
}

// =====================================================================
// Subcomponents — sidebar
// =====================================================================
function FilterSection({ label, trailing, defaultOpen = true, children, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="srx-filter-section">
      <button
        type="button"
        className={`srx-filter-head srx-filter-head-button ${open ? 'is-open' : 'is-closed'}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {accent && <span className={`srx-filter-dot is-${accent}`} aria-hidden="true" />}
        <span className="srx-filter-label">{label}</span>
        {trailing}
        <span className="srx-filter-caret" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5l3 3 3-3" />
          </svg>
        </span>
      </button>
      {open && <div className="srx-filter-body">{children}</div>}
    </div>
  );
}

function CheckboxRow({ checked, onChange, label, count }) {
  return (
    <label className="srx-row">
      <input type="checkbox" checked={checked} onChange={onChange} className="sp-checkbox" />
      <span className="srx-row-label">{label}</span>
      {count != null && <span className="srx-row-count">{count}</span>}
    </label>
  );
}

// Facet section that adds type-to-filter when item count is large.
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
  const [query, setQuery] = useState('');
  const showSearch = items.length > 8;

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(i => String(i.label).toLowerCase().includes(q));
  }, [items, query]);

  // Always include selected items even if filtered out
  const display = useMemo(() => {
    const selectedItems = items.filter(i => selectedSet.has(i.id) && !filtered.find(f => f.id === i.id));
    return [...selectedItems, ...filtered].slice(0, 50);
  }, [items, filtered, selectedSet]);

  return (
    <>
      {showSearch && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${items.length} ${noun}`}
          className="srx-facet-search"
        />
      )}
      <div className="srx-facet-list">
        {display.map(item => (
          <CheckboxRow
            key={item.id}
            checked={selectedSet.has(item.id)}
            onChange={() => onToggle(item.id)}
            label={item.label}
            count={item.count}
          />
        ))}
        {filtered.length > 50 && (
          <p className="srx-filter-note">Showing first 50. Refine search.</p>
        )}
      </div>
    </>
  );
}

// =====================================================================
// Active filter chip bar
// =====================================================================
function ActiveFilterBar({ filters, meta, onRemove, onRemoveFromArray, onClearAll }) {
  const chips = [];
  if (filters.kind) chips.push({ key: 'kind', label: `Type: ${KIND_LABELS[filters.kind] || filters.kind}`, onClear: () => onRemove({ kind: '' }) });
  filters.concept_ids.forEach(id => {
    const c = meta.concepts.find(x => x.id === id);
    if (c) chips.push({ key: `c-${id}`, label: `Concept: ${c.label}`, onClear: () => onRemoveFromArray('concept_ids', id) });
  });
  filters.person_ids.forEach(id => {
    const p = meta.authors.find(x => x.id === id);
    if (p) chips.push({ key: `p-${id}`, label: `Author: ${p.full_name}`, onClear: () => onRemoveFromArray('person_ids', id) });
  });
  filters.tags.forEach(t => chips.push({ key: `t-${t}`, label: `Tag: ${t}`, onClear: () => onRemoveFromArray('tags', t) }));
  filters.collection_ids.forEach(id => {
    const c = meta.collections.find(x => x.id === id);
    if (c) chips.push({ key: `co-${id}`, label: `Collection: ${c.name}`, onClear: () => onRemoveFromArray('collection_ids', id) });
  });
  filters.markers.forEach(m => chips.push({ key: `m-${m}`, label: `Marker: ${m}`, onClear: () => onRemoveFromArray('markers', m) }));
  filters.methodologies.forEach(m => chips.push({ key: `meth-${m}`, label: `Method: ${m}`, onClear: () => onRemoveFromArray('methodologies', m) }));
  if (filters.year_min) chips.push({ key: 'ymin', label: `From ${filters.year_min}`, onClear: () => onRemove({ year_min: '' }) });
  if (filters.year_max) chips.push({ key: 'ymax', label: `To ${filters.year_max}`, onClear: () => onRemove({ year_max: '' }) });
  if (filters.has_pdf) chips.push({ key: 'pdf', label: 'Has PDF', onClear: () => onRemove({ has_pdf: false }) });
  if (filters.has_notes) chips.push({ key: 'notes', label: 'Has notes', onClear: () => onRemove({ has_notes: false }) });

  if (chips.length === 0) return null;

  return (
    <div className="srx-chip-bar">
      {chips.map(c => (
        <button key={c.key} type="button" className="srx-chip" onClick={c.onClear}>
          <span>{c.label}</span>
          <span className="srx-chip-x" aria-hidden="true">×</span>
        </button>
      ))}
      <button type="button" className="srx-chip-clear" onClick={onClearAll}>Clear All</button>
    </div>
  );
}

// =====================================================================
// Pagination
// =====================================================================
function Pagination({ page, totalPages, totalCount, onPageChange }) {
  const from = (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, totalCount);
  const pages = paginationRange(page, totalPages);

  return (
    <div className="srx-pagination">
      <span className="srx-pagination-info">{from.toLocaleString()}–{to.toLocaleString()} of {totalCount.toLocaleString()}</span>
      <div className="srx-pagination-controls">
        <button type="button" className="srx-page-btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>‹</button>
        {pages.map((p, i) => (
          p === '…'
            ? <span key={`e${i}`} className="srx-page-ellipsis">…</span>
            : <button
                key={p}
                type="button"
                className={`srx-page-btn ${p === page ? 'is-current' : ''}`}
                onClick={() => onPageChange(p)}
              >{p}</button>
        ))}
        <button type="button" className="srx-page-btn" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>›</button>
      </div>
    </div>
  );
}

function paginationRange(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = new Set([1, total, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach(p => out.add(p));
  if (page >= total - 2) [total - 1, total - 2, total - 3].forEach(p => out.add(p));
  const sorted = [...out].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('…');
    result.push(p);
  });
  return result;
}

// =====================================================================
// Empty state
// =====================================================================
function EmptyState({ hasFilters, onClear, onCreate }) {
  if (hasFilters) {
    return (
      <div className="srx-empty">
        <h2 className="srx-empty-title">No Matches</h2>
        <p className="srx-empty-text">Adjust the filters or search and try again.</p>
        <div className="srx-empty-actions">
          <button type="button" className="sp-action sp-action-secondary" onClick={onClear}>Clear Filters</button>
        </div>
      </div>
    );
  }
  return (
    <div className="srx-empty">
      <h2 className="srx-empty-title">No Sources Yet</h2>
      <p className="srx-empty-text">
        Add the first article, book, or website to begin building your evidence base.  PDFs can be uploaded individually or in bulk.
      </p>
      <div className="srx-empty-actions">
        <button type="button" className="sp-action sp-action-primary" onClick={onCreate}>
          <span className="srx-plus">+</span> First Source
        </button>
        <a href="/uploads" className="sp-action sp-action-secondary">Bulk Upload</a>
      </div>
    </div>
  );
}

// =====================================================================
// Export Citations Modal
// =====================================================================
function ExportCitationsModal({ open, ids, onClose }) {
  const [format, setFormat] = useState('apa');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setBody('');
      setCopied(false);
      return;
    }
    if (ids.length === 0) return;
    let cancelled = false;
    setLoading(true);
    const csrf = document.querySelector('[name="csrf-token"]')?.content;
    fetch('/sources/citations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ ids, format }),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled) setBody(data.body || ''); })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, format, ids]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) { console.error(err); }
  };

  const download = () => {
    const ext = format === 'bibtex' ? 'bib' : format === 'ris' ? 'ris' : 'txt';
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bibliography-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="srx-modal-backdrop" onClick={onClose}>
      <div className="srx-modal" onClick={(e) => e.stopPropagation()}>
        <header className="srx-modal-head">
          <h2>Export Bibliography</h2>
          <button type="button" className="srx-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="srx-modal-body">
          <div className="srx-format-tabs">
            {[
              { v: 'apa', l: 'APA' },
              { v: 'chicago', l: 'Chicago' },
              { v: 'mla', l: 'MLA' },
              { v: 'bibtex', l: 'BibTeX' },
              { v: 'ris', l: 'RIS' },
            ].map(o => (
              <button
                key={o.v}
                type="button"
                className={`srx-format-tab ${format === o.v ? 'is-active' : ''}`}
                onClick={() => setFormat(o.v)}
              >{o.l}</button>
            ))}
          </div>
          <p className="srx-modal-meta">
            {ids.length} source{ids.length === 1 ? '' : 's'}
          </p>
          {loading ? (
            <div className="srx-modal-loading">Building Citations.</div>
          ) : (
            <textarea
              className="srx-modal-textarea"
              readOnly
              value={body}
              spellCheck={false}
            />
          )}
        </div>
        <footer className="srx-modal-foot">
          <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>Close</button>
          <button type="button" className="sp-action sp-action-secondary" onClick={download} disabled={!body}>Download</button>
          <button type="button" className="sp-action sp-action-primary" onClick={copy} disabled={!body}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// =====================================================================
// Icons
// =====================================================================
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11l3 3" strokeLinecap="round" />
    </svg>
  );
}

// =====================================================================
// Styles
// =====================================================================
function SrxStyles() {
  return (
    <style>{`
      .srx {
        flex: 1;
        background: var(--paper);
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .srx-header {
        max-width: 1440px;
        margin: 0 auto;
        width: 100%;
        padding: 32px 24px 20px;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      .srx-title {
        font-family: var(--font-display);
        font-size: 36px;
        font-weight: 600;
        color: var(--source);
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 0;
      }
      .srx-subtitle {
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink-3);
        margin: 6px 0 0;
      }
      .srx-link {
        background: none;
        border: none;
        padding: 0;
        color: var(--source-2);
        cursor: pointer;
        font: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .srx-link:hover { color: var(--source); }
      .srx-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .srx-plus { font-family: var(--font-mono); font-weight: 500; }

      /* Source-themed accents on action primaries inside this view */
      .srx .sp-action-primary {
        background: var(--source);
        border-color: var(--source);
      }
      .srx .sp-action-primary:hover:not(:disabled) {
        background: var(--source-2);
        border-color: var(--source-2);
      }
      .srx .sp-checkbox:checked,
      .srx .sp-checkbox:indeterminate {
        background: var(--source);
        border-color: var(--source);
      }

      .srx-body {
        max-width: 1440px;
        margin: 0 auto;
        width: 100%;
        padding: 0 24px 64px;
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr);
        gap: 32px;
      }

      .srx-sidebar {
        position: sticky;
        top: 88px;
        align-self: start;
        max-height: calc(100vh - 100px);
        overflow-y: auto;
      }
      .srx-mobile-toggle { display: none; }
      .srx-sidebar-body { display: block; }

      .srx-filter-section { margin-bottom: 18px; }
      /* Source-blue tint for ON-state toggles in this view */
      .srx-quick-toggles { --toggle-on: var(--source); display: flex; flex-direction: column; gap: 1px; }
      .srx-filter-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      /* Collapsible header — same metrics as before, but a clickable button
         with a chevron at the right that rotates when collapsed. */
      .srx-filter-head-button {
        width: 100%;
        background: transparent;
        border: none;
        padding: 6px 0;
        cursor: pointer;
        text-align: left;
        color: inherit;
      }
      .srx-filter-head-button:hover .srx-filter-label { color: var(--ink); }
      .srx-filter-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        flex: 1;
        transition: color 0.12s;
      }
      .srx-filter-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ink-3);
        flex-shrink: 0;
        margin-right: 8px;
      }
      .srx-filter-dot.is-concept { background: var(--concept); }
      .srx-filter-dot.is-source  { background: var(--source);  }
      .srx-filter-dot.is-person  { background: var(--person);  }
      .srx-filter-caret {
        display: inline-flex;
        align-items: center;
        color: var(--ink-3);
        flex-shrink: 0;
        transition: transform 0.18s;
      }
      .srx-filter-head-button.is-closed .srx-filter-caret { transform: rotate(-90deg); }
      .srx-filter-body { display: flex; flex-direction: column; gap: 1px; }
      .srx-filter-empty {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-4);
        margin: 0;
        padding: 4px 8px;
      }
      .srx-filter-note {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-4);
        margin: 4px 0 0;
        padding: 0 8px;
      }

      .srx-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 8px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        border-radius: var(--r-sm);
      }
      .srx-row:hover { background: var(--hover); color: var(--ink); }
      .srx-row-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .srx-row-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }

      .srx-facet-search {
        width: 100%;
        height: 28px;
        padding: 0 8px;
        margin-bottom: 6px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink);
      }
      .srx-facet-search:focus { outline: none; border-color: var(--ink-2); background: var(--paper); }
      .srx-facet-list {
        display: flex;
        flex-direction: column;
        gap: 1px;
        max-height: 240px;
        overflow-y: auto;
        padding: 4px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        box-shadow: inset 0 -8px 8px -8px rgba(15, 23, 35, 0.08);
      }
      .srx-facet-list::-webkit-scrollbar { width: 8px; }
      .srx-facet-list::-webkit-scrollbar-track { background: transparent; }
      .srx-facet-list::-webkit-scrollbar-thumb {
        background: var(--ink-line);
        border-radius: 4px;
      }
      .srx-facet-list::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }

      .srx-year-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .srx-year-input {
        flex: 1;
        min-width: 0;
        height: 30px;
        padding: 0 8px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--ink);
      }
      .srx-year-input:focus { outline: none; border-color: var(--source); }
      .srx-year-dash { color: var(--ink-4); font-family: var(--font-body); }

      .srx-clear-all {
        margin-top: 8px;
        background: transparent;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 6px 10px;
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        cursor: pointer;
        width: 100%;
      }
      .srx-clear-all:hover { background: var(--hover); color: var(--ink); }

      /* Main column */
      .srx-main { min-width: 0; }

      .srx-toolbar {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 16px;
      }
      .srx-search {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 36px;
        padding: 0 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        color: var(--ink-3);
        max-width: 480px;
        transition: border-color var(--transition-fast);
      }
      .srx-search:focus-within { border-color: var(--source); color: var(--ink); }
      .srx-search-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink);
        min-width: 0;
      }
      .srx-search-input::placeholder { color: var(--ink-3); }
      .srx-search-clear {
        background: none;
        border: none;
        color: var(--ink-3);
        font-size: 18px;
        line-height: 1;
        padding: 0 4px;
        cursor: pointer;
      }
      .srx-search-clear:hover { color: var(--ink); }
      .srx-sort {
        height: 36px;
        padding: 0 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink);
        cursor: pointer;
      }
      .srx-sort:focus { outline: none; border-color: var(--source); }

      .srx-density-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        white-space: nowrap;
        transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
      }
      .srx-density-toggle:hover { border-color: var(--source); color: var(--ink); }
      .srx-density-toggle.is-on {
        background: var(--source-tint);
        border-color: var(--source);
        color: var(--source-2);
        font-weight: 600;
      }
      .srx-density-toggle input[type="checkbox"] {
        accent-color: var(--source);
        margin: 0;
      }

      .srx-chip-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }
      .srx-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--source-tint);
        color: var(--source-2);
        border: none;
        border-radius: var(--r-sm);
        padding: 3px 8px 3px 10px;
        font-family: var(--font-body);
        font-size: 12px;
        cursor: pointer;
      }
      .srx-chip:hover { background: color-mix(in srgb, var(--source-tint) 70%, var(--source) 30%); }
      .srx-chip-x { font-size: 14px; line-height: 1; opacity: 0.7; }
      .srx-chip-clear {
        background: transparent;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 3px 10px;
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        cursor: pointer;
      }
      .srx-chip-clear:hover { background: var(--hover); color: var(--ink); }

      .srx-bulk-bar {
        background: var(--source-tint);
        border: 1px solid color-mix(in srgb, var(--source) 25%, transparent);
        border-radius: var(--r-md);
        padding: 8px 14px;
        margin-bottom: 12px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--source-2);
      }
      .srx-bulk-count { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }

      .srx-message {
        padding: 64px 24px;
        text-align: center;
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-3);
      }

      .srx-empty {
        max-width: 540px;
        margin: 48px auto;
        text-align: center;
        padding: 32px 24px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
      }
      .srx-empty-title {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--ink);
        margin: 0 0 8px;
      }
      .srx-empty-text {
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-2);
        line-height: 1.6;
        margin: 0 0 20px;
      }
      .srx-empty-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }

      /* Source rows */
      .srx-list {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      /* Pagination */
      .srx-pagination {
        margin-top: 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .srx-pagination-info {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .srx-pagination-controls { display: flex; gap: 4px; }
      .srx-page-btn {
        min-width: 32px;
        height: 32px;
        padding: 0 8px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        font-variant-numeric: tabular-nums;
      }
      .srx-page-btn:hover:not(:disabled) {
        background: var(--source-tint);
        color: var(--source-2);
        border-color: var(--source);
      }
      .srx-page-btn.is-current {
        background: var(--source);
        border-color: var(--source);
        color: var(--paper);
      }
      .srx-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .srx-page-ellipsis {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-4);
        align-self: center;
        padding: 0 4px;
      }

      /* Export modal */
      .srx-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 35, 0.5);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .srx-modal {
        background: var(--paper);
        border-radius: var(--r-lg);
        box-shadow: 0 12px 48px rgba(15, 23, 35, 0.25);
        width: 100%;
        max-width: 720px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .srx-modal-head {
        padding: 18px 24px;
        border-bottom: 1px solid var(--ink-line);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .srx-modal-head h2 {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
      }
      .srx-modal-close {
        background: none;
        border: none;
        font-size: 22px;
        line-height: 1;
        color: var(--ink-3);
        cursor: pointer;
        padding: 4px 8px;
      }
      .srx-modal-close:hover { color: var(--ink); }
      .srx-modal-body {
        padding: 18px 24px;
        flex: 1;
        overflow-y: auto;
      }
      .srx-format-tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
      .srx-format-tab {
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 6px 14px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
      }
      .srx-format-tab:hover { background: var(--hover); color: var(--ink); }
      .srx-format-tab.is-active {
        background: var(--source);
        border-color: var(--source);
        color: var(--paper);
      }
      .srx-modal-meta {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        margin: 0 0 8px;
      }
      .srx-modal-loading {
        padding: 32px;
        text-align: center;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
      }
      .srx-modal-textarea {
        width: 100%;
        min-height: 280px;
        padding: 12px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--font-mono);
        font-size: 12px;
        line-height: 1.6;
        color: var(--ink);
        resize: vertical;
      }
      .srx-modal-textarea:focus { outline: none; border-color: var(--source); }
      .srx-modal-foot {
        padding: 14px 24px;
        border-top: 1px solid var(--ink-line);
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      /* Responsive */
      @media (max-width: 900px) {
        .srx-body { grid-template-columns: 1fr; }
        .srx-sidebar {
          position: static;
          max-height: none;
          padding: 0;
          background: var(--paper);
          border: 1px solid var(--ink-line);
          border-radius: var(--r-md);
          margin-bottom: 16px;
          overflow: hidden;
        }
        .srx-mobile-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 16px;
          background: var(--paper);
          border: none;
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
          text-align: left;
        }
        .srx-sidebar.is-open .srx-mobile-toggle { border-bottom: 1px solid var(--ink-line); }
        .srx-mobile-toggle:hover { background: var(--paper-soft); }
        .srx-mobile-toggle-label { flex: 1; }
        .srx-mobile-toggle-count {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          color: var(--source-2);
          background: var(--source-tint);
          padding: 2px 8px;
          border-radius: var(--r-sm);
        }
        .srx-mobile-toggle-caret {
          display: inline-flex;
          align-items: center;
          color: var(--ink-3);
          transition: transform 0.15s;
        }
        .srx-sidebar.is-collapsed .srx-mobile-toggle-caret { transform: rotate(-90deg); }
        .srx-sidebar.is-collapsed .srx-sidebar-body { display: none; }
        .srx-sidebar-body { padding: 16px; }
      }
      @media (max-width: 600px) {
        .srx-header { padding: 20px 16px 12px; }
        .srx-body { padding: 0 16px 48px; gap: 16px; }
        .srx-title { font-size: 28px; }
        .srx-toolbar { flex-direction: column; align-items: stretch; }
        .srx-search { max-width: none; }
      }
    `}</style>
  );
}
