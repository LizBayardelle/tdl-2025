import React, { useState, useEffect, useRef, useMemo } from 'react';
import AdminLayout from './AdminLayout';
import AdminPageHeader from './AdminPageHeader';

const FIELD_GROUPS = [
  {
    key: 'identity',
    label: 'Identity',
    icon: 'fa-id-card',
    description: 'What this concept is and what it\'s called.',
    fields: [
      { key: 'label', label: 'Label', type: 'single' },
      { key: 'aliases', label: 'Aliases', type: 'array' },
      { key: 'summary', label: 'Summary', type: 'multi' },
    ],
  },
  {
    key: 'definition',
    label: 'Core Definition',
    icon: 'fa-book-open',
    description: 'The substance — what it is, where it lives, what it looks like.',
    fields: [
      { key: 'description', label: 'Description', type: 'multi' },
      { key: 'location', label: 'Location', type: 'multi' },
      { key: 'examples', label: 'Examples', type: 'multi' },
    ],
  },
  {
    key: 'context',
    label: 'Origins & Context',
    icon: 'fa-scroll',
    description: 'Where it came from and how the field thinks about it.',
    fields: [
      { key: 'etymology', label: 'Etymology', type: 'multi' },
      { key: 'school_of_thought', label: 'School of Thought', type: 'single' },
      { key: 'history', label: 'History', type: 'multi' },
      { key: 'controversy', label: 'Controversy', type: 'multi' },
    ],
  },
  {
    key: 'practical',
    label: 'Practical Notes',
    icon: 'fa-stethoscope',
    description: 'How this shows up in practice, teaching, and measurement.',
    fields: [
      { key: 'clinical_relevance', label: 'Clinical Relevance', type: 'multi' },
      { key: 'misconceptions', label: 'Misconceptions', type: 'multi' },
      { key: 'mnemonic', label: 'Mnemonic', type: 'multi' },
      { key: 'developmental_notes', label: 'Developmental Notes', type: 'multi' },
      { key: 'measurement_notes', label: 'Measurement Notes', type: 'multi' },
    ],
  },
];

const ALL_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);
const FIELD_META_BY_KEY = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f]));

const IN_PROGRESS_STATUSES = ['pending', 'generating', 'fact_checking', 'enriching'];
const TERMINAL_STATUSES = ['approved', 'rejected', 'failed'];

const STEPS = [
  { key: 'draft',      label: 'Draft',       icon: 'fa-pen-nib' },
  { key: 'factcheck',  label: 'Fact-check',  icon: 'fa-magnifying-glass' },
  { key: 'review',     label: 'Review',      icon: 'fa-eye' },
  { key: 'decision',   label: 'Decision',    icon: 'fa-gavel' },
];

function stepStatusFor(genStatus) {
  // Returns { currentStep, stepStates } where stepStates[key] is 'upcoming' | 'current' | 'done' | 'error'
  const stepStates = { draft: 'upcoming', factcheck: 'upcoming', review: 'upcoming', decision: 'upcoming' };
  let currentStep = 'draft';

  switch (genStatus) {
    case 'pending':
    case 'generating':
      stepStates.draft = 'current';
      currentStep = 'draft';
      break;
    case 'fact_checking':
    case 'enriching':
      stepStates.draft = 'done';
      stepStates.factcheck = 'current';
      currentStep = 'factcheck';
      break;
    case 'ready_for_review':
      stepStates.draft = 'done';
      stepStates.factcheck = 'done';
      stepStates.review = 'current';
      currentStep = 'review';
      break;
    case 'approved':
    case 'rejected':
      stepStates.draft = 'done';
      stepStates.factcheck = 'done';
      stepStates.review = 'done';
      stepStates.decision = 'done';
      currentStep = 'decision';
      break;
    case 'failed':
      stepStates.draft = 'error';
      stepStates.factcheck = 'error';
      currentStep = 'draft';
      break;
    default:
      stepStates.draft = 'current';
  }

  return { currentStep, stepStates };
}

const inputStyle = {
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--neutral-300)',
  borderRadius: 'var(--radius)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-body)',
  boxSizing: 'border-box',
  background: 'white',
  lineHeight: 1.5,
};

const labelStyle = {
  display: 'block',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--neutral-600)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 'var(--space-2)',
};

const primaryBtn = {
  background: 'var(--admin-brown-dark)',
  color: 'white',
  border: 'none',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
};

const secondaryBtn = {
  background: 'white',
  color: 'var(--neutral-700)',
  border: '1px solid var(--neutral-300)',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-sm)',
  cursor: 'pointer',
};

