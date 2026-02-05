// Single source of truth for concept node types
// Used in ConceptsIndex, ConceptFormModal, and anywhere else node types are displayed

export const NODE_TYPES = [
  {
    value: 'undeclared',
    label: 'Undeclared',
    description: 'Not yet categorized. Choose a type to better organize your research.'
  },
  {
    value: 'concept',
    label: 'Concept',
    description: 'An abstract idea, construct, or phenomenon studied in research (e.g., internalized racism, working memory, fear conditioning).'
  },
  {
    value: 'theory',
    label: 'Theory / Model',
    description: 'A formal explanatory framework describing how concepts relate or operate (e.g., Minority Stress Theory, Dual Process Model).'
  },
  {
    value: 'method',
    label: 'Method',
    description: 'A research, clinical, or analytical procedure or approach (e.g., fMRI, CBT, randomized controlled trial).'
  },
  {
    value: 'measure',
    label: 'Measure / Instrument',
    description: 'A tool used to assess, quantify, or operationalize a concept (e.g., PHQ-9, Stroop Task, ACEs questionnaire).'
  },
  {
    value: 'entity',
    label: 'Entity',
    description: 'A concrete or bounded thing, including anatomical structures, populations, or named systems (e.g., amygdala, HPA axis, adolescents).'
  },
  {
    value: 'category',
    label: 'Category',
    description: 'A grouping used to organize related concepts via "is-a" relationships (e.g., brain areas, affective disorders, imaging techniques).'
  },
  {
    value: 'subject',
    label: 'Subject',
    description: 'A field, domain, or area of study that provides context rather than content (e.g., social psychology, cognitive neuroscience).'
  },
  {
    value: 'other',
    label: 'Other',
    description: "Anything that doesn't fit the above or is intentionally left uncategorized."
  }
];

// Helper to get label for a value
export const getNodeTypeLabel = (value) => {
  const type = NODE_TYPES.find(t => t.value === value);
  return type ? type.label : value?.replace(/_/g, ' ');
};

// Helper to get description for a value
export const getNodeTypeDescription = (value) => {
  const type = NODE_TYPES.find(t => t.value === value);
  return type ? type.description : '';
};
