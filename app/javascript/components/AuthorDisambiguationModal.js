import React, { useState, useEffect } from 'react';
import Modal from './Modal';

// Capitalize first letter of each word in a name
const capitalizeName = (name) => {
  if (!name) return '';
  return name
    .split(/\s+/)
    .map(word => {
      if (word.length === 0) return word;
      // Handle hyphenated names like "Mary-Jane"
      if (word.includes('-')) {
        return word.split('-').map(part =>
          part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        ).join('-');
      }
      // Handle names with apostrophes like "O'Connor"
      if (word.includes("'")) {
        const parts = word.split("'");
        return parts.map((part, i) =>
          i === 0 ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                  : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        ).join("'");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

export default function AuthorDisambiguationModal({ isOpen, onClose, authors, authorsData, doi, onConfirm }) {
  // Parse author name from string format "Last, F. M." - fallback when no structured data
  const parseAuthorName = (authorString) => {
    const parts = authorString.split(',').map(s => s.trim());
    const lastName = parts[0] || '';
    const initials = parts[1] || '';

    const initialParts = initials.split(/\s+/).filter(i => i.length > 0);
    const firstName = initialParts[0]?.replace('.', '') || '';
    const middleName = initialParts.slice(1).join(' ').replace(/\./g, '') || '';

    return { firstName, middleName, lastName };
  };

  const [authorData, setAuthorData] = useState([]);

  // Initialize author data when modal opens
  useEffect(() => {
    if (isOpen && authors.length > 0) {
      const initialData = authors.map((authorString, idx) => {
        // Use structured data if available, otherwise parse from string
        const structured = authorsData?.[idx];

        let firstName, middleName, lastName, orcid, affiliation, sequence;

        if (structured) {
          // Rich data from CrossRef
          const givenParts = (structured.given || '').split(/\s+/);
          firstName = capitalizeName(givenParts[0] || '');
          middleName = capitalizeName(givenParts.slice(1).join(' ') || '');
          lastName = capitalizeName(structured.family || '');
          orcid = structured.orcid || '';
          affiliation = structured.affiliation || '';
          sequence = structured.sequence || (idx === 0 ? 'first' : 'additional');
        } else {
          // Parse from display string
          const parsed = parseAuthorName(authorString);
          firstName = capitalizeName(parsed.firstName);
          middleName = capitalizeName(parsed.middleName);
          lastName = capitalizeName(parsed.lastName);
          orcid = '';
          affiliation = '';
          sequence = idx === 0 ? 'first' : 'additional';
        }

        return {
          originalName: authorString,
          action: 'create',
          linkedPersonId: null,
          firstName,
          middleName,
          lastName,
          orcid,
          affiliation,
          sequence,
          potentialMatches: [],
          orcidMatch: null,
          orcidSuggestions: [],
          loadingMatches: true,
          loadingOrcidSuggestions: false
        };
      });
      setAuthorData(initialData);

      // Search for matches for each author
      initialData.forEach((author, index) => {
        searchForMatches(index, author.lastName, author.firstName, author.orcid);
      });
    }
  }, [isOpen, authors, authorsData]);

  const searchForMatches = async (index, lastName, firstName, orcid) => {
    try {
      let orcidMatch = null;
      let nameMatches = [];

      // First, try ORCID match in local database (highest confidence)
      if (orcid) {
        const orcidResponse = await fetch(`/people/search?orcid=${encodeURIComponent(orcid)}`);
        const orcidResults = await orcidResponse.json();
        if (orcidResults.length > 0) {
          orcidMatch = orcidResults[0];
        }
      }

      // Then search local database by name
      if (lastName && lastName.trim().length >= 2) {
        const nameResponse = await fetch(`/people/search?q=${encodeURIComponent(lastName)}`);
        nameMatches = await nameResponse.json();
        // Filter out the ORCID match from name results to avoid duplicates
        if (orcidMatch) {
          nameMatches = nameMatches.filter(p => p.id !== orcidMatch.id);
        }
      }

      setAuthorData(prev => {
        const newData = [...prev];
        if (newData[index]) {
          newData[index].orcidMatch = orcidMatch;
          newData[index].potentialMatches = nameMatches;
          newData[index].loadingMatches = false;

          // Auto-link if we have an ORCID match in our database
          if (orcidMatch) {
            newData[index].action = 'link';
            newData[index].linkedPersonId = orcidMatch.id;
          }
        }
        return newData;
      });

      // Search ORCID registry for suggestions if:
      // 1. No ORCID match in local DB, OR
      // 2. We have local name matches without ORCIDs (merge opportunity)
      const hasLocalMatchesWithoutOrcid = nameMatches.some(p => !p.orcid);
      if ((!orcidMatch && lastName && lastName.trim().length >= 2) || hasLocalMatchesWithoutOrcid) {
        searchOrcidRegistry(index, lastName, firstName, doi);
      }
    } catch (error) {
      console.error('Error searching people:', error);
      setAuthorData(prev => {
        const newData = [...prev];
        if (newData[index]) {
          newData[index].potentialMatches = [];
          newData[index].orcidMatch = null;
          newData[index].loadingMatches = false;
        }
        return newData;
      });
    }
  };

  const searchOrcidRegistry = async (index, lastName, firstName, articleDoi) => {
    setAuthorData(prev => {
      const newData = [...prev];
      if (newData[index]) {
        newData[index].loadingOrcidSuggestions = true;
      }
      return newData;
    });

    try {
      const params = new URLSearchParams({ family_name: lastName });
      if (firstName) {
        params.append('given_name', firstName);
      }
      if (articleDoi) {
        params.append('doi', articleDoi);
      }

      const response = await fetch(`/people/search_orcid?${params}`);
      const suggestions = await response.json();

      setAuthorData(prev => {
        const newData = [...prev];
        if (newData[index]) {
          newData[index].orcidSuggestions = suggestions;
          newData[index].loadingOrcidSuggestions = false;
        }
        return newData;
      });
    } catch (error) {
      console.error('Error searching ORCID registry:', error);
      setAuthorData(prev => {
        const newData = [...prev];
        if (newData[index]) {
          newData[index].orcidSuggestions = [];
          newData[index].loadingOrcidSuggestions = false;
        }
        return newData;
      });
    }
  };

  const handleLinkToPerson = (index, person) => {
    setAuthorData(prev => {
      const newData = [...prev];
      newData[index].action = 'link';
      newData[index].linkedPersonId = person.id;
      newData[index].mergeOrcid = null; // Clear any pending merge
      return newData;
    });
  };

  // Link to existing person AND add ORCID from registry suggestion
  const handleLinkAndMergeOrcid = (index, person, orcidSuggestion) => {
    setAuthorData(prev => {
      const newData = [...prev];
      newData[index].action = 'link_and_update';
      newData[index].linkedPersonId = person.id;
      newData[index].mergeOrcid = orcidSuggestion.orcid;
      // Also update form fields with ORCID data for reference
      if (orcidSuggestion.affiliations && orcidSuggestion.affiliations.length > 0) {
        newData[index].affiliation = orcidSuggestion.affiliations[0];
      }
      return newData;
    });
  };

  const handleUnlink = (index) => {
    setAuthorData(prev => {
      const newData = [...prev];
      newData[index].action = 'create';
      newData[index].linkedPersonId = null;
      newData[index].mergeOrcid = null;
      return newData;
    });
  };

  const handleFieldChange = (index, field, value) => {
    setAuthorData(prev => {
      const newData = [...prev];
      newData[index][field] = value;
      return newData;
    });
  };

  // Auto-capitalize name fields on blur
  const handleNameBlur = (index, field) => {
    setAuthorData(prev => {
      const newData = [...prev];
      if (newData[index] && newData[index][field]) {
        newData[index][field] = capitalizeName(newData[index][field]);
      }
      return newData;
    });
  };

  // Fill form fields from an ORCID suggestion
  const handleUseOrcidSuggestion = (index, suggestion) => {
    setAuthorData(prev => {
      const newData = [...prev];
      if (newData[index]) {
        // Split full given name into first and middle, capitalize
        const givenParts = (suggestion.given_name || '').split(/\s+/);
        newData[index].firstName = capitalizeName(givenParts[0] || '');
        newData[index].middleName = capitalizeName(givenParts.slice(1).join(' ') || '');
        newData[index].lastName = capitalizeName(suggestion.family_name || '');
        newData[index].orcid = suggestion.orcid || '';
        if (suggestion.affiliations && suggestion.affiliations.length > 0) {
          newData[index].affiliation = suggestion.affiliations[0];
        }
      }
      return newData;
    });
  };

  const handleConfirm = () => {
    const processedAuthors = authorData.map(author => ({
      action: author.action,
      linkedPersonId: author.linkedPersonId,
      firstName: author.firstName,
      middleName: author.middleName,
      lastName: author.lastName,
      orcid: author.orcid,
      mergeOrcid: author.mergeOrcid, // ORCID to add to existing person
      originalName: author.originalName
    }));

    onConfirm(processedAuthors);
  };

  const getLinkedPerson = (authorItem) => {
    if ((authorItem.action === 'link' || authorItem.action === 'link_and_update') && authorItem.linkedPersonId) {
      // Check orcidMatch first, then potentialMatches
      if (authorItem.orcidMatch?.id === authorItem.linkedPersonId) {
        return authorItem.orcidMatch;
      }
      return authorItem.potentialMatches.find(p => p.id === authorItem.linkedPersonId);
    }
    return null;
  };

  const getSequenceLabel = (sequence) => {
    if (sequence === 'first') return '1st Author';
    return 'Co-Author';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review Authors" size="large">
      <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: 'var(--space-4)' }}>
        <p style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--neutral-600)',
          marginBottom: 'var(--space-4)',
          fontFamily: 'var(--font-body)'
        }}>
          We detected {authors.length} author{authors.length !== 1 ? 's' : ''}.
          Link to existing people in your database or review details before creating new records.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {authorData.map((author, index) => {
            const linkedPerson = getLinkedPerson(author);
            const hasPotentialMatches = author.potentialMatches && author.potentialMatches.length > 0;
            const hasOrcidMatch = author.orcidMatch !== null;
            const hasOrcidSuggestions = author.orcidSuggestions && author.orcidSuggestions.length > 0;
            const isOrcidLinked = linkedPerson && author.orcidMatch?.id === linkedPerson.id;

            return (
              <div key={index} style={{
                border: '1px solid var(--neutral-300)',
                borderRadius: '4px',
                padding: 'var(--space-4)',
                background: 'white'
              }}>
                {/* Header with author position */}
                <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--neutral-500)',
                      marginBottom: 'var(--space-1)',
                      fontFamily: 'var(--font-body)'
                    }}>
                      From citation:
                    </div>
                    <div style={{
                      fontWeight: 500,
                      color: 'var(--neutral-900)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)'
                    }}>
                      {author.originalName}
                    </div>
                    {author.affiliation && (
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                        marginTop: 'var(--space-1)',
                        fontFamily: 'var(--font-body)'
                      }}>
                        <i className="fas fa-building" style={{ marginRight: 'var(--space-1)', opacity: 0.7 }}></i>
                        {author.affiliation}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    padding: 'var(--space-1) var(--space-2)',
                    background: author.sequence === 'first' ? 'var(--accent-gold-light)' : 'var(--neutral-100)',
                    color: author.sequence === 'first' ? 'var(--accent-gold)' : 'var(--neutral-600)',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500
                  }}>
                    {getSequenceLabel(author.sequence)}
                  </span>
                </div>

                {(author.action === 'link' || author.action === 'link_and_update') && linkedPerson ? (
                  /* Linked State */
                  <div style={{
                    background: isOrcidLinked || author.mergeOrcid ? 'var(--accent-green-light)' : 'var(--accent-gold-light)',
                    border: `1px solid ${isOrcidLinked || author.mergeOrcid ? 'var(--accent-green)' : 'var(--accent-gold)'}`,
                    borderRadius: '4px',
                    padding: 'var(--space-3)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 500,
                          color: isOrcidLinked || author.mergeOrcid ? 'var(--accent-green)' : 'var(--accent-gold)',
                          fontFamily: 'var(--font-body)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          flexWrap: 'wrap'
                        }}>
                          ✓ {isOrcidLinked ? 'ORCID Match' : author.mergeOrcid ? 'Linked + Adding ORCID' : 'Linked to existing person'}
                          {(isOrcidLinked || author.mergeOrcid) && (
                            <span style={{
                              fontSize: 'var(--text-xs)',
                              background: 'var(--accent-green)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>
                              ORCID
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: 'var(--text-sm)',
                          marginTop: 'var(--space-1)',
                          fontFamily: 'var(--font-body)',
                          color: 'var(--neutral-900)'
                        }}>
                          {linkedPerson.full_name}
                        </div>
                        {linkedPerson.role && (
                          <div style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--neutral-600)',
                            fontFamily: 'var(--font-body)'
                          }}>
                            {linkedPerson.role}
                          </div>
                        )}
                        {linkedPerson.orcid && (
                          <div style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--accent-green)',
                            fontFamily: 'var(--font-body)',
                            marginTop: 'var(--space-1)'
                          }}>
                            <i className="fab fa-orcid" style={{ marginRight: 'var(--space-1)' }}></i>
                            {linkedPerson.orcid}
                          </div>
                        )}
                        {author.mergeOrcid && !linkedPerson.orcid && (
                          <div style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--accent-green)',
                            fontFamily: 'var(--font-body)',
                            marginTop: 'var(--space-1)'
                          }}>
                            <i className="fab fa-orcid" style={{ marginRight: 'var(--space-1)' }}></i>
                            Will add: {author.mergeOrcid}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlink(index)}
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: isOrcidLinked || author.mergeOrcid ? 'var(--accent-green)' : 'var(--accent-gold)',
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
                  /* Create New Person State */
                  <>
                    {/* Name Fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div>
                          <label className="form-label" style={{
                            display: 'block',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 500,
                            marginBottom: 'var(--space-1)',
                            fontFamily: 'var(--font-body)',
                            color: 'var(--neutral-700)'
                          }}>
                            First Name(s)
                          </label>
                          <input
                            type="text"
                            value={author.firstName}
                            onChange={(e) => handleFieldChange(index, 'firstName', e.target.value)}
                            onBlur={() => handleNameBlur(index, 'firstName')}
                            className="form-input"
                            placeholder="e.g., Peter or P"
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
                          <label className="form-label" style={{
                            display: 'block',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 500,
                            marginBottom: 'var(--space-1)',
                            fontFamily: 'var(--font-body)',
                            color: 'var(--neutral-700)'
                          }}>
                            Middle Name(s)
                          </label>
                          <input
                            type="text"
                            value={author.middleName}
                            onChange={(e) => handleFieldChange(index, 'middleName', e.target.value)}
                            onBlur={() => handleNameBlur(index, 'middleName')}
                            className="form-input"
                            placeholder="e.g., Michael or M"
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
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div>
                          <label className="form-label" style={{
                            display: 'block',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 500,
                            marginBottom: 'var(--space-1)',
                            fontFamily: 'var(--font-body)',
                            color: 'var(--neutral-700)'
                          }}>
                            Last Name *
                          </label>
                          <input
                            type="text"
                            value={author.lastName}
                            onChange={(e) => handleFieldChange(index, 'lastName', e.target.value)}
                            onBlur={() => handleNameBlur(index, 'lastName')}
                            className="form-input"
                            placeholder="e.g., Gollwitzer"
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
                          <label className="form-label" style={{
                            fontSize: 'var(--text-xs)',
                            fontWeight: 500,
                            marginBottom: 'var(--space-1)',
                            fontFamily: 'var(--font-body)',
                            color: 'var(--neutral-700)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)'
                          }}>
                            ORCID
                            {author.orcid && (
                              <span style={{
                                fontSize: '10px',
                                background: 'var(--accent-green)',
                                color: 'white',
                                padding: '1px 4px',
                                borderRadius: '3px'
                              }}>
                                from CrossRef
                              </span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={author.orcid}
                            onChange={(e) => handleFieldChange(index, 'orcid', e.target.value)}
                            className="form-input"
                            placeholder="0000-0000-0000-0000"
                            style={{
                              width: '100%',
                              padding: 'var(--space-2)',
                              fontSize: 'var(--text-sm)',
                              border: `1px solid ${author.orcid ? 'var(--accent-green)' : 'var(--neutral-300)'}`,
                              borderRadius: '4px',
                              fontFamily: 'var(--font-body)',
                              background: author.orcid ? 'var(--accent-green-light)' : 'white'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Loading state */}
                    {author.loadingMatches && (
                      <div style={{
                        marginTop: 'var(--space-3)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                        fontFamily: 'var(--font-body)'
                      }}>
                        <i className="fas fa-spinner fa-spin" style={{ marginRight: 'var(--space-2)' }}></i>
                        Searching for existing people...
                      </div>
                    )}

                    {/* Local database matches */}
                    {!author.loadingMatches && (hasOrcidMatch || hasPotentialMatches) && (
                      <div style={{
                        marginTop: 'var(--space-4)',
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
                          {/* ORCID match first */}
                          {hasOrcidMatch && (
                            <button
                              key={`orcid-${author.orcidMatch.id}`}
                              type="button"
                              onClick={() => handleLinkToPerson(index, author.orcidMatch)}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: 'var(--space-2) var(--space-3)',
                                fontSize: 'var(--text-sm)',
                                background: 'var(--accent-green-light)',
                                borderRadius: '4px',
                                border: '2px solid var(--accent-green)',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#c6f6d5';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--accent-green-light)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <span style={{ fontWeight: 500 }}>{author.orcidMatch.full_name}</span>
                                <span style={{
                                  fontSize: 'var(--text-xs)',
                                  background: 'var(--accent-green)',
                                  color: 'white',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 600
                                }}>
                                  ORCID Match
                                </span>
                              </div>
                              {author.orcidMatch.role && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-600)' }}>
                                  {author.orcidMatch.role}
                                </div>
                              )}
                            </button>
                          )}

                          {/* Name matches */}
                          {author.potentialMatches.map(person => (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => handleLinkToPerson(index, person)}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: 'var(--space-2) var(--space-3)',
                                fontSize: 'var(--text-sm)',
                                background: 'var(--neutral-100)',
                                borderRadius: '4px',
                                border: '1px solid var(--neutral-200)',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--accent-gold-light)';
                                e.currentTarget.style.borderColor = 'var(--accent-gold)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--neutral-100)';
                                e.currentTarget.style.borderColor = 'var(--neutral-200)';
                              }}
                            >
                              <div style={{ fontWeight: 500 }}>{person.full_name}</div>
                              {person.role && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-600)' }}>
                                  {person.role}
                                </div>
                              )}
                              {person.orcid && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-green)', marginTop: '2px' }}>
                                  <i className="fab fa-orcid" style={{ marginRight: '4px' }}></i>
                                  {person.orcid}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ORCID Registry Suggestions - show when loading or has suggestions */}
                    {!author.loadingMatches && !hasOrcidMatch && (
                      <>
                        {author.loadingOrcidSuggestions && (
                          <div style={{
                            marginTop: 'var(--space-4)',
                            paddingTop: 'var(--space-3)',
                            borderTop: '1px solid var(--neutral-200)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--neutral-500)',
                            fontFamily: 'var(--font-body)'
                          }}>
                            <i className="fas fa-spinner fa-spin" style={{ marginRight: 'var(--space-2)' }}></i>
                            Searching ORCID registry...
                          </div>
                        )}

                        {!author.loadingOrcidSuggestions && hasOrcidSuggestions && (
                          <div style={{
                            marginTop: 'var(--space-4)',
                            paddingTop: 'var(--space-3)',
                            borderTop: '1px solid var(--neutral-200)'
                          }}>
                            <div style={{
                              fontSize: 'var(--text-xs)',
                              fontWeight: 500,
                              color: 'var(--accent-green)',
                              marginBottom: 'var(--space-2)',
                              fontFamily: 'var(--font-body)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-1)'
                            }}>
                              <i className="fab fa-orcid"></i>
                              Found on ORCID Registry:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                              {author.orcidSuggestions.map((suggestion, suggIdx) => {
                                // Find local matches that could be merged with this ORCID
                                const matchingLocalPeople = author.potentialMatches.filter(p =>
                                  !p.orcid &&
                                  p.full_name.toLowerCase().includes(suggestion.family_name?.toLowerCase() || '')
                                );

                                return (
                                  <div key={`sugg-${suggIdx}-${suggestion.orcid}`} style={{
                                    border: suggestion.doi_verified ? '2px solid var(--accent-green)' : '1px dashed var(--accent-green)',
                                    borderRadius: '4px',
                                    background: suggestion.doi_verified ? 'var(--accent-green-light)' : 'white',
                                  }}>
                                    {/* ORCID suggestion info */}
                                    <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)' }}>{suggestion.full_name}</span>
                                        <span style={{
                                          fontSize: '10px',
                                          background: 'var(--accent-green)',
                                          color: 'white',
                                          padding: '1px 6px',
                                          borderRadius: '3px'
                                        }}>
                                          {suggestion.orcid}
                                        </span>
                                        {suggestion.doi_verified && (
                                          <span style={{
                                            fontSize: '10px',
                                            background: 'var(--accent-blue)',
                                            color: 'white',
                                            padding: '1px 6px',
                                            borderRadius: '3px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                          }}>
                                            <i className="fas fa-check-circle"></i>
                                            Has this article
                                          </span>
                                        )}
                                      </div>
                                      {suggestion.affiliations && suggestion.affiliations.length > 0 && (
                                        <div style={{
                                          fontSize: 'var(--text-xs)',
                                          color: 'var(--neutral-600)',
                                          marginTop: '2px',
                                          fontFamily: 'var(--font-body)'
                                        }}>
                                          <i className="fas fa-building" style={{ marginRight: '4px', opacity: 0.7 }}></i>
                                          {suggestion.affiliations.join(' • ')}
                                        </div>
                                      )}
                                    </div>

                                    {/* Action buttons */}
                                    <div style={{
                                      padding: 'var(--space-2) var(--space-3)',
                                      borderTop: '1px solid var(--neutral-200)',
                                      background: 'var(--neutral-50)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 'var(--space-2)'
                                    }}>
                                      {/* Use for new person button */}
                                      <button
                                        type="button"
                                        onClick={() => handleUseOrcidSuggestion(index, suggestion)}
                                        style={{
                                          width: '100%',
                                          textAlign: 'left',
                                          padding: 'var(--space-2)',
                                          fontSize: 'var(--text-xs)',
                                          background: 'white',
                                          borderRadius: '4px',
                                          border: '1px solid var(--accent-green)',
                                          cursor: 'pointer',
                                          fontFamily: 'var(--font-body)',
                                          color: 'var(--accent-green)',
                                          fontWeight: 500,
                                          transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = 'var(--accent-green-light)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = 'white';
                                        }}
                                      >
                                        <i className="fas fa-user-plus" style={{ marginRight: 'var(--space-2)' }}></i>
                                        Use for new person
                                      </button>

                                      {/* Merge with existing person buttons */}
                                      {matchingLocalPeople.map(localPerson => (
                                        <button
                                          key={`merge-${localPerson.id}-${suggestion.orcid}`}
                                          type="button"
                                          onClick={() => handleLinkAndMergeOrcid(index, localPerson, suggestion)}
                                          style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: 'var(--space-2)',
                                            fontSize: 'var(--text-xs)',
                                            background: 'var(--accent-gold-light)',
                                            borderRadius: '4px',
                                            border: '1px solid var(--accent-gold)',
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-body)',
                                            color: 'var(--accent-gold)',
                                            fontWeight: 500,
                                            transition: 'all 0.15s'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#f5e6c8';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'var(--accent-gold-light)';
                                          }}
                                        >
                                          <i className="fas fa-link" style={{ marginRight: 'var(--space-2)' }}></i>
                                          Link to "{localPerson.full_name}" & add ORCID
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
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

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          paddingTop: 'var(--space-4)',
          paddingBottom: 'var(--space-4)',
          borderTop: '1px solid var(--neutral-200)',
          position: 'sticky',
          bottom: 0,
          background: 'white',
          marginTop: 'var(--space-4)'
        }}>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary"
            style={{
              background: 'var(--accent-gold)',
              color: 'white',
              border: 'none',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: '4px',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#8a6624';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-gold)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Confirm & Save
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
