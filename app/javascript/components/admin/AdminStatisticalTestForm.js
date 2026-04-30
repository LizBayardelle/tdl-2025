import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import AdminPageHeader from './AdminPageHeader';
import MagicSparkles from '../icons/MagicSparkles';

// -----------------------------------------------------------------------------
// Controlled vocabularies. Keep in sync with app/models/statistical_test.rb.
// -----------------------------------------------------------------------------

const GOALS = [
  'Compare Groups', 'Test Association', 'Predict Outcome', 'Model Change Over Time',
  'Test Mediation', 'Test Moderation', 'Analyze Survival / Time-to-Event',
  'Reduce Dimensions', 'Identify Latent Structure', 'Classify Cases',
  'Assess Agreement', 'Test Frequencies Against Expected Values',
];

const VARIABLE_RELATIONSHIP_STRUCTURES = ['DV–IV Directional', 'Symmetric / Correlation', 'Not Applicable'];
const PRIMARY_VARIABLE_1_TYPES = ['Continuous', 'Ordinal', 'Binary', 'Nominal Categorical', 'Count', 'Time-to-Event', 'None / Not Applicable'];
const PRIMARY_VARIABLE_2_TYPES = ['Continuous', 'Ordinal', 'Binary', 'Nominal Categorical', 'Mixed', 'None / Not Applicable'];
const NUMBER_OF_DEPENDENT_VARIABLES = ['One', 'Multiple'];
const NUMBER_OF_PREDICTORS = ['One', 'Multiple', 'None / Not Applicable'];
const NUMBER_OF_GROUPS_CONDITIONS = ['One', 'Two', 'Three or More', 'None / Not Applicable'];
const SAMPLE_RELATIONSHIPS = ['Independent', 'Paired / Matched', 'Repeated Measures', 'Mixed', 'None / Not Applicable'];
const NUMBER_OF_TIMEPOINTS = ['One', 'Two', 'Three or More', 'Continuous / Event-Based', 'Not Applicable'];
const SUPPORT_LEVELS = ['Not Supported', 'Supported', 'Required'];
const DATA_HIERARCHIES = ['Single Level', 'Nested / Multilevel', 'Longitudinal', 'Cross-Classified', 'Unknown'];
const YES_NO = ['Yes', 'No'];
const YES_NO_UNKNOWN = ['Yes', 'No', 'Unknown'];
const YES_NO_NA = ['Yes', 'No', 'Not Applicable'];
const YES_NO_UNKNOWN_NA = ['Yes', 'No', 'Unknown', 'Not Applicable'];
const AGREEMENT_DATA_TYPES = ['Continuous', 'Ordinal', 'Categorical', 'Not Applicable'];
const POST_HOC_OPTIONS = ['Yes', 'No', 'Possibly', 'Not Applicable'];
const ANALYSIS_SCOPES = ['Unadjusted / Bivariate', 'Adjusted / Multivariable', 'Multivariate'];
const PRIMARY_OUTPUTS = ['Group Difference', 'Correlation', 'Regression Coefficient', 'Odds Ratio', 'Hazard Ratio', 'Latent Factors', 'Clusters', 'Agreement Index', 'Fit Statistic'];
const ANALYSIS_PREFERENCE_LEVELS = ['Classical / Introductory', 'Robust', 'Bayesian', 'Machine Learning', 'No Preference'];
const COMPLEXITY_LEVELS = ['Introductory', 'Intermediate', 'Advanced', 'Any'];

