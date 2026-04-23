import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from './AdminLayout';
import AdminPageHeader from './AdminPageHeader';

const CONTENT_FIELDS = [
  { key: 'label', label: 'Label', type: 'single' },
  { key: 'aliases', label: 'Aliases', type: 'array' },
  { key: 'summary', label: 'Summary', type: 'multi' },
  { key: 'description', label: 'Description', type: 'multi' },
  { key: 'location', label: 'Location', type: 'multi' },
  { key: 'examples', label: 'Examples', type: 'multi' },
  { key: 'etymology', label: 'Etymology', type: 'multi' },
  { key: 'school_of_thought', label: 'School of Thought', type: 'single' },
  { key: 'history', label: 'History', type: 'multi' },
  { key: 'controversy', label: 'Controversy', type: 'multi' },
  { key: 'clinical_relevance', label: 'Clinical Relevance', type: 'multi' },
  { key: 'misconceptions', label: 'Misconceptions', type: 'multi' },
  { key: 'mnemonic', label: 'Mnemonic', type: 'multi' },
  { key: 'developmental_notes', label: 'Developmental Notes', type: 'multi' },
  { key: 'measurement_notes', label: 'Measurement Notes', type: 'multi' },
];

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

const TERMINAL_STATUSES = ['approved', 'rejected', 'failed'];
const IN_PROGRESS_STATUSES = ['pending', 'generating', 'fact_checking', 'enriching'];

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

