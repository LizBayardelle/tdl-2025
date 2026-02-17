import React, { useState, useEffect } from 'react';
import ShareModal from './ShareModal';

export default function CollectionsIndex() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime] = useState(new Date());

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Expanded collection
  const [expandedId, setExpandedId] = useState(null);
  const [expandedDetails, setExpandedDetails] = useState(null);

  // Share modal
  const [shareCollection, setShareCollection] = useState(null);

  useEffect(() => {
    fetchCollections();
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
        setCollections([newCollection, ...collections]);
        setNewName('');
        setNewDescription('');
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

  const handleDelete = async (id) => {
    if (!confirm('Delete this collection? Items inside will not be deleted.')) return;

    try {
      const response = await fetch(`/collections/${id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content }
      });

      if (response.ok) {
        setCollections(collections.filter(c => c.id !== id));
        if (expandedId === id) {
          setExpandedId(null);
          setExpandedDetails(null);
        }
      }
    } catch (err) {
      setError('Failed to delete collection');
    }
  };

  const handleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetails(null);
      return;
    }

    try {
      const response = await fetch(`/collections/${id}.json`);
      if (response.ok) {
        const data = await response.json();
        setExpandedDetails(data);
        setExpandedId(id);
      }
    } catch (err) {
      console.error('Failed to load collection details');
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
        const refreshResponse = await fetch(`/collections/${collectionId}.json`);
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setExpandedDetails(data);
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

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).toUpperCase();
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (loading) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 64px)',
        background: '#e2e2e2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        color: 'var(--neutral-600)',
        fontSize: 'var(--text-lg)',
        letterSpacing: '0.1em'
      }}>
        LOADING ARCHIVES...
      </div>
    );
  }

  const totalItems = collections.reduce((sum, c) => sum + (c.items_count || 0), 0);

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      background: '#e2e2e2',
    }}>
      <CollectionsStyles />

      <div className="collections-container">
        {/* Header */}
        <div className="collections-header">
          <div className="collections-header-date">
            {collections.length} COLLECTIONS — {totalItems} ITEMS
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 className="collections-header-title">
              Collections
            </h1>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="collections-add-btn"
              >
                <i className="fas fa-plus"></i>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fee', color: '#c00', borderRadius: '4px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {error}
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#c00' }}>&times;</button>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="collections-create-form">
            <div className="collections-create-form-tab">New Collection</div>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Collection name"
                autoFocus
                className="collections-form-input"
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="collections-form-textarea"
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  style={{
                    padding: '0.5rem 1.25rem',
                    backgroundColor: creating || !newName.trim() ? 'var(--neutral-300)' : 'var(--accent-maroon)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 500,
                    cursor: creating || !newName.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setNewName(''); setNewDescription(''); }}
                  style={{
                    padding: '0.5rem 1.25rem',
                    backgroundColor: 'white',
                    color: 'var(--accent-maroon)',
                    border: '2px solid var(--accent-maroon)',
                    borderRadius: '4px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Collections List */}
        {collections.length === 0 ? (
          <div className="collections-empty">
            <i className="fas fa-folder-open" style={{ fontSize: '3rem', color: 'var(--accent-maroon)', marginBottom: '1rem', display: 'block' }}></i>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--neutral-700)', fontFamily: 'var(--font-display)' }}>No Collections Yet</h2>
            <p style={{ color: 'var(--neutral-500)', marginBottom: '1.5rem', fontFamily: 'var(--font-body)' }}>
              Create collections to organize and share your research.
            </p>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: 'var(--accent-maroon)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)'
                }}
              >
                Create Your First Collection
              </button>
            )}
          </div>
        ) : (
          <div className="collections-grid">
            {collections.map(collection => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                isExpanded={expandedId === collection.id}
                expandedDetails={expandedId === collection.id ? expandedDetails : null}
                onExpand={() => handleExpand(collection.id)}
                onDelete={() => handleDelete(collection.id)}
                onShare={() => setShareCollection({ id: collection.id, name: collection.name, type: 'Collection' })}
                onRemoveItem={handleRemoveItem}
                getItemLink={getItemLink}
                getTypeIcon={getTypeIcon}
                getTypeColor={getTypeColor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareCollection && (
        <ShareModal
          isOpen={!!shareCollection}
          onClose={() => setShareCollection(null)}
          shareable={shareCollection}
        />
      )}
    </div>
  );
}

function CollectionCard({ collection, isExpanded, expandedDetails, onExpand, onDelete, onShare, onRemoveItem, getItemLink, getTypeIcon, getTypeColor }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="collection-card-wrapper"
      style={{
        transform: isHovered && !isExpanded ? 'translateY(-4px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Folder Tab */}
      <div className="collection-card-tab">
        {collection.items_count || 0} items
      </div>

      {/* Card Body */}
      <div
        className="collection-card"
        style={{
          boxShadow: isHovered || isExpanded
            ? '0 8px 24px rgba(0,0,0,0.18), 2px 2px 0 rgba(0,0,0,0.05)'
            : '0 2px 8px rgba(0,0,0,0.1), 2px 2px 0 rgba(0,0,0,0.03)',
        }}
      >
        {/* Header */}
        <div
          onClick={onExpand}
          style={{
            padding: '1rem 1.25rem',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: 600,
              fontSize: 'var(--text-lg)',
              fontFamily: 'var(--font-display)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--neutral-800)',
              marginBottom: '0.25rem'
            }}>
              <i className={`fas ${isExpanded ? 'fa-folder-open' : 'fa-folder'}`} style={{ color: 'var(--accent-maroon)' }}></i>
              {collection.name}
            </div>
            {collection.description && (
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-500)', fontFamily: 'var(--font-body)' }}>
                {collection.description}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '1rem' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              title="Share collection"
              className="collection-icon-btn"
            >
              <i className="fas fa-share-alt"></i>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Delete collection"
              className="collection-icon-btn collection-icon-btn--danger"
            >
              <i className="fas fa-trash"></i>
            </button>
            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`} style={{ color: 'var(--accent-maroon)', marginLeft: '0.5rem', fontSize: 'var(--text-sm)' }}></i>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && expandedDetails && (
          <div style={{ borderTop: '1px solid var(--neutral-200)', padding: '1.25rem', background: 'white' }}>
            {['sources', 'concepts', 'people', 'notes'].map(type => {
              const items = expandedDetails[type] || [];
              if (items.length === 0) return null;

              const singularType = type === 'people' ? 'Person' : type.charAt(0).toUpperCase() + type.slice(1, -1);

              return (
                <div key={type} style={{ marginBottom: '1.25rem' }}>
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: getTypeColor(type),
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontFamily: 'var(--font-display)'
                  }}>
                    <i className={`fas ${getTypeIcon(type)}`}></i>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {items.map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.375rem 0.625rem',
                          backgroundColor: 'var(--neutral-100)',
                          borderRadius: '4px',
                          fontSize: 'var(--text-sm)',
                          fontFamily: 'var(--font-body)'
                        }}
                      >
                        <a
                          href={getItemLink(type, item.id)}
                          style={{ color: 'var(--neutral-700)', textDecoration: 'none' }}
                        >
                          {item.title || item.label || item.full_name || item.body?.substring(0, 40)}
                        </a>
                        <button
                          onClick={() => onRemoveItem(collection.id, singularType, item.id)}
                          title="Remove from collection"
                          style={{ background: 'none', border: 'none', color: 'var(--neutral-400)', cursor: 'pointer', padding: '0', fontSize: '0.75rem' }}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {!expandedDetails.sources?.length && !expandedDetails.concepts?.length && !expandedDetails.people?.length && !expandedDetails.notes?.length && (
              <div style={{ color: 'var(--neutral-500)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '1rem', fontFamily: 'var(--font-body)' }}>
                <i className="fas fa-inbox" style={{ display: 'block', fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--neutral-400)' }}></i>
                This collection is empty. Add items from their detail pages.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CollectionsStyles = () => (
  <style>{`
    .collections-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 32px;
    }

    .collections-header {
      margin-bottom: 32px;
    }

    .collections-header-date {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      letter-spacing: 0.2em;
      color: var(--neutral-500);
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .collections-header-title {
      font-size: var(--text-5xl);
      font-weight: 700;
      font-family: var(--font-display);
      color: var(--neutral-800);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .collections-add-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--accent-maroon);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-xl);
      transition: all 0.15s;
      box-shadow: var(--shadow-md);
    }

    .collections-add-btn:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }

    .collections-create-form {
      position: relative;
      margin-bottom: 32px;
      padding: 24px;
      padding-top: 32px;
      background: color-mix(in srgb, var(--accent-maroon) 15%, white);
      border: 1px solid var(--neutral-300);
      border-top: 5px solid var(--accent-maroon);
      border-radius: 0 4px 4px 4px;
    }

    .collections-create-form-tab {
      position: absolute;
      top: -22px;
      left: 12px;
      background: var(--accent-maroon);
      color: white;
      padding: 4px 12px 6px;
      font-family: var(--font-display);
      font-size: var(--text-xs);
      letter-spacing: 0.1em;
      border-radius: 3px 3px 0 0;
    }

    .collections-form-input,
    .collections-form-textarea {
      width: 100%;
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--neutral-300);
      border-radius: 4px;
      font-family: var(--font-body);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .collections-form-input {
      font-size: 1rem;
      margin-bottom: 0.75rem;
    }

    .collections-form-textarea {
      font-size: 0.9375rem;
      margin-bottom: 1rem;
      resize: vertical;
    }

    .collections-form-input:focus,
    .collections-form-textarea:focus {
      border-color: var(--accent-maroon);
      box-shadow: 0 0 0 3px rgba(128, 0, 32, 0.15);
    }

    .collections-empty {
      text-align: center;
      padding: 4rem 2rem;
      background: white;
      border-radius: 4px;
      border: 1px solid var(--neutral-300);
    }

    .collections-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 32px;
      padding-top: 24px;
    }

    .collection-card-wrapper {
      position: relative;
      transition: transform 0.2s;
    }

    .collection-card-tab {
      position: absolute;
      top: -18px;
      left: 12px;
      background: var(--accent-maroon);
      color: white;
      padding: 4px 12px 6px;
      font-family: var(--font-display);
      font-size: var(--text-xs);
      letter-spacing: 0.1em;
      border-radius: 3px 3px 0 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      z-index: 2;
    }

    .collection-card {
      background: white;
      border: 1px solid var(--neutral-300);
      border-top: 5px solid var(--accent-maroon);
      border-radius: 0 4px 4px 4px;
      overflow: hidden;
      transition: box-shadow 0.2s;
      position: relative;
      z-index: 1;
    }

    .collection-icon-btn {
      background: none;
      border: none;
      color: var(--accent-maroon);
      cursor: pointer;
      padding: 0.375rem 0.5rem;
      border-radius: 4px;
      transition: background 0.15s;
    }

    .collection-icon-btn:hover {
      background: rgba(0,0,0,0.05);
    }

    .collection-icon-btn--danger {
      color: var(--neutral-400);
    }

    .collection-icon-btn--danger:hover {
      color: var(--error);
    }

    /* Mobile breakpoint */
    @media (max-width: 768px) {
      .collections-container {
        padding: 16px;
      }

      .collections-status-bar {
        padding: 8px 16px;
        font-size: 10px;
        gap: 16px;
      }

      .collections-header-title {
        font-size: var(--text-3xl);
      }

      .collections-header-date {
        font-size: 10px;
      }

      .collections-grid {
        gap: 28px;
      }

      .collections-add-btn {
        width: 40px;
        height: 40px;
        font-size: var(--text-base);
      }
    }
  `}</style>
);
