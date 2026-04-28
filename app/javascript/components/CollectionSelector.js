import React, { useState, useEffect } from 'react';

export default function CollectionSelector({
  itemType,
  itemId,
  selectedCollectionIds = [],
  onChange,
  themeColor = 'var(--ink-3)',
  disabled = false
}) {
  const [allCollections, setAllCollections] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const response = await fetch('/collections.json');
      const data = await response.json();
      setAllCollections(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching collections:', error);
      setLoading(false);
    }
  };

  const filteredCollections = allCollections.filter(collection =>
    collection.name.toLowerCase().includes(filter.toLowerCase())
  );

  const handleToggleCollection = async (collectionId) => {
    if (disabled) return;

    const isSelected = selectedCollectionIds.includes(collectionId);

    // If no itemId, just update local state (for create mode)
    if (!itemId) {
      if (isSelected) {
        const newIds = selectedCollectionIds.filter(id => id !== collectionId);
        const newCollections = allCollections.filter(c => newIds.includes(c.id));
        onChange(newIds, newCollections);
      } else {
        const newIds = [...selectedCollectionIds, collectionId];
        const newCollections = allCollections.filter(c => newIds.includes(c.id));
        onChange(newIds, newCollections);
      }
      return;
    }

    // If we have an itemId, make API calls
    try {
      if (isSelected) {
        // Remove from collection
        const response = await fetch(`/collections/${collectionId}/remove_item`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
          },
          body: JSON.stringify({
            item_type: itemType,
            item_id: itemId
          }),
        });

        if (response.ok) {
          const newIds = selectedCollectionIds.filter(id => id !== collectionId);
          const newCollections = allCollections.filter(c => newIds.includes(c.id));
          onChange(newIds, newCollections);
        }
      } else {
        // Add to collection
        const response = await fetch(`/collections/${collectionId}/add_item`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
          },
          body: JSON.stringify({
            item_type: itemType,
            item_id: itemId
          }),
        });

        if (response.ok) {
          const newIds = [...selectedCollectionIds, collectionId];
          const newCollections = allCollections.filter(c => newIds.includes(c.id));
          onChange(newIds, newCollections);
        }
      }
    } catch (error) {
      console.error('Error updating collection:', error);
    }
  };

  const handleCreateCollection = async () => {
    if (!filter.trim() || allCollections.some(c => c.name.toLowerCase() === filter.trim().toLowerCase())) {
      return;
    }

    try {
      const response = await fetch('/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          collection: { name: filter.trim() }
        }),
      });

      if (response.ok) {
        const newCollection = await response.json();
        const updatedCollections = [...allCollections, newCollection];
        setAllCollections(updatedCollections);
        setFilter('');
        // Auto-select the new collection
        const newIds = [...selectedCollectionIds, newCollection.id];
        const newSelectedCollections = updatedCollections.filter(c => newIds.includes(c.id));

        if (itemId) {
          // If we have an itemId, also make the API call
          try {
            await fetch(`/collections/${newCollection.id}/add_item`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
              },
              body: JSON.stringify({
                item_type: itemType,
                item_id: itemId
              }),
            });
          } catch (error) {
            console.error('Error adding to collection:', error);
          }
        }

        onChange(newIds, newSelectedCollections);
      }
    } catch (error) {
      console.error('Error creating collection:', error);
    }
  };

  const canCreateNew = filter.trim() &&
    !allCollections.some(c => c.name.toLowerCase() === filter.trim().toLowerCase());

  const selectedCollections = allCollections.filter(c => selectedCollectionIds.includes(c.id));

  if (loading) {
    return (
      <p style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-500)',
        fontFamily: 'var(--font-body)'
      }}>
        Loading collections...
      </p>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--neutral-300)',
      borderRadius: 'var(--radius)',
      background: 'white',
      height: '100%',
      maxHeight: '400px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Search/Filter Input */}
      <div style={{
        padding: 'var(--space-3)',
        borderBottom: '1px solid var(--neutral-200)'
      }}>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canCreateNew) {
              e.preventDefault();
              handleCreateCollection();
            }
          }}
          placeholder="Search or create collection..."
          style={{
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--text-sm)',
            border: '1px solid var(--neutral-300)',
            borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-body)'
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = 'none';
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
        {canCreateNew && (
          <button
            type="button"
            onClick={handleCreateCollection}
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

      {/* Selected Collections */}
      {selectedCollections.length > 0 && (
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
            {selectedCollections.map(collection => (
              <span
                key={collection.id}
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
{collection.name}
                <button
                  type="button"
                  onClick={() => handleToggleCollection(collection.id)}
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

      {/* Scrollable Collection List */}
      <div style={{
        flex: 1,
        minHeight: '120px',
        overflowY: 'auto',
        padding: 'var(--space-3)'
      }}>
        {filteredCollections.length === 0 ? (
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-500)',
            textAlign: 'center',
            padding: 'var(--space-4)',
            fontFamily: 'var(--font-body)'
          }}>
            {filter ? 'No matches. Press Enter to create.' : 'No collections yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredCollections.map(collection => {
              const isSelected = selectedCollectionIds.includes(collection.id);
              return (
                <label
                  key={collection.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: 'var(--radius)',
                    transition: 'background 0.15s',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = `color-mix(in srgb, ${themeColor} 10%, white)`}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleCollection(collection.id)}
                    style={{
                      marginTop: '2px',
                      accentColor: themeColor,
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{
                    flex: 1,
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--neutral-900)'
                  }}>
                    {collection.name}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
