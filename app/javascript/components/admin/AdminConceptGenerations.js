import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import AdminPageHeader from './AdminPageHeader';

const STATUS_META = {
  pending: { label: 'Pending', color: 'var(--neutral-500)', bg: 'var(--neutral-100)' },
  generating: { label: 'Generating', color: 'var(--neutral-700)', bg: 'var(--neutral-200)' },
  fact_checking: { label: 'Fact-checking', color: 'var(--neutral-700)', bg: 'var(--neutral-200)' },
  enriching: { label: 'Enriching', color: 'var(--neutral-700)', bg: 'var(--neutral-200)' },
  ready_for_review: { label: 'Ready for Review', color: 'white', bg: 'var(--neutral-800)' },
  approved: { label: 'Approved', color: 'white', bg: '#2d6a3e' },
  rejected: { label: 'Rejected', color: 'white', bg: '#7a3030' },
  failed: { label: 'Failed', color: 'white', bg: 'var(--accent-red, #9c2a2a)' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'ready_for_review', label: 'Ready for Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'failed', label: 'Failed' },
];

function matchesFilter(gen, filter) {
  if (filter === 'all') return true;
  if (filter === 'in_progress') return ['pending', 'generating', 'fact_checking', 'enriching'].includes(gen.status);
  return gen.status === filter;
}

export default function AdminConceptGenerations() {
  const [generations, setGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/admin/concept_generations.json')
      .then((res) => res.json())
      .then((data) => {
        setGenerations(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load generations');
        setLoading(false);
      });
  }, []);

  const filtered = generations.filter((g) => matchesFilter(g, filter));

  const actions = (
    <a
      href="/admin/concept_generations/new"
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'white',
        color: 'var(--neutral-900)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--text-xl)',
        transition: 'all 0.15s',
        boxShadow: 'var(--shadow-md)',
        flexShrink: 0,
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      title="New Generation"
    >
      <i className="fas fa-plus"></i>
    </a>
  );

  return (
    <AdminLayout currentPage="concept_generations">
      <AdminPageHeader title="Concept Generations" subtitle="AI-drafted concept definitions pending review" actions={actions} />
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)' }}>
        {error && (
          <div style={{ padding: 'var(--space-3)', background: 'var(--accent-red-light, #fde8e8)', color: 'var(--accent-red, #9c2a2a)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius)',
                border: '1px solid ' + (filter === f.key ? 'var(--neutral-800)' : 'var(--neutral-300)'),
                background: filter === f.key ? 'var(--neutral-800)' : 'white',
                color: filter === f.key ? 'white' : 'var(--neutral-700)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-500)' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', padding: 'var(--space-8)', borderRadius: 'var(--radius)', textAlign: 'center', color: 'var(--neutral-500)', fontFamily: 'var(--font-body)', border: '1px solid var(--neutral-200)' }}>
            <i className="fas fa-wand-magic-sparkles" style={{ fontSize: '32px', marginBottom: 'var(--space-3)', display: 'block', color: 'var(--neutral-300)' }}></i>
            {filter === 'all' ? 'No generations yet. Create your first above.' : 'No generations match this filter.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filtered.map((gen) => {
              const meta = STATUS_META[gen.status] || STATUS_META.pending;
              return (
                <a
                  key={gen.id}
                  href={`/admin/concept_generations/${gen.id}`}
                  style={{
                    background: 'white',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--neutral-200)',
                    padding: 'var(--space-3) var(--space-4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    textDecoration: 'none',
                    transition: 'box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', color: 'var(--neutral-900)', fontWeight: 600, fontSize: 'var(--text-base)' }}>
                      {gen.concept_name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-500)', fontSize: 'var(--text-xs)', marginTop: '2px' }}>
                      {gen.concept_type || 'untyped'} · created {new Date(gen.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 'var(--radius)', fontSize: 'var(--text-xs)', fontWeight: 600, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em', background: meta.bg, color: meta.color }}>
                    {meta.label}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
