import React, { useState, useEffect } from 'react';

export default function TagSelector({ selectedTags = [], onChange, themeColor = 'var(--accent-purple)' }) {
  const [allTags, setAllTags] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const response = await fetch('/tags.json');
      const data = await response.json();
      setAllTags(data.map(tag => tag.name));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setLoading(false);
    }
  };

  const filteredTags = allTags.filter(tag =>
    tag.toLowerCase().includes(filter.toLowerCase())
  );

  const handleToggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const handleCreateFromFilter = () => {
    if (filter.trim() && !allTags.includes(filter.trim()) && !selectedTags.includes(filter.trim())) {
      const newTag = filter.trim();
      setAllTags([...allTags, newTag]);
      onChange([...selectedTags, newTag]);
      setFilter('');
    }
  };

  const canCreateNew = filter.trim() &&
                       !allTags.includes(filter.trim()) &&
                       !selectedTags.includes(filter.trim());

  if (loading) {
    return (
      <div style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-500)',
        fontFamily: 'var(--font-body)'
      }}>
        Loading tags...
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
          placeholder="Type to filter or create new tag..."
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

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
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
            {selectedTags.map(tag => (
              <span
                key={tag}
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
                {tag}
                <button
                  type="button"
                  onClick={() => handleToggleTag(tag)}
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

      {/* Scrollable Tag List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)' }}>
        {filteredTags.length === 0 ? (
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-500)',
            textAlign: 'center',
            padding: 'var(--space-4) 0',
            fontFamily: 'var(--font-body)'
          }}>
            {filter ? 'No matching tags. Press Enter to create new.' : 'No tags yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredTags.map(tag => (
              <label
                key={tag}
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
                  checked={selectedTags.includes(tag)}
                  onChange={() => handleToggleTag(tag)}
                  style={{
                    borderRadius: '4px',
                    border: '1px solid var(--neutral-300)',
                    accentColor: themeColor
                  }}
                />
                <span style={{ fontSize: 'var(--text-sm)' }}>{tag}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