export default function AdminConceptGenerationShow({ generationId }) {
  const [gen, setGen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const pollRef = useRef(null);
  const editsInitializedRef = useRef(false);

  const csrf = () => document.querySelector('[name="csrf-token"]').content;

  const fetchGen = async () => {
    try {
      const res = await fetch(`/admin/concept_generations/${generationId}.json`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setGen(data);
      setLoading(false);
      if (!editsInitializedRef.current && data.content) {
        const initial = {};
        ALL_FIELDS.forEach((f) => {
          initial[f.key] = data.content[f.key] ?? (f.type === 'array' ? [] : '');
        });
        setEdits(initial);
        editsInitializedRef.current = true;
      }
      return data;
    } catch (err) {
      setError('Failed to load generation');
      setLoading(false);
      return null;
    }
  };

  useEffect(() => {
    fetchGen();
  }, [generationId]);

  // Poll while in progress
  useEffect(() => {
    if (!gen) return;
    if (!IN_PROGRESS_STATUSES.includes(gen.status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(fetchGen, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [gen?.status]);

  // Default tab follows current step unless user explicitly picked one
  const { currentStep, stepStates } = useMemo(() => (gen ? stepStatusFor(gen.status) : { currentStep: 'draft', stepStates: {} }), [gen?.status]);
  useEffect(() => {
    if (activeTab === null && gen) setActiveTab(currentStep);
  }, [currentStep, gen, activeTab]);

  const updateEdit = (key, value) => {
    setEdits((e) => ({ ...e, [key]: value }));
    setDirty(true);
  };

  const saveEdits = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/admin/concept_generations/${generationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ concept_generation: edits }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.errors?.join(', ') || 'Save failed');
      } else {
        const data = await res.json();
        setGen(data);
        setDirty(false);
      }
    } catch {
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (dirty && !confirm('You have unsaved edits. Approve anyway (using last saved version)?')) return;
    setActing(true);
    try {
      const res = await fetch(`/admin/concept_generations/${generationId}/approve`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf() },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.errors?.join(', ') || 'Approve failed');
      } else {
        setGen(await res.json());
      }
    } finally {
      setActing(false);
    }
  };

  const reject = async () => {
    const reason = prompt('Reason for rejection (optional):');
    if (reason === null) return;
    setActing(true);
    try {
      const res = await fetch(`/admin/concept_generations/${generationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.errors?.join(', ') || 'Reject failed');
      } else {
        setGen(await res.json());
      }
    } finally {
      setActing(false);
    }
  };

  const retryStage = async (stage) => {
    setActing(true);
    try {
      const res = await fetch(`/admin/concept_generations/${generationId}/retry_stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.errors?.join(', ') || 'Retry failed');
      } else {
        setGen(await res.json());
      }
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout currentPage="concept_generations">
        <AdminPageHeader title="Loading…" backHref="/admin/concept_generations" backLabel="Back to Concept Creator" />
        <div style={{ padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))', fontFamily: 'var(--font-body)', color: 'var(--neutral-500)' }}>Loading…</div>
      </AdminLayout>
    );
  }
  if (!gen) {
    return (
      <AdminLayout currentPage="concept_generations">
        <AdminPageHeader title="Not found" backHref="/admin/concept_generations" backLabel="Back to Concept Creator" />
        <div style={{ padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))', fontFamily: 'var(--font-body)', color: 'var(--neutral-700)' }}>{error || 'Generation not found'}</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="concept_generations">
      <AdminPageHeader
        title={gen.concept_name}
        subtitle={`${gen.concept_type || 'untyped'} · created ${new Date(gen.created_at).toLocaleString()}`}
        backHref="/admin/concept_generations"
        backLabel="Back to Concept Creator"
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <StepTabs steps={STEPS} stepStates={stepStates} active={activeTab || currentStep} onPick={setActiveTab} />

        <div style={{ padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))' }}>
          {(activeTab || currentStep) === 'draft' && (
            <DraftTab gen={gen} onRetry={retryStage} acting={acting} />
          )}
          {(activeTab || currentStep) === 'factcheck' && (
            <FactCheckTab gen={gen} onRetry={retryStage} acting={acting} />
          )}
          {(activeTab || currentStep) === 'review' && (
            <ReviewTab
              gen={gen}
              edits={edits}
              onEdit={updateEdit}
              onSave={saveEdits}
              dirty={dirty}
              saving={saving}
              onRetry={retryStage}
              acting={acting}
              onRefresh={fetchGen}
            />
          )}
          {(activeTab || currentStep) === 'decision' && (
            <DecisionTab gen={gen} onApprove={approve} onReject={reject} onRetry={retryStage} acting={acting} dirty={dirty} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function StepTabs({ steps, stepStates, active, onPick }) {
  return (
    <div style={{ background: 'white', borderBottom: '1px solid var(--neutral-200)', padding: '0 clamp(var(--space-4), 4vw, var(--space-8))', display: 'flex', overflowX: 'auto' }}>
      {steps.map((step, idx) => {
        const state = stepStates[step.key] || 'upcoming';
        const isActive = active === step.key;
        const isDone = state === 'done';
        const isCurrent = state === 'current';
        const isError = state === 'error';
        const color = isActive
          ? 'var(--admin-brown-dark)'
          : isDone
          ? 'var(--admin-brown)'
          : isCurrent
          ? 'var(--admin-brown)'
          : isError
          ? 'var(--neutral-900)'
          : 'var(--neutral-400)';
        const borderBottom = isActive ? '3px solid var(--admin-brown-dark)' : '3px solid transparent';
        return (
          <button
            key={step.key}
            onClick={() => onPick(step.key)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom,
              padding: 'var(--space-4) var(--space-4)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: isActive ? 600 : 500,
              color,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            <StepBadge idx={idx + 1} state={state} />
            <span>{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StepBadge({ idx, state }) {
  const base = {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  };
  if (state === 'done') {
    return (
      <span style={{ ...base, background: 'var(--admin-brown-dark)', color: 'white' }}>
        <i className="fas fa-check" style={{ fontSize: '10px' }}></i>
      </span>
    );
  }
  if (state === 'current') {
    return <span style={{ ...base, background: 'var(--admin-brown)', color: 'white' }}>{idx}</span>;
  }
  if (state === 'error') {
    return (
      <span style={{ ...base, background: 'var(--neutral-900)', color: 'white' }}>
        <i className="fas fa-xmark" style={{ fontSize: '11px' }}></i>
      </span>
    );
  }
  return <span style={{ ...base, background: 'var(--neutral-100)', color: 'var(--neutral-500)', border: '1px solid var(--neutral-300)' }}>{idx}</span>;
}

/* ─── Draft tab ───────────────────────────────────── */

function DraftTab({ gen, onRetry, acting }) {
  const sources = gen.web_search_sources || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {gen.status === 'generating' && (
        <ProgressBanner icon="fa-circle-notch fa-spin">
          Claude Sonnet is researching and drafting from authoritative sources. This usually takes 3–5 minutes.
        </ProgressBanner>
      )}
      {gen.status === 'pending' && (
        <ProgressBanner icon="fa-hourglass-half">Queued. Generation will begin shortly.</ProgressBanner>
      )}
      {gen.status === 'failed' && gen.stage_errors?.generate && (
        <ErrorBanner
          title="Draft stage failed"
          message={gen.stage_errors.generate.message}
          actions={(
            <button onClick={() => onRetry('generate')} disabled={acting} style={{ ...primaryBtn, background: 'white', color: 'var(--neutral-900)' }}>
              <i className="fas fa-redo" style={{ marginRight: 'var(--space-2)' }}></i>
              Restart draft
            </button>
          )}
        />
      )}

      <InfoCard title="What's happening" icon="fa-pen-nib">
        The drafting step asks Claude Sonnet to research the concept with web search (limited to trusted domains) and
        produce a structured draft. The fact-check step then reviews and revises it.
      </InfoCard>

      {sources.length > 0 && (
        <SourcesList sources={sources} />
      )}
    </div>
  );
}

/* ─── Fact-check tab ──────────────────────────────── */

function FactCheckTab({ gen, onRetry, acting }) {
  const notes = gen.fact_check_notes || [];
  const snapshot = gen.previous_snapshot?.after_generate || null;
  const content = gen.content || {};

  // Build diff rows: one per field that has a note or a changed value
  const diffs = useMemo(() => {
    const notesByField = {};
    notes.forEach((n) => {
      const f = n.field || '__general__';
      if (!notesByField[f]) notesByField[f] = [];
      notesByField[f].push(n);
    });

    const fieldKeys = new Set([
      ...ALL_FIELDS.map((f) => f.key),
      ...Object.keys(notesByField),
    ]);

    const result = [];
    fieldKeys.forEach((key) => {
      const before = snapshot?.[key];
      const after = content[key];
      const fieldNotes = notesByField[key] || [];
      const changed = snapshot && !valuesEqual(before, after);
      if (fieldNotes.length > 0 || changed) {
        result.push({ key, before, after, notes: fieldNotes, changed });
      }
    });

    // General-level notes without a field
    if (notesByField.__general__) {
      result.unshift({ key: '__general__', before: null, after: null, notes: notesByField.__general__, changed: false });
    }

    return result;
  }, [notes, snapshot, content]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {gen.status === 'fact_checking' && (
        <ProgressBanner icon="fa-circle-notch fa-spin">
          Claude Opus is fact-checking the draft against sources, looking for errors and missing hedging. 3–5 minutes.
        </ProgressBanner>
      )}
      {gen.status === 'enriching' && (
        <ProgressBanner icon="fa-circle-notch fa-spin">Enriching links from sources.</ProgressBanner>
      )}
      {gen.status === 'failed' && gen.stage_errors?.fact_check && (
        <ErrorBanner
          title="Fact-check stage failed"
          message={gen.stage_errors.fact_check.message}
          actions={(
            <button onClick={() => onRetry('fact_check')} disabled={acting} style={{ ...primaryBtn, background: 'white', color: 'var(--neutral-900)' }}>
              <i className="fas fa-redo" style={{ marginRight: 'var(--space-2)' }}></i>
              Retry fact-check
            </button>
          )}
        />
      )}

      {diffs.length === 0 ? (
        <InfoCard title={notes.length === 0 && !snapshot ? 'Fact-check hasn\'t run yet' : 'No changes'} icon="fa-magnifying-glass">
          {notes.length === 0 && !snapshot
            ? 'This tab will fill in once Claude Opus finishes the fact-check pass.'
            : 'The fact-checker reviewed the draft and made no changes. Proceed to review.'}
        </InfoCard>
      ) : (
        <>
          <InfoCard title={`${diffs.length} change${diffs.length === 1 ? '' : 's'} to review`} icon="fa-magnifying-glass">
            Each box below represents a field the fact-checker modified. Expand to see what changed and why.
          </InfoCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {diffs.map((d) => (
              <DiffBox key={d.key} diff={d} />
            ))}
          </div>
        </>
      )}

      {gen.status === 'ready_for_review' && (
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={() => onRetry('fact_check')} disabled={acting} style={secondaryBtn} title="Restore the post-draft snapshot and re-run fact-check only">
            <i className="fas fa-redo" style={{ marginRight: 'var(--space-2)' }}></i>
            Re-run fact-check
          </button>
        </div>
      )}
    </div>
  );
}

function DiffBox({ diff }) {
  const { key, before, after, notes, changed } = diff;
  const fieldMeta = FIELD_META_BY_KEY[key];
  const fieldLabel = key === '__general__' ? 'General notes' : (fieldMeta?.label || key);
  const [expanded, setExpanded] = useState(true);
  const severityOrder = { major: 3, moderate: 2, minor: 1 };
  const topSeverity = notes.reduce((acc, n) => {
    const s = (n.severity || '').toLowerCase();
    return severityOrder[s] > severityOrder[acc] ? s : acc;
  }, '');
  const severityStyles = {
    major:    { bg: 'var(--neutral-900)',     color: 'white' },
    moderate: { bg: 'var(--admin-brown)',     color: 'white' },
    minor:    { bg: 'var(--admin-brown-light)',color: 'var(--admin-brown-dark)' },
  };

  return (
    <div style={{ background: 'white', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--neutral-100)',
          border: 'none',
          borderBottom: expanded ? '1px solid var(--neutral-200)' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <i className={`fas fa-chevron-${expanded ? 'down' : 'right'}`} style={{ fontSize: '11px', color: 'var(--neutral-500)', width: '12px' }}></i>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--neutral-700)' }}>
          {fieldLabel}
        </span>
        {topSeverity && (
          <span style={{
            padding: '2px 8px',
            borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-body)',
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            ...severityStyles[topSeverity],
          }}>
            {topSeverity}
          </span>
        )}
        {changed && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--neutral-500)' }}>
            text changed
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--neutral-500)' }}>
          {notes.length > 0 ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : ''}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {notes.map((note, i) => (
            <CommentBox key={i} note={note} />
          ))}

          {changed && (
            <DiffTexts before={before} after={after} />
          )}
        </div>
      )}
    </div>
  );
}

function CommentBox({ note }) {
  return (
    <div style={{
      background: 'var(--admin-brown-light)',
      border: '1px solid var(--admin-brown)',
      borderLeft: '4px solid var(--admin-brown-dark)',
      borderRadius: 'var(--radius)',
      padding: 'var(--space-3) var(--space-4)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--neutral-900)',
      lineHeight: 1.55,
    }}>
      {note.issue && (
        <div style={{ marginBottom: note.change ? 'var(--space-2)' : 0 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--admin-brown-dark)', marginBottom: '2px' }}>
            <i className="fas fa-comment" style={{ marginRight: '6px' }}></i>
            Issue
          </div>
          {note.issue}
        </div>
      )}
      {note.change && (
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--admin-brown-dark)', marginBottom: '2px' }}>
            <i className="fas fa-pen" style={{ marginRight: '6px' }}></i>
            Change
          </div>
          {note.change}
        </div>
      )}
    </div>
  );
}

function DiffTexts({ before, after }) {
  const toText = (v) => {
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  };
  const beforeText = toText(before);
  const afterText = toText(after);
  const { beforeSegs, afterSegs } = diffWords(beforeText, afterText);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
      <DiffCell label="Before" segments={beforeSegs} empty={!beforeText} tone="before" />
      <DiffCell label="After" segments={afterSegs} empty={!afterText} tone="after" />
    </div>
  );
}

function DiffCell({ label, segments, empty, tone }) {
  const isAfter = tone === 'after';
  const marker = isAfter ? '+' : '−';
  const labelColor = isAfter ? '#4a6024' : '#6e3030';
  const markerBg = isAfter ? '#b4c99a' : '#d4a8a8';

  return (
    <div style={{
      background: 'white',
      border: '1px solid var(--neutral-200)',
      borderRadius: 'var(--radius)',
      padding: 'var(--space-3)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--neutral-900)',
      whiteSpace: 'pre-wrap',
      lineHeight: 1.55,
    }}>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: labelColor,
        marginBottom: 'var(--space-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '3px',
          background: markerBg,
          color: 'white',
          fontSize: '11px',
          fontWeight: 700,
        }}>
          {marker}
        </span>
        {label}
      </div>
      {empty ? (
        <em style={{ color: 'var(--neutral-500)' }}>empty</em>
      ) : (
        segments.map((seg, i) => {
          if (seg.highlight && tone === 'before') {
            return (
              <span key={i} style={{ background: '#f6d3d3', borderRadius: '2px', padding: '0 1px' }}>
                {seg.text}
              </span>
            );
          }
          if (seg.highlight && tone === 'after') {
            return (
              <span key={i} style={{ background: '#d8e9bd', borderRadius: '2px', padding: '0 1px' }}>
                {seg.text}
              </span>
            );
          }
          return <span key={i}>{seg.text}</span>;
        })
      )}
    </div>
  );
}

// Word-level LCS diff. Returns { beforeSegs, afterSegs } where each seg is
// { text, highlight } — highlight=true means that span was removed (in before) or added (in after).
function diffWords(before, after) {
  const tokenize = (s) => (s.match(/\S+|\s+/g) || []);
  const a = tokenize(before);
  const b = tokenize(after);

  // Bail out for very large fields — whole-block highlight instead of O(n*m) LCS.
  if (a.length > 2500 || b.length > 2500) {
    return {
      beforeSegs: before ? [{ text: before, highlight: true }] : [],
      afterSegs: after ? [{ text: after, highlight: true }] : [],
    };
  }

  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const ops = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.push({ type: 'equal', text: a[i - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: 'remove', text: a[i - 1] });
      i--;
    } else {
      ops.push({ type: 'add', text: b[j - 1] });
      j--;
    }
  }
  while (i > 0) { ops.push({ type: 'remove', text: a[i - 1] }); i--; }
  while (j > 0) { ops.push({ type: 'add', text: b[j - 1] }); j--; }
  ops.reverse();

  // Merge runs of the same type
  const merged = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) last.text += op.text;
    else merged.push({ ...op });
  }

  const beforeSegs = merged
    .filter((o) => o.type !== 'add')
    .map((o) => ({ text: o.text, highlight: o.type === 'remove' }));
  const afterSegs = merged
    .filter((o) => o.type !== 'remove')
    .map((o) => ({ text: o.text, highlight: o.type === 'add' }));

  return { beforeSegs, afterSegs };
}

/* ─── Review tab ──────────────────────────────────── */

function ReviewTab({ gen, edits, onEdit, onSave, dirty, saving, onRetry, acting, onRefresh }) {
  const disabled = TERMINAL_STATUSES.includes(gen.status) || IN_PROGRESS_STATUSES.includes(gen.status);
  const hasContent = gen.content && Object.values(gen.content).some((v) => v && (Array.isArray(v) ? v.length : true));

  if (!hasContent) {
    return (
      <InfoCard title="No content yet" icon="fa-hourglass-half">
        Review becomes available once drafting and fact-check finish.
      </InfoCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--space-6) * 2)' }}>
      {gen.status === 'ready_for_review' && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 3,
          background: 'white',
          border: '1px solid var(--neutral-200)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--neutral-700)' }}>
            Edit any field below, then save. Approve or reject on the Decision tab.
          </span>
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            style={{
              ...primaryBtn,
              marginLeft: 'auto',
              background: dirty ? 'var(--admin-brown-dark)' : 'var(--neutral-300)',
              cursor: dirty ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : dirty ? 'Save edits' : 'Saved'}
          </button>
        </div>
      )}

      {FIELD_GROUPS.map((group) => (
        <FieldGroup key={group.key} group={group} edits={edits} onEdit={onEdit} disabled={disabled} />
      ))}

      <SelectedLinksPanel
        gen={gen}
        onRetry={onRetry}
        acting={acting}
        onRefresh={onRefresh}
        disabled={disabled}
      />
    </div>
  );
}

