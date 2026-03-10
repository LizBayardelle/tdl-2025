import React, { useState, useEffect } from 'react';
import Modal from './Modal';

const NODE_TYPE_OPTIONS = [
  { value: 'concept', label: 'Concept' },
  { value: 'theory', label: 'Theory' },
  { value: 'method', label: 'Method' },
  { value: 'measure', label: 'Measure' },
  { value: 'entity', label: 'Entity' },
  { value: 'category', label: 'Category' },
  { value: 'subject', label: 'Subject' },
];

const CONFIDENCE_COLORS = {
  high: { bg: 'var(--accent-green-light)', border: 'var(--accent-green)', text: 'var(--accent-green)' },
  medium: { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
  low: { bg: 'var(--neutral-100)', border: 'var(--neutral-400)', text: 'var(--neutral-600)' },
};

const CONFIDENCE_LABELS = {
  high: 'High Confidence',
  medium: 'Medium Confidence',
  low: 'Low Confidence',
};

export default function ConceptDisambiguationModal({ isOpen, onClose, suggestions, onConfirm }) {
  const [conceptData, setConceptData] = useState([]);
  const [newConceptLabel, setNewConceptLabel] = useState('');
  const [newConceptType, setNewConceptType] = useState('subject');

  // Initialize concept data when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewConceptLabel('');
      setNewConceptType('subject');

      if (suggestions && suggestions.length > 0) {
        const initialData = suggestions.map((suggestion) => ({
          originalSuggestion: {
            label: suggestion.label,
            node_type: suggestion.node_type,
            confidence: suggestion.confidence,
            rationale: suggestion.rationale,
          },
          action: suggestion.potential_matches?.length > 0 && suggestion.potential_matches[0].match_type === 'exact'
            ? 'link'
            : 'create',
          linkedConceptId: suggestion.potential_matches?.length > 0 && suggestion.potential_matches[0].match_type === 'exact'
            ? suggestion.potential_matches[0].id
            : null,
          editedLabel: suggestion.label,
          editedNodeType: suggestion.node_type || 'subject',
          potentialMatches: suggestion.potential_matches || [],
          isCustom: false,
        }));
        setConceptData(initialData);
      } else {
        setConceptData([]);
      }
    }
  }, [isOpen, suggestions]);

  const handleLinkToConcept = (index, concept) => {
    setConceptData(prev => {
      const newData = [...prev];
      newData[index].action = 'link';
      newData[index].linkedConceptId = concept.id;
      return newData;
    });
  };

  const handleUnlink = (index) => {
    setConceptData(prev => {
      const newData = [...prev];
      newData[index].action = 'create';
      newData[index].linkedConceptId = null;
      return newData;
    });
  };

  const handleSkip = (index) => {
    setConceptData(prev => {
      const newData = [...prev];
      newData[index].action = 'skip';
      newData[index].linkedConceptId = null;
      return newData;
    });
  };

  const handleInclude = (index) => {
    setConceptData(prev => {
      const newData = [...prev];
      newData[index].action = 'create';
      return newData;
    });
  };

  const handleRemoveCustom = (index) => {
    setConceptData(prev => prev.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index, field, value) => {
    setConceptData(prev => {
      const newData = [...prev];
      newData[index][field] = value;
      return newData;
    });
  };

  const handleAddCustomConcept = () => {
    if (!newConceptLabel.trim()) return;

    setConceptData(prev => [...prev, {
      originalSuggestion: null,
      action: 'create',
      linkedConceptId: null,
      editedLabel: newConceptLabel.trim(),
      editedNodeType: newConceptType,
      potentialMatches: [],
      isCustom: true,
    }]);

    setNewConceptLabel('');
    setNewConceptType('subject');
  };

  const handleConfirm = () => {
    const processedConcepts = conceptData.map(concept => ({
      action: concept.action,
      linkedConceptId: concept.linkedConceptId,
      editedLabel: concept.editedLabel,
      editedNodeType: concept.editedNodeType,
      originalSuggestion: concept.originalSuggestion,
      isCustom: concept.isCustom,
    }));

    onConfirm(processedConcepts);
  };

  const getLinkedConcept = (conceptItem) => {
    if (conceptItem.action === 'link' && conceptItem.linkedConceptId) {
      return conceptItem.potentialMatches.find(c => c.id === conceptItem.linkedConceptId);
    }
    return null;
  };

  const getConfidenceStyle = (confidence) => {
    return CONFIDENCE_COLORS[confidence] || CONFIDENCE_COLORS.medium;
  };

  const getConfidenceLabel = (confidence) => {
    return CONFIDENCE_LABELS[confidence] || 'Medium Confidence';
  };

  const activeCount = conceptData.filter(c => c.action !== 'skip').length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review Suggested Concepts" size="large">
      <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
        {/* Scrollable content area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-600)',
            marginBottom: 'var(--space-4)',
            fontFamily: 'var(--font-body)'
          }}>
            {suggestions?.length > 0
              ? `We found ${suggestions.length} potential concept${suggestions.length !== 1 ? 's' : ''} in this article. Link to existing concepts, create new ones, or skip.`
              : 'No suggestions were generated. You can add concepts manually below.'
            }
          </p>

          {/* Suggested concepts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {conceptData.map((concept, index) => {
              const linkedConcept = getLinkedConcept(concept);
              const hasPotentialMatches = concept.potentialMatches && concept.potentialMatches.length > 0;
              const isSkipped = concept.action === 'skip';
              const isCustom = concept.isCustom;

              return (
                <div key={index} style={{
                  border: `1px solid ${isSkipped ? 'var(--neutral-200)' : isCustom ? 'var(--accent-blue)' : 'var(--neutral-300)'}`,
                  borderRadius: '4px',
                  padding: 'var(--space-4)',
                  background: isSkipped ? 'var(--neutral-50)' : isCustom ? 'var(--accent-blue-light)' : 'white',
                  opacity: isSkipped ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}>
                  {/* Header with suggestion info */}
                  <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <span style={{
                          fontWeight: 600,
                          color: 'var(--neutral-900)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-base)'
                        }}>
                          {isCustom ? concept.editedLabel : concept.originalSuggestion?.label}
                        </span>
                        {isCustom ? (
                          <span style={{
                            fontSize: 'var(--text-xs)',
                            padding: '2px 8px',
                            background: 'var(--accent-blue)',
                            color: 'white',
                            borderRadius: '4px',
                            fontWeight: 500,
                          }}>
                            Custom
                          </span>
                        ) : (
                          <>
                            <span style={{
                              fontSize: 'var(--text-xs)',
                              padding: '2px 8px',
                              background: 'var(--accent-green-light)',
                              color: 'var(--accent-green)',
                              borderRadius: '4px',
                              fontWeight: 500,
                              textTransform: 'capitalize',
                            }}>
                              {concept.originalSuggestion?.node_type}
                            </span>
                            <span style={{
                              fontSize: 'var(--text-xs)',
                              padding: '2px 8px',
                              background: getConfidenceStyle(concept.originalSuggestion?.confidence).bg,
                              color: getConfidenceStyle(concept.originalSuggestion?.confidence).text,
                              border: `1px solid ${getConfidenceStyle(concept.originalSuggestion?.confidence).border}`,
                              borderRadius: '4px',
                              fontWeight: 500,
                            }}>
                              {getConfidenceLabel(concept.originalSuggestion?.confidence)}
                            </span>
                          </>
                        )}
                      </div>
                      {!isCustom && concept.originalSuggestion?.rationale && (
                        <p style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--neutral-500)',
                          marginTop: 'var(--space-1)',
                          fontFamily: 'var(--font-body)',
                          fontStyle: 'italic',
                        }}>
                          {concept.originalSuggestion.rationale}
                        </p>
                      )}
                    </div>
                    {/* Skip/Include/Remove toggle */}
                    {isCustom ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustom(index)}
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--error)',
                          padding: 'var(--space-1) var(--space-2)',
                          border: '1px solid var(--error)',
                          borderRadius: '4px',
                          background: 'white',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                          fontWeight: 500,
                        }}
                      >
                        <i className="fas fa-trash" style={{ marginRight: 'var(--space-1)' }}></i>
                        Remove
                      </button>
                    ) : isSkipped ? (
                      <button
                        type="button"
                        onClick={() => handleInclude(index)}
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--accent-green)',
                          padding: 'var(--space-1) var(--space-2)',
                          border: '1px solid var(--accent-green)',
                          borderRadius: '4px',
                          background: 'white',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                          fontWeight: 500,
                        }}
                      >
                        <i className="fas fa-plus" style={{ marginRight: 'var(--space-1)' }}></i>
                        Include
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSkip(index)}
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--neutral-500)',
                          padding: 'var(--space-1) var(--space-2)',
                          border: '1px solid var(--neutral-300)',
                          borderRadius: '4px',
                          background: 'white',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                          fontWeight: 500,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--neutral-100)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white';
                        }}
                      >
                        <i className="fas fa-times" style={{ marginRight: 'var(--space-1)' }}></i>
                        Skip
                      </button>
                    )}
                  </div>

                  {!isSkipped && (
                    <>
                      {concept.action === 'link' && linkedConcept ? (
                        /* Linked State */
                        <div style={{
                          background: 'var(--accent-green-light)',
                          border: '1px solid var(--accent-green)',
                          borderRadius: '4px',
                          padding: 'var(--space-3)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{
                                fontSize: 'var(--text-sm)',
                                fontWeight: 500,
                                color: 'var(--accent-green)',
                                fontFamily: 'var(--font-body)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                              }}>
                                <i className="fas fa-check-circle"></i>
                                Linked to existing concept
                              </div>
                              <div style={{
                                fontSize: 'var(--text-sm)',
                                marginTop: 'var(--space-1)',
                                fontFamily: 'var(--font-body)',
                                color: 'var(--neutral-900)'
                              }}>
                                {linkedConcept.label}
                                <span style={{
                                  fontSize: 'var(--text-xs)',
                                  marginLeft: 'var(--space-2)',
                                  padding: '2px 6px',
                                  background: 'white',
                                  borderRadius: '3px',
                                  color: 'var(--neutral-600)',
                                }}>
                                  {linkedConcept.node_type}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnlink(index)}
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--accent-green)',
                                padding: 'var(--space-1) var(--space-3)',
                                border: '1px solid var(--neutral-300)',
                                borderRadius: '4px',
                                background: 'white',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                                fontWeight: 500,
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--neutral-100)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'white';
                              }}
                            >
                              Unlink
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Create New Concept State */
                        <>
                          {/* Editable fields */}
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)', marginBottom: hasPotentialMatches ? 'var(--space-3)' : 0 }}>
                            <div>
                              <label style={{
                                display: 'block',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 500,
                                marginBottom: 'var(--space-1)',
                                fontFamily: 'var(--font-body)',
                                color: 'var(--neutral-700)'
                              }}>
                                Label
                              </label>
                              <input
                                type="text"
                                value={concept.editedLabel}
                                onChange={(e) => handleFieldChange(index, 'editedLabel', e.target.value)}
                                className="form-input"
                                style={{
                                  width: '100%',
                                  padding: 'var(--space-2)',
                                  fontSize: 'var(--text-sm)',
                                  border: '1px solid var(--neutral-300)',
                                  borderRadius: '4px',
                                  fontFamily: 'var(--font-body)'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{
                                display: 'block',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 500,
                                marginBottom: 'var(--space-1)',
                                fontFamily: 'var(--font-body)',
                                color: 'var(--neutral-700)'
                              }}>
                                Type
                              </label>
                              <select
                                value={concept.editedNodeType}
                                onChange={(e) => handleFieldChange(index, 'editedNodeType', e.target.value)}
                                className="form-select"
                                style={{
                                  width: '100%',
                                  padding: 'var(--space-2)',
                                  fontSize: 'var(--text-sm)',
                                  border: '1px solid var(--neutral-300)',
                                  borderRadius: '4px',
                                  fontFamily: 'var(--font-body)',
                                  height: '38px',
                                }}
                              >
                                {NODE_TYPE_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Potential matches */}
                          {hasPotentialMatches && (
                            <div style={{
                              paddingTop: 'var(--space-3)',
                              borderTop: '1px solid var(--neutral-200)'
                            }}>
                              <div style={{
                                fontSize: 'var(--text-xs)',
                                fontWeight: 500,
                                color: 'var(--neutral-700)',
                                marginBottom: 'var(--space-2)',
                                fontFamily: 'var(--font-body)'
                              }}>
                                <i className="fas fa-database" style={{ marginRight: 'var(--space-1)', opacity: 0.7 }}></i>
                                Found in your database:
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {concept.potentialMatches.map(match => (
                                  <button
                                    key={match.id}
                                    type="button"
                                    onClick={() => handleLinkToConcept(index, match)}
                                    style={{
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: 'var(--space-2) var(--space-3)',
                                      fontSize: 'var(--text-sm)',
                                      background: match.match_type === 'exact' ? 'var(--accent-green-light)' : 'var(--neutral-100)',
                                      borderRadius: '4px',
                                      border: match.match_type === 'exact' ? '2px solid var(--accent-green)' : '1px solid var(--neutral-200)',
                                      cursor: 'pointer',
                                      fontFamily: 'var(--font-body)',
                                      transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (match.match_type === 'exact') {
                                        e.currentTarget.style.background = '#c6f6d5';
                                      } else {
                                        e.currentTarget.style.background = 'var(--accent-green-light)';
                                        e.currentTarget.style.borderColor = 'var(--accent-green)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (match.match_type === 'exact') {
                                        e.currentTarget.style.background = 'var(--accent-green-light)';
                                      } else {
                                        e.currentTarget.style.background = 'var(--neutral-100)';
                                        e.currentTarget.style.borderColor = 'var(--neutral-200)';
                                      }
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                      <span style={{ fontWeight: 500 }}>{match.label}</span>
                                      {match.match_type === 'exact' && (
                                        <span style={{
                                          fontSize: 'var(--text-xs)',
                                          background: 'var(--accent-green)',
                                          color: 'white',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontWeight: 600
                                        }}>
                                          Exact Match
                                        </span>
                                      )}
                                      <span style={{
                                        fontSize: 'var(--text-xs)',
                                        color: 'var(--neutral-500)',
                                        marginLeft: 'auto',
                                      }}>
                                        {match.node_type}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Custom Concept Section */}
          <div style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-4)',
            background: 'var(--neutral-50)',
            borderRadius: '4px',
            border: '1px dashed var(--neutral-300)',
          }}>
            <div style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--neutral-700)',
              marginBottom: 'var(--space-3)',
              fontFamily: 'var(--font-body)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <i className="fas fa-plus-circle" style={{ color: 'var(--accent-blue)' }}></i>
              Add Custom Concept
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
              <div style={{ flex: 2 }}>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  marginBottom: 'var(--space-1)',
                  fontFamily: 'var(--font-body)',
                  color: 'var(--neutral-600)'
                }}>
                  Label
                </label>
                <input
                  type="text"
                  value={newConceptLabel}
                  onChange={(e) => setNewConceptLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newConceptLabel.trim()) {
                      e.preventDefault();
                      handleAddCustomConcept();
                    }
                  }}
                  placeholder="e.g., Cognitive Behavioral Therapy"
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    fontSize: 'var(--text-sm)',
                    border: '1px solid var(--neutral-300)',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-body)',
                    background: 'white',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  marginBottom: 'var(--space-1)',
                  fontFamily: 'var(--font-body)',
                  color: 'var(--neutral-600)'
                }}>
                  Type
                </label>
                <select
                  value={newConceptType}
                  onChange={(e) => setNewConceptType(e.target.value)}
                  className="form-select"
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    fontSize: 'var(--text-sm)',
                    border: '1px solid var(--neutral-300)',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-body)',
                    height: '38px',
                    background: 'white',
                  }}
                >
                  {NODE_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddCustomConcept}
                disabled={!newConceptLabel.trim()}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: newConceptLabel.trim() ? 'var(--accent-blue)' : 'var(--neutral-300)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  cursor: newConceptLabel.trim() ? 'pointer' : 'not-allowed',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  transition: 'all 0.15s',
                }}
              >
                <i className="fas fa-plus"></i>
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Fixed footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--neutral-200)',
          background: 'white',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary"
            disabled={activeCount === 0}
            style={{
              background: activeCount === 0 ? 'var(--neutral-300)' : 'var(--accent-green)',
              color: 'white',
              border: 'none',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: '4px',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              cursor: activeCount === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              if (activeCount > 0) {
                e.currentTarget.style.background = '#22543d';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeCount > 0) {
                e.currentTarget.style.background = 'var(--accent-green)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            Confirm {activeCount > 0 ? `(${activeCount})` : ''}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{
              background: 'white',
              color: 'var(--neutral-700)',
              border: '1px solid var(--neutral-300)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: '4px',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--neutral-100)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
