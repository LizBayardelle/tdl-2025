import React, { useState, useRef, useEffect } from 'react';

// Inverse relationship pairs — given a rel_type as written (src → dst),
// what's the natural way to read it from the dst side?  Used both by the
// picker UI ("Is X a parent of Y, or Y a parent of X?") and by display
// logic when showing connections from the "other" perspective.
//
// Symmetric and unidirectional rels are intentionally omitted; display
// code falls back to a curated passive-form phrase via getReverseText.
export const INVERSE_PAIRS = {
  // Hierarchical
  parent_of: 'child_of',
  child_of: 'parent_of',
  is_a: 'categorizes',
  categorizes: 'is_a',

  // Lineage — builds_on and derived_from are mirror verbs ("A builds_on B"
  // ≡ "B derived_from A"), so we keep the pair for display.
  builds_on: 'derived_from',
  derived_from: 'builds_on',

  // Positional (general)
  is_above: 'is_below',
  is_below: 'is_above',
  contains: 'is_inside',
  is_inside: 'contains',
  faces: 'faces_away_from',
  faces_away_from: 'faces',

  // Positional (anatomical)
  superior_to: 'inferior_to',
  inferior_to: 'superior_to',
  anterior_to: 'posterior_to',
  posterior_to: 'anterior_to',
  medial_to: 'lateral_to',
  lateral_to: 'medial_to',
  dorsal_to: 'ventral_to',
  ventral_to: 'dorsal_to',
  rostral_to: 'caudal_to',
  caudal_to: 'rostral_to',
  proximal_to: 'distal_to',
  distal_to: 'proximal_to',
};

// Vocabulary mirrors the Ruby Connection model.  Source of truth lives in
// `Connection` (KINDS, INPUT_INVERSES, KIND_SCOPE); this constant is the
// JS-side display config — labels and category grouping.  When you add or
// remove a kind, update both sides.
//
// Each category is rendered with its own UI on the show page (hierarchy
// tree, lineage list, etc.) so the visual matches the meaning.
export const RELATIONSHIP_CATEGORIES = [
  {
    label: 'Hierarchical',
    types: [
      { value: 'parent_of',    text: 'is a parent of' },
      { value: 'child_of',     text: 'is a child of' },
      { value: 'is_a',         text: 'is a (categorization)' },
      { value: 'categorizes',  text: 'categorizes' },
    ],
  },
  {
    label: 'Lineage',
    types: [
      { value: 'authored',     text: 'authored' },
      { value: 'builds_on',    text: 'builds on' },
      { value: 'derived_from', text: 'is derived from' },
      { value: 'influenced',   text: 'influenced' },
      { value: 'supports',     text: 'supports' },
      { value: 'critiques',    text: 'critiques' },
    ],
  },
  {
    label: 'Semantic',
    types: [
      { value: 'related_to',       text: 'is related to' },
      { value: 'contrasts_with',   text: 'contrasts with' },
      { value: 'integrates_with',  text: 'integrates with' },
      { value: 'associated_with',  text: 'is associated with' },
    ],
  },
  {
    label: 'Clinical',
    types: [
      { value: 'applies_to',           text: 'applies to' },
      { value: 'treats',               text: 'treats' },
      { value: 'is_treated_by',        text: 'is treated by' },
      { value: 'prevents',             text: 'prevents' },
      { value: 'is_prevented_by',      text: 'is prevented by' },
      { value: 'causes',               text: 'causes' },
      { value: 'is_caused_by',         text: 'is caused by' },
      { value: 'is_symptom_of',        text: 'is a symptom of' },
      { value: 'has_symptom',          text: 'has symptom' },
      { value: 'operationalizes',      text: 'operationalizes' },
      { value: 'is_operationalized_by',text: 'is operationalized by' },
    ],
  },
  {
    label: 'Positional',
    types: [
      // General spatial
      { value: 'is_above',         text: 'is above' },
      { value: 'is_below',         text: 'is below' },
      { value: 'contains',         text: 'contains' },
      { value: 'is_inside',        text: 'is inside' },
      { value: 'faces',            text: 'faces' },
      { value: 'faces_away_from',  text: 'faces away from' },
      { value: 'is_near',          text: 'is near' },
      // Anatomical
      { value: 'superior_to',      text: 'is superior to' },
      { value: 'inferior_to',      text: 'is inferior to' },
      { value: 'anterior_to',      text: 'is anterior to' },
      { value: 'posterior_to',     text: 'is posterior to' },
      { value: 'medial_to',        text: 'is medial to' },
      { value: 'lateral_to',       text: 'is lateral to' },
      { value: 'dorsal_to',        text: 'is dorsal to' },
      { value: 'ventral_to',       text: 'is ventral to' },
      { value: 'rostral_to',       text: 'is rostral to' },
      { value: 'caudal_to',        text: 'is caudal to' },
      { value: 'proximal_to',      text: 'is proximal to' },
      { value: 'distal_to',        text: 'is distal to' },
      { value: 'ipsilateral_to',   text: 'is ipsilateral to' },
      { value: 'contralateral_to', text: 'is contralateral to' },
    ],
  },
];

