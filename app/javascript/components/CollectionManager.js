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
      <div style={{ padding: '24px', fontFamily: 'var(--font-body)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--primary)',
              letterSpacing: '-0.005em',
            }}
          >
            {itemToAdd ? 'Add to collection' : 'My collections'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              lineHeight: 1,
              cursor: 'pointer',
              color: 'var(--ink-3)',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(122, 46, 46, 0.06)',
              color: 'var(--error)',
              border: '1px solid rgba(122, 46, 46, 0.20)',
              borderRadius: 'var(--r-md)',
              marginBottom: '14px',
              fontSize: '13.5px',
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--ink-3)' }}>Loading.</div>
        ) : (
          <>
            <div style={{ maxHeight: '320px', overflowY: 'auto', marginBottom: '16px' }}>
              {collections.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '28px 16px',
                    background: 'var(--paper-soft)',
                    border: '1px dashed var(--ink-line)',
                    borderRadius: 'var(--r-md)',
                    color: 'var(--ink-3)',
                    fontSize: '13.5px',
                  }}
                >
                  No collections yet.  Create one to get started.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {collections.map((collection) => {
                    const isSelected = selectedCollection?.id === collection.id;
                    return (
                      <div
                        key={collection.id}
                        onClick={() => itemToAdd && setSelectedCollection(collection)}
                        style={{
                          padding: '12px 14px',
                          border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--ink-line)'}`,
                          borderRadius: 'var(--r-md)',
                          cursor: itemToAdd ? 'pointer' : 'default',
                          background: isSelected ? 'var(--paper-soft)' : 'var(--paper)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'border-color 0.12s, background 0.12s',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '14px' }}>
                            {collection.name}
                          </div>
                          {collection.description && (
                            <div style={{ fontSize: '13px', color: 'var(--ink-2)', marginTop: '2px', lineHeight: 1.5 }}>
                              {collection.description}
                            </div>
                          )}
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--ink-3)',
                              marginTop: '4px',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {collection.items_count || 0} {(collection.items_count || 0) === 1 ? 'item' : 'items'}
                          </div>
                        </div>
                        {!itemToAdd && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCollection(collection.id);
                            }}
                            className="sp-action sp-action-quiet sp-action-danger"
                            style={{ height: '28px', padding: '0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {itemToAdd && selectedCollection && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '14px',
                  fontSize: '13.5px',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  className="sp-checkbox"
                  checked={includeRelated}
                  onChange={(e) => setIncludeRelated(e.target.checked)}
                />
                Also add related items (linked concepts, people, sources, notes)
              </label>
            )}

            {showCreateForm ? (
              <form onSubmit={handleCreateCollection} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="sp-field">
                  <label className="sp-label">Name</label>
                  <input
                    type="text"
                    className="sp-input"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="e.g., Attachment theory papers"
                    autoFocus
                    required
                  />
                </div>
                <div className="sp-field">
                  <label className="sp-label">Description</label>
                  <textarea
                    className="sp-textarea"
                    value={newCollectionDescription}
                    onChange={(e) => setNewCollectionDescription(e.target.value)}
                    placeholder="Optional."
                    rows={2}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="submit"
                    disabled={creating || !newCollectionName.trim()}
                    className="sp-action sp-action-primary"
                  >
                    {creating ? 'Creating.' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewCollectionName('');
                      setNewCollectionDescription('');
                    }}
                    className="sp-action sp-action-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="sp-action sp-action-secondary"
                style={{ width: '100%' }}
              >
                + New collection
              </button>
            )}

            {itemToAdd && selectedCollection && (
              <div
                style={{
                  marginTop: '16px',
                  borderTop: '1px solid var(--ink-line-soft)',
                  paddingTop: '16px',
                }}
              >
                <button
                  type="button"
                  onClick={handleAddToCollection}
                  disabled={adding}
                  className="sp-action sp-action-primary"
                  style={{ width: '100%' }}
                >
                  {adding ? 'Adding.' : `Add to "${selectedCollection.name}"`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
