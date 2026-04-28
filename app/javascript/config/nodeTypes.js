// Single source of truth for concept types.
// Used in ConceptsIndex, ConceptFormModal, ConceptShow, and anywhere
// concept types are displayed.
//
// Stored as snake_case in the DB (e.g. "phenomenon", "theory") and shown
// as plain-language labels via these helpers.

export const NODE_TYPES = [
  {
    value: 'field',
    label: 'Field',
    description: 'Disciplines and areas of study.',
    examples: ['neuroscience', 'developmental psychology'],
  },
  {
    value: 'theory',
    label: 'Theory',
    description: 'Frameworks, models, or schools of thought.',
    examples: ['attachment theory', 'social cognitive theory'],
  },
  {
    value: 'phenomenon',
    label: 'Phenomenon',
    description: 'Observable patterns, emotions, behaviors, or social states.',
    examples: ['anxiety', 'racism', 'trust'],
  },
  {
    value: 'process',
    label: 'Process',
    description: 'Biological, cognitive, or social processes.',
    examples: ['memory consolidation', 'neurogenesis'],
  },
  {
    value: 'anatomy',
    label: 'Anatomy',
    description: 'Physical structures, body parts, and brain regions.',
    examples: ['femur', 'amygdala', 'prefrontal cortex'],
  },
  {
    value: 'pathology',
    label: 'Pathology',
    description: 'Diseases, disorders, and clinical conditions.',
    examples: ['cancer', 'depression', 'ADHD'],
  },
  {
    value: 'intervention',
    label: 'Intervention',
    description: 'Treatments, therapies, and drugs.',
    examples: ['CBT', 'exposure therapy', 'SSRIs'],
  },
  {
    value: 'measurement',
    label: 'Measurement',
    description: 'Scales, instruments, and assessments.',
    examples: ['Beck Depression Inventory', 'Strange Situation'],
  },
  {
    value: 'method',
    label: 'Method',
    description: 'Research methodologies and study designs.',
    examples: ['RCT', 'ethnography', 'fMRI'],
  },
];

const TYPE_BY_VALUE = NODE_TYPES.reduce((acc, t) => {
  acc[t.value] = t;
  return acc;
}, {});

export function getNodeType(value) {
  return TYPE_BY_VALUE[value] || null;
}

export function getNodeTypeLabel(value) {
  if (!value) return '';
  return TYPE_BY_VALUE[value]?.label || String(value).replace(/_/g, ' ');
}

export function getNodeTypeDescription(value) {
  return TYPE_BY_VALUE[value]?.description || '';
}

export function getNodeTypeExamples(value) {
  return TYPE_BY_VALUE[value]?.examples || [];
}
