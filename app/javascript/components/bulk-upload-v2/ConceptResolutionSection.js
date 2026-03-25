import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useBulkUpload } from './BulkUploadContext';

// Convert string to title case for display
function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (match) => match.toUpperCase());
}

export default function ConceptResolutionSection({ item, onResolutionChange, onCreateConcept }) {
  const { state } = useBulkUpload();
  const concepts = item.detected_concepts || [];

  // Track which concept is being edited and store edited labels
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedLabels, setEditedLabels] = useState({}); // { idx: 'edited label' }
  const editInputRef = useRef(null);

  // New concept form
  const [showNewConceptForm, setShowNewConceptForm] = useState(false);
  const [newConceptLabel, setNewConceptLabel] = useState('');
  const [newConceptType, setNewConceptType] = useState('non_physical_concept');
  const newConceptInputRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingIdx !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingIdx]);

  // Focus new concept input when form opens
  useEffect(() => {
    if (showNewConceptForm && newConceptInputRef.current) {
      newConceptInputRef.current.focus();
    }
  }, [showNewConceptForm]);

  // Handle creating a brand new concept (not from detected list)
  const handleCreateNewConcept = useCallback(async () => {
    const label = newConceptLabel.trim();
    if (!label) return;

    // Check if it exists in database first
    try {
      const response = await fetch(`/concepts/search?q=${encodeURIComponent(label.toLowerCase())}`);
      if (response.ok) {
        const results = await response.json();
        const exactMatch = results.find(c => c.label.toLowerCase() === label.toLowerCase());
        if (exactMatch) {
          // Concept already exists - could show a message or auto-link
          alert(`Concept "${exactMatch.label}" already exists in your database.`);
          return;
        }
      }
    } catch (err) {
      console.error('Search error:', err);
    }

    // Create as a new "detected" concept at the end
    // We'll add it to pendingConcepts directly
    onCreateConcept(-1, {
      label: label.toLowerCase(),
      conceptType: newConceptType,
      createdFromKeyword: label
    });

    setNewConceptLabel('');
    setNewConceptType('non_physical_concept');
    setShowNewConceptForm(false);
  }, [newConceptLabel, newConceptType, onCreateConcept]);

  // Get the display label for a concept (edited or original)
  const getDisplayLabel = useCallback((idx, concept) => {
    if (editedLabels[idx]) {
      return editedLabels[idx];
    }
    return concept.keyword || concept.label || '';
  }, [editedLabels]);

  // Start editing a concept name
  const handleStartEdit = useCallback((idx, currentLabel) => {
    setEditingIdx(idx);
    // Use the current display value (which may already be edited)
    setEditValue(editedLabels[idx] || toTitleCase(currentLabel));
  }, [editedLabels]);

  // Save edited name - preserve their capitalization
  const handleSaveEdit = useCallback((idx) => {
    const newLabel = editValue.trim();
    if (newLabel) {
      // Store exactly as they typed it - respect their capitalization
      setEditedLabels(prev => ({
        ...prev,
        [idx]: newLabel
      }));
    }
    setEditingIdx(null);
    setEditValue('');
  }, [editValue]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingIdx(null);
    setEditValue('');
  }, []);

  // Handle key press in edit input
  const handleEditKeyDown = useCallback((e, idx) => {
    if (e.key === 'Enter') {
      handleSaveEdit(idx);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  // Accept concept: link if already exists, create if not
  const handleAccept = useCallback(async (idx, concept) => {
    // Use edited label if available, otherwise original
    const keyword = (editedLabels[idx] || concept.keyword || concept.label || '').toLowerCase().trim();
    if (!keyword) return;

    // Check for session match first
    const sessionMatch = concept.sessionMatches?.find(pending => {
      return (pending.label || '').toLowerCase().trim() === keyword;
    });

    if (sessionMatch) {
      onResolutionChange(idx, {
        action: 'link',
        tempConceptId: sessionMatch.tempId,
        conceptLabel: sessionMatch.label
      });
      return;
    }

    // Search for exact match in database
    try {
      const response = await fetch(`/concepts/search?q=${encodeURIComponent(keyword)}`);
      if (response.ok) {
        const results = await response.json();
        const exactMatch = results.find(c => c.label.toLowerCase() === keyword);
        if (exactMatch) {
          onResolutionChange(idx, {
            action: 'link',
            conceptId: exactMatch.id,
            conceptLabel: exactMatch.label
          });
          return;
        }
      }
    } catch (err) {
      console.error('Search error:', err);
    }

    // No match found, create new concept
    onCreateConcept(idx, {
      label: keyword,
      conceptType: concept.suggested_type || 'non_physical_concept',
      createdFromKeyword: concept.keyword || concept.label
    });
  }, [editedLabels, onResolutionChange, onCreateConcept]);

  // Reject concept: mark as skipped
  const handleReject = useCallback((idx) => {
    onResolutionChange(idx, { action: 'skip' });
  }, [onResolutionChange]);

  // Clear resolution
  const handleClear = useCallback((idx) => {
    onResolutionChange(idx, null);
  }, [onResolutionChange]);

  // Unlink an auto-linked concept (sets a resolution to override auto_linked)
  const handleUnlink = useCallback((idx) => {
    // Set a 'pending' resolution to override the auto_linked status
    // This makes isAutoLinked false so the thumbs up/down buttons appear
    onResolutionChange(idx, { action: 'pending' });
  }, [onResolutionChange]);

  // Accept all unresolved concepts
  const handleAcceptAll = useCallback(async () => {
    for (let idx = 0; idx < concepts.length; idx++) {
      const concept = concepts[idx];
      if (concept.auto_linked || concept.resolution) continue;
      await handleAccept(idx, concept);
    }
  }, [concepts, handleAccept]);

  // Count stats
  const autoLinkedCount = concepts.filter(c => c.auto_linked && !c.resolution).length;
  const acceptedCount = concepts.filter(c => c.resolution?.action === 'link' || c.resolution?.action === 'create').length;
  const rejectedCount = concepts.filter(c => c.resolution?.action === 'skip').length;
  const unresolvedCount = concepts.filter(c => !c.auto_linked && !c.resolution).length;

  // Check if concept has a database match (but isn't auto-linked)
  const hasDbMatch = (concept) => {
    return concept.matched_concept_id && !concept.auto_linked;
  };

  if (concepts.length === 0) {
    return (
      <div style={{ marginBottom: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-2)',
          paddingBottom: 'var(--space-2)',
          borderBottom: '2px solid var(--accent-green)',
        }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--neutral-800)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            margin: 0,
          }}>
            <i className="fas fa-tags" style={{ color: 'var(--accent-green)' }}></i>
            Concepts (0)
          </h3>
        </div>
        <div style={{
          padding: 'var(--space-3)',
          background: 'var(--neutral-50)',
          borderRadius: '6px',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          color: 'var(--neutral-500)',
        }}>
          No keywords detected in metadata
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-2)',
        paddingBottom: 'var(--space-2)',
        borderBottom: '2px solid var(--accent-green)',
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          color: 'var(--neutral-800)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          margin: 0,
        }}>
          <i className="fas fa-tags" style={{ color: 'var(--accent-green)' }}></i>
          Concepts ({concepts.length})
          {autoLinkedCount > 0 && (
            <span style={{
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--accent-green-light)',
              fontSize: 'var(--text-xs)',
              color: 'var(--accent-green)',
              fontWeight: 500,
            }}>
              {autoLinkedCount} auto-linked
            </span>
          )}
        </h3>
        {unresolvedCount > 0 && (
          <button
            onClick={handleAcceptAll}
            style={{
              padding: '4px 10px',
              fontSize: 'var(--text-xs)',
              background: 'var(--accent-green-light)',
              border: '1px solid var(--accent-green)',
              borderRadius: '4px',
              color: 'var(--accent-green)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-body)',
            }}
          >
            <i className="fas fa-check-double"></i>
            Accept all
          </button>
        )}
      </div>

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        color: 'var(--neutral-500)',
        margin: 0,
        marginBottom: 'var(--space-3)',
        lineHeight: 1.4,
      }}>
        Keywords extracted from the article. Accept to link or create concepts in your database.
      </p>

      {/* Concept list */}
      <div style={{
        border: '1px solid var(--neutral-200)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        {concepts.map((concept, idx) => {
          const resolution = concept.resolution;
          const isAutoLinked = concept.auto_linked && !resolution;
          const isAccepted = resolution?.action === 'link' || resolution?.action === 'create';
          const isRejected = resolution?.action === 'skip';
          const isResolved = isAutoLinked || resolution;
          const keyword = getDisplayLabel(idx, concept);
          const isEditing = editingIdx === idx;
          const dbMatch = hasDbMatch(concept);

          return (
            <div
              key={idx}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                borderBottom: idx < concepts.length - 1 ? '1px solid var(--neutral-100)' : 'none',
                background: isAccepted ? 'var(--accent-green-light)' : isRejected ? 'var(--neutral-50)' : 'white',
                opacity: isRejected ? 0.6 : 1,
              }}
            >
              {/* Keyword label - click to edit */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: isRejected ? 'var(--neutral-400)' : 'var(--neutral-800)',
                  textDecoration: isRejected ? 'line-through' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  flexWrap: 'wrap',
                }}>
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleSaveEdit(idx)}
                      onKeyDown={(e) => handleEditKeyDown(e, idx)}
                      style={{
                        padding: '2px 6px',
                        fontSize: 'var(--text-sm)',
                        fontFamily: 'var(--font-body)',
                        border: '1px solid var(--accent-green)',
                        borderRadius: '4px',
                        outline: 'none',
                        minWidth: '150px',
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => handleStartEdit(idx, keyword)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px dashed var(--neutral-300)',
                        paddingBottom: '1px',
                      }}
                      title="Click to edit"
                    >
                      {/* Use edited label directly if set, otherwise apply title case */}
                      {editedLabels[idx] || toTitleCase(keyword)}
                    </span>
                  )}

                  {/* AI Detected badge */}
                  {concept.source === 'llm' && (
                    <span style={{
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: '#fff3e0',
                      fontSize: '9px',
                      color: '#e65100',
                      fontWeight: 600,
                    }}>
                      AI Detected
                    </span>
                  )}

                  {/* Database match badge */}
                  {dbMatch && (
                    <span style={{
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: 'var(--accent-green-light)',
                      fontSize: '9px',
                      color: 'var(--accent-green)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}>
                      <i className="fas fa-database" style={{ fontSize: '8px' }}></i>
                      exists
                    </span>
                  )}

                  {/* Status indicators */}
                  {isAutoLinked && (
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--accent-green)',
                    }}>
                      <i className="fas fa-link" style={{ marginRight: '4px' }}></i>
                      {toTitleCase(concept.matched_concept_label)}
                    </span>
                  )}
                  {isAccepted && resolution.action === 'link' && (
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--accent-green)',
                    }}>
                      <i className="fas fa-link" style={{ marginRight: '4px' }}></i>
                      {toTitleCase(resolution.conceptLabel)}
                    </span>
                  )}
                  {isAccepted && resolution.action === 'create' && (
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--accent-green)',
                    }}>
                      <i className="fas fa-plus" style={{ marginRight: '4px' }}></i>
                      will create
                    </span>
                  )}
                </div>
                {concept.rationale && !isResolved && (
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    color: 'var(--neutral-500)',
                    fontStyle: 'italic',
                    marginTop: '2px',
                  }}>
                    {concept.rationale}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{
                display: 'flex',
                gap: '4px',
                flexShrink: 0,
              }}>
                {isAutoLinked ? (
                  /* Unlink button for auto-linked concepts */
                  <button
                    onClick={() => handleUnlink(idx)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--neutral-300)',
                      background: 'white',
                      color: 'var(--neutral-500)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-body)',
                    }}
                    title="Unlink this concept"
                  >
                    <i className="fas fa-unlink"></i>
                    Unlink
                  </button>
                ) : (
                  <>
                    {/* Thumbs up button */}
                    <button
                      onClick={() => isAccepted ? handleClear(idx) : handleAccept(idx, concept)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        border: isAccepted
                          ? 'none'
                          : isRejected
                            ? '1px solid var(--neutral-300)'
                            : '1px solid var(--accent-green)',
                        background: isAccepted
                          ? 'var(--accent-green)'
                          : 'white',
                        color: isAccepted
                          ? 'white'
                          : isRejected
                            ? 'var(--neutral-400)'
                            : 'var(--accent-green)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        transition: 'all 0.15s ease',
                      }}
                      title={isAccepted ? 'Undo accept' : 'Accept'}
                    >
                      <i className="fas fa-thumbs-up"></i>
                    </button>

                    {/* Thumbs down button */}
                    <button
                      onClick={() => isRejected ? handleClear(idx) : handleReject(idx)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        border: isRejected
                          ? 'none'
                          : isAccepted
                            ? '1px solid var(--neutral-300)'
                            : '1px solid var(--accent-green)',
                        background: isRejected
                          ? 'var(--neutral-500)'
                          : 'white',
                        color: isRejected
                          ? 'white'
                          : isAccepted
                            ? 'var(--neutral-400)'
                            : 'var(--accent-green)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        transition: 'all 0.15s ease',
                      }}
                      title={isRejected ? 'Undo reject' : 'Reject'}
                    >
                      <i className="fas fa-thumbs-down"></i>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create new concept section */}
      <div style={{ marginTop: 'var(--space-3)' }}>
        {showNewConceptForm ? (
          <div style={{
            padding: 'var(--space-3)',
            background: 'var(--neutral-50)',
            borderRadius: '8px',
            border: '1px solid var(--neutral-200)',
          }}>
            <div style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--neutral-600)',
              marginBottom: 'var(--space-2)',
            }}>
              Create New Concept
            </div>
            <div style={{
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'center',
            }}>
              <input
                ref={newConceptInputRef}
                type="text"
                value={newConceptLabel}
                onChange={(e) => setNewConceptLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateNewConcept();
                  if (e.key === 'Escape') setShowNewConceptForm(false);
                }}
                placeholder="Concept name..."
                style={{
                  flex: 1,
                  padding: 'var(--space-2)',
                  borderRadius: '6px',
                  border: '1px solid var(--neutral-200)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                }}
              />
              <select
                value={newConceptType}
                onChange={(e) => setNewConceptType(e.target.value)}
                style={{
                  padding: 'var(--space-2)',
                  borderRadius: '6px',
                  border: '1px solid var(--neutral-200)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-xs)',
                  background: 'white',
                }}
              >
                <option value="non_physical_concept">Non-Physical Concept</option>
                <option value="research_method">Research Method</option>
                <option value="measurement">Measurement</option>
                <option value="intervention">Intervention</option>
                <option value="pathology">Pathology</option>
                <option value="emotion">Emotion</option>
                <option value="symptom">Symptom</option>
                <option value="school_of_thought">School of Thought</option>
                <option value="physical_entity">Physical Entity</option>
                <option value="physical_process">Physical Process</option>
                <option value="non_physical_process">Non-Physical Process</option>
              </select>
              <button
                onClick={handleCreateNewConcept}
                disabled={!newConceptLabel.trim()}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  background: newConceptLabel.trim() ? 'var(--accent-green)' : 'var(--neutral-300)',
                  color: 'white',
                  cursor: newConceptLabel.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <i className="fas fa-plus"></i>
                Add
              </button>
              <button
                onClick={() => setShowNewConceptForm(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--neutral-300)',
                  background: 'white',
                  color: 'var(--neutral-500)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNewConceptForm(true)}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px dashed var(--neutral-300)',
              background: 'transparent',
              color: 'var(--neutral-500)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              width: '100%',
              justifyContent: 'center',
            }}
          >
            <i className="fas fa-plus"></i>
            Add a concept not in list
          </button>
        )}
      </div>

      {/* Summary line */}
      {(acceptedCount > 0 || rejectedCount > 0) && (
        <div style={{
          marginTop: 'var(--space-2)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          color: 'var(--neutral-500)',
          display: 'flex',
          gap: 'var(--space-3)',
        }}>
          {acceptedCount > 0 && (
            <span style={{ color: 'var(--accent-green)' }}>
              <i className="fas fa-check" style={{ marginRight: '4px' }}></i>
              {acceptedCount} accepted
            </span>
          )}
          {rejectedCount > 0 && (
            <span>
              <i className="fas fa-times" style={{ marginRight: '4px' }}></i>
              {rejectedCount} rejected
            </span>
          )}
        </div>
      )}
    </div>
  );
}
