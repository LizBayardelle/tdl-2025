import React, { useState } from 'react';

export default function BulkUploadItemCard({ item, isExpanded, onToggle, onApproved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editedMetadata, setEditedMetadata] = useState(item.extracted_metadata || {});
  const [authorDecisions, setAuthorDecisions] = useState({});
  const [conceptDecisions, setConceptDecisions] = useState({});

  const metadata = item.extracted_metadata || {};
  const canApprove = item.status === 'extracted' || item.status === 'review_needed';
  const canRetry = item.status === 'failed';

  const handleApprove = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/batch_upload_items/${item.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          decisions: {
            ...item.user_decisions,
            metadata: editedMetadata,
            authors: authorDecisions,
            concepts: conceptDecisions,
          },
        }),
      });

      if (response.ok) {
        onApproved();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to approve');
      }
    } catch (err) {
      setError('Failed to approve item');
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/batch_upload_items/${item.id}/retry`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        onApproved();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to retry');
      }
    } catch (err) {
      setError('Failed to retry item');
    } finally {
      setSaving(false);
    }
  };

  const getStatusInfo = () => {
    switch (item.status) {
      case 'pending':
        return { icon: 'fas fa-clock', color: 'var(--neutral-400)', label: 'Pending' };
      case 'extracting':
        return { icon: 'fas fa-cog fa-spin', color: 'var(--accent-blue)', label: 'Extracting' };
      case 'extracted':
        return { icon: 'fas fa-check-circle', color: 'var(--accent-blue)', label: 'Review Details' };
      case 'review_needed':
        return { icon: 'fas fa-exclamation-triangle', color: 'var(--accent-blue)', label: 'Needs Review' };
      case 'approved':
        return { icon: 'fas fa-thumbs-up', color: 'var(--accent-blue)', label: 'Approved' };
      case 'created':
        return { icon: 'fas fa-check-double', color: 'var(--accent-blue)', label: 'Source Created' };
      case 'failed':
        return { icon: 'fas fa-times-circle', color: '#dc2626', label: 'Failed' };
      default:
        return { icon: 'fas fa-question', color: 'var(--neutral-400)', label: item.status };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      border: `1px solid ${item.status === 'failed' ? '#fecaca' : 'var(--neutral-200)'}`,
      overflow: 'hidden',
    }}>
      {/* Collapsed header */}
      <div
        onClick={onToggle}
        style={{
          padding: 'var(--space-4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          background: isExpanded ? 'color-mix(in srgb, var(--accent-blue) 12%, white)' : 'white',
        }}
      >
        <i className={statusInfo.icon} style={{ color: statusInfo.color, width: '20px', textAlign: 'center' }}></i>

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
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-500)',
            display: 'flex',
            gap: 'var(--space-3)',
            alignItems: 'center',
          }}>
            {metadata.authors && <span>{metadata.authors.substring(0, 50)}{metadata.authors.length > 50 ? '...' : ''}</span>}
            {metadata.year && <span>{metadata.year}</span>}
            {item.extracted_doi && (
              <span style={{ color: 'var(--accent-blue)' }}>
                DOI: {item.extracted_doi.substring(0, 30)}{item.extracted_doi.length > 30 ? '...' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Indicators */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {item.has_duplicates && (
            <span title="Possible duplicate" style={{
              padding: '2px 8px',
              background: '#fef3c7',
              color: '#d97706',
              borderRadius: '4px',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-body)',
            }}>
              <i className="fas fa-copy"></i>
            </span>
          )}
          {item.needs_author_review && (
            <span title="Author disambiguation needed" style={{
              padding: '2px 8px',
              background: 'color-mix(in srgb, var(--accent-blue) 15%, white)',
              color: 'var(--accent-blue)',
              borderRadius: '4px',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-body)',
            }}>
              <i className="fas fa-users"></i>
            </span>
          )}
        </div>

        <span style={{
          padding: '4px 12px',
          background: item.status === 'failed' ? '#fecaca' : '#e2e2e2',
          color: statusInfo.color,
          borderRadius: '4px',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          fontWeight: 500,
        }}>
          {statusInfo.label}
        </span>

        <i
          className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}
          style={{ color: 'var(--neutral-400)', transition: 'transform 0.2s' }}
        ></i>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--neutral-200)',
        }}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
              <i className="fas fa-exclamation-circle"></i> {error}
            </div>
          )}

          {/* Failed error message */}
          {item.status === 'failed' && item.error_message && (
            <div style={{
              padding: 'var(--space-3)',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              marginBottom: 'var(--space-4)',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: '#dc2626',
                marginBottom: 'var(--space-1)',
              }}>
                <i className="fas fa-exclamation-triangle"></i> Error
              </div>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: '#7f1d1d',
                margin: 0,
              }}>
                {item.error_message}
              </p>
            </div>
          )}

          {/* Duplicate warnings */}
          {item.duplicate_candidates && item.duplicate_candidates.length > 0 && (
            <div style={{
              padding: 'var(--space-3)',
              background: '#fef3c7',
              border: '1px solid #d97706',
              borderRadius: '8px',
              marginBottom: 'var(--space-4)',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: '#92400e',
                marginBottom: 'var(--space-2)',
              }}>
                <i className="fas fa-copy"></i> Possible Duplicates
              </div>
              {item.duplicate_candidates.map((dup, idx) => (
                <div key={idx} style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: '#92400e',
                }}>
                  <strong>{dup.type}:</strong>{' '}
                  <a
                    href={`/sources/${dup.source_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-blue)' }}
                  >
                    {dup.source_title}
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Metadata form */}
          {(item.status === 'extracted' || item.status === 'review_needed') && (
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              {/* Title */}
              <div>
                <label className="form-label">Title</label>
                <input
                  type="text"
                  value={editedMetadata.title || ''}
                  onChange={(e) => setEditedMetadata({ ...editedMetadata, title: e.target.value })}
                  className="form-input"
                />
              </div>

              {/* Authors and Year */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <label className="form-label">Authors</label>
                  <input
                    type="text"
                    value={editedMetadata.authors || ''}
                    onChange={(e) => setEditedMetadata({ ...editedMetadata, authors: e.target.value })}
                    className="form-input"
                    placeholder="Last, F., Last, F."
                  />
                </div>
                <div>
                  <label className="form-label">Year</label>
                  <input
                    type="number"
                    value={editedMetadata.year || ''}
                    onChange={(e) => setEditedMetadata({ ...editedMetadata, year: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Journal info */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <label className="form-label">Journal</label>
                  <input
                    type="text"
                    value={editedMetadata.journal_name || ''}
                    onChange={(e) => setEditedMetadata({ ...editedMetadata, journal_name: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Volume</label>
                  <input
                    type="text"
                    value={editedMetadata.volume || ''}
                    onChange={(e) => setEditedMetadata({ ...editedMetadata, volume: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Issue</label>
                  <input
                    type="text"
                    value={editedMetadata.issue || ''}
                    onChange={(e) => setEditedMetadata({ ...editedMetadata, issue: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Pages</label>
                  <input
                    type="text"
                    value={editedMetadata.pages || ''}
                    onChange={(e) => setEditedMetadata({ ...editedMetadata, pages: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              {/* DOI */}
              <div>
                <label className="form-label">DOI</label>
                <input
                  type="text"
                  value={item.extracted_doi || editedMetadata.doi || ''}
                  onChange={(e) => setEditedMetadata({ ...editedMetadata, doi: e.target.value })}
                  className="form-input"
                />
              </div>

              {/* Author matches */}
              {item.detected_authors && item.detected_authors.length > 0 && (
                <AuthorMatchSection
                  authors={item.detected_authors}
                  decisions={authorDecisions}
                  onDecisionsChange={setAuthorDecisions}
                  doi={item.extracted_doi}
                />
              )}

              {/* Source file info */}
              <div style={{
                padding: 'var(--space-3)',
                background: '#e2e2e2',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}>
                <i className="fas fa-file-pdf" style={{ color: 'var(--accent-blue)', fontSize: '1.5rem' }}></i>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    color: 'var(--neutral-700)',
                  }}>
                    {item.original_filename}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--neutral-500)',
                  }}>
                    {(item.file_size / 1024 / 1024).toFixed(2)} MB
                    {item.extraction_method && ` | Extracted via ${item.extraction_method}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Created source link */}
          {item.status === 'created' && item.source_id && (
            <div style={{
              padding: 'var(--space-4)',
              background: 'color-mix(in srgb, var(--accent-blue) 10%, white)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--accent-blue)',
                  marginBottom: 'var(--space-1)',
                }}>
                  <i className="fas fa-check-circle"></i> Source Created
                </div>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-600)',
                }}>
                  {metadata.title || item.original_filename}
                </div>
              </div>
              <a
                href={`/sources/${item.source_id}`}
                className="btn-success"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', textDecoration: 'none' }}
              >
                <i className="fas fa-external-link-alt"></i>
                View Source
              </a>
            </div>
          )}

          {/* Action buttons */}
          {(canApprove || canRetry) && (
            <div style={{
              marginTop: 'var(--space-4)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--neutral-200)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-3)',
            }}>
              {canRetry && (
                <button
                  onClick={handleRetry}
                  disabled={saving}
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
                >
                  {saving ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fas fa-redo"></i>
                  )}
                  Retry
                </button>
              )}
              {canApprove && (
                <button
                  onClick={handleApprove}
                  disabled={saving || !editedMetadata.title}
                  className="btn-success"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
                >
                  {saving ? (
                    <><i className="fas fa-spinner fa-spin"></i> Approving...</>
                  ) : (
                    <><i className="fas fa-check"></i> Approve & Create Source</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuthorMatchSection({ authors, decisions, onDecisionsChange, doi }) {
  const [expandedAuthor, setExpandedAuthor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [orcidSuggestions, setOrcidSuggestions] = useState({});
  const [loadingOrcid, setLoadingOrcid] = useState({});

  const searchPeople = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(`/people/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.slice(0, 10));
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const searchOrcidRegistry = async (idx, author) => {
    if (!author.family) return;

    setLoadingOrcid(prev => ({ ...prev, [idx]: true }));
    try {
      const params = new URLSearchParams({ family_name: author.family });
      if (author.given) params.append('given_name', author.given);
      if (doi) params.append('doi', doi);

      const response = await fetch(`/people/search_orcid?${params}`);
      if (response.ok) {
        const suggestions = await response.json();
        setOrcidSuggestions(prev => ({ ...prev, [idx]: suggestions }));
      }
    } catch (err) {
      console.error('ORCID search failed:', err);
    } finally {
      setLoadingOrcid(prev => ({ ...prev, [idx]: false }));
    }
  };

  const getDecision = (idx) => decisions[idx] || null;

  const updateDecision = (idx, decision) => {
    onDecisionsChange({ ...decisions, [idx]: decision });
  };

  const handleExpand = (idx, author) => {
    const isExpanding = expandedAuthor !== idx;
    setExpandedAuthor(isExpanding ? idx : null);
    setSearchQuery('');
    setSearchResults([]);

    // Search ORCID registry when expanding if no matches exist
    if (isExpanding && !author.auto_linked && (!author.potential_matches || author.potential_matches.length === 0)) {
      if (!orcidSuggestions[idx]) {
        searchOrcidRegistry(idx, author);
      }
    }
  };

  const useOrcidSuggestion = (idx, suggestion, author) => {
    updateDecision(idx, {
      action: 'create',
      first_name: suggestion.given_name || author.given,
      last_name: suggestion.family_name || author.family,
      orcid: suggestion.orcid
    });
  };

  return (
    <div style={{
      padding: 'var(--space-4)',
      background: 'color-mix(in srgb, var(--accent-blue) 10%, white)',
      borderRadius: '8px',
    }}>
      <h4 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: 'var(--accent-blue)',
        marginBottom: 'var(--space-3)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}>
        <i className="fas fa-users"></i>
        Author Matching
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {authors.map((author, idx) => {
          const decision = getDecision(idx);
          const isExpanded = expandedAuthor === idx;
          const isSkipped = decision?.action === 'skip';
          const hasMatches = author.potential_matches && author.potential_matches.length > 0;
          const suggestions = orcidSuggestions[idx] || [];

          return (
            <div key={idx} style={{
              background: 'white',
              borderRadius: '6px',
              border: isSkipped ? '1px dashed var(--neutral-300)' : '1px solid var(--neutral-200)',
              opacity: isSkipped ? 0.6 : 1,
            }}>
              {/* Author row */}
              <div style={{
                padding: 'var(--space-2) var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    color: isSkipped ? 'var(--neutral-400)' : 'var(--neutral-700)',
                    textDecoration: isSkipped ? 'line-through' : 'none',
                  }}>
                    {author.original}
                  </span>
                  {author.orcid && (
                    <span style={{
                      marginLeft: 'var(--space-2)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--accent-green)',
                    }}>
                      <i className="fab fa-orcid"></i> {author.orcid}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {/* Status badge */}
                  {isSkipped ? (
                    <span style={{
                      padding: '2px 8px',
                      background: 'var(--neutral-100)',
                      color: 'var(--neutral-500)',
                      borderRadius: '4px',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-body)',
                    }}>
                      Skipped
                    </span>
                  ) : decision?.action === 'link' ? (
                    <span style={{
                      padding: '2px 8px',
                      background: 'var(--accent-green-light)',
                      color: 'var(--accent-green)',
                      borderRadius: '4px',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                    }}>
                      <i className="fas fa-link"></i> {decision.person_name || 'Linked'}
                    </span>
                  ) : author.auto_linked ? (
                    <span style={{
                      padding: '2px 8px',
                      background: 'var(--accent-green-light)',
                      color: 'var(--accent-green)',
                      borderRadius: '4px',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                    }}>
                      <i className="fas fa-check-circle"></i> {author.linked_person_name}
                    </span>
                  ) : decision?.action === 'create' ? (
                    <span style={{
                      padding: '2px 8px',
                      background: 'var(--accent-gold-light)',
                      color: 'var(--accent-gold)',
                      borderRadius: '4px',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                    }}>
                      <i className="fas fa-user-plus"></i> Create: {decision.first_name} {decision.last_name}
                    </span>
                  ) : hasMatches ? (
                    <span style={{
                      padding: '2px 8px',
                      background: 'var(--accent-gold-light)',
                      color: 'var(--accent-gold)',
                      borderRadius: '4px',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                    }}>
                      <i className="fas fa-question-circle"></i> {author.potential_matches.length} possible match{author.potential_matches.length > 1 ? 'es' : ''}
                    </span>
                  ) : (
                    <span style={{
                      padding: '2px 8px',
                      background: 'var(--neutral-100)',
                      color: 'var(--neutral-500)',
                      borderRadius: '4px',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-body)',
                    }}>
                      Not in Database
                    </span>
                  )}

                  {/* Edit/Review button */}
                  <button
                    onClick={() => handleExpand(idx, author)}
                    className={isExpanded ? 'btn-source' : 'btn-outline-source'}
                    style={{
                      padding: '4px 10px',
                      fontSize: 'var(--text-xs)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                    }}
                  >
                    {isExpanded ? (
                      <><i className="fas fa-times"></i> Close</>
                    ) : (
                      <><i className="fas fa-search"></i> Review</>
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded edit section */}
              {isExpanded && (
                <div style={{
                  padding: 'var(--space-3)',
                  borderTop: '1px solid var(--neutral-200)',
                  background: 'var(--neutral-50)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}>
                  {/* Keep auto-linked button at top if applicable */}
                  {author.auto_linked && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => {
                          updateDecision(idx, null);
                          setExpandedAuthor(null);
                        }}
                        className="btn-source"
                        style={{
                          padding: '6px 12px',
                          fontSize: 'var(--text-xs)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 'var(--space-1)',
                        }}
                      >
                        <i className="fas fa-check"></i> Keep: {author.linked_person_name}
                      </button>
                    </div>
                  )}

                  {/* Potential matches from database */}
                  {hasMatches && (
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 500,
                        color: 'var(--neutral-700)',
                        marginBottom: 'var(--space-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                      }}>
                        <i className="fas fa-database" style={{ color: 'var(--accent-blue)' }}></i>
                        Found in your database:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        {author.potential_matches.map(match => (
                          <div
                            key={match.id}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              background: decision?.person_id === match.id ? 'color-mix(in srgb, var(--accent-blue) 15%, white)' : 'white',
                              border: decision?.person_id === match.id ? '2px solid var(--accent-blue)' : '1px solid var(--neutral-200)',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)' }}>{match.name}</span>
                              {match.orcid && (
                                <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--accent-green)' }}>
                                  <i className="fab fa-orcid"></i> {match.orcid}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                updateDecision(idx, {
                                  action: 'link',
                                  person_id: match.id,
                                  person_name: match.name
                                });
                                setExpandedAuthor(null);
                              }}
                              className="btn-source"
                              style={{
                                padding: '4px 10px',
                                fontSize: 'var(--text-xs)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 'var(--space-1)',
                              }}
                            >
                              <i className="fas fa-link"></i> Link
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Create new person section - moved up */}
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 500,
                      color: 'var(--neutral-700)',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                    }}>
                      <i className="fas fa-user-plus" style={{ color: 'var(--accent-blue)' }}></i>
                      {hasMatches ? 'Or create new person:' : 'Create new person:'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
                      <div>
                        <label style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--neutral-500)',
                          marginBottom: '2px',
                          display: 'block',
                        }}>
                          First Name
                        </label>
                        <input
                          type="text"
                          value={decision?.action === 'create' ? (decision.first_name || '') : (author.given || '')}
                          onChange={(e) => updateDecision(idx, {
                            action: 'create',
                            first_name: e.target.value,
                            last_name: decision?.last_name || author.family || '',
                            orcid: decision?.orcid || author.orcid || ''
                          })}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            border: '1px solid var(--neutral-300)',
                            borderRadius: '4px',
                            fontSize: 'var(--text-sm)',
                            fontFamily: 'var(--font-body)',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--neutral-500)',
                          marginBottom: '2px',
                          display: 'block',
                        }}>
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={decision?.action === 'create' ? (decision.last_name || '') : (author.family || '')}
                          onChange={(e) => updateDecision(idx, {
                            action: 'create',
                            first_name: decision?.first_name || author.given || '',
                            last_name: e.target.value,
                            orcid: decision?.orcid || author.orcid || ''
                          })}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            border: '1px solid var(--neutral-300)',
                            borderRadius: '4px',
                            fontSize: 'var(--text-sm)',
                            fontFamily: 'var(--font-body)',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--neutral-500)',
                          marginBottom: '2px',
                          display: 'block',
                        }}>
                          ORCID
                        </label>
                        <input
                          type="text"
                          value={decision?.action === 'create' ? (decision.orcid || '') : (author.orcid || '')}
                          onChange={(e) => updateDecision(idx, {
                            action: 'create',
                            first_name: decision?.first_name || author.given || '',
                            last_name: decision?.last_name || author.family || '',
                            orcid: e.target.value
                          })}
                          placeholder="0000-0000-0000-0000"
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            border: (decision?.orcid || author.orcid) ? '1px solid var(--accent-green)' : '1px solid var(--neutral-300)',
                            background: (decision?.orcid || author.orcid) ? 'var(--accent-green-light)' : 'white',
                            borderRadius: '4px',
                            fontSize: 'var(--text-sm)',
                            fontFamily: 'var(--font-body)',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ORCID Registry suggestions */}
                  {!author.auto_linked && (
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 500,
                        color: 'var(--accent-green)',
                        marginBottom: 'var(--space-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                      }}>
                        <i className="fab fa-orcid"></i>
                        Find ORCID:
                        {!orcidSuggestions[idx] && !loadingOrcid[idx] && (
                          <button
                            onClick={() => searchOrcidRegistry(idx, author)}
                            className="btn-source"
                            style={{
                              marginLeft: 'var(--space-2)',
                              padding: '2px 8px',
                              fontSize: 'var(--text-xs)',
                            }}
                          >
                            Search Registry
                          </button>
                        )}
                      </div>

                      {loadingOrcid[idx] && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-500)' }}>
                          <i className="fas fa-spinner fa-spin"></i> Searching ORCID registry...
                        </div>
                      )}

                      {suggestions.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                          {suggestions.slice(0, 5).map((suggestion, suggIdx) => (
                            <div
                              key={suggIdx}
                              style={{
                                padding: 'var(--space-2) var(--space-3)',
                                background: suggestion.doi_verified ? 'var(--accent-green-light)' : 'white',
                                border: suggestion.doi_verified ? '2px solid var(--accent-green)' : '1px dashed var(--accent-green)',
                                borderRadius: '4px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                <div>
                                  <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)' }}>
                                    {suggestion.full_name}
                                  </span>
                                  {suggestion.doi_verified && (
                                    <span style={{
                                      marginLeft: 'var(--space-2)',
                                      fontSize: '10px',
                                      background: 'var(--accent-blue)',
                                      color: 'white',
                                      padding: '1px 6px',
                                      borderRadius: '3px',
                                    }}>
                                      <i className="fas fa-check-circle"></i> Has this article
                                    </span>
                                  )}
                                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-green)' }}>
                                    {suggestion.orcid}
                                  </div>
                                  {suggestion.affiliations && suggestion.affiliations.length > 0 && (
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-500)', marginTop: '2px' }}>
                                      <i className="fas fa-building" style={{ marginRight: '4px' }}></i>
                                      {suggestion.affiliations[0]}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => useOrcidSuggestion(idx, suggestion, author)}
                                  className="btn-source"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 'var(--text-xs)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-1)',
                                  }}
                                >
                                  <i className="fas fa-arrow-up"></i> Use
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {orcidSuggestions[idx] && suggestions.length === 0 && !loadingOrcid[idx] && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-500)', fontStyle: 'italic' }}>
                          No matches found in ORCID registry
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons at bottom */}
                  <div style={{
                    borderTop: '1px solid var(--neutral-200)',
                    paddingTop: 'var(--space-3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <button
                      onClick={() => {
                        updateDecision(idx, { action: 'skip' });
                        setExpandedAuthor(null);
                      }}
                      className="btn-outline-source"
                      style={{
                        padding: '8px 16px',
                        fontSize: 'var(--text-sm)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <i className="fas fa-ban"></i>
                      Skip Author
                    </button>
                    <button
                      onClick={() => {
                        const firstName = decision?.first_name || author.given || '';
                        const lastName = decision?.last_name || author.family || '';
                        if (firstName && lastName) {
                          updateDecision(idx, {
                            action: 'create',
                            first_name: firstName,
                            last_name: lastName,
                            orcid: decision?.orcid || author.orcid || ''
                          });
                          setExpandedAuthor(null);
                        }
                      }}
                      className="btn-source"
                      style={{
                        padding: '8px 16px',
                        fontSize: 'var(--text-sm)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <i className="fas fa-user-plus"></i>
                      Create New Person
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
