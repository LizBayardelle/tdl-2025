import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
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
// type ∈ 'single' | 'multi' | 'text' | 'textarea' | 'tags'
const FIELD_GROUPS = [
  {
    title: 'Identification',
    eyebrow: 'What it is',
    fields: [
      { key: 'name', label: 'Test name', type: 'text', required: true, hint: 'The canonical name (e.g., "Independent Samples t-test").' },
      { key: 'aliases', label: 'Aliases', type: 'tags', hint: 'Alternate names.  Used to match auto-detected tags from Haiku.' },
      { key: 'description', label: 'Description', type: 'textarea', hint: 'Optional.  Short, plain-language summary.' },
    ],
  },
  {
    title: 'Purpose',
    eyebrow: 'What it does',
    fields: [
      { key: 'goal', label: 'Goal', type: 'multi', options: GOALS, hint: 'One or more.  What does this test do?' },
    ],
  },
  {
    title: 'Variable Structure',
    eyebrow: 'What goes in',
    fields: [
      { key: 'variable_relationship_structure', label: 'Variable relationship structure', type: 'single', options: VARIABLE_RELATIONSHIP_STRUCTURES },
      { key: 'primary_variable_1_type', label: 'Primary variable 1 type', type: 'single', options: PRIMARY_VARIABLE_1_TYPES },
      { key: 'primary_variable_2_type', label: 'Primary variable 2 type', type: 'single', options: PRIMARY_VARIABLE_2_TYPES },
      { key: 'number_of_dependent_variables', label: 'Number of dependent variables', type: 'single', options: NUMBER_OF_DEPENDENT_VARIABLES },
      { key: 'number_of_predictors', label: 'Number of predictors', type: 'single', options: NUMBER_OF_PREDICTORS },
    ],
  },
  {
    title: 'Design Structure',
    eyebrow: 'How the data is collected',
    fields: [
      { key: 'number_of_groups_conditions', label: 'Number of groups / conditions', type: 'single', options: NUMBER_OF_GROUPS_CONDITIONS },
      { key: 'sample_relationship', label: 'Sample relationship', type: 'single', options: SAMPLE_RELATIONSHIPS },
      { key: 'repeated_observations_present', label: 'Repeated observations present', type: 'single', options: YES_NO },
      { key: 'number_of_timepoints', label: 'Number of timepoints', type: 'single', options: NUMBER_OF_TIMEPOINTS },
      { key: 'time_matters_to_analysis', label: 'Time matters to the analysis', type: 'single', options: YES_NO },
    ],
  },
  {
    title: 'Model Structure',
    eyebrow: 'How the model is built',
    fields: [
      { key: 'covariates_included', label: 'Covariates included', type: 'single', options: SUPPORT_LEVELS },
      { key: 'nested_or_clustered_data', label: 'Nested or clustered data', type: 'single', options: SUPPORT_LEVELS },
      { key: 'data_hierarchy', label: 'Data hierarchy', type: 'single', options: DATA_HIERARCHIES },
      { key: 'mediation', label: 'Mediation', type: 'single', options: SUPPORT_LEVELS },
      { key: 'moderation', label: 'Moderation', type: 'single', options: SUPPORT_LEVELS },
    ],
  },
  {
    title: 'Assumptions & Edge Cases',
    eyebrow: 'When it applies',
    fields: [
      { key: 'parametric_assumptions_reasonably_met', label: 'Parametric assumptions reasonably met', type: 'single', options: YES_NO_UNKNOWN },
      { key: 'outcome_approximately_normal', label: 'Outcome approximately normal', type: 'single', options: YES_NO_UNKNOWN_NA },
      { key: 'equal_variances_assumed', label: 'Equal variances assumed', type: 'single', options: YES_NO_UNKNOWN_NA },
      { key: 'small_sample_concern', label: 'Small sample concern', type: 'single', options: YES_NO_UNKNOWN },
      { key: 'small_expected_cell_counts', label: 'Small expected cell counts', type: 'single', options: YES_NO_UNKNOWN_NA },
      { key: 'overdispersion_present', label: 'Overdispersion present', type: 'single', options: YES_NO_UNKNOWN_NA },
      { key: 'many_zero_values', label: 'Many zero values', type: 'single', options: YES_NO_UNKNOWN_NA },
      { key: 'censoring_present', label: 'Censoring present', type: 'single', options: SUPPORT_LEVELS },
    ],
  },
  {
    title: 'Special Analysis Types',
    eyebrow: 'Particular use cases',
    fields: [
      { key: 'latent_construct_interest', label: 'Latent construct interest', type: 'single', options: YES_NO },
      { key: 'dimension_reduction_goal', label: 'Dimension reduction goal', type: 'single', options: YES_NO },
      { key: 'group_membership_known_in_advance', label: 'Group membership known in advance', type: 'single', options: YES_NO_NA },
      { key: 'agreement_data_type', label: 'Agreement data type', type: 'single', options: AGREEMENT_DATA_TYPES },
    ],
  },
  {
    title: 'Output & Practical',
    eyebrow: 'What it produces',
    fields: [
      { key: 'post_hoc_comparisons_needed', label: 'Post-hoc comparisons needed', type: 'single', options: POST_HOC_OPTIONS },
      { key: 'analysis_scope', label: 'Analysis scope', type: 'single', options: ANALYSIS_SCOPES },
      { key: 'primary_output_desired', label: 'Primary output desired', type: 'multi', options: PRIMARY_OUTPUTS, hint: 'One or more.  What does the test produce?' },
    ],
  },
  {
    title: 'Advanced',
    eyebrow: 'Estimation preferences',
    fields: [
      { key: 'exact_method_needed', label: 'Exact method needed', type: 'single', options: YES_NO_UNKNOWN },
      { key: 'bayesian_approach_desired', label: 'Bayesian approach desired', type: 'single', options: YES_NO },
      { key: 'analysis_preference_level', label: 'Analysis preference level', type: 'single', options: ANALYSIS_PREFERENCE_LEVELS },
      { key: 'complexity_level_allowed', label: 'Complexity level allowed', type: 'single', options: COMPLEXITY_LEVELS },
    ],
  },
];