// Domain scope mirroring Connection::KIND_SCOPE.  The picker uses this to
// hide kinds that don't make sense for the concept_types in play (e.g.
// anatomical positionals between two theories).  When a side is untyped,
// that side is treated as "any" (no restriction).  Kinds not listed here
// are universal — they show for every pair.
const ANATOMICAL_TYPES = ['anatomy', 'physical_entity'];
const KIND_SCOPE = {
  superior_to:      { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
  anterior_to:      { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
  medial_to:        { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
  dorsal_to:        { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
  rostral_to:       { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
  proximal_to:      { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
  ipsilateral_to:   { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
  contralateral_to: { src: ANATOMICAL_TYPES, dst: ANATOMICAL_TYPES },
  treats:           { src: ['intervention', 'method', 'research_method'], dst: ['pathology', 'symptom', 'emotion'] },
  prevents:         { src: ['intervention', 'method', 'research_method'], dst: ['pathology', 'symptom', 'emotion'] },
  causes:           { src: ['pathology', 'phenomenon', 'physical_process', 'non_physical_process'], dst: ['pathology', 'symptom', 'emotion', 'phenomenon'] },
  is_symptom_of:    { src: ['symptom', 'emotion', 'phenomenon'], dst: ['pathology'] },
  operationalizes:  { src: ['measurement', 'method', 'research_method'], dst: ['phenomenon', 'non_physical_concept', 'theory'] },
};

// Map an input phrasing back to its canonical kind so KIND_SCOPE lookups
// work for both directions of an inverse pair.  Mirrors Connection::INPUT_INVERSES.
const INPUT_TO_CANONICAL = {
  child_of: 'parent_of',
  categorizes: 'is_a',
  builds_on: 'prerequisite_for',
  derived_from: 'influenced',
  is_below: 'is_above',
  is_inside: 'contains',
  faces_away_from: 'faces',
  inferior_to: 'superior_to',
  posterior_to: 'anterior_to',
  lateral_to: 'medial_to',
  ventral_to: 'dorsal_to',
  caudal_to: 'rostral_to',
  distal_to: 'proximal_to',
  is_treated_by: 'treats',
  is_prevented_by: 'prevents',
  is_caused_by: 'causes',
  has_symptom: 'is_symptom_of',
  is_operationalized_by: 'operationalizes',
};

function pairFits(scope, srcType, dstType) {
  const okSrc = !srcType || !scope.src || scope.src.includes(srcType);
  const okDst = !dstType || !scope.dst || scope.dst.includes(dstType);
  return okSrc && okDst;
}

// Returns true if the picker should show this rel_type for a concept pair
// with the given concept_types.  Either type may be null/undefined.
export function isKindApplicable(relType, srcType, dstType) {
  const canonical = INPUT_TO_CANONICAL[relType] || relType;
  const scope = KIND_SCOPE[canonical];
  if (!scope) return true; // universal
  return pairFits(scope, srcType, dstType) || pairFits(scope, dstType, srcType);
}

// Lookup helpers used by both the picker and the show page.
export const REL_TYPES_FLAT = RELATIONSHIP_CATEGORIES.flatMap((cat) =>
  cat.types.map((t) => ({ ...t, category: cat.label }))
);

const REL_TYPE_BY_VALUE = REL_TYPES_FLAT.reduce((acc, t) => {
  acc[t.value] = t;
  return acc;
}, {});

export const getRelTypeText = (value) => REL_TYPE_BY_VALUE[value]?.text || (value || '').replace(/_/g, ' ');

export const getRelTypeCategory = (value) => REL_TYPE_BY_VALUE[value]?.category || 'Other';

export const getInverseRelType = (relType) => INVERSE_PAIRS[relType] || null;

// Synthesized passive phrasing for unidirectional verbs viewed from the
// "other" side.  Symmetric verbs return the same phrasing in both directions.
const PASSIVE_BY_FORM = {
  authored:        'is authored by',
  influenced:      'was influenced by',
  supports:        'is supported by',
  critiques:       'is critiqued by',
  extends:         'is extended by',
  synthesizes:     'is synthesized by',
  applies_to:      'is applied to by',
  treats:          'is treated by',
  causes:          'is caused by',
  is_symptom_of:   'has symptom',
  operationalizes: 'is operationalized by',
  prevents:        'is prevented by',
  // Symmetric — incoming reads the same as outgoing
  related_to:      'is related to',
  contrasts_with:  'contrasts with',
  integrates_with: 'integrates with',
  associated_with: 'is associated with',
  synonym_of:      'is a synonym of',
  // Anatomy positional ipsi/contra are symmetric
  ipsilateral_to:   'is ipsilateral to',
  contralateral_to: 'is contralateral to',
  is_near:          'is near',
};

// Returns the verb phrase to display for a connection from the focal
// concept's perspective.  isOutgoing = true when the focal is the src.
export const getDirectionalRelText = (relType, isOutgoing) => {
  if (isOutgoing) return getRelTypeText(relType);
  const inverse = INVERSE_PAIRS[relType];
  if (inverse) return getRelTypeText(inverse);
  return PASSIVE_BY_FORM[relType] || `${getRelTypeText(relType)} by`;
};

// Bucket helpers for the show page: given a list of connections and the
// focal id, returns one bucket per category with each connection annotated
// from the focal's perspective.
export const groupConnectionsByCategory = (connections, focalId) => {
  const buckets = {
    Hierarchical: [],
    Lineage: [],
    Semantic: [],
    Clinical: [],
    Positional: [],
    Other: [],
  };
  connections.forEach((conn) => {
    const isOutgoing = conn.src_concept?.id === focalId;
    const other = isOutgoing ? conn.dst_concept : conn.src_concept;
    if (!other) return;
    const category = getRelTypeCategory(conn.rel_type);
    const verb = getDirectionalRelText(conn.rel_type, isOutgoing);
    (buckets[category] || buckets.Other).push({
      id: conn.id,
      rel_type: conn.rel_type,
      isOutgoing,
      other,
      verb,
    });
  });
  return buckets;
};

// =====================================================================
// InlineRelTypeSelect — picker widget (existing UI, taxonomy-driven).
// =====================================================================
export default function InlineRelTypeSelect({ value, onChange, themeColor = 'var(--concept)', srcConceptType = null, dstConceptType = null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = REL_TYPE_BY_VALUE[value];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: '4px 10px',
          fontFamily: 'var(--font-body)',
          fontSize: '12.5px',
          color: themeColor,
          background: 'transparent',
          border: `1px solid ${themeColor}`,
          borderRadius: 'var(--r-sm)',
          cursor: 'pointer',
        }}
      >
        {current ? current.text : 'Pick a relationship'} ▾
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'var(--paper)',
            border: '1px solid var(--ink-line)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-lg, 0 12px 32px rgba(15, 23, 35, 0.18))',
            zIndex: 10,
            padding: '6px',
            minWidth: '240px',
            maxHeight: '360px',
            overflowY: 'auto',
          }}
        >
          {RELATIONSHIP_CATEGORIES.map((cat) => {
            const visibleTypes = cat.types.filter((t) => isKindApplicable(t.value, srcConceptType, dstConceptType));
            if (visibleTypes.length === 0) return null;
            return (
            <div key={cat.label} style={{ marginBottom: '6px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                  padding: '4px 8px',
                }}
              >
                {cat.label}
              </div>
              {visibleTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { onChange(t.value); setOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '5px 10px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: value === t.value ? themeColor : 'var(--ink-2)',
                    background: value === t.value ? 'var(--concept-tint, var(--paper-soft))' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--r-sm)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { if (value !== t.value) e.currentTarget.style.background = 'var(--hover)'; }}
                  onMouseLeave={(e) => { if (value !== t.value) e.currentTarget.style.background = 'transparent'; }}
                >
                  {t.text}
                </button>
              ))}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
