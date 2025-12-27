import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import HierarchicalConceptSelect from './HierarchicalConceptSelect';

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
          'Accept': 'application/json',
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
      size="medium"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden', position: 'relative' }}>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            zIndex: 10,
            background: 'white',
            border: 'none',
            color: 'var(--neutral-500)',
            fontSize: 'var(--text-2xl)',
            cursor: 'pointer',
            padding: 0,
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            boxShadow: 'var(--shadow-md)',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--neutral-100)';
            e.currentTarget.style.color = 'var(--neutral-900)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = 'var(--neutral-500)';
          }}
        >
          ×
        </button>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--background)',
          padding: 'var(--space-6)'
        }}>
          {error && (
            <div style={{
              background: 'var(--accent-green-light)',
              border: '1px solid var(--accent-green)',
              color: 'var(--error)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius)',
              marginBottom: 'var(--space-4)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)'
            }}>
              {error}
            </div>
          )}

          {/* Sentence-style relationship builder */}
          <div style={{
            background: 'var(--accent-green-light)',
            border: '1px solid var(--accent-green)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)'
          }}>
            <label className="form-label" style={{ marginBottom: 'var(--space-3)' }}>
              Define Relationship
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-lg)',
              fontFamily: 'var(--font-body)'
            }}>
              <span style={{
                fontWeight: 600,
                color: 'var(--accent-green)',
                fontFamily: 'var(--font-body)'
              }}>
                {getSourceConceptName() || '[Source Concept]'}
              </span>
              <select
                value={formData.rel_type}
                onChange={(e) => setFormData({ ...formData, rel_type: e.target.value })}
                className="form-select"
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--text-base)',
                  fontFamily: 'var(--font-body)'
                }}
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
                concepts={allConcepts || concepts}
                value={formData.dst_concept_id}
                onChange={(e) => setFormData({ ...formData, dst_concept_id: e.target.value })}
                excludeId={formData.src_concept_id ? parseInt(formData.src_concept_id) : null}
                placeholder="select a construct..."
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">
              Custom Relationship Label
              <span style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--neutral-500)',
                marginLeft: 'var(--space-2)',
                fontWeight: 400
              }}>
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={formData.relationship_label}
              onChange={(e) => setFormData({ ...formData, relationship_label: e.target.value })}
              className="form-input"
              style={{
                width: '100%',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-base)'
              }}
              placeholder="e.g., 'is a specialized form of', 'requires understanding of'"
            />
            <p style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--neutral-600)',
              marginTop: 'var(--space-1)',
              fontFamily: 'var(--font-body)'
            }}>
              Override the default label for this relationship (e.g., "is a type of" instead of "Parent of")
            </p>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              className="form-textarea"
              style={{
                width: '100%',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-base)',
                resize: 'vertical'
              }}
              placeholder="Why are these constructs related?"
            />
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Tags (one per line)</label>
            <textarea
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              rows="2"
              className="form-textarea"
              style={{
                width: '100%',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-base)',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--neutral-200)',
          background: 'var(--background)',
          padding: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-3)',
        }}>
          <button
            type="submit"
            className="btn-primary"
            style={{
              background: 'var(--accent-green)',
              fontFamily: 'var(--font-body)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-dark)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-green)'}
          >
            {item ? 'Save Changes' : 'Create Relationship'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              color: 'var(--accent-green)',
              background: 'var(--accent-green-light)',
              border: '1px solid var(--accent-green)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-green)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-green-light)';
              e.currentTarget.style.color = 'var(--accent-green)';
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