function SelectedLinksPanel({ gen, onRetry, acting, onRefresh, disabled }) {
  const [savingLinks, setSavingLinks] = useState(false);
  const links = Array.isArray(gen.selected_links) ? gen.selected_links : [];

  const csrf = () => document.querySelector('[name="csrf-token"]').content;

  const removeLink = async (idx) => {
    const next = links.filter((_, i) => i !== idx);
    setSavingLinks(true);
    try {
      const res = await fetch(`/admin/concept_generations/${gen.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ concept_generation: { selected_links: next } }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.errors?.join(', ') || 'Remove failed');
      } else {
        onRefresh && onRefresh();
      }
    } finally {
      setSavingLinks(false);
    }
  };

  return (
    <section style={{ background: 'white', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <header style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--admin-brown-light)',
        borderBottom: '1px solid var(--admin-brown)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}>
        <i className="fas fa-link" style={{ color: 'var(--admin-brown-dark)', fontSize: '14px' }}></i>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--admin-brown-dark)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            External Links · {links.length}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--neutral-600)' }}>
            Curated subset from web-search sources. Link records are created on approval.
          </div>
        </div>
        <button
          onClick={() => onRetry('enrich')}
          disabled={acting || disabled || gen.status === 'enriching'}
          style={{
            ...secondaryBtn,
            fontSize: 'var(--text-xs)',
            opacity: (acting || gen.status === 'enriching') ? 0.7 : 1,
            cursor: (acting || gen.status === 'enriching' || disabled) ? 'not-allowed' : 'pointer',
          }}
          title="Re-rank links from the full source list"
        >
          <i
            className={`fas ${(acting || gen.status === 'enriching') ? 'fa-circle-notch fa-spin' : 'fa-rotate'}`}
            style={{ marginRight: 'var(--space-2)' }}
          ></i>
          {(acting || gen.status === 'enriching') ? 'Re-enriching…' : 'Re-enrich'}
        </button>
      </header>
      <div style={{ padding: 'var(--space-4)' }}>
        {links.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--neutral-500)' }}>
            No links selected. Click Re-enrich to populate from web search sources.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {links.map((link, i) => (
              <div
                key={`${link.url}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--neutral-100)',
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    background: 'var(--admin-brown)',
                    color: 'white',
                    borderRadius: '3px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {link.category || link.domain}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--neutral-900)',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'block',
                      marginBottom: '2px',
                    }}
                  >
                    {link.name}
                  </a>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--neutral-500)', wordBreak: 'break-all' }}>
                    {link.url}
                  </div>
                </div>
                <button
                  onClick={() => removeLink(i)}
                  disabled={savingLinks || disabled}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--neutral-500)',
                    cursor: (savingLinks || disabled) ? 'not-allowed' : 'pointer',
                    padding: 'var(--space-1) var(--space-2)',
                    fontSize: 'var(--text-base)',
                    flexShrink: 0,
                  }}
                  title="Remove this link"
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--neutral-900)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--neutral-500)')}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FieldGroup({ group, edits, onEdit, disabled }) {
  return (
    <section style={{
      border: '1px solid var(--admin-brown-light)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-6)',
        background: 'var(--admin-brown-light)',
        borderRadius: 'var(--radius) var(--radius) 0 0',
        marginBottom: 'var(--space-4)',
      }}>
        <i className={`fas ${group.icon}`} style={{ color: 'var(--admin-brown-dark)', fontSize: '14px' }}></i>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--admin-brown-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {group.label}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--neutral-600)', marginTop: '2px' }}>
            {group.description}
          </div>
        </div>
      </header>
      <div style={{ padding: '0 var(--space-6) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {group.fields.map((field) => {
          const value = edits[field.key] ?? (field.type === 'array' ? [] : '');
          return (
            <div key={field.key}>
              <label style={labelStyle}>{field.label}</label>
              {field.type === 'array' ? (
                <input
                  type="text"
                  value={(Array.isArray(value) ? value : []).join(', ')}
                  onChange={(e) => onEdit(field.key, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  disabled={disabled}
                  placeholder="Comma-separated aliases"
                  style={inputStyle}
                />
              ) : field.type === 'single' ? (
                <input
                  type="text"
                  value={value || ''}
                  onChange={(e) => onEdit(field.key, e.target.value)}
                  disabled={disabled}
                  style={inputStyle}
                />
              ) : (
                <textarea
                  value={value || ''}
                  onChange={(e) => onEdit(field.key, e.target.value)}
                  disabled={disabled}
                  rows={Math.max(3, Math.min(12, (value || '').split('\n').length + 1))}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}


/* ─── Decision tab ────────────────────────────────── */

function DecisionTab({ gen, onApprove, onReject, onRetry, acting, dirty }) {
  if (gen.status === 'approved') {
    const cdId = gen.approved_concept_definition_id;
    const packId = gen.approved_concept_definition_pack_id;
    let followUp = null;
    if (cdId && packId) {
      followUp = (
        <a
          href={`/admin/packs/${packId}`}
          style={{ color: 'var(--admin-brown-dark)', fontWeight: 600, textDecoration: 'underline' }}
        >
          Open pack to edit ConceptDefinition #{cdId}
        </a>
      );
    } else if (cdId) {
      followUp = (
        <span style={{ color: 'var(--neutral-600)' }}>
          ConceptDefinition #{cdId} isn't assigned to a pack yet — {' '}
          <a href="/admin/packs" style={{ color: 'var(--admin-brown-dark)', fontWeight: 600, textDecoration: 'underline' }}>
            assign it in Packs
          </a>.
        </span>
      );
    }
    return (
      <TerminalState
        icon="fa-circle-check"
        title="Approved"
        detail={`Approved on ${new Date(gen.approved_at).toLocaleString()}.`}
        followUp={followUp}
      />
    );
  }
  if (gen.status === 'rejected') {
    return (
      <TerminalState
        icon="fa-ban"
        title="Rejected"
        detail={gen.rejected_reason || 'No reason was provided.'}
      />
    );
  }
  if (gen.status !== 'ready_for_review') {
    return (
      <InfoCard title="Not ready for a decision yet" icon="fa-hourglass-half">
        Finish the draft and fact-check steps before approving or rejecting.
      </InfoCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--space-6) * 2)' }}>
      {dirty && (
        <div style={{
          background: 'white',
          border: '1px solid var(--neutral-900)',
          borderLeft: '4px solid var(--neutral-900)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-3) var(--space-4)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--neutral-900)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}>
          <i className="fas fa-triangle-exclamation"></i>
          <span><strong>Unsaved edits</strong> on the Review tab. Save before approving or the last saved version will be used.</span>
        </div>
      )}

      <DecisionGroup label="Make a decision" emphasize>
        <DecisionCard
          icon="fa-check"
          title="Approve & publish"
          body="Create a new ConceptDefinition from the content on the Review tab. This can't be undone through the creator."
          actionLabel={acting ? 'Approving…' : 'Approve'}
          primary
          onAction={onApprove}
          disabled={acting}
        />
        <DecisionCard
          icon="fa-xmark"
          title="Reject"
          body="Discard this draft. Nothing gets published; the record stays here for history with your reason."
          actionLabel={acting ? 'Rejecting…' : 'Reject'}
          onAction={onReject}
          disabled={acting}
        />
      </DecisionGroup>

      <DecisionGroup label="Not quite right?">
        <DecisionCard
          icon="fa-magnifying-glass"
          title="Re-run fact-check"
          body="Restore the original post-draft content and run Claude Opus over it again. Skips the expensive drafting step."
          actionLabel="Re-fact-check"
          onAction={() => onRetry('fact_check')}
          disabled={acting}
        />
        <DecisionCard
          icon="fa-arrows-rotate"
          title="Regenerate from scratch"
          body="Throw everything out and restart from the beginning. Re-runs both drafting and fact-check (slowest, most expensive)."
          actionLabel="Regenerate"
          onAction={() => onRetry('generate')}
          disabled={acting}
        />
      </DecisionGroup>
    </div>
  );
}

function DecisionGroup({ label, emphasize, children }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: emphasize ? 'var(--admin-brown-dark)' : 'var(--neutral-600)',
          paddingBottom: 'var(--space-2)',
          borderBottom: `1px solid ${emphasize ? 'var(--admin-brown)' : 'var(--neutral-200)'}`,
          marginBottom: 'var(--space-4)',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {children}
      </div>
    </div>
  );
}

function DecisionCard({ icon, title, body, actionLabel, primary, onAction, disabled }) {
  return (
    <div
      style={{
        padding: 'var(--space-3) var(--space-2)',
        display: 'flex',
        gap: 'var(--space-4)',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: 'var(--radius)',
        background: primary ? 'var(--admin-brown-dark)' : 'var(--admin-brown-light)',
        color: primary ? 'white' : 'var(--admin-brown-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          fontWeight: 700,
          color: 'var(--neutral-900)',
          marginBottom: '2px',
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          color: 'var(--neutral-600)',
          lineHeight: 1.5,
        }}>
          {body}
        </div>
      </div>
      <button
        onClick={onAction}
        disabled={disabled}
        style={primary ? { ...primaryBtn, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' } : { ...secondaryBtn, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function TerminalState({ icon, title, detail, followUp }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid var(--admin-brown-light)',
      borderRadius: 'var(--radius)',
      padding: 'var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 'var(--space-3)',
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'var(--admin-brown-light)',
        color: 'var(--admin-brown-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
      }}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-lg)',
        fontWeight: 700,
        color: 'var(--neutral-900)',
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-600)',
        maxWidth: '480px',
        lineHeight: 1.55,
      }}>
        {detail}
      </div>
      {followUp && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
          {followUp}
        </div>
      )}
    </div>
  );
}

/* ─── Shared atoms ────────────────────────────────── */

function ProgressBanner({ icon, children }) {
  return (
    <div style={{
      background: 'var(--admin-brown-light)',
      border: '1px solid var(--admin-brown)',
      borderLeft: '4px solid var(--admin-brown-dark)',
      padding: 'var(--space-3) var(--space-4)',
      borderRadius: 'var(--radius)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--admin-brown-dark)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
    }}>
      <i className={`fas ${icon}`}></i>
      <span>{children}</span>
    </div>
  );
}

function ErrorBanner({ title, message, actions }) {
  return (
    <div style={{
      background: 'var(--neutral-100)',
      border: '1px solid var(--neutral-900)',
      borderLeft: '4px solid var(--neutral-900)',
      padding: 'var(--space-3) var(--space-4)',
      borderRadius: 'var(--radius)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--neutral-900)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>{title}</div>
      {message && <div style={{ marginBottom: actions ? 'var(--space-3)' : 0 }}>{message}</div>}
      {actions}
    </div>
  );
}

function InfoCard({ title, icon, children, tone }) {
  const tones = {
    success: { bg: 'var(--admin-brown-light)', border: 'var(--admin-brown)', iconColor: 'var(--admin-brown-dark)' },
    neutral: { bg: 'var(--neutral-100)', border: 'var(--neutral-200)', iconColor: 'var(--neutral-600)' },
    default: { bg: 'white', border: 'var(--neutral-200)', iconColor: 'var(--admin-brown)' },
  };
  const t = tones[tone || 'default'];
  return (
    <div style={{
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderRadius: 'var(--radius)',
      padding: 'var(--space-4)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--neutral-800)',
      lineHeight: 1.55,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
        {icon && <i className={`fas ${icon}`} style={{ color: t.iconColor }}></i>}
        <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-900)' }}>{title}</strong>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SourcesList({ sources }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius)', padding: 'var(--space-4)' }}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--neutral-700)', marginBottom: 'var(--space-3)' }}>
        Web search sources · {sources.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '320px', overflowY: 'auto' }}>
        {sources.slice(0, 50).map((src, i) => (
          <a
            key={i}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              color: 'var(--neutral-700)',
              textDecoration: 'none',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius)',
              border: '1px solid transparent',
              transition: 'border-color 0.15s, background 0.15s',
              display: 'block',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--neutral-200)';
              e.currentTarget.style.background = 'var(--neutral-100)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>{src.title || src.url}</div>
            <div style={{ color: 'var(--neutral-500)', fontSize: '11px', wordBreak: 'break-all' }}>{src.url}</div>
          </a>
        ))}
        {sources.length > 50 && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--neutral-500)' }}>
            + {sources.length - 50} more
          </div>
        )}
      </div>
    </div>
  );
}

function valuesEqual(a, b) {
  if (a == null && b == null) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  return a === b;
}