const ALL_FIELD_KEYS = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

// -----------------------------------------------------------------------------
// Field renderers
// -----------------------------------------------------------------------------

const selectStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--ink-line)',
  borderRadius: 'var(--r-sm)',
  fontSize: '13.5px',
  fontFamily: 'var(--font-body)',
  boxSizing: 'border-box',
  background: 'var(--paper)',
  color: 'var(--ink)',
};

function FieldShell({ label, hint, required, children }) {
  return (
    <div className="sp-field" style={{ marginBottom: 'var(--space-4)' }}>
      <label className="sp-label">
        {label}
        {required && <span style={{ color: 'var(--error)', marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {hint && <div className="sp-help">{hint}</div>}
    </div>
  );
}

function SingleSelect({ value, options, onChange }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      style={selectStyle}
    >
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 'var(--space-2) var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--paper-soft)',
        border: '1px solid var(--ink-line)',
        borderRadius: 'var(--r-sm)',
      }}
    >
      {options.map((opt) => {
        const checked = selected.has(opt);
        return (
          <label
            key={opt}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              className="sp-checkbox"
              checked={checked}
              onChange={() => toggle(opt)}
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
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="sp-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`e.g., "Student's t-test"`}
        />
        <button type="button" onClick={add} className="sp-action sp-action-secondary">
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {tags.map((t) => (
            <span key={t} className="sp-chip is-neutral sp-chip-removable">
              {t}
              <button
                type="button"
                className="sp-chip-x"
                onClick={() => remove(t)}
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
          className="sp-input"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case 'textarea':
      return (
        <textarea
          className="sp-textarea"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
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
    if (!window.confirm('Delete this test?  This cannot be undone.')) return;
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

  const heroTitle = isEdit ? (form.name?.trim() || 'Edit Test') : 'New Statistical Test';
  const heroLead = isEdit
    ? 'Edit the catalog entry.  Saving applies to every source already tagged with this test.'
    : 'Add a test to the catalog so sources can be tagged with it.  Auto-fill from the name to skip the busywork.';

  return (
    <AdminLayout currentPage="statistical_tests">
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-8) clamp(var(--space-4), 4vw, var(--space-8))',
        }}
      >
        <div style={{ maxWidth: '880px', margin: '0 auto' }}>
          <FormHero title={heroTitle} lead={heroLead} />

          {loading ? (
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-3)' }}>Loading.</p>
          ) : (
            <form onSubmit={onSubmit}>
              {error && <Banner tone="error">{error}</Banner>}

              <AutoFillPanel
                onAutoFill={handleAutoFill}
                disabled={autoFilling || !form.name?.trim()}
                disabledReason={!form.name?.trim() ? 'Add a name first.' : null}
                spinning={autoFilling}
                replace={autoFillReplace}
                onReplaceChange={setAutoFillReplace}
                error={autoFillError}
                note={autoFillNote}
              />

              {FIELD_GROUPS.map((group) => (
                <FormSection
                  key={group.title}
                  title={group.title}
                  eyebrow={group.eyebrow}
                >
                  {group.fields.map((field) => (
                    <FieldShell
                      key={field.key}
                      label={field.label}
                      hint={field.hint}
                      required={field.required}
                    >
                      <FieldRenderer
                        field={field}
                        value={form[field.key]}
                        onChange={(v) => update(field.key, v)}
                      />
                    </FieldShell>
                  ))}
                </FormSection>
              ))}

              <FormFooter
                submitting={submitting}
                deleting={deleting}
                isEdit={isEdit}
                disabled={submitting || !form.name?.trim()}
                onDelete={onDelete}
              />
            </form>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

// ---------- Hero ----------

function FormHero({ title, lead }) {
  return (
    <header
      style={{
        marginBottom: 'var(--space-8)',
        paddingBottom: 'var(--space-7)',
        borderBottom: '1px solid var(--ink-line)',
      }}
    >
      <a
        href="/admin/stats"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          color: 'var(--ink-3)',
          textDecoration: 'none',
          marginBottom: '12px',
          display: 'inline-block',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}
      >
        ← Back to catalog
      </a>
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
          fontSize: '40px',
          fontWeight: 600,
          color: 'var(--primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          margin: 0,
          textWrap: 'balance',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '15px',
          color: 'var(--ink-2)',
          lineHeight: 1.65,
          maxWidth: '620px',
          marginTop: '14px',
          marginBottom: 0,
        }}
      >
        {lead}
      </p>
    </header>
  );
}

// ---------- Section ----------

function FormSection({ title, eyebrow, children }) {
  return (
    <section style={{ marginBottom: 'var(--space-7)' }}>
      <div
        style={{
          paddingBottom: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
          borderBottom: '1px solid var(--ink-line)',
        }}
      >
        {eyebrow && (
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              marginBottom: '6px',
            }}
          >
            {eyebrow}
          </div>
        )}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--primary)',
            letterSpacing: '-0.005em',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

// ---------- Auto-fill panel ----------

function AutoFillPanel({ onAutoFill, disabled, disabledReason, spinning, replace, onReplaceChange, error, note }) {
  return (
    <section
      style={{
        background: 'var(--source-tint)',
        border: '1px solid color-mix(in srgb, var(--source) 30%, transparent)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--space-4) var(--space-5)',
        marginBottom: 'var(--space-7)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10.5px',
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--source-2)',
          marginBottom: '8px',
        }}
      >
        Haiku auto-fill
      </div>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13.5px',
          color: 'var(--ink-2)',
          lineHeight: 1.6,
          marginTop: 0,
          marginBottom: 'var(--space-3)',
          maxWidth: '640px',
        }}
      >
        Type a test name above, then offer it to Haiku.  Default: only fills blanks.
        Toggle <em>Replace existing values</em> to override what's already there.
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onAutoFill}
          disabled={disabled}
          title={disabledReason || 'Ask Haiku to fill the columns from the test name'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '34px',
            padding: '0 14px',
            background: disabled ? 'var(--paper-warm)' : 'var(--source)',
            color: disabled ? 'var(--ink-3)' : 'var(--paper)',
            border: `1px solid ${disabled ? 'var(--ink-line)' : 'var(--source)'}`,
            borderRadius: 'var(--r-sm)',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: disabled ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <MagicSparkles size={14} spinning={spinning} />
          {spinning ? 'Filling.' : 'Auto-fill from name'}
        </button>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--ink-2)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            className="sp-checkbox is-source"
            checked={replace}
            onChange={(e) => onReplaceChange(e.target.checked)}
          />
          Replace existing values
        </label>
      </div>

      {error && (
        <div
          style={{
            marginTop: 'var(--space-3)',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--error)',
          }}
        >
          {error}
        </div>
      )}
      {note && (
        <div
          style={{
            marginTop: 'var(--space-3)',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--concept-2)',
          }}
        >
          {note}
        </div>
      )}
    </section>
  );
}

// ---------- Footer ----------

function FormFooter({ submitting, deleting, isEdit, disabled, onDelete }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        display: 'flex',
        gap: 'var(--space-2)',
        alignItems: 'center',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--paper-soft)',
        border: '1px solid var(--ink-line)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
      }}
    >
      <button
        type="submit"
        disabled={disabled}
        className="sp-action sp-action-primary"
      >
        {submitting ? 'Saving.' : (isEdit ? 'Save changes' : 'Create test')}
      </button>
      <a href="/admin/stats" className="sp-action sp-action-secondary">
        Cancel
      </a>
      {isEdit && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="sp-action sp-action-quiet sp-action-danger"
          style={{ marginLeft: 'auto' }}
        >
          {deleting ? 'Deleting.' : 'Delete'}
        </button>
      )}
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
        ...styles,
      }}
    >
      {children}
    </div>
  );
}
