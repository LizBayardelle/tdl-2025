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
      <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
        <p className="text-sm text-gray-600 mb-4">
          We detected {authors.length} author{authors.length !== 1 ? 's' : ''}.
          You can link to existing people in your database or add more details before creating new records.
        </p>

        {authorData.map((author, index) => {
          const linkedPerson = getLinkedPerson(author);
          const hasPotentialMatches = author.potentialMatches && author.potentialMatches.length > 0;

          return (
            <div key={index} className="border border-gray-300 rounded p-4 bg-white">
              {/* Header */}
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1">From citation:</div>
                <div className="font-medium text-gray-900">{author.originalName}</div>
              </div>

              {author.action === 'link' && linkedPerson ? (
                /* Linked State */
                <div className="bg-primary-light bg-opacity-20 border border-primary-light rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-primary">
                        ✓ Linked to existing person
                      </div>
                      <div className="text-sm mt-1">{linkedPerson.full_name}</div>
                      {linkedPerson.role && (
                        <div className="text-xs text-gray-600">{linkedPerson.role}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlink(index)}
                      className="text-xs text-accent hover:text-accent-dark px-3 py-1 border border-gray-300 rounded bg-white"
                    >
                      Unlink
                    </button>
                  </div>
                </div>
              ) : (
                /* Create New Person State */
                <>
                  {/* Name Fields */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">First Name(s)</label>
                        <input
                          type="text"
                          value={author.firstName}
                          onChange={(e) => handleFieldChange(index, 'firstName', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                          placeholder="e.g., Peter or P"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Middle Name(s)</label>
                        <input
                          type="text"
                          value={author.middleName}
                          onChange={(e) => handleFieldChange(index, 'middleName', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                          placeholder="e.g., Michael or M"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Last Name *</label>
                        <input
                          type="text"
                          value={author.lastName}
                          onChange={(e) => handleFieldChange(index, 'lastName', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                          placeholder="e.g., Gollwitzer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">ORCID (optional)</label>
                        <input
                          type="text"
                          value={author.orcid}
                          onChange={(e) => handleFieldChange(index, 'orcid', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                          placeholder="0000-0000-0000-0000"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Potential Duplicates Section */}
                  {author.loadingMatches && (
                    <div className="mt-3 text-xs text-gray-500">
                      Searching for existing people...
                    </div>
                  )}

                  {!author.loadingMatches && hasPotentialMatches && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <div className="text-xs font-medium text-gray-700 mb-2">
                        Could this be one of these existing people?
                      </div>
                      <div className="space-y-2">
                        {author.potentialMatches.map(person => (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => handleLinkToPerson(index, person)}
                            className="w-full text-left px-3 py-2 text-sm bg-sand hover:bg-primary-light rounded border border-gray-200"
                          >
                            <div className="font-medium">{person.full_name}</div>
                            {person.role && (
                              <div className="text-xs text-gray-600">{person.role}</div>
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

        <div className="flex justify-center gap-3 pt-4 pb-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary"
          >
            Confirm & Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
