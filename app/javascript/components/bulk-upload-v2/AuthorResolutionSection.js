import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useBulkUpload } from './BulkUploadContext';

export default function AuthorResolutionSection({ item, onResolutionChange, onCreatePerson }) {
  const { state } = useBulkUpload();
  const [expandedAuthorIdx, setExpandedAuthorIdx] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [orcidResults, setOrcidResults] = useState([]);
  const [searchingOrcid, setSearchingOrcid] = useState(false);
  const [orcidSearched, setOrcidSearched] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: '', lastName: '', orcid: '' });
  const [previousForm, setPreviousForm] = useState(null); // For undo functionality

  const authors = item.detected_authors || [];

  // Per-request tokens so a late-returning fetch from a previous expansion
  // can't clobber results for the currently-expanded author.
  const latestDbSearchRef = useRef(null);
  const latestOrcidSearchRef = useRef(null);

  const handleSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    const token = {};
    latestDbSearchRef.current = token;

    setSearching(true);
    try {
      const response = await fetch(`/people/search?q=${encodeURIComponent(query)}`);
      if (latestDbSearchRef.current !== token) return;
      if (response.ok) {
        const data = await response.json();
        if (latestDbSearchRef.current !== token) return;
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      if (latestDbSearchRef.current === token) setSearching(false);
    }
  }, []);

  const handleOrcidSearch = useCallback(async (author) => {
    const familyName = author.family || '';
    const givenName = author.given || '';
    if (!familyName) return;

    const token = {};
    latestOrcidSearchRef.current = token;

    setSearchingOrcid(true);
    setOrcidSearched(false);
    setOrcidResults([]);
    try {
      const params = new URLSearchParams({
        family_name: familyName,
        given_name: givenName
      });
      const response = await fetch(`/people/search_orcid?${params}`);
      if (latestOrcidSearchRef.current !== token) return;
      if (response.ok) {
        const data = await response.json();
        if (latestOrcidSearchRef.current !== token) return;
        setOrcidResults(data || []);
      }
    } catch (err) {
      console.error('ORCID search error:', err);
    } finally {
      if (latestOrcidSearchRef.current === token) {
        setSearchingOrcid(false);
        setOrcidSearched(true);
      }
    }
  }, []);

  const handleExpandAuthor = useCallback((idx, author) => {
    if (expandedAuthorIdx === idx) {
      setExpandedAuthorIdx(null);
      setSearchResults([]);
      setOrcidResults([]);
      setOrcidSearched(false);
      setCreateForm({ firstName: '', lastName: '', orcid: '' });
      setPreviousForm(null);
    } else {
      setExpandedAuthorIdx(idx);
      setSearchResults([]);
      setOrcidResults([]);
      setOrcidSearched(false);
      setPreviousForm(null);
      // Pre-fill create form with author data
      setCreateForm({
        firstName: author.given || '',
        lastName: author.family || '',
        orcid: author.orcid || ''
      });
      // Search database for existing matches
      handleSearch(`${author.family || ''} ${author.given || ''}`.trim());
      // Auto-fire ORCID registry search so results are ready without a click
      handleOrcidSearch(author);
    }
  }, [expandedAuthorIdx, handleSearch, handleOrcidSearch]);

  const handleLinkToDbPerson = useCallback((authorIdx, person) => {
    onResolutionChange(authorIdx, {
      action: 'link',
      personId: person.id,
      personName: person.full_name
    });
    setExpandedAuthorIdx(null);
  }, [onResolutionChange]);

  const handleLinkToSessionPerson = useCallback((authorIdx, pendingPerson) => {
    onResolutionChange(authorIdx, {
      action: 'link',
      tempPersonId: pendingPerson.tempId,
      personName: `${pendingPerson.firstName} ${pendingPerson.lastName}`
    });
    setExpandedAuthorIdx(null);
  }, [onResolutionChange]);

  const handleCreateNew = useCallback((authorIdx, author) => {
    if (!createForm.lastName) return;

    onCreatePerson(authorIdx, {
      firstName: createForm.firstName,
      lastName: createForm.lastName,
      orcid: createForm.orcid || null,
      createdFromAuthor: author
    });
    setExpandedAuthorIdx(null);
    setCreateForm({ firstName: '', lastName: '', orcid: '' });
  }, [createForm, onCreatePerson]);

  const handleSkip = useCallback((authorIdx) => {
    onResolutionChange(authorIdx, { action: 'skip' });
    setExpandedAuthorIdx(null);
  }, [onResolutionChange]);

  // Accept best-guess for a single author (thumbs-up from the row).
  // Prefers DB match → session match → create-from-extracted.
  const handleAcceptAuthor = useCallback((authorIdx, author) => {
    if (author.potential_matches?.length > 0) {
      const bestMatch = author.potential_matches[0];
      onResolutionChange(authorIdx, {
        action: 'link',
        personId: bestMatch.id,
        personName: bestMatch.name
      });
      return;
    }

    const sessionMatch = (author.sessionMatches || []).find(pending => {
      const pendingFirst = (pending.firstName || '').toLowerCase().trim();
      const pendingLast = (pending.lastName || '').toLowerCase().trim();
      const authorFirst = (author.given || '').toLowerCase().trim();
      const authorLast = (author.family || '').toLowerCase().trim();
      return pendingFirst === authorFirst && pendingLast === authorLast;
    });
    if (sessionMatch) {
      onResolutionChange(authorIdx, {
        action: 'link',
        tempPersonId: sessionMatch.tempId,
        personName: `${sessionMatch.firstName} ${sessionMatch.lastName}`
      });
      return;
    }

    onCreatePerson(authorIdx, {
      firstName: author.given || '',
      lastName: author.family || '',
      orcid: author.orcid || null,
      createdFromAuthor: author
    });
  }, [onResolutionChange, onCreatePerson]);

  const handleClearResolution = useCallback((authorIdx) => {
    onResolutionChange(authorIdx, null);
  }, [onResolutionChange]);

  // Unlink an auto-linked author — mirror the concept pattern
  const handleUnlinkAuthor = useCallback((authorIdx) => {
    onResolutionChange(authorIdx, { action: 'pending' });
  }, [onResolutionChange]);

  const handleUseOrcid = useCallback((authorIdx, orcidPerson) => {
    // Save current form for undo
    setPreviousForm({ ...createForm });
    // Pre-fill create form with ORCID data
    setCreateForm({
      firstName: orcidPerson.given_name || orcidPerson.given_names || orcidPerson.given || '',
      lastName: orcidPerson.family_name || orcidPerson.family || '',
      orcid: orcidPerson.orcid
    });
  }, [createForm]);

  const handleUndoOrcid = useCallback(() => {
    if (previousForm) {
      setCreateForm(previousForm);
      setPreviousForm(null);
    }
  }, [previousForm]);

  // Count authors with potential matches
  const authorsWithMatches = authors.filter(a =>
    !a.auto_linked && !a.resolution && (a.potential_matches?.length > 0 || a.sessionMatches?.length > 0)
  ).length;

  // Count unresolved authors
  const unresolvedAuthors = authors.filter(a => !a.auto_linked && !a.resolution);

  // Auto-resolve all: link to potential matches if available, otherwise create
  const handleAutoResolveAll = useCallback(() => {
    authors.forEach((author, idx) => {
      // Skip if already resolved or auto-linked
      if (author.auto_linked || author.resolution) return;

      // If there are potential matches from the database, link to the first one
      if (author.potential_matches?.length > 0) {
        const bestMatch = author.potential_matches[0];
        onResolutionChange(idx, {
          action: 'link',
          personId: bestMatch.id,
          personName: bestMatch.name
        });
        return;
      }

      // Check for session match
      const sessionMatch = author.sessionMatches?.find(pending => {
        const pendingFirst = (pending.firstName || '').toLowerCase().trim();
        const pendingLast = (pending.lastName || '').toLowerCase().trim();
        const authorFirst = (author.given || '').toLowerCase().trim();
        const authorLast = (author.family || '').toLowerCase().trim();
        return pendingFirst === authorFirst && pendingLast === authorLast;
      });

      if (sessionMatch) {
        // Link to session person
        onResolutionChange(idx, {
          action: 'link',
          tempPersonId: sessionMatch.tempId,
          personName: `${sessionMatch.firstName} ${sessionMatch.lastName}`
        });
      } else {
        // No matches - create new person
        onCreatePerson(idx, {
          firstName: author.given || '',
          lastName: author.family || '',
          orcid: author.orcid || null,
          createdFromAuthor: author
        });
      }
    });
  }, [authors, onResolutionChange, onCreatePerson]);

  // Pre-filter on item load: auto-create authors with zero possible matches,
  // then auto-expand the first author that still needs user judgment.
  const prefilteredItemIdRef = useRef(null);
  useEffect(() => {
    if (prefilteredItemIdRef.current === item.id) return;
    prefilteredItemIdRef.current = item.id;

    if (!authors || authors.length === 0) return;

    let firstAmbiguousIdx = null;
    authors.forEach((author, idx) => {
      if (author.auto_linked || author.resolution) return;

      const hasDbMatches = author.potential_matches?.length > 0;
      const hasSessionMatches = author.sessionMatches?.length > 0;

      if (!hasDbMatches && !hasSessionMatches) {
        onCreatePerson(idx, {
          firstName: author.given || '',
          lastName: author.family || '',
          orcid: author.orcid || null,
          createdFromAuthor: author
        });
        return;
      }

      if (firstAmbiguousIdx === null) {
        firstAmbiguousIdx = idx;
      }
    });

    if (firstAmbiguousIdx !== null) {
      const author = authors[firstAmbiguousIdx];
      setExpandedAuthorIdx(firstAmbiguousIdx);
      setSearchResults([]);
      setOrcidResults([]);
      setOrcidSearched(false);
      setPreviousForm(null);
      setCreateForm({
        firstName: author.given || '',
        lastName: author.family || '',
        orcid: author.orcid || ''
      });
      handleSearch(`${author.family || ''} ${author.given || ''}`.trim());
      handleOrcidSearch(author);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Yellow button styles
  const btnYellow = {
    padding: '4px 12px',
    fontSize: 'var(--text-xs)',
    background: 'var(--accent-gold)',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: 'var(--font-body)',
  };

  const btnYellowOutline = {
    padding: '4px 12px',
    fontSize: 'var(--text-xs)',
    background: 'white',
    border: '1px solid var(--accent-gold)',
    borderRadius: '4px',
    color: 'var(--accent-gold)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: 'var(--font-body)',
  };

  return (
    <div style={{ marginBottom: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-2)',
          paddingBottom: 'var(--space-2)',
          borderBottom: '2px solid var(--accent-gold)',
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
            <i className="fas fa-users" style={{ color: 'var(--accent-gold)' }}></i>
            Authors ({authors.length})
          </h3>
          {unresolvedAuthors.length > 0 && (
            <button
              onClick={handleAutoResolveAll}
              style={{
                padding: '4px 10px',
                fontSize: 'var(--text-xs)',
                background: 'var(--accent-gold-light)',
                border: '1px solid var(--accent-gold)',
                borderRadius: '4px',
                color: 'var(--accent-gold)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: 'var(--font-body)',
              }}
            >
              <i className="fas fa-magic"></i>
              Auto-resolve all
            </button>
          )}
        </div>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          color: 'var(--neutral-500)',
          margin: 0,
          lineHeight: 1.4,
        }}>
          The raw author string is saved automatically. To track sources by author in your database,
          link or create people below.
        </p>
        {authorsWithMatches > 0 && (
          <div style={{
            marginTop: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--accent-gold-light)',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            <i className="fas fa-lightbulb" style={{ color: 'var(--accent-gold)', fontSize: 'var(--text-xs)' }}></i>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              color: 'var(--neutral-700)',
            }}>
              <strong>{authorsWithMatches}</strong> potential {authorsWithMatches === 1 ? 'match' : 'matches'} from your database detected
            </span>
          </div>
        )}
      </div>

      <div style={{
        border: '1px solid var(--neutral-200)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        {authors.map((author, idx) => {
          const isExpanded = expandedAuthorIdx === idx;
          const resolution = author.resolution;
          const isResolved = resolution || author.auto_linked;
          const sessionMatches = author.sessionMatches || [];

          return (
            <div
              key={idx}
              style={{
                borderBottom: idx < authors.length - 1 ? '1px solid var(--neutral-100)' : 'none',
              }}
            >
              {/* Author row */}
              <div style={{
                padding: 'var(--space-3) var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                background: isExpanded ? 'var(--accent-gold-light)' : 'white',
              }}>
                {/* Status indicator */}
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isResolved
                    ? 'var(--accent-gold-light)'
                    : sessionMatches.length > 0
                      ? 'var(--accent-gold-light)'
                      : 'var(--neutral-100)',
                }}>
                  {isResolved ? (
                    <i className="fas fa-check" style={{ fontSize: '10px', color: 'var(--accent-gold)' }}></i>
                  ) : sessionMatches.length > 0 ? (
                    <i className="fas fa-bolt" style={{ fontSize: '10px', color: 'var(--accent-gold)' }}></i>
                  ) : (
                    <i className="fas fa-question" style={{ fontSize: '10px', color: 'var(--neutral-400)' }}></i>
                  )}
                </div>

                {/* Author name */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--neutral-800)',
                  }}>
                    {author.given ? `${author.given} ` : ''}{author.family || 'Unknown'}
                  </div>

                  {/* Potential matches indicator (before resolution) */}
                  {!isResolved && !author.auto_linked && (author.potential_matches?.length > 0) && (
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--accent-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '2px',
                    }}>
                      <i className="fas fa-user-check"></i>
                      {author.potential_matches.length} potential {author.potential_matches.length === 1 ? 'match' : 'matches'} in database
                    </div>
                  )}

                  {/* Resolution status */}
                  {resolution && (
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      color: resolution.action === 'skip' ? 'var(--neutral-500)' : 'var(--accent-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      {resolution.action === 'link' && (
                        <>
                          <i className="fas fa-link"></i>
                          Linked to {resolution.personName}
                        </>
                      )}
                      {resolution.action === 'create' && (
                        <>
                          <i className="fas fa-plus-circle"></i>
                          Will create: {resolution.firstName} {resolution.lastName}
                        </>
                      )}
                      {resolution.action === 'skip' && (
                        <>
                          <i className="fas fa-ban"></i>
                          Skipped
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolutionChange(idx, null);
                        }}
                        style={{
                          marginLeft: '6px',
                          padding: '2px 6px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--neutral-400)',
                          cursor: 'pointer',
                          fontSize: 'var(--text-xs)',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                        title="Clear resolution"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}

                  {/* Auto-linked status */}
                  {author.auto_linked && !resolution && (
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--accent-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <i className="fas fa-magic"></i>
                      Auto-linked to {author.linked_person_name}
                    </div>
                  )}

                  {/* Session match hint */}
                  {!isResolved && sessionMatches.length > 0 && (
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--accent-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <i className="fas fa-bolt"></i>
                      {sessionMatches.length} session match{sessionMatches.length > 1 ? 'es' : ''} available
                    </div>
                  )}
                </div>

                {/* ORCID badge */}
                {author.orcid && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--accent-gold-light)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--accent-gold)',
                  }}>
                    ORCID
                  </span>
                )}

                {/* Action buttons — match the concepts pattern */}
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  {author.auto_linked && !resolution ? (
                    /* Unlink button for auto-linked authors */
                    <button
                      onClick={() => handleUnlinkAuthor(idx)}
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
                      title="Unlink this author"
                    >
                      <i className="fas fa-unlink"></i>
                      Unlink
                    </button>
                  ) : (
                    <>
                      {(() => {
                        const isAccepted = resolution && resolution.action !== 'skip' && resolution.action !== 'pending';
                        const isRejected = resolution?.action === 'skip';
                        return (
                          <>
                            {/* Thumbs up */}
                            <button
                              onClick={() => isAccepted ? handleClearResolution(idx) : handleAcceptAuthor(idx, author)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '4px',
                                border: isAccepted
                                  ? 'none'
                                  : isRejected
                                    ? '1px solid var(--neutral-300)'
                                    : '1px solid var(--accent-gold)',
                                background: isAccepted
                                  ? 'var(--accent-gold)'
                                  : 'white',
                                color: isAccepted
                                  ? 'white'
                                  : isRejected
                                    ? 'var(--neutral-400)'
                                    : 'var(--accent-gold)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                transition: 'all 0.15s ease',
                              }}
                              title={isAccepted ? 'Undo accept' : 'Accept best match (or create)'}
                            >
                              <i className="fas fa-thumbs-up"></i>
                            </button>

                            {/* Thumbs down */}
                            <button
                              onClick={() => isRejected ? handleClearResolution(idx) : handleSkip(idx)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '4px',
                                border: isRejected
                                  ? 'none'
                                  : isAccepted
                                    ? '1px solid var(--neutral-300)'
                                    : '1px solid var(--accent-gold)',
                                background: isRejected
                                  ? 'var(--neutral-500)'
                                  : 'white',
                                color: isRejected
                                  ? 'white'
                                  : isAccepted
                                    ? 'var(--neutral-400)'
                                    : 'var(--accent-gold)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                transition: 'all 0.15s ease',
                              }}
                              title={isRejected ? 'Undo skip' : 'Skip this author'}
                            >
                              <i className="fas fa-thumbs-down"></i>
                            </button>

                            {/* Details chevron — opens the full resolution panel */}
                            <button
                              onClick={() => handleExpandAuthor(idx, author)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '4px',
                                border: '1px solid var(--neutral-300)',
                                background: isExpanded ? 'var(--neutral-100)' : 'white',
                                color: 'var(--neutral-500)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                transition: 'all 0.15s ease',
                              }}
                              title={isExpanded ? 'Close details' : 'More options (search DB, ORCID, custom)'}
                            >
                              <i className={isExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'}></i>
                            </button>
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>

              {/* Expanded resolution section */}
              {isExpanded && (
                <div style={{
                  padding: 'var(--space-4)',
                  background: 'var(--neutral-50)',
                  borderTop: '1px solid var(--neutral-200)',
                }}>
                  {/* Detected matches from backend (pre-computed) */}
                  {author.potential_matches?.length > 0 && (
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                      <div style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: 'var(--accent-gold)',
                        marginBottom: 'var(--space-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}>
                        <i className="fas fa-user-check"></i>
                        Detected Matches
                      </div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-2)',
                      }}>
                        {author.potential_matches.map(person => (
                          <div
                            key={person.id}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              background: 'var(--accent-gold-light)',
                              border: '2px solid var(--accent-gold)',
                              borderRadius: '6px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <span style={{
                                fontFamily: 'var(--font-body)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: 600,
                                color: 'var(--neutral-800)',
                              }}>
                                {person.name}
                              </span>
                              {person.orcid && (
                                <span style={{
                                  marginLeft: 'var(--space-2)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'var(--accent-gold)',
                                  fontFamily: 'var(--font-body)',
                                  fontSize: '10px',
                                  color: 'white',
                                }}>
                                  ORCID
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleLinkToDbPerson(idx, { id: person.id, full_name: person.name })}
                              style={btnYellow}
                            >
                              Link
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Session matches - highlighted! */}
                  {sessionMatches.length > 0 && (
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                      <div style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: 'var(--accent-gold)',
                        marginBottom: 'var(--space-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}>
                        <i className="fas fa-bolt"></i>
                        Created This Session
                      </div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-2)',
                      }}>
                        {sessionMatches.map(person => (
                          <div
                            key={person.tempId}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              background: 'var(--accent-gold-light)',
                              border: '2px solid var(--accent-gold)',
                              borderRadius: '6px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <span style={{
                                fontFamily: 'var(--font-body)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: 600,
                                color: 'var(--neutral-800)',
                              }}>
                                {person.firstName} {person.lastName}
                              </span>
                              <span style={{
                                marginLeft: 'var(--space-2)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'var(--accent-gold)',
                                fontFamily: 'var(--font-body)',
                                fontSize: '10px',
                                color: 'white',
                              }}>
                                Just Created
                              </span>
                            </div>
                            <button
                              onClick={() => handleLinkToSessionPerson(idx, person)}
                              style={btnYellow}
                            >
                              Link
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Database search */}
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      color: 'var(--neutral-600)',
                      marginBottom: 'var(--space-2)',
                    }}>
                      Search Your Database
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          handleSearch(e.target.value);
                        }}
                        placeholder="Search by name..."
                        style={{
                          flex: 1,
                          padding: 'var(--space-2)',
                          borderRadius: '6px',
                          border: '1px solid var(--neutral-200)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-sm)',
                        }}
                      />
                      {searching && <i className="fas fa-spinner fa-spin" style={{ alignSelf: 'center' }}></i>}
                    </div>

                    {searchResults.length > 0 && (
                      <div style={{
                        marginTop: 'var(--space-2)',
                        border: '1px solid var(--neutral-200)',
                        borderRadius: '6px',
                        maxHeight: '150px',
                        overflowY: 'auto',
                      }}>
                        {searchResults.map(person => (
                          <div
                            key={person.id}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              borderBottom: '1px solid var(--neutral-100)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: 'white',
                            }}
                          >
                            <span style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-sm)',
                              color: 'var(--neutral-700)',
                            }}>
                              {person.full_name}
                              {person.orcid && (
                                <span style={{ marginLeft: '8px', color: 'var(--accent-gold)', fontSize: '10px' }}>
                                  ORCID
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => handleLinkToDbPerson(idx, person)}
                              style={{ ...btnYellowOutline, padding: '2px 8px' }}
                            >
                              Link
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {searchQuery && searchResults.length === 0 && !searching && (
                      <p style={{
                        marginTop: 'var(--space-2)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                      }}>
                        No matches found in your database
                      </p>
                    )}
                  </div>

                  {/* Create new person */}
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--space-2)',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: 'var(--neutral-600)',
                      }}>
                        Create New Person
                      </span>
                      {previousForm && (
                        <button
                          onClick={handleUndoOrcid}
                          style={{
                            padding: '2px 8px',
                            fontSize: 'var(--text-xs)',
                            background: 'transparent',
                            border: '1px solid var(--neutral-300)',
                            borderRadius: '4px',
                            color: 'var(--neutral-600)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <i className="fas fa-undo"></i>
                          Undo ORCID
                        </button>
                      )}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 'var(--space-2)',
                    }}>
                      <input
                        type="text"
                        value={createForm.firstName}
                        onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                        placeholder="First name"
                        style={{
                          padding: 'var(--space-2)',
                          borderRadius: '6px',
                          border: '1px solid var(--neutral-200)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-sm)',
                        }}
                      />
                      <input
                        type="text"
                        value={createForm.lastName}
                        onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                        placeholder="Last name"
                        style={{
                          padding: 'var(--space-2)',
                          borderRadius: '6px',
                          border: '1px solid var(--neutral-200)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-sm)',
                        }}
                      />
                      <input
                        type="text"
                        value={createForm.orcid}
                        onChange={(e) => setCreateForm({ ...createForm, orcid: e.target.value })}
                        placeholder="ORCID (optional)"
                        style={{
                          padding: 'var(--space-2)',
                          borderRadius: '6px',
                          border: '1px solid var(--neutral-200)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-sm)',
                        }}
                      />
                    </div>
                  </div>

                  {/* ORCID search (auto-fires on expand) */}
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      color: 'var(--neutral-600)',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <i className="fab fa-orcid" style={{ color: 'var(--accent-gold)' }}></i>
                      ORCID Registry
                    </div>

                    {/* Loading state */}
                    {searchingOrcid && (
                      <div style={{
                        marginTop: 'var(--space-2)',
                        padding: 'var(--space-3)',
                        background: 'var(--neutral-100)',
                        borderRadius: '6px',
                        textAlign: 'center',
                      }}>
                        <i className="fas fa-spinner fa-spin" style={{ color: 'var(--accent-gold)', marginRight: '8px' }}></i>
                        <span style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--neutral-600)',
                        }}>
                          Searching ORCID registry...
                        </span>
                      </div>
                    )}

                    {/* Results */}
                    {!searchingOrcid && orcidResults.length > 0 && (
                      <div style={{
                        marginTop: 'var(--space-2)',
                        border: '1px solid var(--neutral-200)',
                        borderRadius: '6px',
                        maxHeight: '150px',
                        overflowY: 'auto',
                      }}>
                        {orcidResults.map((person, oidx) => (
                          <div
                            key={person.orcid || oidx}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              borderBottom: '1px solid var(--neutral-100)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: 'white',
                            }}
                          >
                            <div>
                              <span style={{
                                fontFamily: 'var(--font-body)',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--neutral-700)',
                              }}>
                                {person.given_name || person.given_names || person.given} {person.family_name || person.family}
                              </span>
                              <span style={{
                                marginLeft: '8px',
                                fontFamily: 'var(--font-body)',
                                fontSize: '10px',
                                color: 'var(--accent-gold)',
                              }}>
                                {person.orcid}
                              </span>
                            </div>
                            <button
                              onClick={() => handleUseOrcid(idx, person)}
                              style={{ ...btnYellowOutline, padding: '2px 8px' }}
                            >
                              Use
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No results */}
                    {!searchingOrcid && orcidSearched && orcidResults.length === 0 && (
                      <div style={{
                        marginTop: 'var(--space-2)',
                        padding: 'var(--space-3)',
                        background: 'color-mix(in srgb, var(--accent-orange) 10%, white)',
                        borderRadius: '6px',
                        border: '1px solid color-mix(in srgb, var(--accent-orange) 30%, white)',
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--neutral-600)',
                        }}>
                          <i className="fas fa-info-circle" style={{ color: 'var(--accent-orange)', marginRight: '8px' }}></i>
                          No results found in ORCID registry for "{author.family}, {author.given}"
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Create with the edited form data */}
                  <div style={{
                    paddingTop: 'var(--space-3)',
                    borderTop: '1px solid var(--neutral-200)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}>
                    <button
                      onClick={() => handleCreateNew(idx, author)}
                      disabled={!createForm.lastName}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-sm)',
                        background: 'var(--accent-gold)',
                        border: '1px solid var(--accent-gold)',
                        borderRadius: '6px',
                        color: 'white',
                        cursor: createForm.lastName ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: 'var(--font-body)',
                        opacity: createForm.lastName ? 1 : 0.5,
                      }}
                      title="Create with the details you've entered above"
                    >
                      <i className="fas fa-plus-circle"></i>
                      Create with these details
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
