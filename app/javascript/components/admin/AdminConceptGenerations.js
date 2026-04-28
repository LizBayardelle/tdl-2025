import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from './AdminLayout';
import AdminPageHeader from './AdminPageHeader';

const CONCEPT_TYPES = [
  'research_method',
  'measurement',
  'intervention',
  'pathology',
  'emotion',
  'symptom',
  'school_of_thought',
  'physical_entity',
  'physical_process',
  'non_physical_process',
  'non_physical_concept',
];

const IN_PROGRESS_STATUSES = ['pending', 'generating', 'fact_checking', 'enriching'];
const TERMINAL_STATUSES = ['approved', 'rejected', 'failed'];

const STATUS_META = {
  pending:          { label: 'Queued',          bg: 'var(--neutral-100)',        color: 'var(--neutral-700)' },
  generating:       { label: 'Drafting',        bg: 'var(--neutral-100)',        color: 'var(--neutral-700)' },
  fact_checking:    { label: 'Fact-checking',   bg: 'var(--neutral-100)',        color: 'var(--neutral-700)' },
  enriching:        { label: 'Enriching',       bg: 'var(--neutral-100)',        color: 'var(--neutral-700)' },
  ready_for_review: { label: 'Ready for review',bg: 'var(--admin-brown)',        color: 'white' },
  approved:         { label: 'Approved',        bg: 'var(--admin-brown-dark)',   color: 'white' },
  rejected:         { label: 'Rejected',        bg: 'var(--neutral-200)',        color: 'var(--neutral-700)' },
  failed:           { label: 'Failed',          bg: 'var(--neutral-900)',        color: 'white' },
};

const inputStyle = {
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--neutral-300)',
  borderRadius: 'var(--radius)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-body)',
  boxSizing: 'border-box',
  background: 'white',
};

