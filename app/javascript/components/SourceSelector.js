import React, { useState, useEffect } from 'react';

export default function SourceSelector({ selectedSourceIds = [], selectedSourceId = null, onChange, multiple = true, themeColor = 'var(--accent-blue)' }) {
  const [allSources, setAllSources] = useState([]);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const response = await fetch('/sources.json');
      const data = await response.json();
      const sources = Array.isArray(data) ? data : (data.sources || []);
      setAllSources(sources.sort((a, b) => (a.title || '').localeCompare(b.title || '')));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching sources:', error);
      setLoading(false);
    }
  };

  // Get unique source types
  const sourceTypes = [...new Set(allSources.map(s => s.kind).filter(Boolean))].sort();

  const filteredSources = allSources.filter(source => {
    // Text filter
    if (filter && !source.title.toLowerCase().includes(filter.toLowerCase())) {
      return false;
    }
    // Type filter
    if (typeFilter && source.kind !== typeFilter) {
      return false;
    }
    return true;
  });

  const handleToggle = (sourceId) => {
    if (multiple) {
      if (selectedSourceIds.includes(sourceId)) {
        onChange(selectedSourceIds.filter(id => id !== sourceId));
      } else {
        onChange([...selectedSourceIds, sourceId]);
      }
    } else {
      // Single select mode
      onChange(selectedSourceId === sourceId ? null : sourceId);
    }
  };

  const selectedSources = multiple
    ? allSources.filter(s => selectedSourceIds.includes(s.id))
    : (selectedSourceId ? allSources.filter(s => s.id === selectedSourceId) : []);

  if (loading) {
    return (
      <p style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-500)',
        fontFamily: 'var(--font-body)'
      }}>
        Loading sources...
      </p>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--neutral-300)',
      borderRadius: 'var(--radius)',
      background: 'white',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-body)'
    }}>
      {/* Search/Filter Input */}
      <div style={{
        padding: 'var(--space-3)',
        borderBottom: '1px solid var(--neutral-200)'
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search sources..."
            style={{
              flex: 1,
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--text-sm)',
              border: '1px solid var(--neutral-300)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-body)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = `2px solid ${themeColor}`;
              e.currentTarget.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${themeColor} 10%, transparent)`;
              e.currentTarget.style.padding = 'calc(var(--space-2) - 1px) calc(var(--space-3) - 1px)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = '1px solid var(--neutral-300)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.padding = 'var(--space-2) var(--space-3)';
            }}
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: 'var(--space-2)',
              fontSize: 'var(--text-xs)',
              border: '1px solid var(--neutral-300)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-body)',
              background: 'white',
              color: typeFilter ? 'var(--neutral-900)' : 'var(--neutral-500)',
              cursor: 'pointer',
              minWidth: '90px',
            }}
          >
            <option value="">All Types</option>
            {sourceTypes.map(type => (
              <option key={type} value={type} style={{ textTransform: 'capitalize' }}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Sources */}
      {selectedSources.length > 0 && (
        <div style={{
          padding: 'var(--space-3)',
          borderBottom: '1px solid var(--neutral-200)',
          background: `color-mix(in srgb, ${themeColor} 10%, white)`
        }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            marginBottom: 'var(--space-2)',
            color: 'var(--neutral-600)',
            fontFamily: 'var(--font-body)'
          }}>
            Selected:
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)'
          }}>
            {selectedSources.map(source => (
              <span
                key={source.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-1) var(--space-2)',
                  background: themeColor,
                  color: 'white',
                  fontSize: 'var(--text-xs)',
                  borderRadius: 'var(--radius)',
                  fontFamily: 'var(--font-body)'
                }}
              >
                {source.title} {source.year && `(${source.year})`}
                <button
                  type="button"
                  onClick={() => handleToggle(source.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '14px',
                    cursor: 'pointer',
                    color: 'white',
                    transition: 'opacity 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable Source List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-3)'
      }}>
        {filteredSources.length === 0 ? (
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-500)',
            textAlign: 'center',
            padding: 'var(--space-4)',
            fontFamily: 'var(--font-body)'
          }}>
            No sources found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredSources.map(source => (
              <label
                key={source.id}
                style={{
                  display: 'flex',
                  alignItems: 'start',
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
                  type={multiple ? "checkbox" : "radio"}
                  checked={multiple ? selectedSourceIds.includes(source.id) : selectedSourceId === source.id}
                  onChange={() => handleToggle(source.id)}
                  style={{
                    marginTop: '2px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--neutral-300)',
                    accentColor: themeColor,
                    cursor: 'pointer'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--neutral-900)'
                  }}>
                    {source.title} {source.year && `(${source.year})`}
                  </span>
                  {source.kind && (
                    <span style={{
                      display: 'inline-block',
                      marginLeft: 'var(--space-2)',
                      padding: '1px 6px',
                      fontSize: '10px',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      background: 'var(--neutral-100)',
                      color: 'var(--neutral-500)',
                      borderRadius: '3px',
                    }}>
                      {source.kind.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
