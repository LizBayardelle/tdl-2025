import React, { useState, useEffect } from 'react';
import Modal from './Modal';

export default function CollectionManager({ isOpen, onClose, itemToAdd = null }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [includeRelated, setIncludeRelated] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCollections();
    }
  }, [isOpen]);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const response = await fetch('/collections.json');
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      } else {
        setError('Failed to load collections');
      }
    } catch (err) {
      setError('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    setCreating(true);
    setError('');

    try {
      const response = await fetch('/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({
          collection: {
            name: newCollectionName.trim(),
            description: newCollectionDescription.trim()
          }
        })
      });

      if (response.ok) {
        const newCollection = await response.json();
        setCollections([...collections, newCollection]);
        setNewCollectionName('');
        setNewCollectionDescription('');
        setShowCreateForm(false);
        setSelectedCollection(newCollection);
      } else {
        const data = await response.json();
        setError(data.errors?.join(', ') || 'Failed to create collection');
      }
    } catch (err) {
      setError('Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  const handleAddToCollection = async () => {
    if (!selectedCollection || !itemToAdd) return;

    setAdding(true);
    setError('');

    try {
      const response = await fetch(`/collections/${selectedCollection.id}/add_item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({
          item_type: itemToAdd.type,
          item_id: itemToAdd.id,
          include_related: includeRelated.toString()
        })
      });

      if (response.ok) {
        onClose(true); // Signal success
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add item to collection');
      }
    } catch (err) {
      setError('Failed to add item to collection');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCollection = async (collectionId) => {
    if (!confirm('Are you sure you want to delete this collection?')) return;

    try {
      const response = await fetch(`/collections/${collectionId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        }
      });

      if (response.ok) {
        setCollections(collections.filter(c => c.id !== collectionId));
        if (selectedCollection?.id === collectionId) {
          setSelectedCollection(null);
        }
      } else {
        setError('Failed to delete collection');
      }
    } catch (err) {
      setError('Failed to delete collection');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="medium">
      <div style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            {itemToAdd ? 'Add to Collection' : 'My Collections'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)'
            }}
          >
            &times;
          </button>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: 'var(--color-error-bg, #fee)',
            color: 'var(--color-error, #c00)',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
            Loading collections...
          </div>
        ) : (
          <>
            {/* Collection List */}
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
              {collections.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
                  No collections yet. Create one to get started.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {collections.map(collection => (
                    <div
                      key={collection.id}
                      onClick={() => itemToAdd && setSelectedCollection(collection)}
                      style={{
                        padding: '0.75rem 1rem',
                        border: `2px solid ${selectedCollection?.id === collection.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: '6px',
                        cursor: itemToAdd ? 'pointer' : 'default',
                        backgroundColor: selectedCollection?.id === collection.id ? 'var(--color-primary-bg, #f0f7ff)' : 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500 }}>{collection.name}</div>
                        {collection.description && (
                          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                            {collection.description}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '0.25rem' }}>
                          {collection.items_count || 0} items
                        </div>
                      </div>
                      {!itemToAdd && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCollection(collection.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            padding: '0.25rem'
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Include Related Checkbox */}
            {itemToAdd && selectedCollection && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeRelated}
                  onChange={(e) => setIncludeRelated(e.target.checked)}
                />
                Also add related items (linked concepts, people, sources, notes)
              </label>
            )}

            {/* Create Form */}
            {showCreateForm ? (
              <form onSubmit={handleCreateCollection} style={{ marginTop: '1rem' }}>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Collection name"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    marginBottom: '0.5rem'
                  }}
                />
                <textarea
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    marginBottom: '0.75rem',
                    resize: 'vertical'
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={creating || !newCollectionName.trim()}
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewCollectionName('');
                      setNewCollectionDescription('');
                    }}
                    className="btn-secondary"
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-secondary"
                style={{ width: '100%', padding: '0.5rem 1rem' }}
              >
                + New Collection
              </button>
            )}

            {/* Add to Collection Button */}
            {itemToAdd && selectedCollection && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <button
                  onClick={handleAddToCollection}
                  disabled={adding}
                  className="btn-primary"
                  style={{ width: '100%', padding: '0.75rem 1rem' }}
                >
                  {adding ? 'Adding...' : `Add to "${selectedCollection.name}"`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
