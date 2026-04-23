import React, { useState } from 'react';
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

const primaryButton = {
  background: 'var(--neutral-800)',
  color: 'white',
  border: 'none',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'var(--text-sm)',
  cursor: 'pointer',
};

const secondaryButton = {
  background: 'white',
  color: 'var(--neutral-700)',
  border: '1px solid var(--neutral-300)',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font-display)',
  fontSize: 'var(--text-sm)',
  cursor: 'pointer',
};

export default function AdminConceptGenerationNew() {
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
      const data = await res.json();
      window.location.href = `/admin/concept_generations/${data.id}`;
    } catch (err) {
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
    <AdminLayout currentPage="concept_generations">
      <AdminPageHeader
        title="New Concept Generation"
        subtitle="Kick off a fresh AI-drafted concept definition"
        backHref="/admin/concept_generations"
        backLabel="Back to generations"
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)' }}>
        <div style={{ background: 'white', padding: 'var(--space-6)', borderRadius: 'var(--radius)', border: '1px solid var(--neutral-200)', maxWidth: '640px', boxShadow: 'var(--shadow-sm)' }}>
          {error && (
            <div style={{ padding: 'var(--space-3)', background: 'var(--accent-red-light, #fde8e8)', color: 'var(--accent-red, #9c2a2a)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>
              {error}
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={labelStyle}>Concept Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Frontal Lobe, Working Memory, Cognitive Dissonance"
                style={inputStyle}
                autoFocus
              />
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--neutral-500)', marginTop: '4px' }}>
                This becomes the generation's target concept. Claude may normalize the label (e.g. "frontal lobes" → "Frontal Lobe").
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={labelStyle}>Concept Type</label>
              <select value={conceptType} onChange={(e) => setConceptType(e.target.value)} style={inputStyle}>
                <option value="">(let the classifier decide)</option>
                {CONCEPT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button type="submit" disabled={submitting || !name.trim()} style={{ ...primaryButton, background: (submitting || !name.trim()) ? 'var(--neutral-300)' : 'var(--neutral-800)', cursor: (submitting || !name.trim()) ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Starting...' : 'Generate'}
              </button>
              <a href="/admin/concept_generations" style={{ ...secondaryButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                Cancel
              </a>
            </div>
          </form>
        </div>

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
    </AdminLayout>
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
          A concept definition already exists
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--neutral-700)', marginTop: 0 }}>
          "<strong>{existing.label}</strong>" is already a concept definition (ID {existing.id}). What do you want to do?
        </p>
        {existing.summary && (
          <div style={{ background: 'var(--neutral-100)', padding: 'var(--space-3)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--neutral-700)', marginBottom: 'var(--space-4)' }}>
            {existing.summary}
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button onClick={onRegenerate} style={primaryButton}>Regenerate existing</button>
          <button onClick={onCreateAnyway} style={secondaryButton}>Create new anyway</button>
          <button onClick={onClose} style={{ ...secondaryButton, marginLeft: 'auto' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
