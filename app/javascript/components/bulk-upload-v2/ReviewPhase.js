import React, { useState, useCallback, useEffect } from 'react';
import { useBulkUpload } from './BulkUploadContext';
import AuthorResolutionSection from './AuthorResolutionSection';
import ConceptResolutionSection from './ConceptResolutionSection';

export default function ReviewPhase() {
  const { state, dispatch, filteredItems, stats, enrichedItems } = useBulkUpload();
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [approving, setApproving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [metadata, setMetadata] = useState({});
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Get the selected item
  const selectedItem = enrichedItems.find(item => item.id === selectedItemId);

  // Auto-select first item if none selected
  useEffect(() => {
    if (!selectedItemId && filteredItems.length > 0) {
      setSelectedItemId(filteredItems[0].id);
    }
  }, [selectedItemId, filteredItems]);

  // Update metadata when selected item changes
  useEffect(() => {
    if (selectedItem) {
      setMetadata(selectedItem.extracted_metadata || {});
    }
  }, [selectedItemId]);

  // Poll for updates when items are in 'approved' status (waiting for source creation)
  useEffect(() => {
    const hasApprovedItems = enrichedItems.some(item => item.status === 'approved');
    if (!hasApprovedItems || !state.batch?.id) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/upload_batches/${state.batch.id}.json`);
        if (response.ok) {
          const data = await response.json();
          dispatch({ type: 'SET_BATCH', payload: data });

          // Check if all done
          const allDone = data.items.every(
            item => ['created', 'skipped'].includes(item.status)
          );
          if (allDone) {
            dispatch({ type: 'SET_PHASE', payload: 'complete' });
          }
        }
      } catch (err) {
        console.error('Error polling batch:', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [enrichedItems, state.batch?.id, dispatch]);

  // Get item status info
  const getItemStatus = (item) => {
    if (item.status === 'created') {
      return { icon: 'fa-check-circle', color: 'var(--accent-green)', label: 'Created' };
    }
    if (item.status === 'approved') {
      return { icon: 'fa-spinner fa-spin', color: 'var(--accent-blue)', label: 'Creating...' };
    }
    if (item.status === 'skipped') {
      return { icon: 'fa-ban', color: 'var(--neutral-400)', label: 'Skipped' };
    }
    if (item.status === 'failed') {
      return { icon: 'fa-times-circle', color: 'var(--accent-red)', label: 'Failed' };
    }
    // Check if ready (all authors resolved)
    const allAuthorsResolved = (item.detected_authors || []).every(
      author => author.resolution || author.auto_linked
    );
    if (allAuthorsResolved) {
      return { icon: 'fa-check', color: 'var(--accent-green)', label: 'Ready' };
    }
    return { icon: 'fa-clock', color: 'var(--accent-orange)', label: 'Needs Review' };
  };

  // Check if selected item can be approved (valid status)
  const canApprove = selectedItem && (
    selectedItem.status === 'extracted' || selectedItem.status === 'review_needed'
  );

  // Check if all authors are resolved
  const allAuthorsResolved = selectedItem && (selectedItem.detected_authors || []).every(
    author => author.resolution || author.auto_linked
  );

  // Count unresolved authors for warning
  const unresolvedAuthorsCount = selectedItem
    ? (selectedItem.detected_authors || []).filter(author => !author.resolution && !author.auto_linked).length
    : 0;

  const handleApprove = useCallback(async () => {
    if (!selectedItem) return;
    setApproving(true);

    try {
      // Build author decisions
      const authorDecisions = {};
      selectedItem.detected_authors?.forEach((author, idx) => {
        const resolution = author.resolution;
        if (resolution) {
          if (resolution.action === 'create') {
            authorDecisions[idx] = {
              action: 'create',
              first_name: resolution.firstName,
              last_name: resolution.lastName,
              orcid: resolution.orcid,
              tempPersonId: resolution.tempPersonId
            };
          } else if (resolution.action === 'link') {
            if (resolution.personId) {
              authorDecisions[idx] = { action: 'link', person_id: resolution.personId };
            } else if (resolution.tempPersonId) {
              const pendingPerson = state.pendingPeople.find(p => p.tempId === resolution.tempPersonId);
              if (pendingPerson?.realId) {
                authorDecisions[idx] = { action: 'link', person_id: pendingPerson.realId };
              } else if (pendingPerson) {
                authorDecisions[idx] = {
                  action: 'create',
                  first_name: pendingPerson.firstName,
                  last_name: pendingPerson.lastName,
                  orcid: pendingPerson.orcid,
                  tempPersonId: resolution.tempPersonId
                };
              }
            }
          } else if (resolution.action === 'skip') {
            authorDecisions[idx] = { action: 'skip' };
          }
        } else if (author.auto_linked && author.linked_person_id) {
          authorDecisions[idx] = { action: 'link', person_id: author.linked_person_id };
        }
      });

      // Build concept decisions
      const conceptDecisions = {};
      selectedItem.detected_concepts?.forEach((concept, idx) => {
        const resolution = concept.resolution;
        if (resolution) {
          if (resolution.action === 'create') {
            const pendingConcept = state.pendingConcepts.find(c => c.tempId === resolution.tempConceptId);
            conceptDecisions[idx] = {
              action: 'create',
              label: resolution.label || pendingConcept?.label,
              concept_type: resolution.conceptType || pendingConcept?.conceptType || 'non_physical_concept',
              tempConceptId: resolution.tempConceptId
            };
          } else if (resolution.action === 'link') {
            if (resolution.conceptId) {
              conceptDecisions[idx] = { action: 'link', concept_id: resolution.conceptId };
            } else if (resolution.tempConceptId) {
              const pendingConcept = state.pendingConcepts.find(c => c.tempId === resolution.tempConceptId);
              if (pendingConcept?.realId) {
                conceptDecisions[idx] = { action: 'link', concept_id: pendingConcept.realId };
              } else if (pendingConcept) {
                conceptDecisions[idx] = {
                  action: 'create',
                  label: pendingConcept.label,
                  concept_type: pendingConcept.conceptType || 'non_physical_concept',
                  tempConceptId: resolution.tempConceptId
                };
              }
            }
          } else if (resolution.action === 'skip') {
            conceptDecisions[idx] = { action: 'skip' };
          }
        } else if (concept.auto_linked && concept.matched_concept_id) {
          conceptDecisions[idx] = { action: 'link', concept_id: concept.matched_concept_id };
        }
      });

      const response = await fetch(`/upload_batch_items/${selectedItem.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          decisions: { authors: authorDecisions, concepts: conceptDecisions, metadata }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.created_people?.length > 0) {
          const personMappings = {};
          data.created_people.forEach(m => { personMappings[m.tempPersonId] = m.personId; });
          dispatch({ type: 'REPLACE_TEMP_IDS', payload: { personMappings, conceptMappings: {} } });
        }
        await refreshBatch();
        // Move to next item
        selectNextItem();
      }
    } catch (err) {
      console.error('Error approving item:', err);
    } finally {
      setApproving(false);
    }
  }, [selectedItem, metadata, state.pendingPeople, state.pendingConcepts, dispatch]);

  const handleSkip = useCallback(async () => {
    if (!selectedItem) return;
    setSkipping(true);

    try {
      const response = await fetch(`/upload_batch_items/${selectedItem.id}/skip`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        await refreshBatch();
        selectNextItem();
      }
    } catch (err) {
      console.error('Error skipping item:', err);
    } finally {
      setSkipping(false);
    }
  }, [selectedItem]);

  const refreshBatch = async () => {
    try {
      const response = await fetch(`/upload_batches/${state.batch.id}.json`);
      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'SET_BATCH', payload: data });

        // Check if all done (wait for 'created' not just 'approved' so source_ids are available)
        const allDone = data.items.every(
          item => ['created', 'skipped'].includes(item.status)
        );
        if (allDone) {
          dispatch({ type: 'SET_PHASE', payload: 'complete' });
        }
      }
    } catch (err) {
      console.error('Error refreshing batch:', err);
    }
  };

  const selectNextItem = () => {
    const currentIndex = filteredItems.findIndex(i => i.id === selectedItemId);
    const nextItem = filteredItems.find((item, idx) =>
      idx > currentIndex && !['approved', 'created', 'skipped'].includes(item.status)
    );
    if (nextItem) {
      setSelectedItemId(nextItem.id);
    } else {
      // Try from beginning
      const firstIncomplete = filteredItems.find(item =>
        !['approved', 'created', 'skipped'].includes(item.status)
      );
      if (firstIncomplete) {
        setSelectedItemId(firstIncomplete.id);
      }
    }
  };

  const handleBulkApprove = useCallback(async () => {
    setApproving(true);
    const readyItems = enrichedItems.filter(item => {
      if (item.status !== 'extracted' && item.status !== 'review_needed') return false;
      return (item.detected_authors || []).every(a => a.resolution || a.auto_linked);
    });

    const personMappings = {};
    const conceptMappings = {};

    for (const item of readyItems) {
      try {
        // Build author decisions
        const authorDecisions = {};
        item.detected_authors?.forEach((author, idx) => {
          const resolution = author.resolution;
          if (resolution) {
            if (resolution.action === 'link' && resolution.personId) {
              authorDecisions[idx] = { action: 'link', person_id: resolution.personId };
            } else if (resolution.action === 'link' && resolution.tempPersonId && personMappings[resolution.tempPersonId]) {
              authorDecisions[idx] = { action: 'link', person_id: personMappings[resolution.tempPersonId] };
            } else if (resolution.action === 'create' || (resolution.action === 'link' && resolution.tempPersonId)) {
              const pendingPerson = state.pendingPeople.find(p => p.tempId === resolution.tempPersonId);
              if (pendingPerson) {
                authorDecisions[idx] = {
                  action: 'create',
                  first_name: pendingPerson.firstName || resolution.firstName,
                  last_name: pendingPerson.lastName || resolution.lastName,
                  orcid: pendingPerson.orcid || resolution.orcid,
                  tempPersonId: resolution.tempPersonId
                };
              }
            } else if (resolution.action === 'skip') {
              authorDecisions[idx] = { action: 'skip' };
            }
          } else if (author.auto_linked && author.linked_person_id) {
            authorDecisions[idx] = { action: 'link', person_id: author.linked_person_id };
          }
        });

        // Build concept decisions
        const conceptDecisions = {};
        item.detected_concepts?.forEach((concept, idx) => {
          const resolution = concept.resolution;
          if (resolution) {
            if (resolution.action === 'link' && resolution.conceptId) {
              conceptDecisions[idx] = { action: 'link', concept_id: resolution.conceptId };
            } else if (resolution.action === 'link' && resolution.tempConceptId && conceptMappings[resolution.tempConceptId]) {
              conceptDecisions[idx] = { action: 'link', concept_id: conceptMappings[resolution.tempConceptId] };
            } else if (resolution.action === 'create' || (resolution.action === 'link' && resolution.tempConceptId)) {
              const pendingConcept = state.pendingConcepts.find(c => c.tempId === resolution.tempConceptId);
              if (pendingConcept) {
                conceptDecisions[idx] = {
                  action: 'create',
                  label: pendingConcept.label || resolution.label,
                  concept_type: pendingConcept.conceptType || resolution.conceptType || 'non_physical_concept',
                  tempConceptId: resolution.tempConceptId
                };
              }
            } else if (resolution.action === 'skip') {
              conceptDecisions[idx] = { action: 'skip' };
            }
          } else if (concept.auto_linked && concept.matched_concept_id) {
            conceptDecisions[idx] = { action: 'link', concept_id: concept.matched_concept_id };
          }
        });

        const response = await fetch(`/upload_batch_items/${item.id}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
          },
          body: JSON.stringify({
            decisions: {
              authors: authorDecisions,
              concepts: conceptDecisions,
              metadata: item.extracted_metadata || {}
            }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          data.created_people?.forEach(m => { personMappings[m.tempPersonId] = m.personId; });
          data.created_concepts?.forEach(m => { conceptMappings[m.tempConceptId] = m.conceptId; });
        }
      } catch (err) {
        console.error(`Failed to approve item ${item.id}:`, err);
      }
    }

    if (Object.keys(personMappings).length > 0 || Object.keys(conceptMappings).length > 0) {
      dispatch({ type: 'REPLACE_TEMP_IDS', payload: { personMappings, conceptMappings } });
    }
    await refreshBatch();
    setApproving(false);
  }, [enrichedItems, state.pendingPeople, state.pendingConcepts, dispatch]);

  // Check if all done (wait for 'created' not just 'approved' so source_ids are available)
  const allDone = enrichedItems.length > 0 && enrichedItems.every(
    item => ['created', 'skipped'].includes(item.status)
  );
  if (allDone) {
    dispatch({ type: 'SET_PHASE', payload: 'complete' });
    return null;
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 180px)' }}>
      {/* Sidebar */}
      <div style={{
        width: '320px',
        background: '#e2e2e2',
        overflowY: 'auto',
        padding: 'var(--space-4)',
        paddingLeft: 'var(--space-6)',
        boxShadow: 'inset -4px 0 8px rgba(0, 0, 0, 0.05)',
      }}>
        {/* Stats pills */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
          paddingBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--neutral-300)',
        }}>
          <StatPill
            count={stats.ready}
            label="Ready"
            color="var(--accent-green)"
            active={state.filter === 'ready'}
            onClick={() => dispatch({ type: 'SET_FILTER', payload: state.filter === 'ready' ? 'all' : 'ready' })}
          />
          <StatPill
            count={stats.needsReview}
            label="Review"
            color="var(--accent-orange)"
            active={state.filter === 'needs_review'}
            onClick={() => dispatch({ type: 'SET_FILTER', payload: state.filter === 'needs_review' ? 'all' : 'needs_review' })}
          />
          <StatPill
            count={stats.failed}
            label="Failed"
            color="var(--accent-red)"
            active={state.filter === 'failed'}
            onClick={() => dispatch({ type: 'SET_FILTER', payload: state.filter === 'failed' ? 'all' : 'failed' })}
          />
          <StatPill
            count={stats.created + stats.skipped}
            label="Done"
            color="var(--neutral-500)"
            active={false}
            onClick={() => {}}
          />
          {stats.approved > 0 && (
            <StatPill
              count={stats.approved}
              label="Creating..."
              color="var(--accent-blue)"
              active={false}
              onClick={() => {}}
            />
          )}
        </div>

        {/* Bulk actions */}
        {stats.ready > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={approving}
            className="btn-source"
            style={{
              width: '100%',
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
            }}
          >
            {approving ? (
              <><i className="fas fa-spinner fa-spin"></i> Approving...</>
            ) : (
              <><i className="fas fa-check-double"></i> Approve All Ready ({stats.ready})</>
            )}
          </button>
        )}

        {/* Session info */}
        {state.pendingPeople.length > 0 && (
          <div style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'color-mix(in srgb, var(--accent-blue) 15%, white)',
            borderRadius: '6px',
            fontSize: 'var(--text-xs)',
            color: 'var(--neutral-600)',
          }}>
            <i className="fas fa-magic" style={{ color: 'var(--accent-blue)', marginRight: '6px' }}></i>
            <strong>{state.pendingPeople.length}</strong> new people this session
          </div>
        )}

        {/* Article list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {filteredItems.map(item => {
            const status = getItemStatus(item);
            const isSelected = item.id === selectedItemId;
            const isDone = ['approved', 'created', 'skipped'].includes(item.status);
            const isFailed = item.status === 'failed';

            return (
              <div
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                style={{
                  padding: 'var(--space-3)',
                  background: isSelected ? 'white' : isDone ? 'var(--neutral-200)' : isFailed ? 'color-mix(in srgb, var(--accent-red) 8%, white)' : 'white',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--accent-blue)' : isFailed ? '1px solid color-mix(in srgb, var(--accent-red) 30%, white)' : '1px solid var(--neutral-200)',
                  opacity: isDone ? 0.6 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                  <i
                    className={`fas ${status.icon}`}
                    style={{
                      color: status.color,
                      fontSize: 'var(--text-sm)',
                      marginTop: '2px',
                    }}
                  ></i>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      color: 'var(--neutral-800)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: '1.3',
                    }}>
                      {item.extracted_metadata?.title || item.original_filename}
                    </div>
                    {item.extracted_metadata?.year && (
                      <div style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                        marginTop: '2px',
                      }}>
                        {item.extracted_metadata.year}
                      </div>
                    )}
                    {/* Show error message for failed items */}
                    {isFailed && item.error_message && (
                      <div style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--accent-red)',
                        marginTop: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                        {item.error_message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--neutral-500)' }}>
            <i className="fas fa-filter" style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}></i>
            <p style={{ fontSize: 'var(--text-sm)' }}>No items match filter</p>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div style={{
        flex: 1,
        background: 'white',
        overflowY: 'auto',
        padding: 'var(--space-6)',
        paddingRight: 'var(--space-8)',
      }}>
        {selectedItem ? (
          <div>
            {/* Control bar - sticky at top */}
            <div style={{
              position: 'sticky',
              top: 'calc(-1 * var(--space-6))',
              zIndex: 10,
              background: 'white',
              marginTop: 'calc(-1 * var(--space-6))',
              marginLeft: 'calc(-1 * var(--space-6))',
              marginRight: 'calc(-1 * var(--space-8))',
              paddingLeft: 'var(--space-6)',
              paddingRight: 'var(--space-8)',
              paddingTop: 'var(--space-4)',
              paddingBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--neutral-200)',
              marginBottom: 'var(--space-4)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {selectedItem.pdf_url && (
                    <button
                      onClick={() => setShowPdfModal(true)}
                      className="btn-outline-source"
                      style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)' }}
                    >
                      <i className="fas fa-file-pdf" style={{ marginRight: '6px' }}></i>
                      View PDF
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <button
                      onClick={handleSkip}
                      disabled={skipping || ['approved', 'created', 'skipped'].includes(selectedItem.status)}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-sm)',
                        background: 'transparent',
                        border: '1px solid var(--neutral-300)',
                        borderRadius: '6px',
                        color: 'var(--neutral-600)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: ['approved', 'created', 'skipped'].includes(selectedItem.status) ? 0.5 : 1,
                      }}
                    >
                      {skipping ? (
                        <><i className="fas fa-spinner fa-spin"></i> Skipping...</>
                      ) : (
                        <><i className="fas fa-forward"></i> Skip</>
                      )}
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={approving || !canApprove}
                      className="btn-source"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: canApprove ? 1 : 0.5,
                      }}
                    >
                      {approving ? (
                        <><i className="fas fa-spinner fa-spin"></i> Approving...</>
                      ) : (
                        <><i className="fas fa-check"></i> Approve</>
                      )}
                    </button>
                  </div>
                  {/* Warning text - always reserve space */}
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    color: '#e65100',
                    height: '16px',
                    visibility: (canApprove && !allAuthorsResolved) ? 'visible' : 'hidden',
                  }}>
                    <i className="fas fa-exclamation-triangle" style={{ marginRight: '4px' }}></i>
                    {unresolvedAuthorsCount} unlinked author{unresolvedAuthorsCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Title section */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'var(--neutral-800)',
                marginBottom: 'var(--space-2)',
              }}>
                {metadata.title || selectedItem.original_filename}
              </h2>
              <div style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-500)',
                display: 'flex',
                gap: 'var(--space-4)',
              }}>
                {metadata.year && <span>{metadata.year}</span>}
                {metadata.journal_name && <span>{metadata.journal_name}</span>}
                {(metadata.doi || selectedItem.extracted_doi) && (
                  <span>DOI: {metadata.doi || selectedItem.extracted_doi}</span>
                )}
              </div>
            </div>

            {/* Duplicate warning */}
            {selectedItem.duplicate_candidates?.length > 0 && (
              <div style={{
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-4)',
                background: '#fff3e0',
                borderRadius: '8px',
                borderLeft: '4px solid #f57c00',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: '#f57c00',
                  marginBottom: 'var(--space-2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}>
                  <i className="fas fa-exclamation-triangle"></i>
                  Possible Duplicate Detected
                </div>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-600)',
                  marginBottom: 'var(--space-3)',
                }}>
                  This item may already exist in your library. Consider skipping.
                </div>
                {selectedItem.duplicate_candidates.map((dup, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--space-3)',
                      background: 'white',
                      borderRadius: '6px',
                      border: '1px solid var(--neutral-200)',
                      marginBottom: idx < selectedItem.duplicate_candidates.length - 1 ? 'var(--space-2)' : 0,
                    }}
                  >
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: 'var(--neutral-800)',
                      marginBottom: 'var(--space-1)',
                    }}>
                      {dup.title || 'Untitled'}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--neutral-500)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--space-3)',
                    }}>
                      {dup.year && <span>{dup.year}</span>}
                      {dup.doi && <span>DOI: {dup.doi}</span>}
                      {dup.authors && <span>{dup.authors}</span>}
                    </div>
                    {dup.id && (
                      <a
                        href={`/sources/${dup.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: 'var(--space-2)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--accent-blue)',
                          textDecoration: 'none',
                        }}
                      >
                        <i className="fas fa-external-link-alt"></i>
                        View in Library
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Error message */}
            {selectedItem.status === 'failed' && selectedItem.error_message && (
              <div style={{
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'color-mix(in srgb, var(--accent-red) 10%, white)',
                borderRadius: '8px',
                border: '1px solid color-mix(in srgb, var(--accent-red) 30%, white)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--accent-red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}>
                  <i className="fas fa-exclamation-circle"></i>
                  {selectedItem.error_message}
                </div>
              </div>
            )}

            {/* Metadata section */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--neutral-700)',
                marginBottom: 'var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <i className="fas fa-file-alt" style={{ color: 'var(--accent-blue)' }}></i>
                Metadata
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-3)',
              }}>
                <MetadataField label="Title" value={metadata.title} onChange={(v) => setMetadata({ ...metadata, title: v })} fullWidth />
                <MetadataField label="Year" value={metadata.year} onChange={(v) => setMetadata({ ...metadata, year: v })} />
                <MetadataField label="Journal" value={metadata.journal_name} onChange={(v) => setMetadata({ ...metadata, journal_name: v })} />
                <MetadataField label="DOI" value={metadata.doi || selectedItem.extracted_doi} onChange={(v) => setMetadata({ ...metadata, doi: v })} />
              </div>
              {/* Abstract */}
              <div style={{ marginTop: 'var(--space-3)' }}>
                <label style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--neutral-500)',
                  display: 'block',
                  marginBottom: '4px',
                }}>
                  Abstract
                </label>
                <textarea
                  value={metadata.abstract || ''}
                  onChange={(e) => setMetadata({ ...metadata, abstract: e.target.value })}
                  placeholder="Abstract (optional)"
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: 'var(--space-2)',
                    borderRadius: '6px',
                    border: '1px solid var(--neutral-200)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            {/* Raw authors */}
            {metadata.authors && (
              <div style={{
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3)',
                background: 'var(--neutral-50)',
                borderRadius: '8px',
                border: '1px solid var(--neutral-200)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--neutral-500)',
                  marginBottom: 'var(--space-1)',
                }}>
                  <i className="fas fa-quote-left" style={{ marginRight: '6px' }}></i>
                  Raw Author String
                </div>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-700)',
                  fontStyle: 'italic',
                }}>
                  {metadata.authors}
                </div>
              </div>
            )}

            {/* Authors section */}
            <AuthorResolutionSection
              item={selectedItem}
              onResolutionChange={(authorIdx, resolution) => {
                dispatch({
                  type: 'RESOLVE_AUTHOR',
                  payload: { itemId: selectedItem.id, authorIdx, resolution }
                });
              }}
              onCreatePerson={(authorIdx, personData) => {
                dispatch({
                  type: 'CREATE_PENDING_PERSON',
                  payload: { itemId: selectedItem.id, authorIdx, ...personData }
                });
              }}
            />

            {/* Concepts section */}
            <ConceptResolutionSection
              item={selectedItem}
              onResolutionChange={(conceptIdx, resolution) => {
                dispatch({
                  type: 'RESOLVE_CONCEPT',
                  payload: { itemId: selectedItem.id, conceptIdx, resolution }
                });
              }}
              onCreateConcept={(conceptIdx, conceptData) => {
                dispatch({
                  type: 'CREATE_PENDING_CONCEPT',
                  payload: { itemId: selectedItem.id, conceptIdx, ...conceptData }
                });
              }}
            />

            {/* Action buttons */}
            <div style={{
              marginTop: 'var(--space-6)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--neutral-200)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <button
                onClick={handleSkip}
                disabled={skipping}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  fontSize: 'var(--text-sm)',
                  background: 'transparent',
                  border: '1px solid var(--neutral-300)',
                  borderRadius: '6px',
                  color: 'var(--neutral-600)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                {skipping ? (
                  <><i className="fas fa-spinner fa-spin"></i> Skipping...</>
                ) : (
                  <><i className="fas fa-ban"></i> Skip Article</>
                )}
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <button
                  onClick={handleApprove}
                  disabled={approving || !canApprove}
                  className="btn-source"
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    fontSize: 'var(--text-sm)',
                    opacity: canApprove ? 1 : 0.5,
                  }}
                >
                  {approving ? (
                    <><i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }}></i> Approving...</>
                  ) : (
                    <><i className="fas fa-check" style={{ marginRight: '6px' }}></i> Approve</>
                  )}
                </button>
                {/* Warning text - always reserve space */}
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-xs)',
                  color: '#e65100',
                  height: '16px',
                  visibility: (canApprove && !allAuthorsResolved) ? 'visible' : 'hidden',
                }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: '4px' }}></i>
                  {unresolvedAuthorsCount} unlinked author{unresolvedAuthorsCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--neutral-400)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <i className="fas fa-hand-pointer" style={{ fontSize: '2rem', marginBottom: 'var(--space-4)' }}></i>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)' }}>
                Select an article from the sidebar
              </p>
            </div>
          </div>
        )}
      </div>

      {/* PDF Modal */}
      {showPdfModal && selectedItem?.pdf_url && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-6)',
          }}
          onClick={() => setShowPdfModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '900px',
              height: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: 'var(--space-4)',
              borderBottom: '1px solid var(--neutral-200)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--neutral-800)',
                margin: 0,
              }}>
                <i className="fas fa-file-pdf" style={{ color: 'var(--accent-blue)', marginRight: '8px' }}></i>
                {selectedItem.original_filename}
              </h3>
              <button
                onClick={() => setShowPdfModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 'var(--text-xl)',
                  color: 'var(--neutral-500)',
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <iframe
                src={selectedItem.pdf_url}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title={`PDF Preview: ${selectedItem.original_filename}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ count, label, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: '12px',
        border: active ? `2px solid ${color}` : '1px solid var(--neutral-300)',
        background: active ? `color-mix(in srgb, ${color} 15%, white)` : 'white',
        cursor: count > 0 ? 'pointer' : 'default',
        opacity: count > 0 ? 1 : 0.5,
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color }}>{count}</span>
      <span style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-600)' }}>{label}</span>
    </button>
  );
}

function MetadataField({ label, value, onChange, fullWidth }) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <label style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        color: 'var(--neutral-500)',
        display: 'block',
        marginBottom: '4px',
      }}>
        {label}
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: 'var(--space-2)',
          borderRadius: '6px',
          border: '1px solid var(--neutral-200)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
        }}
      />
    </div>
  );
}
