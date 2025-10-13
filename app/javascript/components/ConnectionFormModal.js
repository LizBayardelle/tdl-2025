import React, { useState, useEffect } from 'react';
import Modal from './Modal';

export default function ConnectionFormModal({ isOpen, onClose, onSuccess, item, conceptId, concepts, allConcepts }) {
  const [formData, setFormData] = useState({
    src_concept_id: '',
    dst_concept_id: '',
    rel_type: 'related_to',
    relationship_label: '',
    description: '',
    tags: ''
  });
  const [error, setError] = useState('');

  // Get the source concept name
  const getSourceConceptName = () => {
    if (!formData.src_concept_id) return '';
    // Use allConcepts if available, otherwise fall back to concepts
    const conceptList = allConcepts || concepts || [];
    const sourceConcept = conceptList.find(c => c.id === parseInt(formData.src_concept_id));
    return sourceConcept ? sourceConcept.label : '';
  };

  // Convert relationship type to sentence form
  const getRelationshipText = (relType) => {
    const textMap = {
      parent_of: 'is a parent of',
      child_of: 'is a child of',
      prerequisite_for: 'is a prerequisite for',
      builds_on: 'builds on',
      derived_from: 'is derived from',
      related_to: 'is related to',
      contrasts_with: 'contrasts with',
      integrates_with: 'integrates with',
      associated_with: 'is associated with',
      influenced: 'influenced',
      supports: 'supports',
      critiques: 'critiques',
      authored: 'authored',
      applies_to: 'applies to',
      treats: 'treats'
    };
    return textMap[relType] || relType;
  };

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setFormData({
          src_concept_id: item.src_concept_id || '',
          dst_concept_id: item.dst_concept_id || '',
          rel_type: item.rel_type || 'related_to',
          relationship_label: item.relationship_label || '',
          description: item.description || '',
          tags: (item.tags || []).join('\n')
        });
      } else {
        setFormData({
          src_concept_id: conceptId || '',
          dst_concept_id: '',
          rel_type: 'related_to',
          relationship_label: '',
          description: '',
          tags: ''
        });
      }
      setError('');
    }
  }, [isOpen, item, conceptId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      ...formData,
      tags: formData.tags.split('\n').filter(t => t.trim())
    };

    try {
      const url = item ? `/connections/${item.id}` : '/connections';
      const method = item ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ connection: payload }),
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
      console.error('Error saving connection:', error);
      setError('An error occurred while saving the relationship');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Relationship' : 'New Relationship'}
      size="medium"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Sentence-style relationship builder */}
        <div className="bg-sand border border-gray-300 rounded-lg p-4">
          <label className="block text-sm font-medium mb-3">Define Relationship</label>
          <div className="flex flex-wrap items-center gap-2 text-lg">
            <span className="font-medium text-primary">
              {getSourceConceptName() || '[Source Concept]'}
            </span>
            <select
              value={formData.rel_type}
              onChange={(e) => setFormData({ ...formData, rel_type: e.target.value })}
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
            <select
              value={formData.dst_concept_id}
              onChange={(e) => setFormData({ ...formData, dst_concept_id: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded bg-white text-base flex-1 min-w-[200px]"
              required
            >
              <option value="">select a construct...</option>
              {concepts && concepts.map(concept => (
                <option key={concept.id} value={concept.id}>
                  {concept.label} ({concept.node_type})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Custom Relationship Label
            <span className="text-xs text-gray-500 ml-2">(optional)</span>
          </label>
          <input
            type="text"
            value={formData.relationship_label}
            onChange={(e) => setFormData({ ...formData, relationship_label: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="e.g., 'is a specialized form of', 'requires understanding of'"
          />
          <p className="text-xs text-gray-600 mt-1">
            Override the default label for this relationship (e.g., "is a type of" instead of "Parent of")
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="Why are these constructs related?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tags (one per line)</label>
          <textarea
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
          >
            {item ? 'Save Changes' : 'Create Relationship'}
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
