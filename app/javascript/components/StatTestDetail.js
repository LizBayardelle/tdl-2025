import React, { useEffect, useState } from 'react';

// =====================================================================
// StatTestDetail — public detail page for a single statistical test.
// Shows every filled-in column grouped by section. Skips blanks.
// =====================================================================

// Field groupings mirror the admin form so the public read-out reflects
// the same mental model the admin uses to enter data.
const FIELD_GROUPS = [
  {
    title: 'Purpose',
    icon: '🎯',
    fields: [
      { key: 'goal', label: 'Goal' },
    ],
  },
  {
    title: 'Variable Structure',
    icon: '🔀',
    fields: [
      { key: 'variable_relationship_structure', label: 'Variable Relationship Structure' },
      { key: 'primary_variable_1_type', label: 'Primary Variable 1 Type' },
      { key: 'primary_variable_2_type', label: 'Primary Variable 2 Type' },
      { key: 'number_of_dependent_variables', label: 'Number of Dependent Variables' },
      { key: 'number_of_predictors', label: 'Number of Predictors' },
    ],
  },
  {
    title: 'Design Structure',
    icon: '🧩',
    fields: [
      { key: 'number_of_groups_conditions', label: 'Number of Groups / Conditions' },
      { key: 'sample_relationship', label: 'Sample Relationship' },
      { key: 'repeated_observations_present', label: 'Repeated Observations Present' },
      { key: 'number_of_timepoints', label: 'Number of Timepoints' },
      { key: 'time_matters_to_analysis', label: 'Time Matters to the Analysis' },
    ],
  },
  {
    title: 'Model Structure',
    icon: '🧠',
    fields: [
      { key: 'covariates_included', label: 'Covariates Included' },
      { key: 'nested_or_clustered_data', label: 'Nested or Clustered Data' },
      { key: 'data_hierarchy', label: 'Data Hierarchy' },
      { key: 'mediation', label: 'Mediation' },
      { key: 'moderation', label: 'Moderation' },
    ],
  },
  {
    title: 'Assumptions / Edge Cases',
    icon: '📉',
    fields: [
      { key: 'parametric_assumptions_reasonably_met', label: 'Parametric Assumptions Reasonably Met' },
      { key: 'outcome_approximately_normal', label: 'Outcome Approximately Normal' },
      { key: 'equal_variances_assumed', label: 'Equal Variances Assumed' },
      { key: 'small_sample_concern', label: 'Small Sample Concern' },
      { key: 'small_expected_cell_counts', label: 'Small Expected Cell Counts' },
      { key: 'overdispersion_present', label: 'Overdispersion Present' },
      { key: 'many_zero_values', label: 'Many Zero Values' },
      { key: 'censoring_present', label: 'Censoring Present' },
    ],
  },
  {
    title: 'Special Analysis Types',
    icon: '🔬',
    fields: [
      { key: 'latent_construct_interest', label: 'Latent Construct Interest' },
      { key: 'dimension_reduction_goal', label: 'Dimension Reduction Goal' },
      { key: 'group_membership_known_in_advance', label: 'Group Membership Known in Advance' },
      { key: 'agreement_data_type', label: 'Agreement Data Type' },
    ],
  },
  {
    title: 'Output / Practical',
    icon: '⚙️',
    fields: [
      { key: 'post_hoc_comparisons_needed', label: 'Post Hoc Comparisons Needed' },
      { key: 'analysis_scope', label: 'Analysis Scope' },
      { key: 'primary_output_desired', label: 'Primary Output Desired' },
    ],
  },
  {
    title: 'Advanced',
    icon: '🧠',
    fields: [
      { key: 'exact_method_needed', label: 'Exact Method Needed' },
      { key: 'bayesian_approach_desired', label: 'Bayesian Approach Desired' },
      { key: 'analysis_preference_level', label: 'Analysis Preference Level' },
      { key: 'complexity_level_allowed', label: 'Complexity Level Allowed' },
    ],
  },
];

const isBlank = (v) => {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
};

const formatValue = (v) => Array.isArray(v) ? v.join(', ') : v;

export default function StatTestDetail({ slug }) {
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`/stats/${slug}.json`, { headers: { Accept: 'application/json' } })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load test');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setTest(data);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || 'Failed to load test');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))', maxWidth: 880, margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Loading…</div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div style={{ padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))', maxWidth: 880, margin: '0 auto' }}>
        <a href="/stats" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--ink-3)', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
          ← Back to catalog
        </a>
        <div style={{ marginTop: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--error)' }}>
          {error || 'Test not found.'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))', maxWidth: 880, margin: '0 auto' }}>
      <a href="/stats" style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        color: 'var(--ink-3)',
        textDecoration: 'none',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 700,
        display: 'inline-block',
        marginBottom: 'var(--space-3)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ink)'}
      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ink-3)'}>
        ← Back to catalog
      </a>

      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          color: 'var(--ink)',
          letterSpacing: '-0.015em',
          marginTop: 0,
          marginBottom: 'var(--space-1)',
          lineHeight: 1.15,
        }}>
          {test.name}
        </h1>
        {(test.aliases || []).length > 0 && (
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--ink-3)',
            fontStyle: 'italic',
          }}>
            aka {test.aliases.join(', ')}
          </div>
        )}
      </header>

      {test.description && (
        <section
          style={{
            background: 'var(--paper-soft)',
            borderLeft: '3px solid var(--ink-line)',
            padding: 'var(--space-4) var(--space-5)',
            borderRadius: 'var(--radius)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-md)',
            color: 'var(--ink)',
            lineHeight: 1.6,
            margin: 0,
          }}>
            {test.description}
          </p>
        </section>
      )}

      {FIELD_GROUPS.map((group) => {
        const filledFields = group.fields.filter((f) => !isBlank(test[f.key]));
        if (filledFields.length === 0) return null;

        return (
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
            <dl style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(200px, 280px) 1fr',
              columnGap: 'var(--space-4)',
              rowGap: 'var(--space-3)',
              margin: 0,
            }}>
              {filledFields.map((field) => (
                <React.Fragment key={field.key}>
                  <dt style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    color: 'var(--ink-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    paddingTop: 2,
                  }}>
                    {field.label}
                  </dt>
                  <dd style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--ink)',
                    margin: 0,
                  }}>
                    {formatValue(test[field.key])}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
