import React, { useState, useEffect, useMemo } from 'react';
import PersonFormModal from './PersonFormModal';
import Toggle from './ui/Toggle';
import { toTitleCase } from '../utils/titleCase';

// =====================================================================
// PeopleIndex
// Library view of every Person the user owns: name, role, sources count,
// concepts they touch, ORCID, tags.  Teal accents — the third category
// color alongside Concept-navy and Source-blue.
// =====================================================================

const SORT_OPTIONS = [
  { value: 'name-asc',          label: 'Name (A–Z)' },
  { value: 'name-desc',         label: 'Name (Z–A)' },
  { value: 'sources_count-desc',label: 'Most Sources' },
  { value: 'sources_count-asc', label: 'Fewest Sources' },
  { value: 'created_at-desc',   label: 'Recently Added' },
];

export default function PeopleIndex() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);

  const [textFilter, setTextFilter] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedConceptIds, setSelectedConceptIds] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState([]);
  const [hasOrcidOnly, setHasOrcidOnly] = useState(false);

  const [sort, setSort] = useState('name-asc');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => { fetchPeople(); }, []);

  const fetchPeople = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/people.json');
      if (!r.ok) throw new Error(`Load failed (${r.status})`);
      setPeople(await r.json());
    } catch (e) {
      console.error(e);
      setError('We could not load your people.  Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Facet metadata (computed from full set, not filtered) ----
  const roleCounts = useMemo(() => {
    const counts = {};
    people.forEach(p => {
      const r = (p.role || '').trim();
      if (!r) return;
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [people]);

  // Concept facet covers concepts each person touches via authored work, not
  // only direct PersonConcept links.  Backend hydrates `effective_concepts`
  // per person with id+label objects; the union becomes the facet list.
  const allConcepts = useMemo(() => {
    const map = new Map();
    people.forEach(p => {
      const seen = new Set();
      (p.effective_concepts || p.concepts || []).forEach(c => {
        if (seen.has(c.id)) return;
        seen.add(c.id);
        const existing = map.get(c.id);
        if (existing) existing.count += 1;
        else map.set(c.id, { id: c.id, label: c.label, count: 1 });
      });
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [people]);

  // Tag and collection facets cover effective reach (direct + via authored
  // sources), so a researcher whose papers carry a tag still surfaces under
  // that tag — same logic as concepts.
  const allTags = useMemo(() => {
    const counts = new Map();
    people.forEach(p => {
      const seen = new Set();
      (p.effective_tag_names || p.tags || []).forEach(t => {
        if (seen.has(t)) return;
        seen.add(t);
        counts.set(t, (counts.get(t) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);

  const allCollections = useMemo(() => {
    const map = new Map();
    people.forEach(p => {
      const seen = new Set();
      (p.effective_collections || p.collections || []).forEach(c => {
        if (seen.has(c.id)) return;
        seen.add(c.id);
        const existing = map.get(c.id);
        if (existing) existing.count += 1;
        else map.set(c.id, { id: c.id, name: c.name, count: 1 });
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);

  const orcidCount = useMemo(() => people.filter(p => p.orcid).length, [people]);

  // ---- Apply filters ----
  const filtered = useMemo(() => {
    return people.filter(p => {
      if (hasOrcidOnly && !p.orcid) return false;
      if (selectedRoles.length > 0 && !selectedRoles.includes((p.role || '').trim())) return false;
      if (selectedConceptIds.length > 0) {
        // Match against effective concepts (direct + via authored sources).
        const reach = new Set(p.effective_concept_ids || (p.concepts || []).map(c => c.id));
        if (!selectedConceptIds.some(id => reach.has(id))) return false;
      }
      if (selectedTags.length > 0) {
        const reach = p.effective_tag_names || p.tags || [];
        if (!selectedTags.some(t => reach.includes(t))) return false;
      }
      if (selectedCollectionIds.length > 0) {
        const reach = new Set(
          (p.effective_collection_ids
            || (p.collections || []).map(c => c.id))
        );
        if (!selectedCollectionIds.some(id => reach.has(id))) return false;
      }
      if (textFilter.trim()) {
        const q = textFilter.toLowerCase();
        const haystack = [
          p.full_name, p.first_name, p.last_name, p.orcid,
          ...(p.aka || []),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [people, hasOrcidOnly, selectedRoles, selectedConceptIds, selectedTags, selectedCollectionIds, textFilter]);

  // ---- Sort ----
  const sorted = useMemo(() => {
    const [field, dir] = sort.split('-');
    const mult = dir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      let av, bv;
      switch (field) {
        case 'sources_count':
          av = a.sources_count || 0; bv = b.sources_count || 0; break;
        case 'created_at':
          av = a.created_at || ''; bv = b.created_at || ''; break;
        case 'name':
        default:
          av = (a.last_name || a.full_name || '').toLowerCase();
          bv = (b.last_name || b.full_name || '').toLowerCase();
          break;
      }
      if (av < bv) return -1 * mult;
      if (av > bv) return 1 * mult;
      return 0;
    });
  }, [filtered, sort]);

  // ---- Filter mutators ----
  const toggleInArray = (setter, current, value) => {
    setter(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  };
  const clearAll = () => {
    setHasOrcidOnly(false);
    setSelectedRoles([]);
    setSelectedConceptIds([]);
    setSelectedTags([]);
    setSelectedCollectionIds([]);
    setTextFilter('');
  };

  const activeFilterCount =
    selectedRoles.length + selectedConceptIds.length + selectedTags.length +
    selectedCollectionIds.length + (hasOrcidOnly ? 1 : 0);

  return (
    <div className="pix">
      <PixStyles />

      <header className="pix-header">
        <div>
          <h1 className="pix-title">People</h1>
          <p className="pix-subtitle">
            {loading
              ? 'Loading.'
              : <>{people.length} person{people.length === 1 ? '' : 's'}{filtered.length !== people.length && <> · {filtered.length} shown</>}</>}
            {activeFilterCount > 0 && (
              <> · <button type="button" className="pix-link" onClick={clearAll}>Clear {activeFilterCount} Filter{activeFilterCount === 1 ? '' : 's'}</button></>
            )}
          </p>
        </div>
        <div className="pix-header-actions">
          <button
            type="button"
            className="sp-action sp-action-primary"
            onClick={() => { setEditingPerson(null); setShowForm(true); }}
          >
            <span className="pix-plus" aria-hidden="true">+</span> Person
          </button>
        </div>
      </header>

      <div className="pix-body">
        <aside className={`pix-sidebar ${mobileFiltersOpen ? 'is-open' : 'is-collapsed'}`}>
          <button
            type="button"
            className="pix-mobile-toggle"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            aria-expanded={mobileFiltersOpen}
          >
            <span className="pix-mobile-toggle-label">Filters</span>
            {activeFilterCount > 0 && (
              <span className="pix-mobile-toggle-count">{activeFilterCount} active</span>
            )}
            <span className="pix-mobile-toggle-caret" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5l3 3 3-3" />
              </svg>
            </span>
          </button>

          <div className="pix-sidebar-body">
            <FilterSection label="Quick">
              <div className="pix-quick-toggles">
                <Toggle
                  checked={hasOrcidOnly}
                  onChange={() => setHasOrcidOnly(v => !v)}
                  label="Has ORCID"
                  count={orcidCount}
                />
              </div>
            </FilterSection>

            <FilterSection label="Role">
              {Object.keys(roleCounts).length === 0 ? (
                <p className="pix-filter-empty">No roles yet.</p>
              ) : (
                Object.entries(roleCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([role, count]) => (
                    <CheckboxRow
                      key={role}
                      checked={selectedRoles.includes(role)}
                      onChange={() => toggleInArray(setSelectedRoles, selectedRoles, role)}
                      label={toTitleCase(role)}
                      count={count}
                    />
                  ))
              )}
            </FilterSection>

            <FacetSection
              label="Concepts"
              noun="concepts"
              items={allConcepts.map(c => ({ id: c.id, label: c.label, count: c.count }))}
              selected={new Set(selectedConceptIds)}
              onToggle={(id) => toggleInArray(setSelectedConceptIds, selectedConceptIds, id)}
            />

            {allTags.length > 0 && (
              <FilterSection label="Tags">
                <FacetSearchList
                  noun="tags"
                  items={allTags.map(t => ({ id: t.name, label: t.name, count: t.count }))}
                  selectedSet={new Set(selectedTags)}
                  onToggle={(t) => toggleInArray(setSelectedTags, selectedTags, t)}
                />
              </FilterSection>
            )}

            {allCollections.length > 0 && (
              <FacetSection
                label="Collections"
                noun="collections"
                items={allCollections.map(c => ({ id: c.id, label: c.name, count: c.count }))}
                selected={new Set(selectedCollectionIds)}
                onToggle={(id) => toggleInArray(setSelectedCollectionIds, selectedCollectionIds, id)}
              />
            )}

            {activeFilterCount > 0 && (
              <button type="button" className="pix-clear-all" onClick={clearAll}>
                Clear All Filters
              </button>
            )}
          </div>
        </aside>

        <main className="pix-main">
          <div className="pix-toolbar">
            <div className="pix-search">
              <SearchIcon />
              <input
                type="text"
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                placeholder="Search by name, ORCID, alias."
                className="pix-search-input"
              />
              {textFilter && (
                <button type="button" className="pix-search-clear" onClick={() => setTextFilter('')} aria-label="Clear search">×</button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="pix-sort"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="pix-message pix-message-error">{error}</div>
          ) : loading ? (
            <div className="pix-message">Loading.</div>
          ) : sorted.length === 0 ? (
            <EmptyState
              hasFilters={activeFilterCount > 0 || !!textFilter}
              onClear={clearAll}
              onCreate={() => { setEditingPerson(null); setShowForm(true); }}
            />
          ) : (
            <div className="pix-list">
              {sorted.map(p => (
                <PersonRow
                  key={p.id}
                  person={p}
                  onEdit={() => { setEditingPerson(p); setShowForm(true); }}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <PersonFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingPerson(null); fetchPeople(); }}
        onSuccess={() => { setShowForm(false); setEditingPerson(null); fetchPeople(); }}
        item={editingPerson}
      />
    </div>
  );
}

// =====================================================================
// Subcomponents
// =====================================================================
function FilterSection({ label, trailing, children }) {
  return (
    <div className="pix-filter-section">
      <div className="pix-filter-head">
        <span className="pix-filter-label">{label}</span>
        {trailing}
      </div>
      <div className="pix-filter-body">{children}</div>
    </div>
  );
}

function CheckboxRow({ checked, onChange, label, count }) {
  return (
    <label className="pix-row">
      <input type="checkbox" checked={checked} onChange={onChange} className="sp-checkbox" />
      <span className="pix-row-label">{label}</span>
      {count != null && <span className="pix-row-count">{count}</span>}
    </label>
  );
}

function FacetSection({ label, items, selected, onToggle, noun }) {
  if (!items || items.length === 0) return null;
  return (
    <FilterSection label={label}>
      <FacetSearchList
        items={items}
        selectedSet={selected}
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
          className="pix-facet-search"
        />
      )}
      <div className="pix-facet-list">
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
          <p className="pix-filter-note">Showing first 50.  Refine search.</p>
        )}
      </div>
    </>
  );
}

function PersonRow({ person, onEdit }) {
  const role = (person.role || '').trim();
  // Clicking anywhere on the card navigates to the profile, except when the
  // click lands on an inner link/button/chip that has its own behavior.
  const handleCardClick = (e) => {
    if (e.target.closest('a, button')) return;
    window.location.href = `/people/${person.id}`;
  };

  return (
    <article className="pix-row-card pix-row-clickable" onClick={handleCardClick}>
      <div className="pix-row-main">
        <div className="pix-row-headline">
          <a href={`/people/${person.id}`} className="pix-row-title">{toTitleCase(person.full_name)}</a>
          {person.orcid && (
            <a
              href={`https://orcid.org/${person.orcid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pix-orcid"
              title="View ORCID profile"
            >
              ORCID
            </a>
          )}
        </div>

        <div className="pix-row-meta">
          {role && <span className="pix-row-role">{toTitleCase(role)}</span>}
          {person.affiliation && (
            <span className="pix-row-affiliation">{person.affiliation}</span>
          )}
          {person.sources_count > 0 && (
            <span className="pix-mini-stat">
              {person.sources_count} source{person.sources_count === 1 ? '' : 's'}
            </span>
          )}
          {person.notes_count > 0 && (
            <span className="pix-mini-stat">
              {person.notes_count} note{person.notes_count === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {((person.concepts && person.concepts.length > 0) ||
          (person.tags && person.tags.length > 0) ||
          (person.collections && person.collections.length > 0)) && (
          <div className="pix-row-tags">
            {person.concepts?.slice(0, 4).map(c => (
              <a key={c.id} href={`/concepts/${c.id}`} className="pix-concept-chip">{toTitleCase(c.label)}</a>
            ))}
            {person.concepts?.length > 4 && (
              <span className="pix-mini-stat">+{person.concepts.length - 4}</span>
            )}
            {person.tags?.slice(0, 3).map(t => (
              <span key={t} className="pix-tag-chip">{t}</span>
            ))}
            {person.collections?.map(c => (
              <a key={c.id} href={`/collections/${c.id}`} className="pix-collection-chip">{c.name}</a>
            ))}
          </div>
        )}
      </div>

      <aside className="pix-row-side">
        <button type="button" className="pix-row-action" onClick={onEdit}>
          <EditIcon /> Edit Person
        </button>
      </aside>
    </article>
  );
}

function EmptyState({ hasFilters, onClear, onCreate }) {
  if (hasFilters) {
    return (
      <div className="pix-empty">
        <h2 className="pix-empty-title">No Matches</h2>
        <p className="pix-empty-text">Adjust the filters or search and try again.</p>
        <div className="pix-empty-actions">
          <button type="button" className="sp-action sp-action-secondary" onClick={onClear}>Clear Filters</button>
        </div>
      </div>
    );
  }
  return (
    <div className="pix-empty">
      <h2 className="pix-empty-title">No People Yet</h2>
      <p className="pix-empty-text">
        People show up here automatically when sources are added with author info.
        You can also create them by hand for collaborators or correspondents.
      </p>
      <div className="pix-empty-actions">
        <button type="button" className="sp-action sp-action-primary" onClick={onCreate}>
          <span className="pix-plus">+</span> First Person
        </button>
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
function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M11 2.5l2.5 2.5L6 12.5H3.5V10L11 2.5z" strokeLinejoin="round" />
    </svg>
  );
}

// =====================================================================
// Styles
// =====================================================================
function PixStyles() {
  return (
    <style>{`
      .pix {
        flex: 1;
        background: var(--paper);
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .pix-header {
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
      .pix-title {
        font-family: var(--font-display);
        font-size: 36px;
        font-weight: 600;
        color: var(--person);
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 0;
      }
      .pix-subtitle {
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink-3);
        margin: 6px 0 0;
      }
      .pix-link {
        background: none;
        border: none;
        padding: 0;
        color: var(--person-2);
        cursor: pointer;
        font: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .pix-link:hover { color: var(--person); }
      .pix-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .pix-plus { font-family: var(--font-mono); font-weight: 500; }

      /* Teal accents on action primary + checkboxes */
      .pix .sp-action-primary {
        background: var(--person);
        border-color: var(--person);
      }
      .pix .sp-action-primary:hover:not(:disabled) {
        background: var(--person-2);
        border-color: var(--person-2);
      }
      .pix .sp-checkbox:checked,
      .pix .sp-checkbox:indeterminate {
        background: var(--person);
        border-color: var(--person);
      }

      .pix-body {
        max-width: 1440px;
        margin: 0 auto;
        width: 100%;
        padding: 0 24px 64px;
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr);
        gap: 32px;
      }

      .pix-sidebar {
        position: sticky;
        top: 88px;
        align-self: start;
        max-height: calc(100vh - 100px);
        overflow-y: auto;
      }
      .pix-mobile-toggle { display: none; }
      .pix-sidebar-body { display: block; }

      .pix-filter-section { margin-bottom: 24px; }
      /* Teal tint for ON-state toggles on this page */
      .pix-quick-toggles { --toggle-on: var(--person); display: flex; flex-direction: column; gap: 1px; }
      .pix-filter-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      .pix-filter-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .pix-filter-body { display: flex; flex-direction: column; gap: 1px; }
      .pix-filter-empty {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-4);
        margin: 0;
        padding: 4px 8px;
      }
      .pix-filter-note {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-4);
        margin: 4px 0 0;
        padding: 0 8px;
      }
      .pix-row {
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
      .pix-row:hover { background: var(--hover); color: var(--ink); }
      .pix-row-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pix-row-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .pix-facet-search {
        width: 100%;
        height: 28px;
        padding: 0 8px;
        margin-bottom: 6px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink);
      }
      .pix-facet-search:focus { outline: none; border-color: var(--person); }
      /* Bordered, slightly inset container — makes it visually obvious that
         the list is scrollable when it overflows.  The inset bottom shadow
         hints at content below the fold. */
      .pix-facet-list {
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
      .pix-facet-list::-webkit-scrollbar { width: 8px; }
      .pix-facet-list::-webkit-scrollbar-track { background: transparent; }
      .pix-facet-list::-webkit-scrollbar-thumb {
        background: var(--ink-line);
        border-radius: 4px;
      }
      .pix-facet-list::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }

      .pix-clear-all {
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
      .pix-clear-all:hover { background: var(--hover); color: var(--ink); }

      /* Main */
      .pix-main { min-width: 0; }
      .pix-toolbar {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 16px;
      }
      .pix-search {
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
      .pix-search:focus-within { border-color: var(--person); color: var(--ink); }
      .pix-search-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink);
        min-width: 0;
      }
      .pix-search-input::placeholder { color: var(--ink-3); }
      .pix-search-clear {
        background: none;
        border: none;
        color: var(--ink-3);
        font-size: 18px;
        line-height: 1;
        padding: 0 4px;
        cursor: pointer;
      }
      .pix-search-clear:hover { color: var(--ink); }
      .pix-sort {
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
      .pix-sort:focus { outline: none; border-color: var(--person); }

      .pix-message {
        padding: 64px 24px;
        text-align: center;
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-3);
      }
      .pix-message-error { color: var(--error); }

      .pix-empty {
        max-width: 540px;
        margin: 48px auto;
        text-align: center;
        padding: 32px 24px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
      }
      .pix-empty-title {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--ink);
        margin: 0 0 8px;
      }
      .pix-empty-text {
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-2);
        line-height: 1.6;
        margin: 0 0 20px;
      }
      .pix-empty-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }

      /* Person rows */
      .pix-list { display: flex; flex-direction: column; gap: 10px; }
      .pix-row-card {
        display: flex;
        gap: 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 14px 16px;
        transition: border-color var(--transition-fast);
      }
      .pix-row-card:hover {
        border-color: color-mix(in srgb, var(--person) 50%, var(--ink-line));
      }
      .pix-row-clickable { cursor: pointer; }
      .pix-row-main { flex: 1; min-width: 0; }
      .pix-row-headline {
        display: flex;
        align-items: baseline;
        gap: 10px;
        flex-wrap: wrap;
      }
      .pix-row-title {
        font-family: var(--font-display);
        font-size: 15.5px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.35;
        text-decoration: none;
      }
      .pix-row-title:hover { color: var(--person-2); }
      .pix-orcid {
        font-family: var(--font-mono);
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: 0.04em;
        background: var(--person-tint);
        color: var(--person-2);
        padding: 1px 6px;
        border-radius: var(--r-sm);
        text-decoration: none;
      }
      .pix-orcid:hover {
        background: color-mix(in srgb, var(--person-tint) 60%, var(--person) 40%);
        color: var(--paper);
      }

      .pix-row-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        margin-top: 6px;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        align-items: baseline;
      }
      .pix-row-role {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--person-2);
        font-weight: 600;
      }
      .pix-row-affiliation {
        font-size: 12.5px;
        color: var(--ink-2);
      }
      .pix-mini-stat {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
      }

      .pix-row-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 6px;
        margin-top: 8px;
        align-items: center;
      }
      .pix-concept-chip {
        display: inline-block;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--concept-2);
        background: var(--concept-tint);
        padding: 1px 8px;
        border-radius: var(--r-sm);
        text-decoration: none;
      }
      .pix-concept-chip:hover { background: color-mix(in srgb, var(--concept-tint) 70%, var(--concept) 30%); }
      .pix-tag-chip {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        background: var(--paper-soft);
        padding: 1px 8px;
        border-radius: var(--r-sm);
      }
      .pix-collection-chip {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-2);
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        padding: 1px 8px;
        border-radius: var(--r-sm);
        text-decoration: none;
      }
      .pix-collection-chip:hover { background: var(--hover); color: var(--ink); }

      /* Right-side action column */
      .pix-row-side {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex-shrink: 0;
        padding-left: 14px;
        margin-left: 8px;
        border-left: 1px solid var(--ink-line-soft);
        align-self: stretch;
        justify-content: center;
      }
      .pix-row-action {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 5px 10px;
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 500;
        color: var(--ink-3);
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        cursor: pointer;
        text-decoration: none;
        white-space: nowrap;
        transition: background 0.12s, color 0.12s;
      }
      .pix-row-action:hover {
        background: var(--person-tint);
        color: var(--person-2);
      }

      /* Responsive */
      @media (max-width: 900px) {
        .pix-body { grid-template-columns: 1fr; }
        .pix-sidebar {
          position: static;
          max-height: none;
          padding: 0;
          background: var(--paper);
          border: 1px solid var(--ink-line);
          border-radius: var(--r-md);
          margin-bottom: 16px;
          overflow: hidden;
        }
        .pix-mobile-toggle {
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
        .pix-sidebar.is-open .pix-mobile-toggle { border-bottom: 1px solid var(--ink-line); }
        .pix-mobile-toggle:hover { background: var(--paper-soft); }
        .pix-mobile-toggle-label { flex: 1; }
        .pix-mobile-toggle-count {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          color: var(--person-2);
          background: var(--person-tint);
          padding: 2px 8px;
          border-radius: var(--r-sm);
        }
        .pix-mobile-toggle-caret {
          display: inline-flex;
          align-items: center;
          color: var(--ink-3);
          transition: transform 0.15s;
        }
        .pix-sidebar.is-collapsed .pix-mobile-toggle-caret { transform: rotate(-90deg); }
        .pix-sidebar.is-collapsed .pix-sidebar-body { display: none; }
        .pix-sidebar-body { padding: 16px; }
      }
      @media (max-width: 600px) {
        .pix-header { padding: 20px 16px 12px; }
        .pix-body { padding: 0 16px 48px; gap: 16px; }
        .pix-title { font-size: 28px; }
        .pix-toolbar { flex-direction: column; align-items: stretch; }
        .pix-search { max-width: none; }
        .pix-row-card { flex-direction: column; gap: 12px; }
        .pix-row-side {
          flex-direction: row;
          flex-wrap: wrap;
          padding-left: 0;
          margin-left: 0;
          border-left: none;
          padding-top: 10px;
          border-top: 1px solid var(--ink-line-soft);
        }
      }
    `}</style>
  );
}
