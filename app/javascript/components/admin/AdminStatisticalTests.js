import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import AdminPageHeader from './AdminPageHeader';

const primaryButton = {
  background: 'var(--admin-brown-dark)',
  color: 'white',
  border: 'none',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font-body)',
  fontWeight: 500,
  fontSize: 'var(--text-sm)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
};

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
};

const tdStyle = {
  padding: 'var(--space-3)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-sm)',
  color: 'var(--ink)',
  borderBottom: '1px solid var(--ink-line-soft)',
  verticalAlign: 'top',
};

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
      <AdminPageHeader
        title="Statistical Tests"
        subtitle="The catalog of statistical tests sources can be tagged with."
        actions={
          <a href="/admin/stats/new" style={primaryButton}>
            <i className="fas fa-plus" style={{ fontSize: 'var(--text-xs)' }} />
            New test
          </a>
        }
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))' }}>
        {error && (
          <div style={{ padding: 'var(--space-3)', background: 'var(--error)', color: 'white', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 'var(--space-4)', maxWidth: 420 }}>
          <input
            type="search"
            placeholder="Search by name, alias, or goal…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />
        </div>

        {loading && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
            Loading…
          </div>
        )}

        {!loading && tests.length === 0 && (
          <div style={{ background: 'var(--paper-soft)', padding: 'var(--space-6)', borderRadius: 'var(--radius)', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
            No tests yet.{' '}
            <a href="/admin/stats/new" style={{ color: 'var(--admin-brown-dark)', fontWeight: 600 }}>Create the first one</a>.
          </div>
        )}

        {!loading && tests.length > 0 && filtered.length === 0 && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
            No tests match "{search}".
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ background: 'white', border: '1px solid var(--ink-line)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Goal</th>
                  <th style={thStyle}>Variable Relationship</th>
                  <th style={thStyle}>Repeated Obs.</th>
                  <th style={thStyle}>Complexity</th>
                  <th style={{ ...thStyle, width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
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
                    <td style={tdStyle}>{(t.goal || []).join(', ') || <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                    <td style={tdStyle}>{t.variable_relationship_structure || <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                    <td style={tdStyle}>{t.repeated_observations_present || <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                    <td style={tdStyle}>{t.complexity_level_allowed || <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <a href={`/admin/stats/${t.id}/edit`} style={{ color: 'var(--admin-brown-dark)', fontWeight: 600, textDecoration: 'none', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Edit
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
