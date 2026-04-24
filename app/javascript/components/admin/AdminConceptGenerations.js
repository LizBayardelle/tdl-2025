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
  const [assignTarget, setAssignTarget] = useState(null); // { generationId, conceptDefinitionId, conceptName }
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

  const isApprovedUnassigned = (g) =>
    g.status === 'approved' && g.approved_concept_definition_id && !g.approved_concept_definition_pack_id;

  const inProgress = generations.filter((g) => IN_PROGRESS_STATUSES.includes(g.status));
  const readyForReview = generations.filter((g) => g.status === 'ready_for_review');
  const unassigned = generations.filter(isApprovedUnassigned);
  const history = generations.filter(
    (g) => TERMINAL_STATUSES.includes(g.status) && !isApprovedUnassigned(g)
  );

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
          title="Unassigned"
          count={unassigned.length}
          emptyText="Every approved concept is filed in a pack."
        >
          {unassigned.map((g) => (
            <GenerationRow
              key={g.id}
              gen={g}
              onAssign={() =>
                setAssignTarget({
                  generationId: g.id,
                  conceptDefinitionId: g.approved_concept_definition_id,
                  conceptName: g.concept_name,
                })
              }
            />
          ))}
        </Section>

        <Section
          title="History"
          count={history.length}
          emptyText="No past drafts yet."
          collapsible
          open={historyOpen}
          onToggle={() => setHistoryOpen((o) => !o)}
        >
          {historyOpen && history.map((g) => <GenerationRow key={g.id} gen={g} muted />)}
        </Section>

        {assignTarget && (
          <AssignToPackModal
            target={assignTarget}
            onClose={() => setAssignTarget(null)}
            onAssigned={() => {
              setAssignTarget(null);
              fetchGenerations();
            }}
          />
        )}

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

function GenerationRow({ gen, emphasize, pulsing, muted, onAssign }) {
  const meta = STATUS_META[gen.status] || STATUS_META.pending;
  const handleAssignClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAssign && onAssign();
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
      {onAssign && (
        <button
          onClick={handleAssignClick}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: 'var(--admin-brown-dark)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
          title="Assign this concept to a pack"
        >
          <i className="fas fa-box"></i>
          Assign to pack
        </button>
      )}
      {!onAssign && (
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
      )}
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

function AssignToPackModal({ target, onClose, onAssigned }) {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/admin/packs.json');
        const data = await res.json();
        setPacks(Array.isArray(data) ? data : []);
      } catch {
        setError('Failed to load packs.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = packs.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase()));

  const assign = async (packId) => {
    setAssigning(true);
    setError('');
    try {
      const res = await fetch(`/admin/packs/${packId}/concept_definitions/import_from_concept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ concept_definition_ids: [target.conceptDefinitionId] }),
      });
      if (res.ok) {
        onAssigned();
      } else {
        const data = await res.json();
        setError((data.errors || []).join(', ') || 'Failed to assign.');
      }
    } catch {
      setError('Failed to assign.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div
      onClick={onClose}
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
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 'var(--radius)',
          width: '100%',
          maxWidth: '520px',
          height: 'min(640px, 85vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            padding: 'var(--space-5) var(--space-6)',
            background: 'var(--admin-brown-light)',
            borderBottom: '1px solid var(--admin-brown)',
          }}
        >
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--admin-brown-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Assign to pack
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--neutral-800)', marginTop: 'var(--space-1)' }}>
            <strong>{target.conceptName}</strong>
          </div>
        </div>

        <div style={{ padding: 'var(--space-5) var(--space-6) var(--space-4)' }}>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter packs…"
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-4)',
              border: '1px solid var(--neutral-300)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              boxSizing: 'border-box',
            }}
            autoFocus
          />
          {error && (
            <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', background: 'var(--neutral-900)', color: 'white', borderRadius: 'var(--radius)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-6) var(--space-5)' }}>
          {loading ? (
            <div style={{ padding: 'var(--space-5) var(--space-4)', fontFamily: 'var(--font-body)', color: 'var(--neutral-500)', fontSize: 'var(--text-sm)' }}>Loading packs…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 'var(--space-5) var(--space-4)', fontFamily: 'var(--font-body)', color: 'var(--neutral-500)', fontSize: 'var(--text-sm)' }}>
              {packs.length === 0 ? 'No packs yet. Create one in Packs first.' : 'No packs match that filter.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {filtered.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => assign(pack.id)}
                  disabled={assigning}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-4) var(--space-5)',
                    background: 'white',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius)',
                    cursor: assigning ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-body)',
                    opacity: assigning ? 0.6 : 1,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!assigning) {
                      e.currentTarget.style.background = 'var(--admin-brown-light)';
                      e.currentTarget.style.borderColor = 'var(--admin-brown)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = 'var(--neutral-200)';
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pack.name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-500)', marginTop: '2px' }}>
                      {pack.concept_definitions_count ?? pack.concept_count ?? 0} concepts · {pack.published ? 'published' : 'draft'}
                    </div>
                  </div>
                  <i className="fas fa-arrow-right" style={{ color: 'var(--admin-brown-dark)', fontSize: '12px' }}></i>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderTop: '1px solid var(--neutral-200)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'white',
              color: 'var(--neutral-700)',
              border: '1px solid var(--neutral-300)',
              padding: 'var(--space-2) var(--space-5)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
