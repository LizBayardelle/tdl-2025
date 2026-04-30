import React, { useEffect, useMemo, useState } from 'react';

// =====================================================================
// StatsCatalog — public reference of every statistical test in the
// catalog. Search, Goal filter, sortable columns. Each row links to
// /stats/:slug for the full detail view.
// =====================================================================

const GOALS_ORDER = [
  'Compare Groups', 'Test Association', 'Predict Outcome', 'Model Change Over Time',
  'Test Mediation', 'Test Moderation', 'Analyze Survival / Time-to-Event',
  'Reduce Dimensions', 'Identify Latent Structure', 'Classify Cases',
  'Assess Agreement', 'Test Frequencies Against Expected Values',
];

const inputStyle = {
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--ink-line)',
  borderRadius: 'var(--radius)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-body)',
  boxSizing: 'border-box',
  background: 'white',
};

const thStyle = {
  textAlign: 'left',
  padding: 'var(--space-2) var(--space-3)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  color: 'var(--ink-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--ink-line)',
  background: 'var(--paper-soft)',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: 'var(--space-3)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-sm)',
  color: 'var(--ink)',
  borderBottom: '1px solid var(--ink-line-soft)',
  verticalAlign: 'top',
};

const dim = (v) => v ? v : <span style={{ color: 'var(--ink-4)' }}>—</span>;

export default function StatsCatalog() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [goalFilter, setGoalFilter] = useState([]);
  const [sortField, setSortField] = useState('position');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    let cancelled = false;
    fetch('/stats.json', { headers: { Accept: 'application/json' } })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load catalog');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setTests(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || 'Failed to load catalog');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const goalsInUse = useMemo(() => {
    const seen = new Set();
    tests.forEach(t => (t.goal || []).forEach(g => seen.add(g)));
    return GOALS_ORDER.filter(g => seen.has(g));
  }, [tests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tests.filter((t) => {
      if (q) {
        const inName = t.name?.toLowerCase().includes(q);
        const inAlias = (t.aliases || []).some(a => a.toLowerCase().includes(q));
        const inDesc = (t.description || '').toLowerCase().includes(q);
        if (!inName && !inAlias && !inDesc) return false;
      }
      if (goalFilter.length > 0) {
        const goals = t.goal || [];
        if (!goalFilter.some(g => goals.includes(g))) return false;
      }
      return true;
    });
  }, [tests, search, goalFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      const cmp = (() => {
        if (Array.isArray(av) && Array.isArray(bv)) return (av[0] || '').localeCompare(bv[0] || '');
        if (typeof av === 'number' && typeof bv === 'number') return av - bv;
        return String(av || '').localeCompare(String(bv || ''));
      })();
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const setSort = (field) => {
    if (field === sortField) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleGoal = (g) => {
    setGoalFilter(goalFilter.includes(g) ? goalFilter.filter(x => x !== g) : [...goalFilter, g]);
  };

  const clearFilters = () => {
    setSearch('');
    setGoalFilter([]);
  };

  const sortIndicator = (field) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div style={{ padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))', maxWidth: 1280, margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          color: 'var(--ink)',
          letterSpacing: '-0.015em',
          marginTop: 0,
          marginBottom: 'var(--space-2)',
        }}>
          Statistical Tests
        </h1>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-md)',
          color: 'var(--ink-3)',
          margin: 0,
        }}>
          A reference catalog of statistical tests with their design assumptions, sample structure, and primary outputs.
        </p>
      </header>

      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--error)', color: 'white', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ flex: '1 1 280px', maxWidth: 420 }}>
          <input
            type="search"
            placeholder="Search by name, alias, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
          {loading ? 'Loading…' : `${sorted.length} of ${tests.length} tests`}
        </div>
        {(search || goalFilter.length > 0) && (
          <button
            type="button"
            onClick={clearFilters}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-3)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              textDecoration: 'underline',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {goalsInUse.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            alignSelf: 'center',
            marginRight: 'var(--space-2)',
          }}>
            Goal:
          </span>
          {goalsInUse.map((g) => {
            const active = goalFilter.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGoal(g)}
                style={{
                  background: active ? 'var(--ink)' : 'white',
                  color: active ? 'white' : 'var(--ink-2)',
                  border: `1px solid ${active ? 'var(--ink)' : 'var(--ink-line)'}`,
                  padding: '4px var(--space-3)',
                  borderRadius: 'var(--r-pill)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-xs)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {g}
              </button>
            );
          })}
        </div>
      )}

      {!loading && tests.length === 0 && !error && (
        <div style={{ background: 'var(--paper-soft)', padding: 'var(--space-6)', borderRadius: 'var(--radius)', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
          The catalog is empty.
        </div>
      )}

      {!loading && tests.length > 0 && sorted.length === 0 && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--ink-3)', padding: 'var(--space-4)' }}>
          No tests match the current filters.
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div style={{
          background: 'white',
          border: '1px solid var(--ink-line)',
          borderRadius: 'var(--radius)',
          overflowX: 'auto',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => setSort('name')}>Name{sortIndicator('name')}</th>
                <th style={thStyle}>Goal</th>
                <th style={thStyle} onClick={() => setSort('primary_variable_1_type')}>Outcome Type{sortIndicator('primary_variable_1_type')}</th>
                <th style={thStyle} onClick={() => setSort('sample_relationship')}>Sample Relationship{sortIndicator('sample_relationship')}</th>
                <th style={thStyle} onClick={() => setSort('repeated_observations_present')}>Repeated Obs.{sortIndicator('repeated_observations_present')}</th>
                <th style={thStyle} onClick={() => setSort('analysis_scope')}>Scope{sortIndicator('analysis_scope')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} style={{ transition: 'background 0.12s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--paper-soft)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={tdStyle}>
                    <a href={`/stats/${t.slug}`} style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' }}>
                      {t.name}
                    </a>
                    {(t.aliases || []).length > 0 && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', marginTop: 2 }}>
                        aka {t.aliases.join(', ')}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>{dim((t.goal || []).join(', '))}</td>
                  <td style={tdStyle}>{dim(t.primary_variable_1_type)}</td>
                  <td style={tdStyle}>{dim(t.sample_relationship)}</td>
                  <td style={tdStyle}>{dim(t.repeated_observations_present)}</td>
                  <td style={tdStyle}>{dim(t.analysis_scope)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