// Field groups drive the form layout. Each field is { key, label, type, options? }.
// type ∈ 'single' | 'multi' | 'text' | 'textarea' | 'tags' | 'number'
const FIELD_GROUPS = [
  {
    title: 'Identification',
    icon: '🧾',
    fields: [
      { key: 'name', label: 'Test Name', type: 'text', required: true, hint: 'The canonical name (e.g., "Independent Samples t-test").' },
      { key: 'aliases', label: 'Aliases', type: 'tags', hint: 'Alternate names. Used to match auto-detected tags from Haiku.' },
      { key: 'description', label: 'Description', type: 'textarea', hint: 'Optional. Short, plain-language summary.' },
    ],
  },
  {
    title: 'Purpose',
    icon: '🎯',
    fields: [
      { key: 'goal', label: 'Goal', type: 'multi', options: GOALS, hint: 'One or more. What does this test do?' },
    ],
  },
  {
    title: 'Variable Structure',
    icon: '🔀',
    fields: [
      { key: 'variable_relationship_structure', label: 'Variable Relationship Structure', type: 'single', options: VARIABLE_RELATIONSHIP_STRUCTURES },
      { key: 'primary_variable_1_type', label: 'Primary Variable 1 Type', type: 'single', options: PRIMARY_VARIABLE_1_TYPES },
      { key: 'primary_variable_2_type', label: 'Primary Variable 2 Type', type: 'single', options: PRIMARY_VARIABLE_2_TYPES },
      { key: 'number_of_dependent_variables', label: 'Number of Dependent Variables', type: 'single', options: NUMBER_OF_DEPENDENT_VARIABLES },
      { key: 'number_of_predictors', label: 'Number of Predictors', type: 'single', options: NUMBER_OF_PREDICTORS },
    ],
  },
  {
    title: 'Design Structure',
    icon: '🧩',
    fields: [
      { key: 'number_of_groups_conditions', label: 'Number of Groups / Conditions', type: 'single', options: NUMBER_OF_GROUPS_CONDITIONS },
      { key: 'sample_relationship', label: 'Sample Relationship', type: 'single', options: SAMPLE_RELATIONSHIPS },
      { key: 'repeated_observations_present', label: 'Repeated Observations Present', type: 'single', options: YES_NO },
      { key: 'number_of_timepoints', label: 'Number of Timepoints', type: 'single', options: NUMBER_OF_TIMEPOINTS },
      { key: 'time_matters_to_analysis', label: 'Time Matters to the Analysis', type: 'single', options: YES_NO },
    ],
  },
  {
    title: 'Model Structure',
    icon: '🧠',
    fields: [
      { key: 'covariates_included', label: 'Covariates Included', type: 'single', options: SUPPORT_LEVELS },
      { key: 'nested_or_clustered_data', label: 'Nested or Clustered Data', type: 'single', options: SUPPORT_LEVELS },
      { key: 'data_hierarchy', label: 'Data Hierarchy', type: 'single', options: DATA_HIERARCHIES },
      { key: 'mediation', label: 'Mediation', type: 'single', options: SUPPORT_LEVELS },
      { key: 'moderation', label: 'Moderation', type: 'single', options: SUPPORT_LEVELS },
    ],
  },
  {
    title: 'Assumptions / Edge Cases',
    icon: '📉',
    fields: [
      { key: 'parametric_assumptions_reasonably_met', label: 'Parametric Assumptions Reasonably Met', type: 'single', options: YES_NO_UNKNOWN },
      { key: 'outcome_approximately_normal', label: 'Outcome Approximately Normal', type: 'single', options: YES_NO_UNKNOWN_NA },
      { key: 'equal_variances_assumed', label: 'Equal Variances Assumed', type: 'single', options: YES_NO_UNKNOWN_NA },
      { key: 'small_sample_concern', label: 'Small Sample Concern', type: 'single', options: YES_NO_UNKNOWN },
      { key: 'small_expected_cell_counts', label: 'Small Expected Cell Counts', type: 'single', options: YES_NO_UNKNOWN_NA },
      { key: 'overdispersion_present', label: 'Overdispersion Present', type: 'single', options: YES_NO_UNKNOWN_NA },
      { key: 'many_zero_values', label: 'Many Zero Values', type: 'single', options: YES_NO_UNKNOWN_NA },
      { key: 'censoring_present', label: 'Censoring Present', type: 'single', options: SUPPORT_LEVELS },
    ],
  },
  {
    title: 'Special Analysis Types',
    icon: '🔬',
    fields: [
      { key: 'latent_construct_interest', label: 'Latent Construct Interest', type: 'single', options: YES_NO },
      { key: 'dimension_reduction_goal', label: 'Dimension Reduction Goal', type: 'single', options: YES_NO },
      { key: 'group_membership_known_in_advance', label: 'Group Membership Known in Advance', type: 'single', options: YES_NO_NA },
      { key: 'agreement_data_type', label: 'Agreement Data Type', type: 'single', options: AGREEMENT_DATA_TYPES },
    ],
  },
  {
    title: 'Output / Practical',
    icon: '⚙️',
    fields: [
      { key: 'post_hoc_comparisons_needed', label: 'Post Hoc Comparisons Needed', type: 'single', options: POST_HOC_OPTIONS },
      { key: 'analysis_scope', label: 'Analysis Scope', type: 'single', options: ANALYSIS_SCOPES },
      { key: 'primary_output_desired', label: 'Primary Output Desired', type: 'multi', options: PRIMARY_OUTPUTS, hint: 'One or more. What does the test produce?' },
    ],
  },
  {
    title: 'Advanced',
    icon: '🧠',
    fields: [
      { key: 'exact_method_needed', label: 'Exact Method Needed', type: 'single', options: YES_NO_UNKNOWN },
      { key: 'bayesian_approach_desired', label: 'Bayesian Approach Desired', type: 'single', options: YES_NO },
      { key: 'analysis_preference_level', label: 'Analysis Preference Level', type: 'single', options: ANALYSIS_PREFERENCE_LEVELS },
      { key: 'complexity_level_allowed', label: 'Complexity Level Allowed', type: 'single', options: COMPLEXITY_LEVELS },
    ],
  },
];

