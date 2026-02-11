import React, { useState, useEffect } from 'react';

export default function ConceptSelector({ selectedConceptIds = [], onChange, themeColor = 'var(--accent-green)' }) {
  const [allConcepts, setAllConcepts] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConcepts();
  }, []);

  const fetchConcepts = async () => {
    try {
      const response = await fetch('/concepts.json');
      const data = await response.json();
      setAllConcepts(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching concepts:', error);
      setLoading(false);
    }
  };

  const filteredConcepts = allConcepts.filter(concept =>
    concept.label.toLowerCase().includes(filter.toLowerCase())
  );

  const handleToggleConcept = (conceptId) => {
    if (selectedConceptIds.includes(conceptId)) {
      onChange(selectedConceptIds.filter(id => id !== conceptId));
    } else {
      onChange([...selectedConceptIds, conceptId]);
    }
  };

  const handleCreateFromFilter = async () => {
    if (filter.trim() && !allConcepts.some(c => c.label.toLowerCase() === filter.trim().toLowerCase())) {
      try {
        const response = await fetch('/concepts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
          },
          body: JSON.stringify({
            concept: {
              label: filter.trim(),
              node_type: 'construct'
            }
          }),
        });

        if (response.ok) {
          const newConcept = await response.json();
          setAllConcepts([...allConcepts, newConcept]);
          onChange([...selectedConceptIds, newConcept.id]);
          setFilter('');
        }
      } catch (error) {
        console.error('Error creating concept:', error);
      }
    }
  };

  const canCreateNew = filter.trim() &&
                       !allConcepts.some(c => c.label.toLowerCase() === filter.trim().toLowerCase());

  const selectedConcepts = allConcepts.filter(c => selectedConceptIds.includes(c.id));

  if (loading) {
    return (
      <div style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-500)',
        fontFamily: 'var(--font-body)'
      }}>
        Loading concepts...
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--neutral-300)',
      borderRadius: '4px',
      background: 'white',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Search/Filter Input */}
      <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--neutral-200)' }}>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canCreateNew) {
              e.preventDefault();
              handleCreateFromFilter();
            }
          }}
          placeholder="Type to filter or create new concept..."
          className="form-input"
          style={{ width: '100%', fontSize: 'var(--text-sm)' }}
        />
        {canCreateNew && (
          <button
            type="button"
            onClick={handleCreateFromFilter}
            style={{
              background: 'none',
              padding: 0,
              color: themeColor,
              fontSize: 'var(--text-xs)',
              border: 'none',
              cursor: 'pointer',
              marginTop: 'var(--space-2)',
              fontFamily: 'var(--font-body)',
            }}
          >
            + Create "{filter.trim()}"
          </button>
        )}
      </div>

      {/* Selected Concepts */}
      {selectedConcepts.length > 0 && (
        <div style={{
          padding: 'var(--space-3)',
          borderBottom: '1px solid var(--neutral-200)',
          background: 'var(--neutral-50)'
        }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            marginBottom: 'var(--space-2)',
            color: 'var(--neutral-600)',
            fontFamily: 'var(--font-body)'
          }}>
            Selected:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {selectedConcepts.map(concept => (
              <span
                key={concept.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-1) var(--space-2)',
                  background: themeColor,
                  color: 'white',
                  fontSize: 'var(--text-xs)',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-body)'
                }}
              >
                {concept.label}
                <button
                  type="button"
                  onClick={() => handleToggleConcept(concept.id)}
                  style={{
                    background: 'none',
                    padding: 0,
                    fontSize: '14px',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0.8
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable Concept List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)' }}>
        {filteredConcepts.length === 0 ? (
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-500)',
            textAlign: 'center',
            padding: 'var(--space-4) 0',
            fontFamily: 'var(--font-body)'
          }}>
            {filter ? 'No matching concepts. Press Enter to create new.' : 'No concepts yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredConcepts.map(concept => (
              <label
                key={concept.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  padding: 'var(--space-1) var(--space-2)',
                  borderRadius: '4px',
                  transition: 'background 0.15s',
                  fontFamily: 'var(--font-body)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-100)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={selectedConceptIds.includes(concept.id)}
                  onChange={() => handleToggleConcept(concept.id)}
                  style={{
                    borderRadius: '4px',
                    border: '1px solid var(--neutral-300)',
                    accentColor: themeColor
                  }}
                />
                <span style={{ fontSize: 'var(--text-sm)' }}>{concept.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
