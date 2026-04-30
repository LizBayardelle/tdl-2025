import React, { useState, useEffect, useRef, useMemo } from 'react';
import AdminLayout from './AdminLayout';

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

// Status pills use brand tokens.  In-progress states share the source-blue
// "active" treatment; ready_for_review uses the concept-tint to read as "your
// move"; approved is the strong concept ink; failed is the system error red.
const STATUS_META = {
  pending:          { label: 'Queued',          bg: 'var(--paper-warm)',         color: 'var(--ink-3)' },
  generating:       { label: 'Drafting',        bg: 'var(--source-tint)',        color: 'var(--source-2)' },
  fact_checking:    { label: 'Fact-checking',   bg: 'var(--source-tint)',        color: 'var(--source-2)' },
  enriching:        { label: 'Enriching',       bg: 'var(--source-tint)',        color: 'var(--source-2)' },
  ready_for_review: { label: 'Ready for review',bg: 'var(--concept-tint)',       color: 'var(--concept-2)' },
  approved:         { label: 'Approved',        bg: 'var(--concept)',            color: 'var(--paper)' },
  rejected:         { label: 'Rejected',        bg: 'var(--paper-warm)',         color: 'var(--ink-3)' },
  failed:           { label: 'Failed',          bg: 'rgba(122, 46, 46, 0.10)',   color: 'var(--error)' },
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--ink-line)',
  borderRadius: 'var(--r-sm)',
  fontSize: '13px',
  fontFamily: 'var(--font-body)',
  boxSizing: 'border-box',
  background: 'var(--paper)',
  color: 'var(--ink)',
};

const labelStyle = {
  display: 'block',
  marginBottom: 'var(--space-1)',
  fontFamily: 'var(--font-body)',
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--ink-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
};

function relativeTime(input) {
  if (!input) return '';
  const ts = new Date(input).getTime();
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminConceptGenerations() {
  const [generations, setGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const totals = useMemo(() => {
    const byUser = new Map();
    generations.forEach((g) => {
      const key = g.triggered_by?.id || 'system';
      byUser.set(key, (byUser.get(key) || 0) + 1);
    });
    return {
      all: generations.length,
      uniqueUsers: byUser.size,
    };
  }, [generations]);

  return (
    <AdminLayout currentPage="concept_generations">
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-8) clamp(var(--space-4), 4vw, var(--space-8))',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <PageHero
            totalCount={totals.all}
            uniqueUsers={totals.uniqueUsers}
          />

          {error && <Banner tone="error">{error}</Banner>}

          <GenerationsTable
            generations={generations}
            retryingIds={retryingIds}
            onRetry={retryGeneration}
            loading={loading}
          />

          <InlineCreator onCreated={fetchGenerations} />
        </div>
      </div>
    </AdminLayout>
  );
}

// ---------- Hero ----------

function PageHero({ totalCount, uniqueUsers }) {
  return (
    <header
      style={{
        marginBottom: 'var(--space-8)',
        paddingBottom: 'var(--space-7)',
        borderBottom: '1px solid var(--ink-line)',
      }}
    >
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
        Concept Generations
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          color: 'var(--ink-2)',
          lineHeight: 1.65,
          maxWidth: '680px',
          marginTop: '14px',
          marginBottom: '20px',
        }}
      >
        Every concept that Claude has drafted, fact-checked, and surfaced — across
        every user.  Click a row to review it; retry a failed stage from the
        actions column.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <HeroStat value={totalCount} label="Generations" />
        <HeroStat value={uniqueUsers} label="Unique users" />
      </div>
    </header>
  );
}

function HeroStat({ value, label }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--primary)',
          fontVariantNumeric: 'tabular-nums lining-nums',
          letterSpacing: '-0.005em',
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10.5px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginTop: '4px',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ---------- Table ----------

