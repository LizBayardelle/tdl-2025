import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';

export default function AdminStatisticalTests() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/admin/stats.json', { headers: { Accept: 'application/json' } })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load tests');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setTests(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || 'Failed to load tests');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) => {
      if (t.name?.toLowerCase().includes(q)) return true;
      if ((t.aliases || []).some((a) => a.toLowerCase().includes(q))) return true;
      if ((t.goal || []).some((g) => g.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [tests, search]);

  return (
    <AdminLayout currentPage="statistical_tests">
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-8) clamp(var(--space-4), 4vw, var(--space-8))',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <PageHero count={tests.length} />

          {error && <Banner tone="error">{error}</Banner>}

          <Toolbar
            search={search}
            onSearchChange={setSearch}
            filteredCount={filtered.length}
            totalCount={tests.length}
          />

          {loading && (
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-3)' }}>Loading.</p>
          )}

          {!loading && tests.length === 0 && (
            <EmptyState />
          )}

          {!loading && tests.length > 0 && filtered.length === 0 && (
            <div
              style={{
                padding: 'var(--space-6)',
                background: 'var(--paper-soft)',
                border: '1px dashed var(--ink-line)',
                borderRadius: 'var(--r-md)',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--ink-3)',
                textAlign: 'center',
              }}
            >
              No tests match "{search}".
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <TestsTable tests={filtered} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

// ---------- Hero ----------

function PageHero({ count }) {
  return (
    <header
      style={{
        marginBottom: 'var(--space-8)',
        paddingBottom: 'var(--space-7)',
        borderBottom: '1px solid var(--ink-line)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
            marginBottom: '12px',
          }}
        >
          Linchpin Industries · Map My Research
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '44px',
            fontWeight: 600,
            color: 'var(--primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          Statistical Tests
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: 'var(--ink-2)',
            lineHeight: 1.65,
            maxWidth: '680px',
            marginTop: '14px',
            marginBottom: 0,
          }}
        >
          The catalog of statistical tests sources can be tagged with.{' '}
          <span style={{ color: 'var(--ink-3)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {count.toLocaleString()}
            </span>{' '}
            in catalog.
          </span>
        </p>
      </div>
      <a href="/admin/stats/new" className="sp-action sp-action-primary">
        + New test
      </a>
    </header>
  );
}

// ---------- Toolbar ----------

function Toolbar({ search, onSearchChange, filteredCount }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '36px',
          padding: '0 12px',
          background: 'var(--paper)',
          border: '1px solid var(--ink-line)',
          borderRadius: 'var(--r-md)',
          color: 'var(--ink-3)',
          flex: '1 1 280px',
          maxWidth: '420px',
        }}
      >
        <i className="fas fa-magnifying-glass" style={{ fontSize: '12px' }}></i>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, alias, or goal."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--ink)',
            minWidth: 0,
          }}
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-3)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: 0,
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      <div
        style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          color: 'var(--ink-3)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {filteredCount.toLocaleString()} shown
      </div>
    </div>
  );
}

// ---------- Empty ----------

function EmptyState() {
  return (
    <div
      style={{
        background: 'var(--paper-soft)',
        border: '1px dashed var(--ink-line)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--space-8)',
        textAlign: 'center',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--primary)',
          marginTop: 0,
          marginBottom: '8px',
          letterSpacing: '-0.005em',
        }}
      >
        No tests yet
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          color: 'var(--ink-3)',
          marginTop: 0,
          marginBottom: 'var(--space-4)',
          lineHeight: 1.6,
        }}
      >
        The catalog is empty.  Add the first test to start tagging sources with statistical methods.
      </p>
      <a href="/admin/stats/new" className="sp-action sp-action-primary">
        + New test
      </a>
    </div>
  );
}

// ---------- Table ----------

function TestsTable({ tests }) {
  return (
    <div
      style={{
        border: '1px solid var(--ink-line)',
        borderRadius: 'var(--r-md)',
        overflowX: 'auto',
        overflowY: 'hidden',
        marginBottom: 'var(--space-6)',
      }}
    >
      <table className="sp-table" style={{ minWidth: '1080px' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Goal</th>
            <th>Variable Relationship</th>
            <th>Repeated Obs.</th>
            <th>Complexity</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((t) => (
            <TestRow key={t.id} test={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TestRow({ test }) {
  return (
    <tr>
      <td>
        <a href={`/stats/${test.slug}`} className="sp-link" style={{ fontWeight: 600 }}>
          {test.name}
        </a>
        {(test.aliases || []).length > 0 && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--ink-3)',
              marginTop: '3px',
              fontStyle: 'italic',
            }}
          >
            aka {test.aliases.join(', ')}
          </div>
        )}
      </td>
      <td style={{ color: 'var(--ink-2)' }}>
        <Cell value={(test.goal || []).join(', ')} />
      </td>
      <td style={{ color: 'var(--ink-2)' }}>
        <Cell value={test.variable_relationship_structure} />
      </td>
      <td style={{ color: 'var(--ink-2)' }}>
        <Cell value={test.repeated_observations_present} />
      </td>
      <td style={{ color: 'var(--ink-2)' }}>
        <Cell value={test.complexity_level_allowed} />
      </td>
      <td style={{ textAlign: 'right' }}>
        <a
          href={`/admin/stats/${test.id}/edit`}
          className="sp-action sp-action-quiet"
          style={{ height: '28px', padding: '0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Edit
        </a>
      </td>
    </tr>
  );
}

function Cell({ value }) {
  if (value == null || value === '') {
    return <span style={{ color: 'var(--ink-4)' }}>—</span>;
  }
  return <>{value}</>;
}

// ---------- Banner ----------

function Banner({ tone, children }) {
  const styles = tone === 'error'
    ? {
        background: 'rgba(122, 46, 46, 0.06)',
        color: 'var(--error)',
        border: '1px solid rgba(122, 46, 46, 0.20)',
      }
    : {
        background: 'var(--paper-soft)',
        color: 'var(--ink)',
        border: '1px solid var(--ink-line)',
        borderLeft: '3px solid var(--primary)',
      };
  return (
    <div
      style={{
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--r-md)',
        marginBottom: 'var(--space-4)',
        fontFamily: 'var(--font-body)',
        fontSize: '13.5px',
        ...styles,
      }}
    >
      {children}
    </div>
  );
}
