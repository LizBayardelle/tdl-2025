import React, { useState, useEffect } from 'react';

export default function PeopleSelector({ selectedPersonIds = [], onChange, themeColor = 'var(--primary)' }) {
  const [allPeople, setAllPeople] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    try {
      const response = await fetch('/people.json');
      const data = await response.json();
      setAllPeople(data.sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching people:', error);
      setLoading(false);
    }
  };

  const filteredPeople = filter
    ? allPeople.filter(person =>
        person.full_name.toLowerCase().includes(filter.toLowerCase())
      )
    : allPeople;

  const handleToggle = (personId) => {
    if (selectedPersonIds.includes(personId)) {
      onChange(selectedPersonIds.filter(id => id !== personId));
    } else {
      onChange([...selectedPersonIds, personId]);
    }
  };

  const handleCreateFromFilter = async () => {
    if (filter.trim() && !allPeople.some(p => p.full_name.toLowerCase() === filter.trim().toLowerCase())) {
      try {
        // Parse the filter into name components
        const nameParts = filter.trim().split(/\s+/);
        let personData = { role: 'researcher' };

        if (nameParts.length === 1) {
          // Just one name - treat as last name
          personData.last_name = nameParts[0];
        } else {
          // Everything except last word goes to first name, last word is last name
          personData.first_name = nameParts.slice(0, -1).join(' ');
          personData.last_name = nameParts[nameParts.length - 1];
        }

        const response = await fetch('/people', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
          },
          body: JSON.stringify({ person: personData }),
        });

        if (response.ok) {
          const newPerson = await response.json();
          setAllPeople([...allPeople, newPerson].sort((a, b) => a.full_name.localeCompare(b.full_name)));
          onChange([...selectedPersonIds, newPerson.id]);
          setFilter('');
        }
      } catch (error) {
        console.error('Error creating person:', error);
      }
    }
  };

  const canCreateNew = filter.trim() &&
                       !allPeople.some(p => p.full_name.toLowerCase() === filter.trim().toLowerCase());

  const selectedPeople = allPeople.filter(p => selectedPersonIds.includes(p.id));

  if (loading) {
    return (
      <div style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-500)',
        fontFamily: 'var(--font-body)'
      }}>
        Loading people...
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
          placeholder="Type to filter or create new person..."
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

      {/* Selected People */}
      {selectedPeople.length > 0 && (
        <div style={{
          padding: 'var(--space-3)',
          borderBottom: '1px solid var(--neutral-200)',
          background: `color-mix(in srgb, ${themeColor} 10%, white)`,
          maxHeight: '100px',
          overflowY: 'auto',
          flexShrink: 0
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
            {selectedPeople.map(person => (
              <span
                key={person.id}
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
                {person.full_name}
                <button
                  type="button"
                  onClick={() => handleToggle(person.id)}
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

      {/* Scrollable People List */}
      <div style={{ flex: 1, minHeight: '120px', overflowY: 'auto', padding: 'var(--space-3)' }}>
        {filteredPeople.length === 0 ? (
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-500)',
            textAlign: 'center',
            padding: 'var(--space-4) 0',
            fontFamily: 'var(--font-body)'
          }}>
            {filter ? 'No matching people. Press Enter to create new.' : 'No people yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredPeople.map(person => (
              <label
                key={person.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius)',
                  transition: 'background 0.15s',
                  fontFamily: 'var(--font-body)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = `color-mix(in srgb, ${themeColor} 10%, white)`}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={selectedPersonIds.includes(person.id)}
                  onChange={() => handleToggle(person.id)}
                  style={{
                    borderRadius: '4px',
                    border: '1px solid var(--neutral-300)',
                    accentColor: themeColor
                  }}
                />
                <span style={{ fontSize: 'var(--text-sm)' }}>{person.full_name}</span>
                {person.role && person.role !== 'researcher' && (
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--neutral-500)',
                    marginLeft: 'auto'
                  }}>
                    ({person.role})
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
