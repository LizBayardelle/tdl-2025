import React, { useState, useEffect } from 'react';
import Modal from './Modal';

export default function AuthorDisambiguationModal({ isOpen, onClose, authors, onConfirm }) {
  const parseAuthorName = (authorString) => {
    // Format: "Last, F. M." or "Last, F."
    const parts = authorString.split(',').map(s => s.trim());
    const lastName = parts[0] || '';
    const initials = parts[1] || '';

    // Extract first and middle initials
    const initialParts = initials.split(/\s+/).filter(i => i.length > 0);
    const firstName = initialParts[0]?.replace('.', '') || '';
    const middleName = initialParts.slice(1).join(' ').replace(/\./g, '') || '';

    return { firstName, middleName, lastName };
  };

  const [authorData, setAuthorData] = useState([]);

  // Initialize author data when modal opens
  useEffect(() => {
    if (isOpen && authors.length > 0) {
      const initialData = authors.map(author => {
        const parsed = parseAuthorName(author);
        return {
          originalName: author,
          action: 'create',
          linkedPersonId: null,
          firstName: parsed.firstName,
          middleName: parsed.middleName,
          lastName: parsed.lastName,
          orcid: '',
          potentialMatches: [],
          loadingMatches: true
        };
      });
      setAuthorData(initialData);

      // Search for matches for each author
      initialData.forEach((author, index) => {
        searchForMatches(index, author.lastName);
      });
    }
  }, [isOpen, authors]);

  const searchForMatches = async (index, lastName) => {
    if (!lastName || lastName.trim().length < 2) {
      setAuthorData(prev => {
        const newData = [...prev];
        newData[index].potentialMatches = [];
        newData[index].loadingMatches = false;
        return newData;
      });
      return;
    }

    try {
      const response = await fetch(`/people/search?q=${encodeURIComponent(lastName)}`);
      const results = await response.json();

      setAuthorData(prev => {
        const newData = [...prev];
        if (newData[index]) {
          newData[index].potentialMatches = results;
          newData[index].loadingMatches = false;
        }
        return newData;
      });
    } catch (error) {
      console.error('Error searching people:', error);
      setAuthorData(prev => {
        const newData = [...prev];
        if (newData[index]) {
          newData[index].potentialMatches = [];
          newData[index].loadingMatches = false;
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
      return newData;
    });
  };

  const handleUnlink = (index) => {
    setAuthorData(prev => {
      const newData = [...prev];
      newData[index].action = 'create';
      newData[index].linkedPersonId = null;
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

  const handleConfirm = () => {
    // Transform data for backend
    const processedAuthors = authorData.map(author => ({
      action: author.action,
      linkedPersonId: author.linkedPersonId,
      firstName: author.firstName,
      middleName: author.middleName,
      lastName: author.lastName,
      orcid: author.orcid,
      originalName: author.originalName
    }));

    onConfirm(processedAuthors);
  };

  const getLinkedPerson = (authorItem) => {
    if (authorItem.action === 'link' && authorItem.linkedPersonId) {
      return authorItem.potentialMatches.find(p => p.id === authorItem.linkedPersonId);
    }
    return null;
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
          You can link to existing people in your database or add more details before creating new records.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {authorData.map((author, index) => {
            const linkedPerson = getLinkedPerson(author);
            const hasPotentialMatches = author.potentialMatches && author.potentialMatches.length > 0;

            return (
              <div key={index} style={{
                border: '1px solid var(--neutral-300)',
                borderRadius: '4px',
                padding: 'var(--space-4)',
                background: 'white'
              }}>
                {/* Header */}
                <div style={{ marginBottom: 'var(--space-3)' }}>
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
                </div>

                {author.action === 'link' && linkedPerson ? (
                  /* Linked State */
                  <div style={{
                    background: 'var(--accent-gold-light)',
                    border: '1px solid var(--accent-gold)',
                    borderRadius: '4px',
                    padding: 'var(--space-3)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 500,
                          color: 'var(--accent-gold)',
                          fontFamily: 'var(--font-body)'
                        }}>
                          ✓ Linked to existing person
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
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlink(index)}
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--accent-gold)',
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
                            display: 'block',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 500,
                            marginBottom: 'var(--space-1)',
                            fontFamily: 'var(--font-body)',
                            color: 'var(--neutral-700)'
                          }}>
                            ORCID (optional)
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
                              border: '1px solid var(--neutral-300)',
                              borderRadius: '4px',
                              fontFamily: 'var(--font-body)'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Potential Duplicates Section */}
                    {author.loadingMatches && (
                      <div style={{
                        marginTop: 'var(--space-3)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                        fontFamily: 'var(--font-body)'
                      }}>
                        Searching for existing people...
                      </div>
                    )}

                    {!author.loadingMatches && hasPotentialMatches && (
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
                          Could this be one of these existing people?
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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
                                <div style={{
                                  fontSize: 'var(--text-xs)',
                                  color: 'var(--neutral-600)'
                                }}>
                                  {person.role}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
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