function GenerationsTable({ generations, retryingIds, onRetry, loading }) {
  if (loading && generations.length === 0) {
    return (
      <p
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--ink-3)',
          padding: 'var(--space-6) 0',
        }}
      >
        Loading.
      </p>
    );
  }

  if (generations.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-8)',
          background: 'var(--paper-soft)',
          border: '1px dashed var(--ink-line)',
          borderRadius: 'var(--r-md)',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          color: 'var(--ink-3)',
          textAlign: 'center',
          marginBottom: 'var(--space-8)',
        }}
      >
        No generations yet.  When a user triggers one from the app, it will land here.
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid var(--ink-line)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        marginBottom: 'var(--space-8)',
      }}
    >
      <table className="sp-table">
        <thead>
          <tr>
            <th>Concept</th>
            <th>Type</th>
            <th>Triggered by</th>
            <th>Created</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {generations.map((gen) => (
            <GenerationRow
              key={gen.id}
              gen={gen}
              retrying={retryingIds.has(gen.id)}
              onRetry={() => onRetry(gen)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GenerationRow({ gen, retrying, onRetry }) {
  const meta = STATUS_META[gen.status] || STATUS_META.pending;
  const inProgress = IN_PROGRESS_STATUSES.includes(gen.status);
  const canRetry = gen.status === 'failed';
  const navigate = () => {
    window.location.href = `/admin/concept_generations/${gen.id}`;
  };
  const handleRetry = (e) => {
    e.stopPropagation();
    if (retrying) return;
    onRetry();
  };
  const handleUserClick = (e) => {
    e.stopPropagation();
  };
  return (
    <tr
      onClick={navigate}
      style={{ cursor: 'pointer' }}
    >
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {inProgress && (
            <i
              className="fas fa-circle-notch fa-spin"
              style={{ color: 'var(--source)', fontSize: '11px', flexShrink: 0 }}
              aria-label="In progress"
            ></i>
          )}
          <a
            href={`/admin/concept_generations/${gen.id}`}
            className="sp-link"
            onClick={(e) => e.stopPropagation()}
            style={{ fontWeight: 500 }}
          >
            {gen.concept_name}
          </a>
        </div>
      </td>
      <td style={{ color: 'var(--ink-2)' }}>
        {(gen.concept_type || 'untyped').replace(/_/g, ' ')}
      </td>
      <td>
        {gen.triggered_by ? (
          <UserChip user={gen.triggered_by} onClick={handleUserClick} />
        ) : (
          <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>—</span>
        )}
      </td>
      <td
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--ink-3)',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
        title={new Date(gen.created_at).toLocaleString()}
      >
        {relativeTime(gen.created_at)}
      </td>
      <td>
        <span
          style={{
            display: 'inline-flex',
            padding: '3px 10px',
            borderRadius: 'var(--r-sm)',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            background: meta.bg,
            color: meta.color,
            whiteSpace: 'nowrap',
          }}
        >
          {meta.label}
        </span>
      </td>
      <td style={{ textAlign: 'right' }}>
        {canRetry ? (
          <button
            onClick={handleRetry}
            disabled={retrying}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--r-sm)',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              background: retrying ? 'var(--paper-warm)' : 'var(--primary)',
              color: retrying ? 'var(--ink-3)' : 'var(--paper)',
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
        ) : (
          <span style={{ color: 'var(--ink-4)' }}>—</span>
        )}
      </td>
    </tr>
  );
}

function UserChip({ user, onClick }) {
  const isAdmin = !!user.admin;
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '1px 8px',
        background: isAdmin ? 'var(--paper-warm)' : 'var(--person-tint)',
        color: isAdmin ? 'var(--ink-2)' : 'var(--person-2)',
        borderRadius: 'var(--r-sm)',
        fontSize: '11.5px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        maxWidth: '260px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
      title={`${user.email} · ${user.plan} plan${isAdmin ? ' · admin' : ''}`}
    >
      {isAdmin && <i className="fas fa-shield-halved" style={{ fontSize: '9px', opacity: 0.7 }}></i>}
      {user.email}
    </span>
  );
}

// ---------- Inline creator (admin one-off) ----------

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
        background: 'var(--paper)',
        border: '1px solid var(--ink-line)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--space-4) var(--space-5)',
      }}
    >
      {!expanded ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '10.5px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
                marginBottom: '4px',
              }}
            >
              Admin one-off
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13.5px',
                color: 'var(--ink-2)',
                lineHeight: 1.55,
                maxWidth: '560px',
              }}
            >
              Users now trigger their own generations from inside the app.  Use this
              to draft a concept directly — bypasses user quotas.
            </div>
          </div>
          <button
            type="button"
            className="sp-action sp-action-secondary"
            onClick={() => setExpanded(true)}
          >
            New concept.
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          {error && <Banner tone="error">{error}</Banner>}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
            }}
          >
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

          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="submit"
              className="sp-action sp-action-primary"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Starting.' : 'Start generation'}
            </button>
            <button
              type="button"
              className="sp-action sp-action-secondary"
              onClick={() => {
                setExpanded(false);
                setName('');
                setConceptType('');
                setError('');
              }}
            >
              Cancel
            </button>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--ink-3)',
                marginLeft: 'var(--space-2)',
              }}
            >
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

// ---------- Duplicate confirm ----------

function DuplicateModal({ existing, onClose, onCreateAnyway, onRegenerate }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 35, 0.45)',
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
          background: 'var(--paper)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--space-6)',
          maxWidth: '520px',
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--ink-line)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--primary)',
            letterSpacing: '-0.005em',
            marginTop: 0,
            marginBottom: 'var(--space-3)',
          }}
        >
          This concept already exists
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--ink-2)',
            lineHeight: 1.6,
            marginTop: 0,
          }}
        >
          "<strong style={{ color: 'var(--ink)' }}>{existing.label}</strong>" is already a concept definition (#{existing.id}).  What do you want to do?
        </p>
        {existing.summary && (
          <div
            style={{
              background: 'var(--paper-soft)',
              border: '1px solid var(--ink-line-soft)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--r-sm)',
              fontFamily: 'var(--font-body)',
              fontSize: '13.5px',
              color: 'var(--ink-2)',
              lineHeight: 1.6,
              marginBottom: 'var(--space-4)',
            }}
          >
            {existing.summary}
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button onClick={onRegenerate} className="sp-action sp-action-primary">
            Regenerate existing
          </button>
          <button onClick={onCreateAnyway} className="sp-action sp-action-secondary">
            Create new anyway
          </button>
          <button onClick={onClose} className="sp-action sp-action-quiet" style={{ marginLeft: 'auto' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
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
        lineHeight: 1.5,
        ...styles,
      }}
    >
      {children}
    </div>
  );
}