const ALL_FIELD_KEYS = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

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

const labelStyle = {
  display: 'block',
  marginBottom: 'var(--space-1)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  color: 'var(--ink-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const hintStyle = {
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-xs)',
  color: 'var(--ink-3)',
  marginTop: 4,
};

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
};

const secondaryButton = {
  background: 'white',
  color: 'var(--ink)',
  border: '1px solid var(--ink-line)',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-sm)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};

const dangerButton = {
  background: 'white',
  color: 'var(--error)',
  border: '1px solid var(--error)',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-sm)',
  cursor: 'pointer',
};

// -----------------------------------------------------------------------------
// Field renderers
// -----------------------------------------------------------------------------

function FieldShell({ label, hint, required, children }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: 'var(--error)' }}>*</span>}
      </label>
      {children}
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

function SingleSelect({ value, options, onChange }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} style={inputStyle}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function MultiSelect({ values, options, onChange }) {
  const selected = new Set(values || []);
  const toggle = (opt) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(Array.from(next));
  };
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 'var(--space-2)',
      padding: 'var(--space-3)',
      border: '1px solid var(--ink-line)',
      borderRadius: 'var(--radius)',
      background: 'var(--paper-soft)',
    }}>
      {options.map((opt) => {
        const checked = selected.has(opt);
        return (
          <label key={opt} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--ink)',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(opt)}
              style={{ accentColor: 'var(--admin-brown-dark)' }}
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
}

function TagsField({ values, onChange }) {
  const [draft, setDraft] = useState('');
  const tags = values || [];

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (tags.includes(v)) { setDraft(''); return; }
    onChange([...tags, v]);
    setDraft('');
  };

  const remove = (t) => onChange(tags.filter((x) => x !== t));

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`e.g., "Student's t-test"`}
          style={inputStyle}
        />
        <button type="button" onClick={add} style={secondaryButton}>Add</button>
      </div>
      {tags.length > 0 && (
        <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {tags.map((t) => (
            <span key={t} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: '2px var(--space-2)',
              background: 'var(--paper-warm)',
              border: '1px solid var(--ink-line)',
              borderRadius: 'var(--r-pill)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              color: 'var(--ink)',
            }}>
              {t}
              <button
                type="button"
                onClick={() => remove(t)}
                style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 0, fontSize: 'var(--text-sm)', lineHeight: 1 }}
                aria-label={`Remove ${t}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRenderer({ field, value, onChange }) {
  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          style={inputStyle}
        />
      );
    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      );
    case 'tags':
      return <TagsField values={value} onChange={onChange} />;
    case 'single':
      return <SingleSelect value={value} options={field.options} onChange={onChange} />;
    case 'multi':
      return <MultiSelect values={value} options={field.options} onChange={onChange} />;
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Form
// -----------------------------------------------------------------------------

const blankForm = () => {
  const f = { name: '', description: '', aliases: [] };
  FIELD_GROUPS.forEach((g) => g.fields.forEach((field) => {
    if (field.key in f) return;
    f[field.key] = field.type === 'multi' ? [] : null;
  }));
  return f;
};

const csrf = () => document.querySelector('[name="csrf-token"]')?.content;

export default function AdminStatisticalTestForm({ testId = null }) {
  const isEdit = Boolean(testId);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillError, setAutoFillError] = useState('');
  const [autoFillNote, setAutoFillNote] = useState('');
  const [autoFillReplace, setAutoFillReplace] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    fetch(`/admin/stats/${testId}.json`, { headers: { Accept: 'application/json' } })
      .then((r) => {
        if (!r.ok) throw new Error('Could not load test');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const f = blankForm();
        Object.keys(f).forEach((k) => {
          if (k in data) f[k] = data[k];
        });
        setForm(f);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || 'Failed to load test');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [testId, isEdit]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Treat single-select as "blank" if null/empty string; multi-select as
  // "blank" if empty array. Identification fields use the same rules.
  const isBlank = (v) => {
    if (v == null) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.length === 0;
    return false;
  };

  const handleAutoFill = async () => {
    if (!form.name?.trim()) {
      setAutoFillError('Add a name first.');
      return;
    }
    setAutoFilling(true);
    setAutoFillError('');
    setAutoFillNote('');
    try {
      const r = await fetch('/admin/stats/auto_fill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf(),
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          aliases: form.aliases || [],
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setAutoFillError(data.error || 'Auto-fill failed.');
        return;
      }
      const attrs = data.attributes || {};
      let filled = 0;
      let skipped = 0;
      setForm((prev) => {
        const next = { ...prev };
        Object.entries(attrs).forEach(([k, v]) => {
          if (!(k in next)) return;
          if (!autoFillReplace && !isBlank(next[k])) { skipped += 1; return; }
          next[k] = v;
          filled += 1;
        });
        return next;
      });
      const total = Object.keys(attrs).length;
      if (total === 0) {
        setAutoFillError('Haiku declined to fill anything — try adding more context.');
      } else {
        setAutoFillNote(
          autoFillReplace
            ? `Filled ${filled} field${filled === 1 ? '' : 's'} from Haiku.`
            : `Filled ${filled} blank field${filled === 1 ? '' : 's'}${skipped ? `, kept ${skipped} existing value${skipped === 1 ? '' : 's'}` : ''}.`
        );
      }
    } catch (e) {
      console.error(e);
      setAutoFillError('Network error.');
    } finally {
      setAutoFilling(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      setError('Name is required.');
      return;
    }
    setSubmitting(true);
    setError('');

    // Strip blanks from single-select fields so they round-trip as nil rather than ''.
    const payload = { name: form.name, description: form.description, aliases: form.aliases };
    ALL_FIELD_KEYS.forEach((k) => {
      if (k === 'name' || k === 'description' || k === 'aliases') return;
      const v = form[k];
      if (Array.isArray(v)) payload[k] = v;
      else payload[k] = v || null;
    });

    const url = isEdit ? `/admin/stats/${testId}` : '/admin/stats';
    const method = isEdit ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf(), Accept: 'application/json' },
        body: JSON.stringify({ statistical_test: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(', ') || 'Save failed.');
        setSubmitting(false);
        return;
      }
      window.location.href = '/admin/stats';
    } catch (err) {
      setError('Network error.');
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!isEdit) return;
    if (!window.confirm('Delete this test? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/admin/stats/${testId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf(), Accept: 'application/json' },
      });
      if (!res.ok && res.status !== 204) {
        setError('Delete failed.');
        setDeleting(false);
        return;
      }
      window.location.href = '/admin/stats';
    } catch (err) {
      setError('Network error.');
      setDeleting(false);
    }
  };

  const title = isEdit ? (form.name || 'Edit Test') : 'New Statistical Test';

  return (
    <AdminLayout currentPage="statistical_tests">
      <AdminPageHeader
        title={title}
        subtitle={isEdit ? 'Edit catalog entry' : 'Add a test to the catalog'}
        backHref="/admin/stats"
        backLabel="Back to catalog"
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))' }}>
        {loading ? (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Loading…</div>
        ) : (
          <form onSubmit={onSubmit} style={{ maxWidth: 880 }}>
            {error && (
              <div style={{ padding: 'var(--space-3)', background: 'var(--error)', color: 'white', borderRadius: 'var(--radius)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>
                {error}
              </div>
            )}

            <section
              style={{
                background: 'var(--paper-warm)',
                border: '1px solid var(--ink-line)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-4) var(--space-5)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleAutoFill}
                  disabled={autoFilling || !form.name?.trim()}
                  title={!form.name?.trim() ? 'Add a name first' : 'Ask Haiku to fill the columns from the test name'}
                  style={{
                    background: (autoFilling || !form.name?.trim()) ? 'var(--ink-4)' : 'var(--admin-brown-dark)',
                    color: 'white',
                    border: 'none',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 'var(--text-sm)',
                    cursor: (autoFilling || !form.name?.trim()) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <MagicSparkles size={14} spinning={autoFilling} />
                  {autoFilling ? 'Filling…' : 'Auto-fill from name'}
                </button>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--ink-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoFillReplace}
                    onChange={(e) => setAutoFillReplace(e.target.checked)}
                    style={{ accentColor: 'var(--admin-brown-dark)' }}
                  />
                  Replace existing values
                </label>
                <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>
                  Default: only fills blanks. Review and save manually.
                </div>
              </div>
              {autoFillError && (
                <div style={{ marginTop: 'var(--space-2)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--error)' }}>
                  {autoFillError}
                </div>
              )}
              {autoFillNote && (
                <div style={{ marginTop: 'var(--space-2)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--success)' }}>
                  {autoFillNote}
                </div>
              )}
            </section>

            {FIELD_GROUPS.map((group) => (
              <section
                key={group.title}
                style={{
                  background: 'white',
                  border: '1px solid var(--ink-line)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-5)',
                  marginBottom: 'var(--space-4)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  marginTop: 0,
                  marginBottom: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}>
                  <span aria-hidden="true">{group.icon}</span> {group.title}
                </h2>
                {group.fields.map((field) => (
                  <FieldShell key={field.key} label={field.label} hint={field.hint} required={field.required}>
                    <FieldRenderer
                      field={field}
                      value={form[field.key]}
                      onChange={(v) => update(field.key, v)}
                    />
                  </FieldShell>
                ))}
              </section>
            ))}

            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', position: 'sticky', bottom: 0, background: 'var(--paper-soft)', padding: 'var(--space-3)', borderRadius: 'var(--radius)', border: '1px solid var(--ink-line)' }}>
              <button
                type="submit"
                disabled={submitting || !form.name?.trim()}
                style={{
                  ...primaryButton,
                  background: (submitting || !form.name?.trim()) ? 'var(--ink-4)' : 'var(--admin-brown-dark)',
                  cursor: (submitting || !form.name?.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Create test')}
              </button>
              <a href="/admin/stats" style={secondaryButton}>Cancel</a>
              {isEdit && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  style={{ ...dangerButton, marginLeft: 'auto', cursor: deleting ? 'not-allowed' : 'pointer' }}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
