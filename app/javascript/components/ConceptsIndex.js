import React, { useState, useEffect, useMemo } from 'react';
import ConceptFormModal from './ConceptFormModal';
import ConceptTypeReference, { ConceptTypeHelpButton } from './ConceptTypeReference';
import { buildConceptHierarchy, flattenHierarchy } from '../utils/conceptHierarchy';
import { NODE_TYPES, getNodeTypeLabel } from '../config/nodeTypes';
import { toTitleCase } from '../utils/titleCase';

// =====================================================================
// ConceptsIndex
// Library view of every concept the user owns: clean table, hierarchy
// indent, type + origin filters, pack provenance.
// =====================================================================

export default function ConceptsIndex() {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [conceptStack, setConceptStack] = useState([]);
  const [showTypeRef, setShowTypeRef] = useState(false);

  const [textFilter, setTextFilter] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [origin, setOrigin] = useState('all'); // 'all' | 'mine' | 'pack'

  const [sortField, setSortField] = useState('label');
  const [sortDir, setSortDir] = useState('asc');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeFilterCount = (selectedTypes.length > 0 ? selectedTypes.length : 0) + (origin !== 'all' ? 1 : 0);

  useEffect(() => { fetchConcepts(); }, []);

  const fetchConcepts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/concepts.json');
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setConcepts(data);
    } catch (err) {
      console.error(err);
      setError('We could not load your concepts.  Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Type counts (computed across all concepts, not filtered) ----
  const typeCounts = useMemo(() => {
    const counts = {};
    concepts.forEach((c) => {
      const t = c.effective_concept_type || c.concept_type;
      if (!t) return;
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [concepts]);

  const packCount = useMemo(
    () => concepts.filter((c) => c.definition?.pack?.name).length,
    [concepts]
  );

  // ---- Apply filters ----
  const filtered = useMemo(() => {
    return concepts.filter((c) => {
      if (origin === 'mine' && c.definition_id) return false;
      if (origin === 'pack' && !c.definition_id) return false;
      const t = c.effective_concept_type || c.concept_type;
      if (selectedTypes.length > 0 && !selectedTypes.includes(t)) return false;
      if (textFilter.trim()) {
        const q = textFilter.toLowerCase();
        if (!c.label?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [concepts, origin, selectedTypes, textFilter]);

  // ---- Hierarchy (only when no text filter) ----
  const rows = useMemo(() => {
    if (textFilter.trim() || sortField !== 'label') {
      // Flat sorted list
      const sorted = [...filtered].sort((a, b) => compareConcepts(a, b, sortField, sortDir));
      return sorted.map((c) => ({ concept: c, depth: 0 }));
    }
    const tree = buildConceptHierarchy(filtered);
    const sortedTree = sortTree(tree, sortDir);
    return flattenHierarchy(sortedTree);
  }, [filtered, sortField, sortDir, textFilter]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleType = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="cidx">
      <CIdxStyles />

      <header className="cidx-header">
        <div>
          <h1 className="cidx-title">Concepts</h1>
          <p className="cidx-subtitle">
            {concepts.length} concept{concepts.length === 1 ? '' : 's'}
            {packCount > 0 && <> · {packCount} from pack{packCount === 1 ? '' : 's'}</>}
          </p>
        </div>
        <div className="cidx-header-actions">
          <a href="/packs" className="sp-action sp-action-secondary">Browse packs</a>
          <button type="button" className="sp-action sp-action-primary" onClick={() => { setConceptStack([]); setShowForm(true); }}>
            <span className="cidx-plus" aria-hidden="true">+</span> Concept
          </button>
        </div>
      </header>

      <div className="cidx-body">
        <aside className={`cidx-sidebar ${mobileFiltersOpen ? 'is-open' : 'is-collapsed'}`}>
          <button
            type="button"
            className="cidx-mobile-toggle"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            aria-expanded={mobileFiltersOpen}
          >
            <span className="cidx-mobile-toggle-label">Filters</span>
            {activeFilterCount > 0 && (
              <span className="cidx-mobile-toggle-count">{activeFilterCount} active</span>
            )}
            <span className="cidx-mobile-toggle-caret" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5l3 3 3-3" />
              </svg>
            </span>
          </button>
          <div className="cidx-sidebar-body">
          <FilterSection label="Origin">
            <RadioRow checked={origin === 'all'}  onChange={() => setOrigin('all')}  label="All concepts" count={concepts.length} />
            <RadioRow checked={origin === 'mine'} onChange={() => setOrigin('mine')} label="My library"     count={concepts.length - packCount} />
            <RadioRow checked={origin === 'pack'} onChange={() => setOrigin('pack')} label="From packs"     count={packCount} />
          </FilterSection>

          <FilterSection
            label="Type"
            trailing={<ConceptTypeHelpButton onClick={() => setShowTypeRef(true)} />}
          >
            {NODE_TYPES.map((t) => {
              const count = typeCounts[t.value] || 0;
              if (count === 0 && !selectedTypes.includes(t.value)) return null;
              return (
                <CheckboxRow
                  key={t.value}
                  checked={selectedTypes.includes(t.value)}
                  onChange={() => toggleType(t.value)}
                  label={t.label}
                  count={count}
                />
              );
            })}
            {selectedTypes.length > 0 && (
              <button className="cidx-clear" onClick={() => setSelectedTypes([])}>
                Clear ({selectedTypes.length})
              </button>
            )}
          </FilterSection>
          </div>
        </aside>

        <main className="cidx-main">
          <div className="cidx-toolbar">
            <div className="cidx-search">
              <SearchIcon />
              <input
                type="text"
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                placeholder={`Filter ${concepts.length} concept${concepts.length === 1 ? '' : 's'}`}
                className="cidx-search-input"
              />
            </div>
            <div className="cidx-result-count">
              {loading ? 'Loading.' : `${rows.length} shown`}
            </div>
          </div>

          {error ? (
            <div className="cidx-message cidx-message-error">{error}</div>
          ) : loading ? (
            <div className="cidx-message">Loading.</div>
          ) : rows.length === 0 ? (
            <EmptyState hasConcepts={concepts.length > 0} onCreate={() => { setConceptStack([]); setShowForm(true); }} />
          ) : (
            <div className="cidx-table-wrap">
              <table className="cidx-table">
                <thead>
                  <tr>
                    <Th label="Concept" field="label" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                    <Th label="Type"    field="type"  sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                    <Th label="Connections" field="connections" sortField={sortField} sortDir={sortDir} onSort={toggleSort} numeric />
                    <Th label="Sources" field="sources" sortField={sortField} sortDir={sortDir} onSort={toggleSort} numeric />
                    <Th label="Notes"   field="notes"   sortField={sortField} sortDir={sortDir} onSort={toggleSort} numeric />
                    <th className="cidx-th">Origin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ concept, depth }) => (
                    <ConceptRow key={concept.id} concept={concept} depth={depth} hierarchical={!textFilter.trim() && sortField === 'label'} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      <ConceptFormModal
        isOpen={showForm}
        onClose={() => {
          if (conceptStack.length > 1) setConceptStack((p) => p.slice(0, -1));
          else { setShowForm(false); setConceptStack([]); }
          fetchConcepts();
        }}
        onSuccess={() => {
          fetchConcepts();
          if (conceptStack.length > 1) setConceptStack((p) => p.slice(0, -1));
          else { setShowForm(false); setConceptStack([]); }
        }}
        item={conceptStack[conceptStack.length - 1] || null}
        stackDepth={conceptStack.length - 1}
        onEditRelatedConcept={async (conceptId) => {
          try {
            const res = await fetch(`/concepts/${conceptId}.json`);
            if (res.ok) {
              const data = await res.json();
              setConceptStack((prev) => [...prev, data]);
            }
          } catch (err) {
            console.error(err);
          }
        }}
      />

      <ConceptTypeReference open={showTypeRef} onClose={() => setShowTypeRef(false)} />
    </div>
  );
}

// =====================================================================
// Subcomponents
// =====================================================================

function FilterSection({ label, trailing, children }) {
  return (
    <div className="cidx-filter-section">
      <div className="cidx-filter-head">
        <span className="cidx-filter-label">{label}</span>
        {trailing}
      </div>
      <div className="cidx-filter-body">{children}</div>
    </div>
  );
}

function RadioRow({ checked, onChange, label, count }) {
  return (
    <label className="cidx-row">
      <input type="radio" checked={checked} onChange={onChange} className="cidx-radio" />
      <span className="cidx-row-label">{label}</span>
      {count != null && <span className="cidx-row-count">{count}</span>}
    </label>
  );
}

function CheckboxRow({ checked, onChange, label, count }) {
  return (
    <label className="cidx-row">
      <input type="checkbox" checked={checked} onChange={onChange} className="sp-checkbox" />
      <span className="cidx-row-label">{label}</span>
      {count != null && <span className="cidx-row-count">{count}</span>}
    </label>
  );
}

function Th({ label, field, sortField, sortDir, onSort, numeric }) {
  const active = sortField === field;
  return (
    <th
      className={`cidx-th ${numeric ? 'cidx-th-num' : ''} ${active ? 'is-active' : ''}`}
      onClick={() => onSort(field)}
    >
      <span>{label}</span>
      {active && (
        <span className="cidx-th-arrow" aria-hidden="true">
          {sortDir === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </th>
  );
}

function ConceptRow({ concept, depth, hierarchical }) {
  const type = concept.effective_concept_type || concept.concept_type;
  const typeLabel = getNodeTypeLabel(type);
  const connectionsCount = (concept.outgoing_connections?.length || 0) + (concept.incoming_connections?.length || 0);
  const pack = concept.definition?.pack;

  return (
    <tr>
      <td className="cidx-td-concept">
        <div className="cidx-concept-cell" style={{ paddingLeft: hierarchical ? `${depth * 18}px` : 0 }}>
          {hierarchical && depth > 0 && <span className="cidx-tree-indent" aria-hidden="true">└</span>}
          <a href={`/concepts/${concept.id}`} className="cidx-concept-link">{toTitleCase(concept.label)}</a>
        </div>
      </td>
      <td className="cidx-td-type">
        {type ? <span className="cidx-type-chip">{typeLabel}</span> : <span className="cidx-muted">—</span>}
      </td>
      <td className="cidx-td-num">{connectionsCount || <span className="cidx-muted">—</span>}</td>
      <td className="cidx-td-num">{concept.sources_count || <span className="cidx-muted">—</span>}</td>
      <td className="cidx-td-num">{concept.notes_count || <span className="cidx-muted">—</span>}</td>
      <td className="cidx-td-origin">
        {pack ? (
          <a href={`/packs/${pack.id}`} className="cidx-pack-pill" title={`From pack: ${pack.name}`}>
            <span className="cidx-pack-dot" aria-hidden="true" />{pack.name}
          </a>
        ) : (
          <span className="cidx-muted">—</span>
        )}
      </td>
    </tr>
  );
}

function EmptyState({ hasConcepts, onCreate }) {
  if (!hasConcepts) {
    return (
      <div className="cidx-empty">
        <h2 className="cidx-empty-title">No concepts yet.</h2>
        <p className="cidx-empty-text">
          Capture a theory, a pathology, an anatomical structure, or any concept you want to organize the literature around.
        </p>
        <div className="cidx-empty-actions">
          <button type="button" className="sp-action sp-action-primary" onClick={onCreate}>
            <span className="cidx-plus">+</span> First concept
          </button>
          <a href="/packs" className="sp-action sp-action-secondary">Browse pre-loaded packs</a>
        </div>
      </div>
    );
  }
  return (
    <div className="cidx-empty">
      <h2 className="cidx-empty-title">No matches for the current filters.</h2>
      <p className="cidx-empty-text">Adjust the type, origin, or text filter and try again.</p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11l3 3" strokeLinecap="round" />
    </svg>
  );
}

// =====================================================================
// Sort helpers
// =====================================================================

function compareConcepts(a, b, field, dir) {
  let av, bv;
  if (field === 'label') { av = (a.label || '').toLowerCase(); bv = (b.label || '').toLowerCase(); }
  else if (field === 'type') {
    av = getNodeTypeLabel(a.effective_concept_type || a.concept_type || '').toLowerCase();
    bv = getNodeTypeLabel(b.effective_concept_type || b.concept_type || '').toLowerCase();
  }
  else if (field === 'connections') {
    av = (a.outgoing_connections?.length || 0) + (a.incoming_connections?.length || 0);
    bv = (b.outgoing_connections?.length || 0) + (b.incoming_connections?.length || 0);
  }
  else if (field === 'sources') { av = a.sources_count || 0; bv = b.sources_count || 0; }
  else if (field === 'notes') { av = a.notes_count || 0; bv = b.notes_count || 0; }
  else { av = ''; bv = ''; }
  if (av < bv) return dir === 'asc' ? -1 : 1;
  if (av > bv) return dir === 'asc' ? 1 : -1;
  return 0;
}

function sortTree(nodes, dir) {
  return [...nodes]
    .sort((a, b) => {
      const av = (a.label || '').toLowerCase();
      const bv = (b.label || '').toLowerCase();
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    })
    .map((n) => ({ ...n, children: n.children ? sortTree(n.children, dir) : [] }));
}

// =====================================================================
// Styles
// =====================================================================

function CIdxStyles() {
  return (
    <style>{`
      .cidx {
        flex: 1;
        background: var(--paper);
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .cidx-header {
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
      .cidx-title {
        font-family: var(--font-display);
        font-size: 36px;
        font-weight: 600;
        color: var(--concept);
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 0;
      }

      /* Concept-themed accents — small navy touches throughout the index */
      .cidx .sp-action-primary {
        background: var(--concept);
        border-color: var(--concept);
      }
      .cidx .sp-action-primary:hover:not(:disabled) {
        background: var(--concept-2);
        border-color: var(--concept-2);
      }
      .cidx .sp-checkbox:checked,
      .cidx .sp-checkbox:indeterminate {
        background: var(--concept);
        border-color: var(--concept);
      }
      .cidx .cidx-radio { accent-color: var(--concept); }
      .cidx-subtitle {
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink-3);
        margin: 6px 0 0;
      }
      .cidx-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .cidx-plus { font-family: var(--font-mono); font-weight: 500; }

      .cidx-body {
        max-width: 1440px;
        margin: 0 auto;
        width: 100%;
        padding: 0 24px 64px;
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 32px;
      }

      .cidx-sidebar {
        position: sticky;
        top: 88px;
        align-self: start;
        max-height: calc(100vh - 100px);
        overflow-y: auto;
      }
      .cidx-mobile-toggle { display: none; }
      .cidx-sidebar-body { display: block; }
      .cidx-filter-section { margin-bottom: 28px; }
      .cidx-filter-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      .cidx-filter-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .cidx-filter-body { display: flex; flex-direction: column; gap: 1px; }

      .cidx-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 8px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        border-radius: var(--r-sm);
      }
      .cidx-row:hover { background: var(--hover); color: var(--ink); }
      .cidx-radio {
        width: 14px;
        height: 14px;
        accent-color: var(--ink);
        margin: 0;
        flex-shrink: 0;
      }
      .cidx-row-label { flex: 1; }
      .cidx-row-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .cidx-clear {
        margin-top: 6px;
        background: transparent;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 5px 10px;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        cursor: pointer;
        align-self: flex-start;
      }
      .cidx-clear:hover { background: var(--hover); color: var(--ink); }

      .cidx-main { min-width: 0; }

      .cidx-toolbar {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 16px;
      }
      .cidx-search {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 34px;
        padding: 0 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        color: var(--ink-3);
        max-width: 360px;
        transition: border-color var(--transition-fast);
      }
      .cidx-search:focus-within { border-color: var(--ink-2); color: var(--ink); }
      .cidx-search-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink);
        min-width: 0;
      }
      .cidx-search-input::placeholder { color: var(--ink-3); }
      .cidx-result-count {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        margin-left: auto;
      }

      .cidx-message {
        padding: 64px 24px;
        text-align: center;
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-3);
      }
      .cidx-message-error { color: var(--error); }

      .cidx-empty {
        max-width: 540px;
        margin: 48px auto;
        text-align: center;
        padding: 32px 24px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
      }
      .cidx-empty-title {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--ink);
        margin: 0 0 8px;
      }
      .cidx-empty-text {
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-2);
        line-height: 1.6;
        margin: 0 0 20px;
      }
      .cidx-empty-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }

      .cidx-table-wrap {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        overflow: hidden;
      }
      .cidx-table {
        width: 100%;
        border-collapse: collapse;
        font-family: var(--font-body);
        font-size: 13px;
      }
      .cidx-table thead { background: var(--paper-soft); }
      .cidx-th {
        text-align: left;
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 11px 16px;
        border-bottom: 1px solid var(--ink-line);
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
      }
      .cidx-th-num { text-align: right; }
      .cidx-th:hover { color: var(--ink); }
      .cidx-th.is-active { color: var(--ink); }
      .cidx-th-arrow {
        font-size: 9px;
        margin-left: 4px;
        color: var(--concept);
      }
      .cidx-table tbody tr {
        border-top: 1px solid var(--ink-line-soft);
      }
      .cidx-table tbody tr:hover { background: var(--paper-soft); }
      .cidx-table td {
        padding: 10px 16px;
        vertical-align: middle;
        line-height: 1.5;
      }
      .cidx-td-concept { max-width: 480px; }
      .cidx-concept-cell {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .cidx-tree-indent {
        color: var(--ink-4);
        font-family: var(--font-mono);
        font-size: 12px;
        flex-shrink: 0;
      }
      .cidx-concept-link {
        font-family: var(--font-body);
        font-weight: 500;
        color: var(--ink);
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: color var(--transition-fast), border-color var(--transition-fast);
      }
      .cidx-concept-link:hover {
        color: var(--concept-2);
        border-color: var(--concept);
      }

      .cidx-type-chip {
        display: inline-block;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--concept-2);
        background: var(--concept-tint);
        padding: 2px 8px;
        border-radius: var(--r-sm);
        white-space: nowrap;
        text-transform: capitalize;
      }

      .cidx-td-num {
        text-align: right;
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--ink-2);
        font-variant-numeric: tabular-nums;
        width: 1%;
        white-space: nowrap;
      }

      .cidx-td-origin { width: 1%; white-space: nowrap; }
      .cidx-pack-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-2);
        background: var(--paper-warm);
        padding: 2px 10px 2px 8px;
        border-radius: var(--r-sm);
        text-decoration: none;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .cidx-pack-pill:hover { background: var(--paper); border: 1px solid var(--ink-line); padding: 1px 9px 1px 7px; }
      .cidx-pack-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ink-3);
        flex-shrink: 0;
      }

      .cidx-muted { color: var(--ink-4); }

      @media (max-width: 900px) {
        .cidx-body { grid-template-columns: 1fr; }
        .cidx-sidebar {
          position: static;
          max-height: none;
          padding: 0;
          background: var(--paper);
          border: 1px solid var(--ink-line);
          border-radius: var(--r-md);
          margin-bottom: 16px;
          overflow: hidden;
        }
        .cidx-mobile-toggle {
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
        .cidx-sidebar.is-open .cidx-mobile-toggle { border-bottom: 1px solid var(--ink-line); }
        .cidx-mobile-toggle:hover { background: var(--paper-soft); }
        .cidx-mobile-toggle-label { flex: 1; }
        .cidx-mobile-toggle-count {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          color: var(--concept-2);
          background: var(--concept-tint);
          padding: 2px 8px;
          border-radius: var(--r-sm);
        }
        .cidx-mobile-toggle-caret {
          display: inline-flex;
          align-items: center;
          color: var(--ink-3);
          transition: transform 0.15s;
        }
        .cidx-sidebar.is-collapsed .cidx-mobile-toggle-caret { transform: rotate(-90deg); }
        .cidx-sidebar.is-collapsed .cidx-sidebar-body { display: none; }
        .cidx-sidebar-body { padding: 16px; }
      }
      @media (max-width: 600px) {
        .cidx-header { padding: 20px 16px 12px; }
        .cidx-body { padding: 0 16px 48px; gap: 16px; }
        .cidx-title { font-size: 28px; }
        .cidx-table td, .cidx-th { padding: 9px 12px; }
        .cidx-result-count { display: none; }
      }
    `}</style>
  );
}
