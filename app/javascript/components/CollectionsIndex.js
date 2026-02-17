import React, { useState, useEffect } from 'react';
import ShareModal from './ShareModal';

export default function CollectionsIndex() {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Share modal
  const [shareCollection, setShareCollection] = useState(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  // Auto-select first collection on initial load
  useEffect(() => {
    if (collections.length > 0 && !selectedCollection) {
      handleCollectionClick(collections[0]);
    }
  }, [collections]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const handleCollectionClick = async (collection) => {
    try {
      const response = await fetch(`/collections/${collection.id}.json`);
      if (response.ok) {
        const data = await response.json();
        // Merge with list data to keep is_owner, owner_email, share_permission
        setSelectedCollection({ ...collection, ...data });
        // Close sidebar on mobile after selection
        if (window.innerWidth < 768) {
          setSidebarOpen(false);
        }
      }
    } catch (err) {
      console.error('Failed to load collection details');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

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
          collection: { name: newName.trim(), description: newDescription.trim() }
        })
      });

      if (response.ok) {
        const newCollection = await response.json();
        // Add ownership info since we just created it
        const collectionWithOwner = { ...newCollection, is_owner: true, items_count: 0 };
        setCollections([collectionWithOwner, ...collections]);
        setNewName('');
        setNewDescription('');
        setShowCreateForm(false);
        handleCollectionClick(collectionWithOwner);
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

  const handleDelete = async (id) => {
    if (!confirm('Delete this collection? Items inside will not be deleted.')) return;

    try {
      const response = await fetch(`/collections/${id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content }
      });

      if (response.ok) {
        setCollections(collections.filter(c => c.id !== id));
        if (selectedCollection?.id === id) {
          setSelectedCollection(null);
        }
      }
    } catch (err) {
      setError('Failed to delete collection');
    }
  };

  const handleRemoveItem = async (collectionId, itemType, itemId) => {
    try {
      const response = await fetch(`/collections/${collectionId}/remove_item`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({ item_type: itemType, item_id: itemId })
      });

      if (response.ok) {
        // Refresh collection details
        const refreshResponse = await fetch(`/collections/${collectionId}.json`);
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setSelectedCollection(prev => ({ ...prev, ...data }));
          setCollections(collections.map(c =>
            c.id === collectionId ? { ...c, items_count: (c.items_count || 1) - 1 } : c
          ));
        }
      }
    } catch (err) {
      console.error('Failed to remove item');
    }
  };

  const getItemLink = (type, id) => {
    const singular = type.endsWith('s') ? type.slice(0, -1) : type;
    switch (singular.toLowerCase()) {
      case 'source': return `/sources/${id}`;
      case 'concept': return `/concepts/${id}`;
      case 'person': case 'people': return `/people/${id}`;
      case 'note': return `/notes/${id}`;
      default: return '#';
    }
  };

  const getTypeIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'sources': return 'fa-book';
      case 'concepts': return 'fa-lightbulb';
      case 'people': return 'fa-user';
      case 'notes': return 'fa-sticky-note';
      default: return 'fa-file';
    }
  };

  const getTypeColor = (type) => {
    switch (type.toLowerCase()) {
      case 'sources': return 'var(--accent-blue)';
      case 'concepts': return 'var(--accent-green)';
      case 'people': return 'var(--accent-gold)';
      case 'notes': return 'var(--accent-teal)';
      default: return 'var(--neutral-500)';
    }
  };

  const formatPermission = (permission) => {
    if (!permission) return '';
    return permission.charAt(0).toUpperCase() + permission.slice(1);
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-600)' }}>Loading collections...</p>
      </div>
    );
  }

  const totalItems = collections.reduce((sum, c) => sum + (c.items_count || 0), 0);

  return (
    <>
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'absolute',
            left: sidebarOpen ? '280px' : '0',
            top: '200px',
            zIndex: 20,
            background: 'var(--accent-maroon)',
            color: 'white',
            border: 'none',
            padding: 'var(--space-2)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderRadius: '0 4px 4px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '48px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-maroon) 80%, black)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-maroon)'}
        >
          <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`} style={{ fontSize: '12px' }}></i>
        </button>

        {/* Left Sidebar */}
        {sidebarOpen && (
          <aside style={{
            width: '280px',
            background: '#e2e2e2',
            overflowY: 'auto',
            padding: 'var(--space-4)',
            boxShadow: 'var(--shadow-sidebar)',
            flexShrink: 0
          }}>
            {/* Create Form */}
            {showCreateForm && (
              <div style={{
                background: 'white',
                padding: 'var(--space-4)',
                borderRadius: '4px',
                marginBottom: 'var(--space-4)',
                border: '1px solid var(--neutral-300)'
              }}>
                <form onSubmit={handleCreate}>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Collection name"
                    autoFocus
                    className="form-input"
                    style={{ width: '100%', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-body)' }}
                  />
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="form-input"
                    style={{ width: '100%', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-body)', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      type="submit"
                      disabled={creating || !newName.trim()}
                      className="btn-primary"
                      style={{
                        flex: 1,
                        background: creating || !newName.trim() ? 'var(--neutral-300)' : 'var(--accent-maroon)',
                        cursor: creating || !newName.trim() ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCreateForm(false); setNewName(''); setNewDescription(''); }}
                      className="btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {error && (
              <div style={{
                padding: 'var(--space-3)',
                backgroundColor: '#fee',
                color: '#c00',
                borderRadius: '4px',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)'
              }}>
                {error}
                <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#c00' }}>&times;</button>
              </div>
            )}

            {/* My Collections */}
            {(() => {
              const myCollections = collections.filter(c => c.is_owner);
              const sharedCollections = collections.filter(c => !c.is_owner);

              return (
                <>
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <h2 style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      fontFamily: 'var(--font-body)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--neutral-500)',
                      marginBottom: 'var(--space-3)'
                    }}>
                      My Collections ({myCollections.length})
                    </h2>

                    {myCollections.length === 0 ? (
                      <p style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--neutral-600)',
                        fontFamily: 'var(--font-body)',
                        textAlign: 'center',
                        padding: 'var(--space-4)'
                      }}>No collections yet</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        {myCollections.map(collection => (
                          <div
                            key={collection.id}
                            onClick={() => handleCollectionClick(collection)}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              background: selectedCollection?.id === collection.id ? 'var(--accent-maroon)' : 'transparent',
                              color: selectedCollection?.id === collection.id ? 'white' : 'var(--neutral-900)',
                              transition: 'all 0.15s',
                              fontFamily: 'var(--font-body)'
                            }}
                            onMouseEnter={(e) => {
                              if (selectedCollection?.id !== collection.id) {
                                e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedCollection?.id !== collection.id) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--space-2)',
                                  fontSize: 'var(--text-sm)',
                                  fontWeight: 500
                                }}>
                                  <i className="fas fa-folder" style={{ fontSize: '12px', opacity: 0.7 }}></i>
                                  <span style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {collection.name}
                                  </span>
                                </div>
                              </div>
                              <span style={{
                                fontSize: 'var(--text-xs)',
                                marginLeft: 'var(--space-2)',
                                flexShrink: 0,
                                opacity: 0.7
                              }}>
                                {collection.items_count || 0}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Shared with Me */}
                  {sharedCollections.length > 0 && (
                    <div>
                      <h2 style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        fontFamily: 'var(--font-body)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--neutral-500)',
                        marginBottom: 'var(--space-3)'
                      }}>
                        Shared with Me ({sharedCollections.length})
                      </h2>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        {sharedCollections.map(collection => (
                          <div
                            key={collection.id}
                            onClick={() => handleCollectionClick(collection)}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              background: selectedCollection?.id === collection.id ? 'var(--accent-maroon)' : 'transparent',
                              color: selectedCollection?.id === collection.id ? 'white' : 'var(--neutral-900)',
                              transition: 'all 0.15s',
                              fontFamily: 'var(--font-body)'
                            }}
                            onMouseEnter={(e) => {
                              if (selectedCollection?.id !== collection.id) {
                                e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedCollection?.id !== collection.id) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--space-2)',
                                  fontSize: 'var(--text-sm)',
                                  fontWeight: 500
                                }}>
                                  <i className="fas fa-share-alt" style={{ fontSize: '12px', opacity: 0.7 }}></i>
                                  <span style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {collection.name}
                                  </span>
                                </div>
                                <p style={{
                                  fontSize: 'var(--text-xs)',
                                  marginTop: '2px',
                                  opacity: 0.7,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  from {collection.owner_email?.split('@')[0]}
                                </p>
                              </div>
                              <span style={{
                                fontSize: 'var(--text-xs)',
                                marginLeft: 'var(--space-2)',
                                flexShrink: 0,
                                opacity: 0.7
                              }}>
                                {collection.items_count || 0}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </aside>
        )}

        {/* Main Content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
          {/* Header */}
          <div style={{
            padding: 'var(--space-6) var(--space-8)',
            background: 'color-mix(in srgb, var(--accent-maroon) 15%, white)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            position: 'relative',
            zIndex: 5,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{
                  fontSize: 'var(--text-4xl)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent-maroon)',
                  margin: 0,
                  lineHeight: 1.1
                }}>Collections</h1>
                <p style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--neutral-600)',
                  fontFamily: 'var(--font-body)',
                  marginTop: 'var(--space-1)',
                  marginBottom: 0
                }}>
                  {collections.length} collections — {totalItems} items
                </p>
              </div>
              {/* New Collection Button */}
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'var(--accent-maroon)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-maroon) 80%, black)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent-maroon)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                title="New Collection"
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-6)',
          }}>
            {selectedCollection ? (
              <CollectionDetail
                collection={selectedCollection}
                onDelete={() => handleDelete(selectedCollection.id)}
                onShare={() => setShareCollection({ id: selectedCollection.id, name: selectedCollection.name, type: 'Collection' })}
                onRemoveItem={handleRemoveItem}
                getItemLink={getItemLink}
                getTypeIcon={getTypeIcon}
                getTypeColor={getTypeColor}
                formatPermission={formatPermission}
              />
            ) : (
              <div style={{
                textAlign: 'center',
                padding: 'var(--space-8)',
                color: 'var(--neutral-500)',
                fontFamily: 'var(--font-body)'
              }}>
                <i className="fas fa-folder-open" style={{ fontSize: '3rem', marginBottom: 'var(--space-4)', display: 'block', color: 'var(--accent-maroon)', opacity: 0.5 }}></i>
                Select a collection to view its contents
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Share Modal */}
      {shareCollection && (
        <ShareModal
          isOpen={!!shareCollection}
          onClose={() => setShareCollection(null)}
          shareable={shareCollection}
        />
      )}
    </>
  );
}

function CollectionDetail({ collection, onDelete, onShare, onRemoveItem, getItemLink, getTypeIcon, getTypeColor, formatPermission }) {
  const isOwner = collection.is_owner;
  const hasSharing = (!isOwner) || (isOwner && collection.shares && collection.shares.length > 0);

  return (
    <div style={{ overflow: 'visible' }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-6)',
        borderBottom: '1px solid var(--neutral-200)',
        background: 'white'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'start',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <i className="fas fa-folder-open" style={{ color: 'var(--accent-maroon)', fontSize: 'var(--text-2xl)' }}></i>
              <h2 style={{
                fontSize: 'var(--text-3xl)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--accent-maroon)',
                margin: 0
              }}>
                {collection.name}
              </h2>
            </div>
            {collection.description && (
              <p style={{
                fontSize: 'var(--text-base)',
                color: 'var(--neutral-600)',
                fontFamily: 'var(--font-body)',
                margin: 0
              }}>
                {collection.description}
              </p>
            )}
          </div>
          {isOwner && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={onShare}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-maroon)',
                  cursor: 'pointer',
                  padding: 'var(--space-2)',
                  fontSize: 'var(--text-lg)',
                  transition: 'color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                title="Share"
              >
                <i className="fas fa-share-alt"></i>
              </button>
              <button
                onClick={onDelete}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--neutral-400)',
                  cursor: 'pointer',
                  padding: 'var(--space-2)',
                  fontSize: 'var(--text-lg)',
                  transition: 'color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-400)'}
                title="Delete"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          )}
        </div>

        {/* Sharing Info Box - for recipients */}
        {!isOwner && (
          <div style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            background: '#e2e2e2',
            border: '1px solid var(--neutral-300)',
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)'
          }}>
            <div>
              <span style={{ color: 'var(--neutral-500)', marginRight: 'var(--space-2)' }}>Shared by:</span>
              <span style={{ color: 'var(--neutral-700)', fontWeight: 500 }}>{collection.owner_email}</span>
            </div>
            <div>
              <span style={{ color: 'var(--neutral-500)', marginRight: 'var(--space-2)' }}>Your role:</span>
              <span style={{
                color: 'white',
                background: 'var(--accent-maroon)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 500,
                fontSize: 'var(--text-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {formatPermission(collection.share_permission)}
              </span>
            </div>
          </div>
        )}

        {/* Sharing Info for Owner */}
        {isOwner && collection.shares && collection.shares.length > 0 && (
          <div style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            background: '#e2e2e2',
            border: '1px solid var(--neutral-300)',
            borderRadius: '4px',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
              color: 'var(--neutral-600)',
              fontWeight: 600
            }}>
              <i className="fas fa-users" style={{ fontSize: '12px' }}></i>
              Shared with
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {collection.shares.map(share => (
                <div key={share.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--neutral-700)' }}>{share.email}</span>
                  <span style={{
                    color: 'white',
                    background: 'var(--accent-maroon)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 500,
                    fontSize: 'var(--text-xs)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {formatPermission(share.permission)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div style={{
        padding: 'var(--space-6)',
        borderBottom: '1px solid var(--neutral-200)',
        background: 'white'
      }}>
        <h3 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
          color: 'var(--neutral-900)',
          marginBottom: 'var(--space-3)'
        }}>
          Items ({collection.items_count || 0})
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {['sources', 'concepts', 'people', 'notes'].map(type => {
            const count = collection[type]?.length || 0;
            if (count === 0) return null;
            return (
              <div
                key={type}
                style={{
                  background: getTypeColor(type),
                  color: 'white',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: '4px',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500
                }}
              >
                <i className={`fas ${getTypeIcon(type)}`} style={{ marginRight: 'var(--space-2)' }}></i>
                {type.charAt(0).toUpperCase() + type.slice(1)}
                <span style={{ marginLeft: 'var(--space-2)', opacity: 0.8 }}>({count})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items by Type */}
      <div style={{ padding: 'var(--space-6)', background: 'white' }}>
        {['sources', 'concepts', 'people', 'notes'].map(type => {
          const items = collection[type] || [];
          if (items.length === 0) return null;

          const singularType = type === 'people' ? 'Person' : type.charAt(0).toUpperCase() + type.slice(1, -1);

          return (
            <div key={type} style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: getTypeColor(type),
                marginBottom: 'var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}>
                <i className={`fas ${getTypeIcon(type)}`} style={{ fontSize: 'var(--text-sm)' }}></i>
                {type.charAt(0).toUpperCase() + type.slice(1)} ({items.length})
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 'var(--space-3)'
              }}>
                {items.map(item => (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      padding: 'var(--space-3)',
                      paddingRight: 'var(--space-6)',
                      borderLeft: `3px solid ${getTypeColor(type)}`,
                      transition: 'all 0.15s',
                      position: 'relative'
                    }}
                  >
                    <a
                      href={getItemLink(type, item.id)}
                      style={{
                        textDecoration: 'none',
                        color: 'var(--neutral-900)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500,
                        fontFamily: 'var(--font-body)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = getTypeColor(type)}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-900)'}
                    >
                      {item.title || item.label || item.full_name || item.body?.substring(0, 40)}
                    </a>
                    <button
                      onClick={() => onRemoveItem(collection.id, singularType, item.id)}
                      title="Remove from collection"
                      style={{
                        position: 'absolute',
                        top: 'var(--space-2)',
                        right: 'var(--space-2)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--neutral-400)',
                        cursor: 'pointer',
                        padding: 'var(--space-1)',
                        fontSize: 'var(--text-xs)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-400)'}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {!collection.sources?.length && !collection.concepts?.length && !collection.people?.length && !collection.notes?.length && (
          <div style={{
            color: 'var(--neutral-500)',
            fontSize: 'var(--text-sm)',
            textAlign: 'center',
            padding: 'var(--space-8)',
            fontFamily: 'var(--font-body)'
          }}>
            <i className="fas fa-inbox" style={{ display: 'block', fontSize: '2rem', marginBottom: 'var(--space-3)', color: 'var(--neutral-400)' }}></i>
            This collection is empty.<br />Add items from their detail pages.
          </div>
        )}
      </div>
    </div>
  );
}
