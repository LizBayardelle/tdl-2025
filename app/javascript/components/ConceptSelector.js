import React, { useState, useEffect } from 'react';

export default function ConceptSelector({ selectedConceptIds = [], onChange }) {
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
    return <div className="text-sm text-gray-500">Loading concepts...</div>;
  }

  return (
    <div className="border border-gray-300 rounded bg-white">
      {/* Search/Filter Input */}
      <div className="p-3 border-b border-gray-200">
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
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
        />
        {canCreateNew && (
          <button
            type="button"
            onClick={handleCreateFromFilter}
            className="mt-2 text-xs hover:text-accent-dark"
            style={{ background: 'none', padding: 0, color: '#414431' }}
          >
            + Create "{filter.trim()}"
          </button>
        )}
      </div>

      {/* Selected Concepts */}
      {selectedConcepts.length > 0 && (
        <div className="p-3 border-b border-gray-200 bg-sand">
          <div className="text-xs font-medium mb-2 text-gray-600">Selected:</div>
          <div className="flex flex-wrap gap-2">
            {selectedConcepts.map(concept => (
              <span
                key={concept.id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-sand text-xs rounded"
              >
                {concept.label}
                <button
                  type="button"
                  onClick={() => handleToggleConcept(concept.id)}
                  className="hover:text-accent-light"
                  style={{ background: 'none', padding: 0, fontSize: '14px' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable Concept List */}
      <div className="max-h-48 overflow-y-auto p-3">
        {filteredConcepts.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            {filter ? 'No matching concepts. Press Enter to create new.' : 'No concepts yet.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConcepts.map(concept => (
              <label
                key={concept.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-sand px-2 py-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedConceptIds.includes(concept.id)}
                  onChange={() => handleToggleConcept(concept.id)}
                  className="rounded border-gray-300"
                  style={{ accentColor: '#414431' }}
                />
                <span className="text-sm">{concept.label}</span>
                {concept.node_type && concept.node_type !== 'concept' && (
                  <span className="text-xs text-gray-500 ml-auto">({concept.node_type})</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