const labelStyle = {
  display: 'block',
  marginBottom: 'var(--space-1)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--neutral-600)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export default function AdminConceptGenerations() {
  const [generations, setGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [retryingIds, setRetryingIds] = useState(() => new Set());
  const pollRef = useRef(null);

  const fetchGenerations = async () => {
    try {
      const res = await fetch('/admin/concept_generations.json');
      const data = await res.json();
      setGenerations(data);
      setLoading(false);
    } catch {
      setError('Failed to load generations');
      setLoading(false);
    }
  };

  // Pick the stage to retry: prefer the latest-failed stage recorded in
  // stage_errors; fall back to a full restart from the 'generate' stage.
  const pickRetryStage = (gen) => {
    const entries = Object.entries(gen.stage_errors || {});
    if (entries.length === 0) return 'generate';
    entries.sort((a, b) => {
      const ta = new Date(a[1]?.at || 0).getTime();
      const tb = new Date(b[1]?.at || 0).getTime();
      return tb - ta;
    });
    const stage = entries[0][0];
    return ['generate', 'fact_check', 'enrich'].includes(stage) ? stage : 'generate';
  };

  const retryGeneration = async (gen) => {
    const stage = pickRetryStage(gen);
    setRetryingIds((prev) => {
      const next = new Set(prev);
      next.add(gen.id);
      return next;
    });
    try {
      const res = await fetch(`/admin/concept_generations/${gen.id}/retry_stage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.errors?.join(', ') || 'Retry failed');
      } else {
        await fetchGenerations();
      }
    } catch {
      setError('Retry failed');
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(gen.id);
        return next;
      });
    }
  };

  useEffect(() => {
    fetchGenerations();
  }, []);

  // Auto-refresh while any generation is in progress
  useEffect(() => {
    const hasInProgress = generations.some((g) => IN_PROGRESS_STATUSES.includes(g.status));
    if (hasInProgress && !pollRef.current) {
      pollRef.current = setInterval(fetchGenerations, 3000);
    }
    if (!hasInProgress && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [generations]);

  const inProgress = generations.filter((g) => IN_PROGRESS_STATUSES.includes(g.status));
  const readyForReview = generations.filter((g) => g.status === 'ready_for_review');
  const history = generations.filter((g) => TERMINAL_STATUSES.includes(g.status));

  return (
    <AdminLayout currentPage="concept_generations">
      <AdminPageHeader
        title="Concept Creator"
        subtitle="Draft, fact-check, and approve new concept definitions"
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))' }}>
        {error && (
          <Banner tone="error">{error}</Banner>
        )}

        <InlineCreator onCreated={fetchGenerations} />

        <Section
          title="Ready for review"
          count={readyForReview.length}
          emptyText="Nothing waiting on you right now."
          emphasize
        >
          {readyForReview.map((g) => <GenerationRow key={g.id} gen={g} emphasize />)}
        </Section>

        <Section
          title="In progress"
          count={inProgress.length}
          emptyText="No drafts in the pipeline."
        >
          {inProgress.map((g) => <GenerationRow key={g.id} gen={g} pulsing />)}
        </Section>

        <Section
          title="History"
          count={history.length}
          emptyText="No past drafts yet."
          collapsible
          open={historyOpen}
          onToggle={() => setHistoryOpen((o) => !o)}
        >
          {historyOpen && history.map((g) => (
            <GenerationRow
              key={g.id}
              gen={g}
              muted
              onRetry={g.status === 'failed' ? () => retryGeneration(g) : undefined}
              retrying={retryingIds.has(g.id)}
            />
          ))}
        </Section>

        {loading && generations.length === 0 && (
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-500)', marginTop: 'var(--space-4)' }}>Loading...</p>
        )}
      </div>
    </AdminLayout>
  );
}

function Section({ title, count, emptyText, children, emphasize, collapsible, open, onToggle }) {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      <div
        onClick={collapsible ? onToggle : undefined}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--space-2)',
          paddingBottom: 'var(--space-2)',
          borderBottom: `1px solid ${emphasize ? 'var(--admin-brown)' : 'var(--neutral-200)'}`,
          marginBottom: 'var(--space-3)',
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {collapsible && (
          <i
            className={`fas fa-chevron-${open ? 'down' : 'right'}`}
            style={{ fontSize: '11px', color: 'var(--neutral-500)', width: '12px' }}
          ></i>
        )}
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: emphasize ? 'var(--admin-brown-dark)' : 'var(--neutral-700)',
          }}
        >
          {title}
        </h2>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--neutral-500)',
            fontWeight: 500,
          }}
        >
          {count}
        </span>
      </div>

      {(!collapsible || open) && !hasChildren && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-500)',
            padding: 'var(--space-3) var(--space-2)',
          }}
        >
          {emptyText}
        </div>
      )}

      {hasChildren && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function GenerationRow({ gen, emphasize, pulsing, muted, onRetry, retrying }) {
  const meta = STATUS_META[gen.status] || STATUS_META.pending;
  const handleRetryClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (retrying) return;
    onRetry && onRetry();
  };
  return (
    <a
      href={`/admin/concept_generations/${gen.id}`}
      style={{
        background: 'white',
        borderRadius: 'var(--radius)',
        border: `1px solid ${emphasize ? 'var(--admin-brown)' : 'var(--neutral-200)'}`,
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        textDecoration: 'none',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        opacity: muted ? 0.75 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = emphasize ? 'var(--admin-brown-dark)' : 'var(--neutral-300)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = emphasize ? 'var(--admin-brown)' : 'var(--neutral-200)';
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {pulsing && (
          <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--admin-brown)', fontSize: '12px' }}></i>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--neutral-900)',
              fontWeight: 600,
              fontSize: 'var(--text-base)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {gen.concept_name}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--neutral-500)',
              fontSize: 'var(--text-xs)',
              marginTop: '2px',
            }}
          >
            {gen.concept_type || 'untyped'} · {new Date(gen.created_at).toLocaleString()}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {onRetry && (
            <button
              onClick={handleRetryClick}
              disabled={retrying}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: retrying ? 'var(--neutral-300)' : 'var(--admin-brown-dark)',
                color: 'white',
                border: 'none',
                cursor: retrying ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Re-enqueue this generation"
            >
              <i className={`fas ${retrying ? 'fa-circle-notch fa-spin' : 'fa-rotate-right'}`}></i>
              {retrying ? 'Retrying' : 'Retry'}
            </button>
          )}
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: meta.bg,
              color: meta.color,
              whiteSpace: 'nowrap',
            }}
          >
            {meta.label}
          </span>
        </div>
    </a>
  );
}

function InlineCreator({ onCreated }) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [conceptType, setConceptType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(null);

  const csrf = () => document.querySelector('[name="csrf-token"]').content;

  const submit = async ({ ignore_duplicate = false, target_mode = 'create_new', target_id = null } = {}) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/admin/concept_generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({
          concept_name: name,
          concept_type: conceptType || null,
          target_mode,
          target_concept_definition_id: target_id,
          ignore_duplicate,
        }),
      });
      if (res.status === 409) {
        const data = await res.json();
        setDuplicate(data.existing_concept_definition);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setError(data.errors?.join(', ') || 'Failed to start generation');
        setSubmitting(false);
        return;
      }
      setName('');
      setConceptType('');
      setExpanded(false);
      setSubmitting(false);
      onCreated && onCreated();
    } catch {
      setError('Network error');
      setSubmitting(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    submit();
  };

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--admin-brown-light)',
            border: '1px dashed var(--admin-brown)',
            borderRadius: 'var(--radius)',
            color: 'var(--admin-brown-dark)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <i className="fas fa-plus"></i>
          New concept…
        </button>
      ) : (
        <form onSubmit={onSubmit}>
          {error && <Banner tone="error">{error}</Banner>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div>
              <label style={labelStyle}>Concept name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Working Memory"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={conceptType} onChange={(e) => setConceptType(e.target.value)} style={inputStyle}>
                <option value="">(auto-classify)</option>
                {CONCEPT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              style={{
                background: submitting || !name.trim() ? 'var(--neutral-300)' : 'var(--admin-brown-dark)',
                color: 'white',
                border: 'none',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 'var(--text-sm)',
                cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Starting…' : 'Start generation'}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setName('');
                setConceptType('');
                setError('');
              }}
              style={{
                background: 'white',
                color: 'var(--neutral-700)',
                border: '1px solid var(--neutral-300)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--neutral-500)', marginLeft: 'var(--space-2)' }}>
              Claude drafts, fact-checks, and surfaces it here for review.
            </span>
          </div>
        </form>
      )}

      {duplicate && (
        <DuplicateModal
          existing={duplicate}
          onClose={() => setDuplicate(null)}
          onCreateAnyway={() => {
            setDuplicate(null);
            submit({ ignore_duplicate: true });
          }}
          onRegenerate={() => {
            setDuplicate(null);
            submit({ target_mode: 'regenerate_existing', target_id: duplicate.id });
          }}
        />
      )}
    </div>
  );
}

function DuplicateModal({ existing, onClose, onCreateAnyway, onRegenerate }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-6)',
          maxWidth: '520px',
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--neutral-900)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
          This concept already exists
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--neutral-700)', marginTop: 0 }}>
          "<strong>{existing.label}</strong>" is already a concept definition (#{existing.id}). What do you want to do?
        </p>
        {existing.summary && (
          <div style={{ background: 'var(--neutral-100)', padding: 'var(--space-3)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--neutral-700)', marginBottom: 'var(--space-4)' }}>
            {existing.summary}
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button
            onClick={onRegenerate}
            style={{ background: 'var(--admin-brown-dark)', color: 'white', border: 'none', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer' }}
          >
            Regenerate existing
          </button>
          <button
            onClick={onCreateAnyway}
            style={{ background: 'white', color: 'var(--neutral-700)', border: '1px solid var(--neutral-300)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}
          >
            Create new anyway
          </button>
          <button
            onClick={onClose}
            style={{ background: 'white', color: 'var(--neutral-700)', border: '1px solid var(--neutral-300)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', cursor: 'pointer', marginLeft: 'auto' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Banner({ tone, children }) {
  const styles = tone === 'error'
    ? { background: 'var(--neutral-900)', color: 'white' }
    : { background: 'var(--admin-brown-light)', color: 'var(--admin-brown-dark)' };
  return (
    <div
      style={{
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius)',
        marginBottom: 'var(--space-4)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        ...styles,
      }}
    >
      {children}
    </div>
  );
}