export default function AdminConceptGenerationShow({ generationId }) {
  const [gen, setGen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
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
      // Initialize edits ONCE from the first server response that has content
      if (!editsInitializedRef.current && data.content) {
        const initial = {};
        CONTENT_FIELDS.forEach((f) => {
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

  // Poll while in-progress
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

  const updateEdit = (key, value) => {
    setEdits((e) => ({ ...e, [key]: value }));
    setDirty(true);
  };

  const saveEdits = async () => {
    setSaving(true);
    try {
      const payload = { concept_generation: { ...edits } };
      const res = await fetch(`/admin/concept_generations/${generationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.errors?.join(', ') || 'Save failed');
      } else {
        const data = await res.json();
        setGen(data);
        setDirty(false);
      }
    } catch (err) {
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
        const data = await res.json();
        setGen(data);
      }
    } finally {
      setActing(false);
    }
  };

  const reject = async () => {
    const reason = prompt('Reason for rejection (optional):');
    if (reason === null) return; // cancelled
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
        <AdminPageHeader title="Loading..." backHref="/admin/concept_generations" backLabel="Back to generations" />
        <div style={{ padding: 'var(--space-6) var(--space-8)', fontFamily: 'var(--font-body)', color: 'var(--neutral-500)' }}>Loading...</div>
      </AdminLayout>
    );
  }
  if (!gen) {
    return (
      <AdminLayout currentPage="concept_generations">
        <AdminPageHeader title="Not found" backHref="/admin/concept_generations" backLabel="Back to generations" />
        <div style={{ padding: 'var(--space-6) var(--space-8)', fontFamily: 'var(--font-body)', color: 'var(--accent-red, #9c2a2a)' }}>{error || 'Generation not found'}</div>
      </AdminLayout>
    );
  }

  const meta = STATUS_META[gen.status] || STATUS_META.pending;
  const isInProgress = IN_PROGRESS_STATUSES.includes(gen.status);
  const isReadyForReview = gen.status === 'ready_for_review';
  const isTerminal = TERMINAL_STATUSES.includes(gen.status);
  const hasContent = gen.content && Object.values(gen.content).some((v) => v && (Array.isArray(v) ? v.length : true));

  const actions = (
    <span style={{ padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 'var(--text-xs)', fontWeight: 600, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.05em', background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );

  return (
    <AdminLayout currentPage="concept_generations">
      <AdminPageHeader
        title={gen.concept_name}
        subtitle={`${gen.concept_type || 'untyped'} · created ${new Date(gen.created_at).toLocaleString()}`}
        actions={actions}
        backHref="/admin/concept_generations"
        backLabel="Back to generations"
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)' }}>
        {/* Status banner / progress */}
        {isInProgress && (
          <div style={{ background: 'var(--neutral-100)', border: '1px solid var(--neutral-200)', padding: 'var(--space-4)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--neutral-700)' }}>
            <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--neutral-500)' }}></i>
            <span>
              {gen.status === 'generating' && 'Stage 1: Claude (Sonnet) is researching and drafting from authoritative sources. ~3-5 minutes.'}
              {gen.status === 'fact_checking' && 'Stage 2: Claude (Opus) is fact-checking the draft against sources, looking for errors and missing hedging. ~3-5 minutes.'}
              {gen.status === 'enriching' && 'Stage 3: enriching links from search sources.'}
              {gen.status === 'pending' && 'Queued for stage 1 generation.'}
            </span>
          </div>
        )}

        {gen.status === 'failed' && (
          <div style={{ background: 'var(--accent-red-light, #fde8e8)', border: '1px solid var(--accent-red, #9c2a2a)', padding: 'var(--space-4)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--accent-red, #9c2a2a)' }}>
            <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Generation failed</div>
            {Object.entries(gen.stage_errors || {}).map(([stage, info]) => (
              <div key={stage} style={{ marginBottom: 'var(--space-2)' }}>
                <strong>{stage}:</strong> {info.message || JSON.stringify(info)}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              {gen.stage_errors?.fact_check && (
                <button onClick={() => retryStage('fact_check')} disabled={acting} style={{ background: 'var(--neutral-800)', color: 'white', border: 'none', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', cursor: acting ? 'not-allowed' : 'pointer' }}>
                  {acting ? 'Retrying...' : 'Retry fact-check only'}
                </button>
              )}
              <button onClick={() => retryStage('generate')} disabled={acting} style={{ background: gen.stage_errors?.fact_check ? 'white' : 'var(--neutral-800)', color: gen.stage_errors?.fact_check ? 'var(--neutral-700)' : 'white', border: gen.stage_errors?.fact_check ? '1px solid var(--neutral-300)' : 'none', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', cursor: acting ? 'not-allowed' : 'pointer' }}>
                {acting ? 'Retrying...' : 'Restart from generation'}
              </button>
            </div>
          </div>
        )}

        {gen.status === 'approved' && (
          <div style={{ background: '#e8f4ec', border: '1px solid #2d6a3e', padding: 'var(--space-4)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: '#1e4a2c' }}>
            <i className="fas fa-check-circle" style={{ marginRight: 'var(--space-2)' }}></i>
            Approved on {new Date(gen.approved_at).toLocaleString()}. ConceptDefinition #{gen.approved_concept_definition_id} created.
          </div>
        )}

        {gen.status === 'rejected' && (
          <div style={{ background: '#fbe8e8', border: '1px solid #7a3030', padding: 'var(--space-4)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: '#5a1f1f' }}>
            <i className="fas fa-times-circle" style={{ marginRight: 'var(--space-2)' }}></i>
            Rejected{gen.rejected_reason ? `: ${gen.rejected_reason}` : '.'}
          </div>
        )}

        {/* Action bar for ready_for_review */}
        {isReadyForReview && (
          <div style={{ background: 'white', border: '1px solid var(--neutral-200)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={saveEdits} disabled={!dirty || saving} style={{ background: dirty ? 'var(--neutral-800)' : 'var(--neutral-300)', color: 'white', border: 'none', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', cursor: dirty ? 'pointer' : 'not-allowed' }}>
              {saving ? 'Saving...' : dirty ? 'Save edits' : 'Saved'}
            </button>
            <button onClick={approve} disabled={acting} style={{ background: '#2d6a3e', color: 'white', border: 'none', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', cursor: acting ? 'not-allowed' : 'pointer' }}>
              <i className="fas fa-check" style={{ marginRight: 'var(--space-2)' }}></i>
              Approve &amp; create ConceptDefinition
            </button>
            <button onClick={reject} disabled={acting} style={{ background: 'white', color: '#7a3030', border: '1px solid #7a3030', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', cursor: acting ? 'not-allowed' : 'pointer' }}>
              Reject
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => retryStage('fact_check')} disabled={acting} style={{ background: 'white', color: 'var(--neutral-700)', border: '1px solid var(--neutral-300)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', cursor: acting ? 'not-allowed' : 'pointer' }} title="Restore original draft and re-run fact-check only">
                <i className="fas fa-magnifying-glass" style={{ marginRight: 'var(--space-2)' }}></i>
                Re-fact-check
              </button>
              <button onClick={() => retryStage('generate')} disabled={acting} style={{ background: 'white', color: 'var(--neutral-700)', border: '1px solid var(--neutral-300)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', cursor: acting ? 'not-allowed' : 'pointer' }} title="Discard current draft and start over from scratch">
                <i className="fas fa-redo" style={{ marginRight: 'var(--space-2)' }}></i>
                Regenerate
              </button>
            </div>
          </div>
        )}

        {/* Fact-check notes */}
        {(gen.fact_check_notes || []).length > 0 && (
          <FactCheckNotesPanel notes={gen.fact_check_notes} />
        )}

        {/* Content fields */}
        {hasContent ? (
          <div style={{ background: 'white', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius)', padding: 'var(--space-6)' }}>
            {CONTENT_FIELDS.map((field) => {
              const value = edits[field.key] ?? (field.type === 'array' ? [] : '');
              const disabled = isTerminal || isInProgress;
              return (
                <div key={field.key} style={{ marginBottom: 'var(--space-5)' }}>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                    {field.label}
                  </label>
                  {field.type === 'array' ? (
                    <input
                      type="text"
                      value={(Array.isArray(value) ? value : []).join(', ')}
                      onChange={(e) => updateEdit(field.key, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                      disabled={disabled}
                      placeholder="Comma-separated aliases"
                      style={inputStyle}
                    />
                  ) : field.type === 'single' ? (
                    <input
                      type="text"
                      value={value || ''}
                      onChange={(e) => updateEdit(field.key, e.target.value)}
                      disabled={disabled}
                      style={inputStyle}
                    />
                  ) : (
                    <textarea
                      value={value || ''}
                      onChange={(e) => updateEdit(field.key, e.target.value)}
                      disabled={disabled}
                      rows={Math.max(3, Math.min(12, (value || '').split('\n').length + 1))}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : !isInProgress && (
          <div style={{ background: 'white', padding: 'var(--space-8)', borderRadius: 'var(--radius)', textAlign: 'center', color: 'var(--neutral-500)', fontFamily: 'var(--font-body)', border: '1px solid var(--neutral-200)' }}>
            No content yet.
          </div>
        )}

        {/* Sources */}
        {(gen.web_search_sources || []).length > 0 && (
          <div style={{ background: 'white', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--neutral-900)', margin: 0, marginBottom: 'var(--space-3)' }}>
              Web Search Sources ({gen.web_search_sources.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxHeight: '300px', overflowY: 'auto' }}>
              {gen.web_search_sources.slice(0, 50).map((src, i) => (
                <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--neutral-700)', textDecoration: 'none', padding: 'var(--space-1) 0', borderBottom: '1px solid var(--neutral-100)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>{src.title || src.url}</div>
                  <div style={{ color: 'var(--neutral-500)', fontSize: '11px', wordBreak: 'break-all' }}>{src.url}</div>
                </a>
              ))}
              {gen.web_search_sources.length > 50 && (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--neutral-500)', marginTop: 'var(--space-2)' }}>
                  + {gen.web_search_sources.length - 50} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Token usage */}
        {gen.token_usage && Object.keys(gen.token_usage).length > 0 && (
          <div style={{ background: 'white', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--neutral-900)', margin: 0, marginBottom: 'var(--space-3)' }}>
              Token Usage
            </h3>
            <pre style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-xs)', color: 'var(--neutral-700)', margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(gen.token_usage, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function FactCheckNotesPanel({ notes }) {
  const severityColor = (sev) => {
    switch ((sev || '').toLowerCase()) {
      case 'major': return { bg: '#fbe8e8', border: '#7a3030', color: '#5a1f1f' };
      case 'moderate': return { bg: '#fff4e0', border: '#9c6a1c', color: '#5e3f0a' };
      case 'minor': return { bg: '#eef2f7', border: '#4a5b73', color: '#1f2937' };
      default: return { bg: 'var(--neutral-100)', border: 'var(--neutral-300)', color: 'var(--neutral-700)' };
    }
  };

  return (
    <div style={{ background: 'white', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--neutral-900)', margin: 0, marginBottom: 'var(--space-3)' }}>
        <i className="fas fa-magnifying-glass" style={{ marginRight: 'var(--space-2)', color: 'var(--neutral-500)' }}></i>
        Fact-check changes ({notes.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {notes.map((note, i) => {
          const c = severityColor(note.severity);
          return (
            <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 'var(--radius)', padding: 'var(--space-3)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: c.color }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                <strong style={{ fontFamily: 'var(--font-display)' }}>{note.field || '(field unspecified)'}</strong>
                {note.severity && (
                  <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, padding: '2px 6px', background: 'rgba(0,0,0,0.06)', borderRadius: '3px' }}>
                    {note.severity}
                  </span>
                )}
              </div>
              {note.issue && <div style={{ marginBottom: '4px' }}><strong>Issue:</strong> {note.issue}</div>}
              {note.change && <div><strong>Change:</strong> {note.change}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
