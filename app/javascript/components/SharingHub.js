import React, { useState, useEffect } from 'react';

const TABS = [
  { id: 'collections', label: 'Collections', icon: 'fa-folder' },
  { id: 'shared-with-me', label: 'Shared with Me', icon: 'fa-inbox' },
  { id: 'my-shares', label: 'My Shares', icon: 'fa-share' }
];

const PERMISSION_OPTIONS = [
  { value: 'viewer', label: 'Viewer', description: 'Can view only' },
  { value: 'editor', label: 'Editor', description: 'Can view and edit' },
  { value: 'collaborator', label: 'Collaborator', description: 'Can view, edit, and add items' }
];

export default function SharingHub() {
  const [activeTab, setActiveTab] = useState('collections');
  const [collections, setCollections] = useState([]);
  const [receivedShares, setReceivedShares] = useState([]);
  const [outgoingShares, setOutgoingShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Collection creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Expanded collection
  const [expandedCollection, setExpandedCollection] = useState(null);
  const [collectionDetails, setCollectionDetails] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [collectionsRes, receivedRes, outgoingRes] = await Promise.all([
        fetch('/collections.json'),
        fetch('/shares/received.json'),
        fetch('/shares.json')
      ]);

      if (collectionsRes.ok) setCollections(await collectionsRes.json());
      if (receivedRes.ok) setReceivedShares(await receivedRes.json());
      if (outgoingRes.ok) setOutgoingShares(await outgoingRes.json());
    } catch (err) {
      setError('Failed to load data');
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

  const handleDeleteCollection = async (collectionId) => {
    if (!confirm('Are you sure you want to delete this collection? This will not delete the items in it.')) return;

    try {
      const response = await fetch(`/collections/${collectionId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        }
      });

      if (response.ok) {
        setCollections(collections.filter(c => c.id !== collectionId));
        if (expandedCollection === collectionId) {
          setExpandedCollection(null);
          setCollectionDetails(null);
        }
      }
    } catch (err) {
      setError('Failed to delete collection');
    }
  };

  const handleExpandCollection = async (collectionId) => {
    if (expandedCollection === collectionId) {
      setExpandedCollection(null);
      setCollectionDetails(null);
      return;
    }

    try {
      const response = await fetch(`/collections/${collectionId}.json`);
      if (response.ok) {
        const data = await response.json();
        setCollectionDetails(data);
        setExpandedCollection(collectionId);
      }
    } catch (err) {
      console.error('Failed to load collection details');
    }
  };

  const handleRevokeShare = async (shareId) => {
    if (!confirm('Are you sure you want to revoke this share?')) return;

    try {
      const response = await fetch(`/shares/${shareId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        }
      });

      if (response.ok) {
        setOutgoingShares(outgoingShares.filter(s => s.id !== shareId));
      }
    } catch (err) {
      console.error('Failed to revoke share');
    }
  };

  const handleUpdatePermission = async (shareId, newPermission) => {
    try {
      const response = await fetch(`/shares/${shareId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({ share: { permission: newPermission } })
      });

      if (response.ok) {
        setOutgoingShares(outgoingShares.map(s =>
          s.id === shareId ? { ...s, permission: newPermission } : s
        ));
      }
    } catch (err) {
      console.error('Failed to update permission');
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Collection': return 'fa-folder';
      case 'Source': return 'fa-book';
      case 'Concept': return 'fa-lightbulb';
      case 'Person': return 'fa-user';
      case 'Note': return 'fa-sticky-note';
      default: return 'fa-file';
    }
  };

  const getItemLink = (type, id) => {
    switch (type) {
      case 'Collection': return `/collections/${id}`;
      case 'Source': return `/sources/${id}`;
      case 'Concept': return `/concepts/${id}`;
      case 'Person': return `/people/${id}`;
      case 'Note': return `/notes/${id}`;
      default: return '#';
    }
  };

  const renderCollections = () => (
    <div>
      {/* Create Form */}
      {showCreateForm ? (
        <form onSubmit={handleCreateCollection} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary, #fafafa)' }}>
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="Collection name"
            autoFocus
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: '4px', marginBottom: '0.5rem' }}
          />
          <textarea
            value={newCollectionDescription}
            onChange={(e) => setNewCollectionDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: '4px', marginBottom: '0.75rem', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={creating || !newCollectionName.trim()} className="btn-primary" style={{ padding: '0.5rem 1rem' }}>
              {creating ? 'Creating...' : 'Create Collection'}
            </button>
            <button type="button" onClick={() => { setShowCreateForm(false); setNewCollectionName(''); setNewCollectionDescription(''); }} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowCreateForm(true)} className="btn-primary" style={{ marginBottom: '1.5rem', padding: '0.5rem 1rem' }}>
          <i className="fas fa-plus" style={{ marginRight: '0.5rem' }}></i> New Collection
        </button>
      )}

      {/* Collections List */}
      {collections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-secondary, #fafafa)', borderRadius: '8px' }}>
          <i className="fas fa-folder-open" style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block' }}></i>
          <div>No collections yet. Create one to organize and share your items.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {collections.map(collection => (
            <div key={collection.id} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <div
                style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: expandedCollection === collection.id ? 'var(--color-bg-secondary, #fafafa)' : 'white' }}
                onClick={() => handleExpandCollection(collection.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className={`fas ${expandedCollection === collection.id ? 'fa-folder-open' : 'fa-folder'}`} style={{ color: 'var(--accent-gold)' }}></i>
                    {collection.name}
                  </div>
                  {collection.description && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                      {collection.description}
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '0.25rem' }}>
                    {collection.items_count || 0} items
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCollection(collection.id); }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                  <i className={`fas fa-chevron-${expandedCollection === collection.id ? 'up' : 'down'}`} style={{ color: 'var(--color-text-secondary)' }}></i>
                </div>
              </div>

              {/* Expanded Collection Details */}
              {expandedCollection === collection.id && collectionDetails && (
                <div style={{ borderTop: '1px solid var(--color-border)', padding: '1rem', backgroundColor: 'white' }}>
                  {['sources', 'concepts', 'people', 'notes'].map(type => {
                    const items = collectionDetails[type] || [];
                    if (items.length === 0) return null;

                    return (
                      <div key={type} style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                          {type}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {items.map(item => (
                            <a
                              key={item.id}
                              href={getItemLink(type.charAt(0).toUpperCase() + type.slice(1, -1), item.id)}
                              style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px', fontSize: '0.875rem', textDecoration: 'none', color: 'var(--color-text-primary)' }}
                            >
                              {item.title || item.label || item.full_name || item.body?.substring(0, 30)}
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {!collectionDetails.sources?.length && !collectionDetails.concepts?.length && !collectionDetails.people?.length && !collectionDetails.notes?.length && (
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                      This collection is empty. Add items from their detail pages.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSharedWithMe = () => {
    const groupedShares = receivedShares.reduce((acc, share) => {
      const type = share.shareable_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(share);
      return acc;
    }, {});

    const typeOrder = ['Collection', 'Source', 'Concept', 'Person', 'Note'];

    return (
      <div>
        {receivedShares.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-secondary, #fafafa)', borderRadius: '8px' }}>
            <i className="fas fa-inbox" style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block' }}></i>
            <div>No items have been shared with you yet.</div>
          </div>
        ) : (
          typeOrder.map(type => {
            const typeShares = groupedShares[type];
            if (!typeShares || typeShares.length === 0) return null;

            return (
              <div key={type} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className={`fas ${getTypeIcon(type)}`}></i>
                  {type === 'Person' ? 'People' : `${type}s`}
                  <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px' }}>
                    {typeShares.length}
                  </span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {typeShares.map(share => (
                    <a
                      key={share.id}
                      href={getItemLink(share.shareable_type, share.shareable_id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', border: '1px solid var(--color-border)', borderRadius: '6px', backgroundColor: 'white', textDecoration: 'none', color: 'inherit' }}
                    >
                      <div>
                        <div style={{ fontWeight: 500 }}>{share.shareable_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                          Shared by {share.email}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px', color: 'var(--color-text-secondary)' }}>
                        {share.permission}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderMyShares = () => {
    const groupedShares = outgoingShares.reduce((acc, share) => {
      const type = share.shareable_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(share);
      return acc;
    }, {});

    const typeOrder = ['Collection', 'Source', 'Concept', 'Person', 'Note'];

    return (
      <div>
        <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          To share an item, go to its detail page and click the Share button.
        </p>

        {outgoingShares.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-secondary, #fafafa)', borderRadius: '8px' }}>
            <i className="fas fa-share" style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block' }}></i>
            <div>You haven't shared anything yet.</div>
          </div>
        ) : (
          typeOrder.map(type => {
            const typeShares = groupedShares[type];
            if (!typeShares || typeShares.length === 0) return null;

            return (
              <div key={type} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className={`fas ${getTypeIcon(type)}`}></i>
                  {type === 'Person' ? 'People' : `${type}s`}
                  <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px' }}>
                    {typeShares.length}
                  </span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {typeShares.map(share => (
                    <div
                      key={share.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', border: '1px solid var(--color-border)', borderRadius: '6px', backgroundColor: 'white' }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{share.shareable_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Shared with {share.email}
                          {share.pending && (
                            <span style={{ padding: '0.125rem 0.375rem', backgroundColor: 'var(--color-warning-bg, #fff3cd)', color: 'var(--color-warning, #856404)', borderRadius: '3px', fontSize: '0.7rem' }}>
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <select
                          value={share.permission}
                          onChange={(e) => handleUpdatePermission(share.id, e.target.value)}
                          style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.875rem' }}
                        >
                          {PERMISSION_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleRevokeShare(share.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-error, #c00)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Sharing</h1>

      {error && (
        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-error-bg, #fee)', color: 'var(--color-error, #c00)', borderRadius: '4px', marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <i className={`fas ${tab.icon}`}></i>
            {tab.label}
            {tab.id === 'collections' && collections.length > 0 && (
              <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px' }}>
                {collections.length}
              </span>
            )}
            {tab.id === 'shared-with-me' && receivedShares.length > 0 && (
              <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px' }}>
                {receivedShares.length}
              </span>
            )}
            {tab.id === 'my-shares' && outgoingShares.length > 0 && (
              <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px' }}>
                {outgoingShares.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'collections' && renderCollections()}
      {activeTab === 'shared-with-me' && renderSharedWithMe()}
      {activeTab === 'my-shares' && renderMyShares()}
    </div>
  );
}
