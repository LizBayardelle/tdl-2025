import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import ConceptSelector from './ConceptSelector';
import TagSelector from './TagSelector';
import SourceSelector from './SourceSelector';

export default function PersonFormModal({ isOpen, onClose, onSuccess, item }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'theorist',
    summary: '',
    aka: [],
    concept_ids: [],
    source_ids: [],
    tags: []
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
      if (item) {
        setFormData({
          full_name: item.full_name || '',
          role: item.role || 'theorist',
          summary: item.summary || '',
          aka: item.aka || [],
          concept_ids: item.concept_ids || [],
          source_ids: item.source_ids || [],
          tags: item.tags || []
        });
      } else {
        setFormData({
          full_name: '',
          role: 'theorist',
          summary: '',
          aka: [],
          concept_ids: [],
          source_ids: [],
          tags: []
        });
      }
      setError('');
    }
  }, [isOpen, item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const url = item ? `/people/${item.id}` : '/people';
      const method = item ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ person: formData }),
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
      console.error('Error saving person:', error);
      setError('An error occurred while saving the person');
    }
  };

  const handleArrayInput = (value) => {
    const items = value.split('\n').filter(item => item.trim());
    setFormData({ ...formData, aka: items });
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'details', label: 'Details' },
    { id: 'metadata', label: 'Metadata' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Person' : 'New Person'}
      size="large"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
        {error && (
          <div style={{
            background: 'var(--accent-gold-light)',
            border: '1px solid var(--accent-gold)',
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

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-1)',
          marginBottom: 0,
          borderBottom: '2px solid var(--neutral-200)'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: 'var(--space-3) var(--space-6)',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-gold)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--accent-gold)' : 'var(--neutral-600)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: '-2px'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = 'var(--neutral-900)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = 'var(--neutral-600)';
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{
          padding: 'var(--space-6)',
          flex: 1,
          overflowY: 'auto'
        }}>
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--neutral-700)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="form-input"
                  style={{
                    width: '100%',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-base)'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--neutral-700)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="form-input"
                  style={{
                    width: '100%',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-base)'
                  }}
                >
                  <option value="theorist">Theorist</option>
                  <option value="clinician">Clinician</option>
                  <option value="researcher">Researcher</option>
                  <option value="peer">Peer</option>
                  <option value="client">Client</option>
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--neutral-700)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Also Known As (one per line)
                </label>
                <textarea
                  value={formData.aka.join('\n')}
                  onChange={(e) => handleArrayInput(e.target.value)}
                  rows="3"
                  className="form-input"
                  style={{
                    width: '100%',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-base)',
                    resize: 'vertical'
                  }}
                  placeholder="Aaron T. Beck&#10;A.T. Beck"
                />
              </div>
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-4)',
              height: '100%'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--neutral-700)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Summary
                </label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  className="form-input"
                  style={{
                    width: '100%',
                    height: '370px',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-base)',
                    resize: 'none',
                    overflowY: 'auto'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--neutral-700)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Sources
                </label>
                <div style={{ height: '370px' }}>
                  <SourceSelector
                    selectedSourceIds={formData.source_ids}
                    onChange={(source_ids) => setFormData({ ...formData, source_ids })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Metadata Tab */}
          {activeTab === 'metadata' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-4)',
              height: '100%'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--neutral-700)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Concepts
                </label>
                <div style={{ height: '370px' }}>
                  <ConceptSelector
                    selectedConceptIds={formData.concept_ids}
                    onChange={(concept_ids) => setFormData({ ...formData, concept_ids })}
                  />
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--neutral-700)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Tags
                </label>
                <div style={{ height: '370px' }}>
                  <TagSelector
                    selectedTags={formData.tags}
                    onChange={(tags) => setFormData({ ...formData, tags })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          paddingTop: 'var(--space-6)',
          paddingBottom: 'var(--space-6)',
          borderTop: '1px solid var(--neutral-200)'
        }}>
          <button
            type="submit"
            className="btn-primary"
            style={{
              background: 'var(--accent-gold)',
              fontFamily: 'var(--font-body)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#8a6324'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-gold)'}
          >
            {item ? 'Save Changes' : 'Create Person'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
