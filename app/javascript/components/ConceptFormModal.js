import React, { useState, useEffect, useRef, useCallback } from 'react';
import SlidePanel from './SlidePanel';
import ConceptSearchSelect from './ConceptSearchSelect';
import InlineRelTypeSelect, { getRelTypeCategory } from './InlineRelTypeSelect';
import { NODE_TYPES } from '../config/nodeTypes';

export default function ConceptFormModal({ isOpen, onClose, onSuccess, item }) {
  const [people, setPeople] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [activeTab, setActiveTab] = useState('basics');
  const [deletedRelationshipIds, setDeletedRelationshipIds] = useState([]);
  const [newRelationships, setNewRelationships] = useState([]);
  const [updatedRelationships, setUpdatedRelationships] = useState({}); // { id: newRelType }
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [typeDropdownPos, setTypeDropdownPos] = useState({ top: 0, left: 0 });
  const typeDropdownTriggerRef = useRef(null);
  const [formData, setFormData] = useState({
    label: '',
    node_type: 'undeclared',
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
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const saveTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);
  const lastSavedData = useRef(null);

  // Autosave function for existing items
  const performAutosave = useCallback(async (dataToSave) => {
    if (!item?.id) return;

    setSaveStatus('saving');

    try {
      const response = await fetch(`/concepts/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ concept: dataToSave }),
      });

      if (response.ok) {
        lastSavedData.current = JSON.stringify(dataToSave);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Autosave error:', error);
      setSaveStatus('error');
    }
  }, [item?.id]);

  // Debounced autosave effect
  useEffect(() => {
    if (!isOpen || !item?.id) return;

    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedData.current = JSON.stringify(formData);
      return;
    }

    // Skip if data hasn't changed (exclude relationship form fields)
    const dataToCompare = { ...formData };
    delete dataToCompare.new_relationship_dst_concept_id;
    delete dataToCompare.new_relationship_rel_type;

    const lastData = lastSavedData.current ? JSON.parse(lastSavedData.current) : null;
    if (lastData) {
      delete lastData.new_relationship_dst_concept_id;
      delete lastData.new_relationship_rel_type;
    }

    if (JSON.stringify(dataToCompare) === JSON.stringify(lastData)) return;

    // Show pending state immediately when data changes
    setSaveStatus('pending');

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new debounced save
    saveTimeoutRef.current = setTimeout(() => {
      performAutosave(formData);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, isOpen, item?.id, performAutosave]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('basics');
      setDeletedRelationshipIds([]);
      setNewRelationships([]);
      setUpdatedRelationships({});
      setTypeDropdownOpen(false);
      setSaveStatus('idle');
      isInitialMount.current = true;
      fetchPeople();
      fetchConcepts();
      if (item) {
        const newFormData = {
          label: item.label || '',
          node_type: item.node_type || 'undeclared',
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
        };
        setFormData(newFormData);
        lastSavedData.current = JSON.stringify(newFormData);
      } else {
        const newFormData = {
          label: '',
          node_type: 'undeclared',
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
        };
        setFormData(newFormData);
        lastSavedData.current = null;
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

  const handleDeleteRelationship = async (relationshipId) => {
    if (!confirm('Are you sure you want to delete this relationship?')) return;

    try {
      const response = await fetch(`/connections/${relationshipId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setDeletedRelationshipIds([...deletedRelationshipIds, relationshipId]);
      } else {
        alert('Failed to delete relationship');
      }
    } catch (error) {
      console.error('Error deleting relationship:', error);
      alert('An error occurred while deleting the relationship');
    }
  };

  const handleAddRelationship = async () => {
    if (!item?.id) {
      alert('Please save the construct first before adding relationships');
      return;
    }

    if (!formData.new_relationship_dst_concept_id) {
      alert('Please select a construct to relate to');
      return;
    }

    try {
      const response = await fetch('/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          connection: {
            src_concept_id: item.id,
            dst_concept_id: formData.new_relationship_dst_concept_id,
            rel_type: formData.new_relationship_rel_type,
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Find the destination concept
        const dstConcept = concepts.find(c => c.id === parseInt(formData.new_relationship_dst_concept_id));

        // Add to newRelationships state
        setNewRelationships([
          ...newRelationships,
          {
            id: data.id,
            rel_type: formData.new_relationship_rel_type,
            dst_concept: dstConcept,
            relationship_label: data.relationship_label,
          }
        ]);

        // Reset the form
        setFormData({
          ...formData,
          new_relationship_dst_concept_id: '',
          new_relationship_rel_type: 'related_to'
        });
      } else {
        const data = await response.json();
        alert(data.errors?.join(', ') || 'Failed to create relationship');
      }
    } catch (error) {
      console.error('Error creating relationship:', error);
      alert('An error occurred while creating the relationship');
    }
  };

  const handleUpdateRelationshipType = async (connectionId, newRelType) => {
    try {
      const response = await fetch(`/connections/${connectionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          connection: { rel_type: newRelType }
        }),
      });

      if (response.ok) {
        // Track the update locally so UI reflects the change
        setUpdatedRelationships(prev => ({ ...prev, [connectionId]: newRelType }));
      } else {
        const data = await response.json();
        alert(data.errors?.join(', ') || 'Failed to update relationship');
      }
    } catch (error) {
      console.error('Error updating relationship:', error);
      alert('An error occurred while updating the relationship');
    }
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

  const handleCreateConcept = async (label) => {
    try {
      const response = await fetch('/concepts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ concept: { label, node_type: 'concept' } }),
      });

      if (response.ok) {
        const newConcept = await response.json();
        setConcepts(prev => [...prev, newConcept]);
        return newConcept;
      }
    } catch (error) {
      console.error('Error creating concept:', error);
    }
    return null;
  };

  const handleClose = () => {
    // If we added, deleted, or updated relationships, refresh the parent
    if (newRelationships.length > 0 || deletedRelationshipIds.length > 0 || Object.keys(updatedRelationships).length > 0) {
      onSuccess();
    }
    onClose();
  };

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {error && (
          <div className="alert alert-error" style={{ margin: 'var(--space-4)', marginBottom: 0 }}>
            <span className="alert-title"><i className="fas fa-times-circle"></i> Error:</span>
            {error}
          </div>
        )}

        {/* Sidebar + Content Layout */}
        <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden', position: 'relative' }}>
          {/* Close Button */}
          <button
            type="button"
            onClick={handleClose}
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
          {/* Left Sidebar Navigation */}
          <div className="w-12 md:w-[200px]" style={{
            background: 'var(--sidebar-bg)',
            padding: 'var(--space-2)',
            paddingTop: 'var(--space-6)',
            flexShrink: 0,
          }}>
            <div className="hidden md:block" style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--neutral-500)',
              marginBottom: 'var(--space-3)',
              fontFamily: 'var(--font-body)',
            }}>
              Sections
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('basics')}
              className="justify-center md:justify-start"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-700)',
                background: activeTab === 'basics' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'basics') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'basics') e.currentTarget.style.background = 'transparent';
              }}
              title="Basics"
            >
              <i className="fas fa-info-circle" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Basics</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('summaries')}
              className="justify-center md:justify-start"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-700)',
                background: activeTab === 'summaries' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'summaries') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'summaries') e.currentTarget.style.background = 'transparent';
              }}
              title="Summaries"
            >
              <i className="fas fa-align-left" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Summaries</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className="justify-center md:justify-start"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-700)',
                background: activeTab === 'details' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'details') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'details') e.currentTarget.style.background = 'transparent';
              }}
              title="Details"
            >
              <i className="fas fa-list-ul" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('relationships')}
              className="justify-center md:justify-start"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-700)',
                background: activeTab === 'relationships' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'relationships') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'relationships') e.currentTarget.style.background = 'transparent';
              }}
              title="Relationships"
            >
              <i className="fas fa-project-diagram" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Relationships</span>
            </button>
          </div>

          {/* Content Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--background)',
            padding: 'var(--space-6)',
          }}>
          {activeTab === 'basics' && (
            <div className="space-y-4">
              <div>
                <label className="form-label required">Label</label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div style={{ position: 'relative' }}>
                  <label className="form-label required">Type</label>
                  <button
                    type="button"
                    ref={typeDropdownTriggerRef}
                    onClick={() => {
                      if (typeDropdownTriggerRef.current) {
                        const rect = typeDropdownTriggerRef.current.getBoundingClientRect();
                        const dropdownHeight = 400;
                        const dropdownWidth = 320;
                        let top = rect.bottom + 4;
                        if (top + dropdownHeight > window.innerHeight) {
                          top = Math.max(8, rect.top - dropdownHeight - 4);
                        }
                        let left = rect.left;
                        if (left + dropdownWidth > window.innerWidth) {
                          left = window.innerWidth - dropdownWidth - 8;
                        }
                        setTypeDropdownPos({ top, left });
                      }
                      setTypeDropdownOpen(!typeDropdownOpen);
                    }}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      border: '1px solid var(--neutral-300)',
                      borderRadius: 'var(--radius)',
                      background: 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <span>{NODE_TYPES.find(t => t.value === formData.node_type)?.label || formData.node_type}</span>
                    <i className="fas fa-chevron-down" style={{ fontSize: '10px', color: 'var(--neutral-400)' }}></i>
                  </button>
                  {typeDropdownOpen && (
                    <>
                      <div
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 9998,
                        }}
                        onClick={() => setTypeDropdownOpen(false)}
                      />
                      <div style={{
                        position: 'fixed',
                        top: typeDropdownPos.top,
                        left: typeDropdownPos.left,
                        width: '320px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        background: 'white',
                        border: '1px solid var(--neutral-300)',
                        borderRadius: 'var(--radius)',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 9999,
                      }}>
                        {NODE_TYPES.map(opt => (
                          <div
                            key={opt.value}
                            onClick={() => {
                              setFormData({ ...formData, node_type: opt.value });
                              setTypeDropdownOpen(false);
                            }}
                            style={{
                              padding: 'var(--space-3)',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--neutral-100)',
                              background: formData.node_type === opt.value ? 'var(--accent-green-light)' : 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              if (formData.node_type !== opt.value) {
                                e.currentTarget.style.background = 'var(--neutral-50)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = formData.node_type === opt.value ? 'var(--accent-green-light)' : 'transparent';
                            }}
                          >
                            <div style={{
                              fontWeight: 600,
                              fontSize: 'var(--text-sm)',
                              color: 'var(--neutral-900)',
                              marginBottom: '2px',
                            }}>
                              {opt.label}
                            </div>
                            <div style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--neutral-500)',
                              lineHeight: 1.4,
                            }}>
                              {opt.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {formData.node_type && (
                    <p style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--neutral-500)',
                      marginTop: 'var(--space-1)',
                      lineHeight: 1.4,
                    }}>
                      {NODE_TYPES.find(t => t.value === formData.node_type)?.description}
                    </p>
                  )}
                </div>

                <div>
                  <label className="form-label">Status</label>
                  <select
                    value={formData.level_status}
                    onChange={(e) => setFormData({ ...formData, level_status: e.target.value })}
                    className="form-select"
                  >
                    <option value="mapped">Mapped</option>
                    <option value="basic">Basic</option>
                    <option value="deep">Deep</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">
                  Summary Top
                </label>
                <div className="form-helper">2-3 sentences</div>
                <textarea
                  value={formData.summary_top}
                  onChange={(e) => setFormData({ ...formData, summary_top: e.target.value })}
                  rows="3"
                  className="form-textarea"
                />
              </div>
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="space-y-4">
              <div>
                <label className="form-label">Summary Mid</label>
                <div className="form-helper">~200 words</div>
                <textarea
                  value={formData.summary_mid}
                  onChange={(e) => setFormData({ ...formData, summary_mid: e.target.value })}
                  rows="8"
                  className="form-textarea"
                />
              </div>

              <div>
                <label className="form-label">Summary Deep</label>
                <div className="form-helper">~600 words</div>
                <textarea
                  value={formData.summary_deep}
                  onChange={(e) => setFormData({ ...formData, summary_deep: e.target.value })}
                  rows="12"
                  className="form-textarea"
                />
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Mechanisms</label>
                  <div className="form-helper">One per line</div>
                  <textarea
                    value={formData.mechanisms.join('\n')}
                    onChange={(e) => handleArrayInput('mechanisms', e.target.value)}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Signature Techniques</label>
                  <div className="form-helper">One per line</div>
                  <textarea
                    value={formData.signature_techniques.join('\n')}
                    onChange={(e) => handleArrayInput('signature_techniques', e.target.value)}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Strengths</label>
                  <div className="form-helper">One per line</div>
                  <textarea
                    value={formData.strengths.join('\n')}
                    onChange={(e) => handleArrayInput('strengths', e.target.value)}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Weaknesses</label>
                  <div className="form-helper">One per line</div>
                  <textarea
                    value={formData.weaknesses.join('\n')}
                    onChange={(e) => handleArrayInput('weaknesses', e.target.value)}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Intake Questions</label>
                  <div className="form-helper">One per line</div>
                  <textarea
                    value={formData.intake_questions.join('\n')}
                    onChange={(e) => handleArrayInput('intake_questions', e.target.value)}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Micro Skills</label>
                  <div className="form-helper">One per line</div>
                  <textarea
                    value={formData.micro_skills.join('\n')}
                    onChange={(e) => handleArrayInput('micro_skills', e.target.value)}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Practice Prompts</label>
                  <div className="form-helper">One per line</div>
                  <textarea
                    value={formData.practice_prompts.join('\n')}
                    onChange={(e) => handleArrayInput('practice_prompts', e.target.value)}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Assessment Links</label>
                  <div className="form-helper">One per line</div>
                  <textarea
                    value={formData.assessment_links.join('\n')}
                    onChange={(e) => handleArrayInput('assessment_links', e.target.value)}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Tags</label>
                  <div className="form-helper">One per line</div>
                  <textarea
                    value={formData.tags.join('\n')}
                    onChange={(e) => handleArrayInput('tags', e.target.value)}
                    rows="3"
                    className="form-textarea"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Link People</label>
                <div className="form-helper">Hold Cmd/Ctrl to select multiple</div>
                <select
                  multiple
                  value={formData.people_ids}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value));
                    setFormData({ ...formData, people_ids: selected });
                  }}
                  className="form-select"
                  size="5"
                >
                  {people.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.full_name} ({person.role})
                    </option>
                  ))}
                </select>
                <p className="form-helper" style={{ marginTop: 'var(--space-2)' }}>
                  Selected: {formData.people_ids.length} {formData.people_ids.length === 1 ? 'person' : 'people'}
                </p>
              </div>

              <div>
                <label className="form-label">Evidence Brief</label>
                <textarea
                  value={formData.evidence_brief}
                  onChange={(e) => setFormData({ ...formData, evidence_brief: e.target.value })}
                  rows="4"
                  className="form-textarea"
                />
              </div>

              <div>
                <label className="form-label">Confidence Note</label>
                <textarea
                  value={formData.confidence_note}
                  onChange={(e) => setFormData({ ...formData, confidence_note: e.target.value })}
                  rows="3"
                  className="form-textarea"
                />
              </div>
            </div>
          )}

          {activeTab === 'relationships' && (
            <div className="space-y-4">
              {/* Relationships */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color: 'var(--primary)',
                marginBottom: 'var(--space-3)',
              }}>
                Relationships
              </div>

              <div style={{
                background: 'var(--accent-green-light)',
                border: '2px solid var(--primary)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-4)',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr 2fr auto',
                  gap: 'var(--space-2)',
                  alignItems: 'center',
                  marginBottom: 'var(--space-3)',
                }}>
                  <span style={{
                    fontWeight: 600,
                    color: 'var(--primary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-base)',
                    lineHeight: 1,
                  }}>
                    {formData.label || 'This'}
                  </span>
                  <select
                    value={formData.new_relationship_rel_type}
                    onChange={(e) => setFormData({ ...formData, new_relationship_rel_type: e.target.value })}
                    className="form-select"
                  >
                    <optgroup label="Hierarchical">
                      <option value="parent_of">is a parent of</option>
                      <option value="child_of">is a child of</option>
                      <option value="is_a">is a (categorization)</option>
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
                    <optgroup label="Positional">
                      <option value="is_above">is above</option>
                      <option value="is_below">is below</option>
                      <option value="contains">contains</option>
                      <option value="is_inside">is inside</option>
                      <option value="faces">faces</option>
                      <option value="faces_away_from">faces away from</option>
                      <option value="is_near">is near</option>
                    </optgroup>
                    <optgroup label="Positional — Anatomical">
                      <option value="superior_to">is superior to</option>
                      <option value="inferior_to">is inferior to</option>
                      <option value="anterior_to">is anterior to</option>
                      <option value="posterior_to">is posterior to</option>
                      <option value="medial_to">is medial to</option>
                      <option value="lateral_to">is lateral to</option>
                      <option value="dorsal_to">is dorsal to</option>
                      <option value="ventral_to">is ventral to</option>
                      <option value="rostral_to">is rostral to</option>
                      <option value="caudal_to">is caudal to</option>
                      <option value="proximal_to">is proximal to</option>
                      <option value="distal_to">is distal to</option>
                      <option value="ipsilateral_to">is ipsilateral to</option>
                      <option value="contralateral_to">is contralateral to</option>
                    </optgroup>
                    <optgroup label="Other">
                      <option value="authored">authored</option>
                      <option value="applies_to">applies to</option>
                      <option value="treats">treats</option>
                    </optgroup>
                  </select>
                  <ConceptSearchSelect
                    concepts={concepts}
                    value={formData.new_relationship_dst_concept_id}
                    onChange={(e) => setFormData({ ...formData, new_relationship_dst_concept_id: e.target.value })}
                    excludeId={item?.id}
                    placeholder="Type to search constructs..."
                    onCreateConcept={handleCreateConcept}
                  />
                  <button
                    type="button"
                    onClick={handleAddRelationship}
                    className="btn-primary"
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      whiteSpace: 'nowrap',
                    }}
                    disabled={!item?.id || !formData.new_relationship_dst_concept_id}
                  >
                    Add
                  </button>
                </div>

                {!item?.id && (
                  <p className="form-helper" style={{ marginTop: 'var(--space-2)', color: 'var(--neutral-500)' }}>
                    Save the construct first before adding relationships.
                  </p>
                )}

                {/* Existing Relationships — grouped by category with inline editable types */}
                {item && (() => {
                  const categoryOrder = ['Hierarchical', 'Sequential', 'Semantic', 'Influence', 'Positional', 'Positional - Anatomical', 'Other'];

                  // Normalize all connections into a flat list with effective rel_type
                  const allConns = [];
                  (item.outgoing_connections || [])
                    .filter(c => !deletedRelationshipIds.includes(c.id))
                    .forEach(c => {
                      const effectiveRelType = updatedRelationships[c.id] || c.rel_type;
                      allConns.push({ ...c, rel_type: effectiveRelType, originalRelType: c.rel_type, direction: 'out', key: `out-${c.id}` });
                    });
                  newRelationships.forEach(c => allConns.push({ ...c, direction: 'new', key: `new-${c.id}` }));
                  (item.incoming_connections || [])
                    .filter(c => !deletedRelationshipIds.includes(c.id))
                    .forEach(c => {
                      const effectiveRelType = updatedRelationships[c.id] || c.rel_type;
                      allConns.push({ ...c, rel_type: effectiveRelType, originalRelType: c.rel_type, direction: 'in', key: `in-${c.id}` });
                    });

                  if (allConns.length === 0) return null;

                  // Group by category
                  const grouped = {};
                  allConns.forEach(c => {
                    const cat = getRelTypeCategory(c.rel_type);
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(c);
                  });

                  return (
                    <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {categoryOrder.filter(cat => grouped[cat]).map(cat => (
                        <div key={cat} style={{
                          background: 'white',
                          border: '1px solid var(--neutral-300)',
                          borderRadius: 'var(--radius)',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--neutral-100)',
                            borderBottom: '1px solid var(--neutral-300)',
                            fontFamily: 'var(--font-display)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}>
                            {cat}
                          </div>
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                            {grouped[cat].map(conn => (
                              <li
                                key={conn.key}
                                style={{
                                  padding: 'var(--space-2) var(--space-3)',
                                  borderBottom: '1px solid var(--neutral-100)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--space-2)',
                                  fontSize: 'var(--text-sm)',
                                  ...(conn.direction === 'new' ? { background: 'var(--accent-green-light)' } : {}),
                                }}
                              >
                                <span style={{ color: 'var(--neutral-400)', fontSize: 'var(--text-xs)', flexShrink: 0 }}>
                                  {conn.direction === 'in' ? '\u2190' : '\u2192'}
                                </span>
                                {conn.direction === 'in' ? (
                                  <>
                                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                      {conn.src_concept?.label || 'Unknown'}
                                    </span>
                                    <InlineRelTypeSelect
                                      value={conn.rel_type}
                                      onChange={(newType) => handleUpdateRelationshipType(conn.id, newType)}
                                      disabled={conn.direction === 'new'}
                                    />
                                    <span style={{ fontWeight: 600, color: 'var(--neutral-700)' }}>
                                      {item.label}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ fontWeight: 600, color: 'var(--neutral-700)' }}>
                                      {item.label}
                                    </span>
                                    <InlineRelTypeSelect
                                      value={conn.rel_type}
                                      onChange={(newType) => handleUpdateRelationshipType(conn.id, newType)}
                                      disabled={conn.direction === 'new'}
                                    />
                                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                      {conn.dst_concept?.label || 'Unknown'}
                                    </span>
                                  </>
                                )}
                                {conn.relationship_label && (
                                  <span style={{
                                    fontSize: 'var(--text-xs)',
                                    color: 'var(--neutral-500)',
                                    fontStyle: 'italic',
                                  }}>
                                    "{conn.relationship_label}"
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRelationship(conn.id)}
                                  style={{
                                    marginLeft: 'auto',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--error)',
                                    cursor: 'pointer',
                                    padding: 'var(--space-1)',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background 0.15s',
                                    flexShrink: 0,
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--error) 15%, transparent)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <i className="fas fa-times" style={{ fontSize: '14px' }}></i>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="form-label">Adjacent Models</label>
                <div className="form-helper">One per line</div>
                <textarea
                  value={formData.adjacent_models.join('\n')}
                  onChange={(e) => handleArrayInput('adjacent_models', e.target.value)}
                  rows="4"
                  className="form-textarea"
                />
              </div>

              <div>
                <label className="form-label">Contrasts With</label>
                <div className="form-helper">One per line</div>
                <textarea
                  value={formData.contrasts_with.join('\n')}
                  onChange={(e) => handleArrayInput('contrasts_with', e.target.value)}
                  rows="4"
                  className="form-textarea"
                />
              </div>

              <div>
                <label className="form-label">Integrates With</label>
                <div className="form-helper">One per line</div>
                <textarea
                  value={formData.integrates_with.join('\n')}
                  onChange={(e) => handleArrayInput('integrates_with', e.target.value)}
                  rows="4"
                  className="form-textarea"
                />
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Footer - only show for new constructs, editing uses autosave + X button */}
        {!item ? (
          <div style={{
            borderTop: '1px solid var(--neutral-200)',
            background: 'var(--background)',
            padding: 'var(--space-6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}>
            <button
              type="submit"
              className="btn-primary"
            >
              Create Construct
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        ) : (
          /* Floating status bar for editing mode */
          <div style={{
            position: 'absolute',
            bottom: 'var(--space-4)',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            background: 'white',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            zIndex: 5,
          }}>
            <span style={{
              color: saveStatus === 'error' ? 'var(--error)' : 'var(--neutral-500)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              {saveStatus === 'pending' && (
                <>
                  <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--neutral-400)' }}></i>
                  <span style={{ color: 'var(--neutral-500)' }}>Save pending...</span>
                </>
              )}
              {saveStatus === 'saving' && (
                <>
                  <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--accent-green)' }}></i>
                  <span style={{ color: 'var(--accent-green)' }}>Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <i className="fas fa-check" style={{ color: 'var(--accent-green)' }}></i>
                  Saved
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <i className="fas fa-exclamation-circle"></i>
                  Error
                </>
              )}
              {saveStatus === 'idle' && (
                <span style={{ color: 'var(--neutral-400)' }}>Auto-saving enabled</span>
              )}
            </span>
          </div>
        )}
      </form>
    </SlidePanel>
  );
}
