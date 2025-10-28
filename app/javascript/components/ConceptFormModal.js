import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import HierarchicalConceptSelect from './HierarchicalConceptSelect';

export default function ConceptFormModal({ isOpen, onClose, onSuccess, item }) {
  const [people, setPeople] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [activeTab, setActiveTab] = useState('basics');
  const [formData, setFormData] = useState({
    label: '',
    node_type: 'model',
    level_status: 'mapped',
    summary_top: '',
    summary_mid: '',
    summary_deep: '',
    mechanisms: [],
    signature_techniques: [],
    strengths: [],
    weaknesses: [],
    adjacent_models: [],
    contrasts_with: [],
    integrates_with: [],
    intake_questions: [],
    micro_skills: [],
    practice_prompts: [],
    assessment_links: [],
    evidence_brief: '',
    confidence_note: '',
    tags: [],
    people_ids: [],
    new_relationship_dst_concept_id: '',
    new_relationship_rel_type: 'related_to'
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('basics');
      fetchPeople();
      fetchConcepts();
      if (item) {
        setFormData({
          label: item.label || '',
          node_type: item.node_type || 'model',
          level_status: item.level_status || 'mapped',
          summary_top: item.summary_top || '',
          summary_mid: item.summary_mid || '',
          summary_deep: item.summary_deep || '',
          mechanisms: item.mechanisms || [],
          signature_techniques: item.signature_techniques || [],
          strengths: item.strengths || [],
          weaknesses: item.weaknesses || [],
          adjacent_models: item.adjacent_models || [],
          contrasts_with: item.contrasts_with || [],
          integrates_with: item.integrates_with || [],
          intake_questions: item.intake_questions || [],
          micro_skills: item.micro_skills || [],
          practice_prompts: item.practice_prompts || [],
          assessment_links: item.assessment_links || [],
          evidence_brief: item.evidence_brief || '',
          confidence_note: item.confidence_note || '',
          tags: item.tags || [],
          people_ids: item.people_ids || [],
          new_relationship_dst_concept_id: '',
          new_relationship_rel_type: 'related_to'
        });
      } else {
        setFormData({
          label: '',
          node_type: 'model',
          level_status: 'mapped',
          summary_top: '',
          summary_mid: '',
          summary_deep: '',
          mechanisms: [],
          signature_techniques: [],
          strengths: [],
          weaknesses: [],
          adjacent_models: [],
          contrasts_with: [],
          integrates_with: [],
          intake_questions: [],
          micro_skills: [],
          practice_prompts: [],
          assessment_links: [],
          evidence_brief: '',
          confidence_note: '',
          tags: [],
          people_ids: [],
          new_relationship_dst_concept_id: '',
          new_relationship_rel_type: 'related_to'
        });
      }
      setError('');
    }
  }, [isOpen, item]);

  const fetchPeople = async () => {
    try {
      const response = await fetch('/people.json');
      const data = await response.json();
      setPeople(data);
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  const fetchConcepts = async () => {
    try {
      const response = await fetch('/concepts.json');
      const data = await response.json();
      setConcepts(data);
    } catch (error) {
      console.error('Error fetching concepts:', error);
    }
  };

  const handleArrayInput = (field, value) => {
    const items = value.split('\n').filter(item => item.trim());
    setFormData({ ...formData, [field]: items });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const url = item ? `/concepts/${item.id}` : '/concepts';
      const method = item ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ concept: formData }),
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data);
        onClose();
      } else {
        const data = await response.json();
        setError(data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error saving concept:', error);
      setError('An error occurred while saving the concept');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Construct' : 'New Construct'}
      size="large"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-0">
          <button
            type="button"
            onClick={() => setActiveTab('basics')}
            className={`px-6 py-2 font-medium rounded-t-lg ${activeTab === 'basics' ? '!bg-sand !text-gray-800' : '!bg-primary !text-sand hover:!bg-accent-dark'}`}
          >
            Basics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('summaries')}
            className={`px-6 py-2 font-medium rounded-t-lg ${activeTab === 'summaries' ? '!bg-sand !text-gray-800' : '!bg-primary !text-sand hover:!bg-accent-dark'}`}
          >
            Summaries
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-6 py-2 font-medium rounded-t-lg ${activeTab === 'details' ? '!bg-sand !text-gray-800' : '!bg-primary !text-sand hover:!bg-accent-dark'}`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('relationships')}
            className={`px-6 py-2 font-medium rounded-t-lg ${activeTab === 'relationships' ? '!bg-sand !text-gray-800' : '!bg-primary !text-sand hover:!bg-accent-dark'}`}
          >
            Relationships
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto bg-sand p-6 rounded-b-lg rounded-tr-lg shadow-lg" style={{ minHeight: '400px' }}>
          {activeTab === 'basics' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Label *</label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type *</label>
                  <select
                    value={formData.node_type}
                    onChange={(e) => setFormData({ ...formData, node_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  >
                    <option value="model">Model</option>
                    <option value="technique">Technique</option>
                    <option value="construct">Construct</option>
                    <option value="measure">Measure</option>
                    <option value="population">Population</option>
                    <option value="category">Category</option>
                    <option value="discipline">Discipline</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={formData.level_status}
                    onChange={(e) => setFormData({ ...formData, level_status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  >
                    <option value="mapped">Mapped</option>
                    <option value="basic">Basic</option>
                    <option value="deep">Deep</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Summary Top (2-3 sentences)
                </label>
                <textarea
                  value={formData.summary_top}
                  onChange={(e) => setFormData({ ...formData, summary_top: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                />
              </div>
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Summary Mid (~200 words)
                </label>
                <textarea
                  value={formData.summary_mid}
                  onChange={(e) => setFormData({ ...formData, summary_mid: e.target.value })}
                  rows="8"
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Summary Deep (~600 words)
                </label>
                <textarea
                  value={formData.summary_deep}
                  onChange={(e) => setFormData({ ...formData, summary_deep: e.target.value })}
                  rows="12"
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                />
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Mechanisms (one per line)
                  </label>
                  <textarea
                    value={formData.mechanisms.join('\n')}
                    onChange={(e) => handleArrayInput('mechanisms', e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Signature Techniques (one per line)
                  </label>
                  <textarea
                    value={formData.signature_techniques.join('\n')}
                    onChange={(e) => handleArrayInput('signature_techniques', e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Strengths (one per line)
                  </label>
                  <textarea
                    value={formData.strengths.join('\n')}
                    onChange={(e) => handleArrayInput('strengths', e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Weaknesses (one per line)
                  </label>
                  <textarea
                    value={formData.weaknesses.join('\n')}
                    onChange={(e) => handleArrayInput('weaknesses', e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Intake Questions (one per line)
                  </label>
                  <textarea
                    value={formData.intake_questions.join('\n')}
                    onChange={(e) => handleArrayInput('intake_questions', e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Micro Skills (one per line)
                  </label>
                  <textarea
                    value={formData.micro_skills.join('\n')}
                    onChange={(e) => handleArrayInput('micro_skills', e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Practice Prompts (one per line)
                  </label>
                  <textarea
                    value={formData.practice_prompts.join('\n')}
                    onChange={(e) => handleArrayInput('practice_prompts', e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Assessment Links (one per line)
                  </label>
                  <textarea
                    value={formData.assessment_links.join('\n')}
                    onChange={(e) => handleArrayInput('assessment_links', e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tags (one per line)
                  </label>
                  <textarea
                    value={formData.tags.join('\n')}
                    onChange={(e) => handleArrayInput('tags', e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Link People (hold Cmd/Ctrl to select multiple)
                </label>
                <select
                  multiple
                  value={formData.people_ids}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value));
                    setFormData({ ...formData, people_ids: selected });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  size="5"
                >
                  {people.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.full_name} ({person.role})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-1">
                  Selected: {formData.people_ids.length} {formData.people_ids.length === 1 ? 'person' : 'people'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Evidence Brief
                </label>
                <textarea
                  value={formData.evidence_brief}
                  onChange={(e) => setFormData({ ...formData, evidence_brief: e.target.value })}
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Confidence Note
                </label>
                <textarea
                  value={formData.confidence_note}
                  onChange={(e) => setFormData({ ...formData, confidence_note: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                />
              </div>
            </div>
          )}

          {activeTab === 'relationships' && (
            <div className="space-y-4">
              {/* Quick Add Relationship */}
              <div className="bg-white border-2 border-primary rounded-lg p-4">
                <label className="block text-sm font-medium mb-3 text-primary">Quick Add Relationship</label>
                <div className="flex flex-wrap items-center gap-2 text-lg">
                  <span className="font-medium text-primary">
                    {formData.label || '[This Construct]'}
                  </span>
                  <select
                    value={formData.new_relationship_rel_type}
                    onChange={(e) => setFormData({ ...formData, new_relationship_rel_type: e.target.value })}
                    className="px-3 py-1.5 border border-gray-300 rounded bg-white text-base"
                  >
                    <optgroup label="Hierarchical">
                      <option value="parent_of">is a parent of</option>
                      <option value="child_of">is a child of</option>
                    </optgroup>
                    <optgroup label="Sequential">
                      <option value="prerequisite_for">is a prerequisite for</option>
                      <option value="builds_on">builds on</option>
                      <option value="derived_from">is derived from</option>
                    </optgroup>
                    <optgroup label="Semantic">
                      <option value="related_to">is related to</option>
                      <option value="contrasts_with">contrasts with</option>
                      <option value="integrates_with">integrates with</option>
                      <option value="associated_with">is associated with</option>
                    </optgroup>
                    <optgroup label="Influence">
                      <option value="influenced">influenced</option>
                      <option value="supports">supports</option>
                      <option value="critiques">critiques</option>
                    </optgroup>
                    <optgroup label="Other">
                      <option value="authored">authored</option>
                      <option value="applies_to">applies to</option>
                      <option value="treats">treats</option>
                    </optgroup>
                  </select>
                  <HierarchicalConceptSelect
                    concepts={concepts}
                    value={formData.new_relationship_dst_concept_id}
                    onChange={(e) => setFormData({ ...formData, new_relationship_dst_concept_id: e.target.value })}
                    excludeId={item?.id}
                    placeholder="select a construct..."
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  This relationship will be created when you save the construct.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Adjacent Models (one per line)
                </label>
                <textarea
                  value={formData.adjacent_models.join('\n')}
                  onChange={(e) => handleArrayInput('adjacent_models', e.target.value)}
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Contrasts With (one per line)
                </label>
                <textarea
                  value={formData.contrasts_with.join('\n')}
                  onChange={(e) => handleArrayInput('contrasts_with', e.target.value)}
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Integrates With (one per line)
                </label>
                <textarea
                  value={formData.integrates_with.join('\n')}
                  onChange={(e) => handleArrayInput('integrates_with', e.target.value)}
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-6 mt-0">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
          >
            {item ? 'Save Changes' : 'Create Construct'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded hover:bg-sand"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
