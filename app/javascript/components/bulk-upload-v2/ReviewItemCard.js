import React, { useState, useCallback } from 'react';
import { useBulkUpload } from './BulkUploadContext';
import AuthorResolutionSection from './AuthorResolutionSection';
import ConceptResolutionSection from './ConceptResolutionSection';
import PdfPreview from './PdfPreview';

export default function ReviewItemCard({ item, isExpanded, onToggleExpand, onApproved }) {
  const { state, dispatch } = useBulkUpload();
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState(item.extracted_metadata || {});
  const [showPdfModal, setShowPdfModal] = useState(false);

  const status = item.status;
  // Ready if all authors resolved (status can be 'extracted' or 'review_needed')
  const canApprove = status === 'extracted' || status === 'review_needed';
  const allAuthorsResolved = (item.detected_authors || []).every(
    author => author.resolution || author.auto_linked
  );
  const isReady = canApprove && allAuthorsResolved;
  const isFailed = status === 'failed';
  const isApproved = status === 'approved' || status === 'created';

  const handleApprove = useCallback(async () => {
    setSaving(true);

    try {
      // Build decisions from resolutions
      const authorDecisions = {};
      item.detected_authors.forEach((author, idx) => {
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
              authorDecisions[idx] = {
                action: 'link',
                person_id: resolution.personId
              };
            } else if (resolution.tempPersonId) {
              // Find pending person and create them
              const pendingPerson = state.pendingPeople.find(
                p => p.tempId === resolution.tempPersonId
              );
              if (pendingPerson?.realId) {
                // Already created in a previous approval
                authorDecisions[idx] = {
                  action: 'link',
                  person_id: pendingPerson.realId
                };
              } else if (pendingPerson) {
                // Need to create
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
          authorDecisions[idx] = {
            action: 'link',
            person_id: author.linked_person_id
          };
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
            metadata: metadata
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onApproved(item.id, data.created_people);
      } else {
        const error = await response.json();
        console.error('Approval failed:', error);
      }
    } catch (err) {
      console.error('Error approving item:', err);
    } finally {
      setSaving(false);
    }
  }, [item, metadata, state.pendingPeople, onApproved]);

  const statusConfig = {
    extracted: { label: 'Ready', color: 'var(--accent-green)', icon: 'fa-check-circle' },
    review_needed: { label: 'Needs Review', color: 'var(--accent-orange)', icon: 'fa-exclamation-triangle' },
    failed: { label: 'Failed', color: 'var(--accent-red)', icon: 'fa-times-circle' },
    approved: { label: 'Approved', color: 'var(--accent-blue)', icon: 'fa-check-double' },
    created: { label: 'Created', color: 'var(--accent-green)', icon: 'fa-check-double' },
    pending: { label: 'Pending', color: 'var(--neutral-400)', icon: 'fa-clock' },
    processing: { label: 'Processing', color: 'var(--accent-blue)', icon: 'fa-spinner fa-spin' },
  };

  const statusInfo = isReady && !isApproved
    ? { label: 'Ready', color: 'var(--accent-green)', icon: 'fa-check-circle' }
    : statusConfig[status] || statusConfig.pending;

  return (
    <div
      className="card"
      style={{
        background: 'white',
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        boxShadow: isExpanded
          ? '0 8px 16px rgba(0, 0, 0, 0.18), 0 2px 4px rgba(0, 0, 0, 0.12)'
          : '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)',
        transform: isExpanded ? 'translateY(-2px)' : 'none',
        border: isExpanded ? '1px solid var(--accent-blue)' : '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isExpanded && !isApproved) {
          e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.18), 0 2px 4px rgba(0, 0, 0, 0.12)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isExpanded) {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Collapsed header */}
      <div
        onClick={!isApproved ? onToggleExpand : undefined}
        style={{
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          cursor: isApproved ? 'default' : 'pointer',
          background: isExpanded ? '#e2e2e2' : 'white',
          borderBottom: isExpanded ? '1px solid var(--neutral-200)' : 'none',
        }}
      >
        {/* Status badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-1) var(--space-2)',
          borderRadius: '4px',
          background: `color-mix(in srgb, ${statusInfo.color} 15%, white)`,
          minWidth: '100px',
        }}>
          <i className={`fas ${statusInfo.icon}`} style={{ color: statusInfo.color, fontSize: 'var(--text-xs)' }}></i>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: statusInfo.color,
          }}>
            {statusInfo.label}
          </span>
        </div>

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-base)',
            fontWeight: 600,
            color: 'var(--neutral-800)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {metadata.title || item.original_filename}
          </div>
          {metadata.year && (
            <div style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              color: 'var(--neutral-500)',
            }}>
              {metadata.year} {metadata.journal_name && `· ${metadata.journal_name}`}
            </div>
          )}
        </div>

        {/* Author/concept counts */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          color: 'var(--neutral-500)',
        }}>
          <span>
            <i className="fas fa-user" style={{ marginRight: '4px' }}></i>
            {item.detected_authors?.length || 0} authors
          </span>
          <span>
            <i className="fas fa-tag" style={{ marginRight: '4px' }}></i>
            {item.detected_concepts?.length || 0} concepts
          </span>
        </div>

        {/* Quick approve button (when ready) */}
        {isReady && !isApproved && !isExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleApprove();
            }}
            disabled={saving}
            className="btn-source"
            style={{
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--text-xs)',
            }}
          >
            {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
            {' '}Approve
          </button>
        )}

        {/* Expand icon */}
        {!isApproved && (
          <i
            className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}
            style={{ color: 'var(--neutral-400)', fontSize: 'var(--text-sm)' }}
          ></i>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && !isApproved && (
        <div style={{ padding: 'var(--space-4)' }}>
          {/* Metadata section */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-3)',
              paddingBottom: 'var(--space-2)',
              borderBottom: '2px solid var(--accent-blue)',
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
                <i className="fas fa-file-alt" style={{ color: 'var(--accent-blue)' }}></i>
                Metadata
              </h3>
              {item.pdf_url && (
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="btn-outline-source"
                  style={{
                    padding: '4px 10px',
                    fontSize: 'var(--text-xs)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <i className="fas fa-file-pdf"></i>
                  View PDF
                </button>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-3)',
            }}>
              <MetadataField
                label="Title"
                value={metadata.title}
                onChange={(v) => setMetadata({ ...metadata, title: v })}
                fullWidth
              />
              <MetadataField
                label="Year"
                value={metadata.year}
                onChange={(v) => setMetadata({ ...metadata, year: v })}
              />
              <MetadataField
                label="Journal"
                value={metadata.journal_name}
                onChange={(v) => setMetadata({ ...metadata, journal_name: v })}
              />
              <MetadataField
                label="DOI"
                value={metadata.doi || item.extracted_doi}
                onChange={(v) => setMetadata({ ...metadata, doi: v })}
              />
            </div>
          </div>

          {/* Raw authors from PDF/metadata */}
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
                Raw Author String (from metadata)
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
            item={item}
            onResolutionChange={(authorIdx, resolution) => {
              dispatch({
                type: 'RESOLVE_AUTHOR',
                payload: { itemId: item.id, authorIdx, resolution }
              });
            }}
            onCreatePerson={(authorIdx, personData) => {
              dispatch({
                type: 'CREATE_PENDING_PERSON',
                payload: {
                  itemId: item.id,
                  authorIdx,
                  ...personData
                }
              });
            }}
          />

          {/* Concepts section */}
          <ConceptResolutionSection
            item={item}
            onResolutionChange={(conceptIdx, resolution) => {
              dispatch({
                type: 'RESOLVE_CONCEPT',
                payload: { itemId: item.id, conceptIdx, resolution }
              });
            }}
            onCreateConcept={(conceptIdx, conceptData) => {
              dispatch({
                type: 'CREATE_PENDING_CONCEPT',
                payload: {
                  itemId: item.id,
                  conceptIdx,
                  ...conceptData
                }
              });
            }}
          />

          {/* Failed message */}
          {isFailed && item.error_message && (
            <div style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-3)',
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
                {item.error_message}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{
            marginTop: 'var(--space-6)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
          }}>
            <button
              onClick={onToggleExpand}
              className="btn-outline-source"
              style={{ padding: 'var(--space-2) var(--space-4)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={saving || !isReady}
              className="btn-source"
              style={{
                padding: 'var(--space-2) var(--space-4)',
                opacity: isReady ? 1 : 0.5,
              }}
            >
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin" style={{ marginRight: 'var(--space-2)' }}></i>
                  Saving...
                </>
              ) : (
                <>
                  <i className="fas fa-check" style={{ marginRight: 'var(--space-2)' }}></i>
                  Approve
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfModal && item.pdf_url && (
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
            {/* Modal header */}
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
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <i className="fas fa-file-pdf" style={{ color: 'var(--accent-blue)' }}></i>
                {item.original_filename}
              </h3>
              <button
                onClick={() => setShowPdfModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 'var(--text-xl)',
                  color: 'var(--neutral-500)',
                  cursor: 'pointer',
                  padding: 'var(--space-2)',
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* PDF embed */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <PdfPreview pdfUrl={item.pdf_url} />
            </div>
          </div>
        </div>
      )}
    </div>
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
