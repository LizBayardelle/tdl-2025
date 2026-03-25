// Single source of truth for concept types
// Used in ConceptsIndex, ConceptFormModal, and anywhere else concept types are displayed

export const NODE_TYPES = [
  {
    value: 'research_method',
    label: 'Research Method',
    description: 'A research, clinical, or analytical procedure or approach (e.g., fMRI, randomized controlled trial, grounded theory).'
  },
  {
    value: 'measurement',
    label: 'Measurement',
    description: 'A tool used to assess, quantify, or operationalize a concept (e.g., PHQ-9, Stroop Task, ACEs questionnaire).'
  },
  {
    value: 'intervention',
    label: 'Intervention',
    description: 'A treatment, therapy, or deliberate action applied to influence an outcome (e.g., CBT, mindfulness training, pharmacotherapy).'
  },
  {
    value: 'pathology',
    label: 'Pathology',
    description: 'A disease, disorder, or dysfunctional condition (e.g., major depressive disorder, PTSD, schizophrenia).'
  },
  {
    value: 'emotion',
    label: 'Emotion',
    description: 'An affective state or feeling (e.g., fear, joy, anger, sadness).'
  },
  {
    value: 'symptom',
    label: 'Symptom',
    description: 'A sign or manifestation of a condition (e.g., anhedonia, insomnia, hypervigilance).'
  },
  {
    value: 'school_of_thought',
    label: 'School of Thought',
    description: 'A theoretical tradition, paradigm, or intellectual movement (e.g., behaviorism, psychoanalysis, constructivism).'
  },
  {
    value: 'physical_entity',
    label: 'Physical Entity',
    description: 'A concrete or bounded physical thing, including anatomical structures, organisms, or systems (e.g., amygdala, HPA axis, neuron).'
  },
  {
    value: 'physical_process',
    label: 'Physical Process',
    description: 'A measurable biological or physical process (e.g., neurogenesis, synaptic pruning, cortisol release).'
  },
  {
    value: 'non_physical_process',
    label: 'Non-Physical Process',
    description: 'A psychological, cognitive, or social process (e.g., memory consolidation, social learning, cognitive reappraisal).'
  },
  {
    value: 'non_physical_concept',
    label: 'Non-Physical Concept',
    description: 'An abstract idea, construct, or phenomenon (e.g., working memory, self-efficacy, attachment style).'
  },
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
