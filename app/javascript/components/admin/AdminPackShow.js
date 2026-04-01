import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';

export default function AdminPackShow({ packId }) {
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [editingDef, setEditingDef] = useState(null);

  useEffect(() => {
    fetchPack();
  }, [packId]);

  const fetchPack = async () => {
    try {
      const res = await fetch(`/admin/packs/${packId}.json`);
      const data = await res.json();
      setPack(data);
    } catch (err) {
      setError('Failed to load pack');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updates) => {
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/admin/packs/${packId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({ pack: updates })
      });

      if (res.ok) {
        const data = await res.json();
        setPack(prev => ({ ...prev, ...data }));
      } else {
        const data = await res.json();
        setError(data.errors?.join(', ') || 'Failed to update');
      }
    } catch (err) {
      setError('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncStripe = async () => {
    setSyncing(true);
    setError('');

    try {
      const res = await fetch(`/admin/packs/${packId}/sync_stripe`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content }
      });

      if (res.ok) {
        const data = await res.json();
        setPack(prev => ({ ...prev, ...data }));
      } else {
        const data = await res.json();
        setError(data.errors?.join(', ') || 'Failed to sync with Stripe');
      }
    } catch (err) {
      setError('Failed to sync with Stripe');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddDefinition = async (defData) => {
    setSaving(true);

    try {
      const res = await fetch(`/admin/packs/${packId}/concept_definitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({ concept_definition: defData })
      });

      if (res.ok) {
        const newDef = await res.json();
        setPack(prev => ({
          ...prev,
          concept_definitions: [...(prev.concept_definitions || []), newDef]
        }));
        setShowCreateModal(false);
      } else {
        const data = await res.json();
        setError(data.errors?.join(', ') || 'Failed to add concept');
      }
    } catch (err) {
      setError('Failed to add concept');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDefinition = async (defId) => {
    if (!confirm('Remove this concept from the pack?')) return;

    try {
      const res = await fetch(`/admin/packs/${packId}/concept_definitions/${defId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content }
      });

      if (res.ok) {
        setPack(prev => ({
          ...prev,
          concept_definitions: prev.concept_definitions.filter(d => d.id !== defId)
        }));
      }
    } catch (err) {
      setError('Failed to remove concept');
    }
  };

  const handleSearchConcepts = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/admin/packs/${packId}/concept_definitions/search_concepts?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleImportConcept = async (conceptId) => {
    setSaving(true);
    try {
      const res = await fetch(`/admin/packs/${packId}/concept_definitions/import_from_concept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({ concept_id: conceptId })
      });

      if (res.ok) {
        const newDef = await res.json();
        setPack(prev => ({
          ...prev,
          concept_definitions: [...(prev.concept_definitions || []), newDef]
        }));
        setSearchResults(prev => prev.filter(c => c.id !== conceptId));
      } else {
        const data = await res.json();
        setError(data.errors?.join(', ') || 'Failed to import concept');
      }
    } catch (err) {
      setError('Failed to import concept');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDefinition = async (defId, updates) => {
    setSaving(true);
    try {
      const res = await fetch(`/admin/packs/${packId}/concept_definitions/${defId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({ concept_definition: updates })
      });

      if (res.ok) {
        const updatedDef = await res.json();
        setPack(prev => ({
          ...prev,
          concept_definitions: prev.concept_definitions.map(d =>
            d.id === defId ? updatedDef : d
          )
        }));
        setEditingDef(null);
      } else {
        const data = await res.json();
        setError(data.errors?.join(', ') || 'Failed to update');
      }
    } catch (err) {
      setError('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (cents) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const conceptTypes = [
    'research_method', 'measurement', 'intervention', 'pathology', 'emotion',
    'symptom', 'school_of_thought', 'physical_entity', 'physical_process',
    'non_physical_process', 'non_physical_concept'
  ];

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'Inter, -apple-system, sans-serif',
  };

  if (loading) {
    return (
      <AdminLayout currentPage="packs">
        <div style={{ padding: '32px' }}>
          <p style={{ fontFamily: 'Inter, -apple-system, sans-serif', color: '#666' }}>Loading...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!pack) {
    return (
      <AdminLayout currentPage="packs">
        <div style={{ padding: '32px' }}>
          <p style={{ fontFamily: 'Inter, -apple-system, sans-serif', color: '#c00' }}>Pack not found</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="packs">
      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <a
          href="/admin/packs"
          style={{
            color: '#666',
            textDecoration: 'none',
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: '14px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <i className="fas fa-arrow-left"></i>
          Back to Packs
        </a>

        {error && (
          <div style={{
            padding: '12px',
            background: '#fee',
            color: '#c00',
            borderRadius: '4px',
            marginBottom: '16px',
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: '14px',
          }}>
            {error}
            <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, -apple-system, sans-serif' }}>&times;</button>
          </div>
        )}

        {/* Pack Details Card */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          padding: '24px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <h1 style={{
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: 'Inter, -apple-system, sans-serif',
                color: '#111',
                margin: 0,
                wordBreak: 'break-word',
              }}>
                {pack.name}
              </h1>
              <p style={{
                fontSize: '14px',
                color: '#666',
                fontFamily: 'Inter, -apple-system, sans-serif',
                marginTop: '4px',
              }}>
                {pack.concept_definitions?.length || 0} concepts · {pack.purchases_count || 0} purchases
              </p>
            </div>
            <span style={{
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Inter, -apple-system, sans-serif',
              background: pack.published ? '#111' : '#e0e0e0',
              color: pack.published ? 'white' : '#666',
              flexShrink: 0,
            }}>
              {pack.published ? 'Published' : 'Draft'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#666', marginBottom: '4px', fontFamily: 'Inter, -apple-system, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Name
              </label>
              <input
                type="text"
                value={pack.name}
                onChange={(e) => setPack(prev => ({ ...prev, name: e.target.value }))}
                onBlur={() => handleUpdate({ name: pack.name })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#666', marginBottom: '4px', fontFamily: 'Inter, -apple-system, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Price (cents)
              </label>
              <input
                type="number"
                value={pack.price_cents}
                onChange={(e) => setPack(prev => ({ ...prev, price_cents: parseInt(e.target.value) || 0 }))}
                onBlur={() => handleUpdate({ price_cents: pack.price_cents })}
                min="0"
                style={inputStyle}
              />
              <span style={{ fontSize: '12px', color: '#888', fontFamily: 'Inter, -apple-system, sans-serif' }}>
                = {formatPrice(pack.price_cents)}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#666', marginBottom: '4px', fontFamily: 'Inter, -apple-system, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Description
            </label>
            <textarea
              value={pack.description || ''}
              onChange={(e) => setPack(prev => ({ ...prev, description: e.target.value }))}
              onBlur={() => handleUpdate({ description: pack.description })}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Stripe Settings */}
          <div style={{
            background: '#fafafa',
            borderRadius: '4px',
            padding: '16px',
            marginBottom: '16px',
            border: '1px solid #e0e0e0',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}>
              <i className="fab fa-stripe" style={{ fontSize: '20px', color: '#635bff' }}></i>
              <span style={{
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'Inter, -apple-system, sans-serif',
                color: '#333',
              }}>
                Stripe Integration
              </span>
              {pack.stripe_price_id && (
                <span style={{
                  background: '#111',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 500,
                  fontFamily: 'Inter, -apple-system, sans-serif',
                }}>
                  Connected
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#666', marginBottom: '4px', fontFamily: 'Inter, -apple-system, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Product ID
                </label>
                <input
                  type="text"
                  value={pack.stripe_product_id || ''}
                  onChange={(e) => setPack(prev => ({ ...prev, stripe_product_id: e.target.value }))}
                  onBlur={() => handleUpdate({ stripe_product_id: pack.stripe_product_id || null })}
                  placeholder="prod_..."
                  style={{ ...inputStyle, fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#666', marginBottom: '4px', fontFamily: 'Inter, -apple-system, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Price ID
                </label>
                <input
                  type="text"
                  value={pack.stripe_price_id || ''}
                  onChange={(e) => setPack(prev => ({ ...prev, stripe_price_id: e.target.value }))}
                  onBlur={() => handleUpdate({ stripe_price_id: pack.stripe_price_id || null })}
                  placeholder="price_..."
                  style={{ ...inputStyle, fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleSyncStripe}
                disabled={syncing || pack.price_cents === 0}
                style={{
                  background: 'white',
                  color: '#333',
                  border: '1px solid #ccc',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  fontWeight: 500,
                  fontSize: '13px',
                  cursor: syncing || pack.price_cents === 0 ? 'not-allowed' : 'pointer',
                  opacity: pack.price_cents === 0 ? 0.5 : 1,
                }}
              >
                {syncing ? 'Syncing...' : 'Auto-sync to Stripe'}
              </button>
              <span style={{ fontSize: '12px', color: '#888', fontFamily: 'Inter, -apple-system, sans-serif' }}>
                or paste IDs from Stripe Dashboard
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => handleUpdate({ published: !pack.published })}
              disabled={saving}
              style={{
                background: pack.published ? '#e0e0e0' : '#111',
                color: pack.published ? '#333' : 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {pack.published ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>

        {/* Concept Definitions */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              fontFamily: 'Inter, -apple-system, sans-serif',
              color: '#111',
              margin: 0,
            }}>
              Concepts ({pack.concept_definitions?.length || 0})
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowImport(!showImport)}
                style={{
                  background: showImport ? '#333' : 'white',
                  color: showImport ? 'white' : '#333',
                  border: '1px solid #ccc',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-search" style={{ marginRight: '6px' }}></i>
                Import
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  background: '#111',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>
                Create
              </button>
            </div>
          </div>

          {/* Import from existing concepts */}
          {showImport && (
            <div style={{
              background: '#fafafa',
              padding: '16px',
              borderRadius: '4px',
              marginBottom: '16px',
              border: '1px solid #e0e0e0',
            }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '8px', fontFamily: 'Inter, -apple-system, sans-serif', color: '#333' }}>
                Search your concepts
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchConcepts(e.target.value)}
                placeholder="Type to search..."
                style={inputStyle}
              />

              {searching && (
                <p style={{ fontSize: '13px', color: '#888', marginTop: '8px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
                  Searching...
                </p>
              )}

              {searchResults.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {searchResults.map(concept => (
                    <div
                      key={concept.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: 'white',
                        borderRadius: '4px',
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 500, fontFamily: 'Inter, -apple-system, sans-serif', fontSize: '14px', color: '#111' }}>
                            {concept.label}
                          </span>
                          {concept.concept_type && (
                            <span style={{
                              fontSize: '11px',
                              color: '#666',
                              background: '#e0e0e0',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              fontFamily: 'Inter, -apple-system, sans-serif',
                            }}>
                              {concept.concept_type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        {concept.summary && (
                          <p style={{
                            fontSize: '12px',
                            color: '#888',
                            margin: '2px 0 0 0',
                            fontFamily: 'Inter, -apple-system, sans-serif',
                          }}>
                            {concept.summary.substring(0, 80)}{concept.summary.length > 80 ? '...' : ''}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleImportConcept(concept.id)}
                        disabled={saving}
                        style={{
                          background: '#111',
                          color: 'white',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          fontSize: '12px',
                          cursor: saving ? 'not-allowed' : 'pointer',
                          marginLeft: '12px',
                        }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p style={{ fontSize: '13px', color: '#888', marginTop: '8px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
                  No matching concepts found (or already added to pack)
                </p>
              )}
            </div>
          )}

          {/* Concept list */}
          {pack.concept_definitions && pack.concept_definitions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pack.concept_definitions.map(def => (
                <div
                  key={def.id}
                  style={{
                    padding: '12px',
                    background: '#fafafa',
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, fontFamily: 'Inter, -apple-system, sans-serif', fontSize: '14px', color: '#111', wordBreak: 'break-word' }}>{def.label}</span>
                        {def.concept_type && (
                          <span style={{
                            fontSize: '11px',
                            color: '#666',
                            background: '#e0e0e0',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontFamily: 'Inter, -apple-system, sans-serif',
                            whiteSpace: 'nowrap',
                          }}>
                            {def.concept_type.replace(/_/g, ' ')}
                          </span>
                        )}
                        {def.links && def.links.length > 0 && (
                          <span style={{
                            fontSize: '11px',
                            color: '#888',
                            fontFamily: 'Inter, -apple-system, sans-serif',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            whiteSpace: 'nowrap',
                          }}>
                            <i className="fas fa-link" style={{ fontSize: '10px' }}></i>
                            {def.links.length}
                          </span>
                        )}
                      </div>
                      {def.summary && (
                        <p style={{
                          fontSize: '13px',
                          color: '#666',
                          margin: '4px 0 0 0',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                        }}>
                          {def.summary}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                      <button
                        onClick={() => setEditingDef(def)}
                        style={{
                          background: 'white',
                          border: '1px solid #ccc',
                          color: '#333',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        <i className="fas fa-pen"></i>
                      </button>
                      <button
                        onClick={() => handleDeleteDefinition(def.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#999',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                        }}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{
              textAlign: 'center',
              color: '#888',
              fontFamily: 'Inter, -apple-system, sans-serif',
              padding: '24px',
              fontSize: '14px',
            }}>
              No concepts in this pack yet. Add some above.
            </p>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingDef && (
        <ConceptDefinitionModal
          definition={editingDef}
          conceptTypes={conceptTypes}
          onSave={(updates) => handleUpdateDefinition(editingDef.id, updates)}
          onClose={() => setEditingDef(null)}
          saving={saving}
          title="Edit Concept Definition"
          packId={packId}
          onLinksChange={(links) => {
            setPack(prev => ({
              ...prev,
              concept_definitions: prev.concept_definitions.map(d =>
                d.id === editingDef.id ? { ...d, links } : d
              )
            }));
          }}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ConceptDefinitionModal
          definition={{}}
          conceptTypes={conceptTypes}
          onSave={handleAddDefinition}
          onClose={() => setShowCreateModal(false)}
          saving={saving}
          title="Create Concept Definition"
        />
      )}
    </AdminLayout>
  );
}

function ConceptDefinitionModal({ definition, conceptTypes, onSave, onClose, saving, title, packId, onLinksChange }) {
  const [form, setForm] = useState({ ...definition });
  const [links, setLinks] = useState(definition.links || []);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLink, setNewLink] = useState({ name: '', url: '', description: '' });
  const [addingLink, setAddingLink] = useState(false);

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'Inter, -apple-system, sans-serif',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: '#666',
    marginBottom: '4px',
    fontFamily: 'Inter, -apple-system, sans-serif',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const fieldStyle = {
    marginBottom: '16px',
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const handleAddLink = async () => {
    if (!newLink.name || !newLink.url) return;
    setAddingLink(true);

    try {
      const res = await fetch(`/admin/packs/${packId}/concept_definitions/${definition.id}/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({ link: newLink })
      });

      if (res.ok) {
        const link = await res.json();
        const updatedLinks = [...links, link];
        setLinks(updatedLinks);
        onLinksChange?.(updatedLinks);
        setNewLink({ name: '', url: '', description: '' });
        setShowAddLink(false);
      }
    } catch (err) {
      console.error('Failed to add link:', err);
    } finally {
      setAddingLink(false);
    }
  };

  const handleRemoveLink = async (linkId) => {
    try {
      const res = await fetch(`/admin/packs/${packId}/concept_definitions/${definition.id}/links/${linkId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        }
      });

      if (res.ok) {
        const updatedLinks = links.filter(l => l.id !== linkId);
        setLinks(updatedLinks);
        onLinksChange?.(updatedLinks);
      }
    } catch (err) {
      console.error('Failed to remove link:', err);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '800px',
          overflow: 'visible',
          padding: '16px',
          margin: '16px 0',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: '#111',
            margin: 0,
          }}>
            {title || 'Concept Definition'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              color: '#999',
              cursor: 'pointer',
            }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Label *</label>
              <input
                type="text"
                value={form.label || ''}
                onChange={(e) => setForm(prev => ({ ...prev, label: e.target.value }))}
                required
                style={{ ...inputStyle, boxSizing: 'border-box' }}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Type</label>
              <select
                value={form.concept_type || ''}
                onChange={(e) => setForm(prev => ({ ...prev, concept_type: e.target.value }))}
                style={{ ...inputStyle, boxSizing: 'border-box' }}
              >
                <option value="">Select type...</option>
                {conceptTypes.map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Summary</label>
            <textarea
              value={form.summary || ''}
              onChange={(e) => setForm(prev => ({ ...prev, summary: e.target.value }))}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Location</label>
              <input
                type="text"
                value={form.location || ''}
                onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))}
                style={{ ...inputStyle, boxSizing: 'border-box' }}
                placeholder="e.g., brain region, anatomical location"
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Etymology</label>
              <input
                type="text"
                value={form.etymology || ''}
                onChange={(e) => setForm(prev => ({ ...prev, etymology: e.target.value }))}
                style={{ ...inputStyle, boxSizing: 'border-box' }}
                placeholder="Word origin"
              />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Examples</label>
            <textarea
              value={form.examples || ''}
              onChange={(e) => setForm(prev => ({ ...prev, examples: e.target.value }))}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>History</label>
            <textarea
              value={form.history || ''}
              onChange={(e) => setForm(prev => ({ ...prev, history: e.target.value }))}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>School of Thought</label>
              <input
                type="text"
                value={form.school_of_thought || ''}
                onChange={(e) => setForm(prev => ({ ...prev, school_of_thought: e.target.value }))}
                style={{ ...inputStyle, boxSizing: 'border-box' }}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Attribution</label>
              <input
                type="text"
                value={form.attribution || ''}
                onChange={(e) => setForm(prev => ({ ...prev, attribution: e.target.value }))}
                style={{ ...inputStyle, boxSizing: 'border-box' }}
                placeholder="Original source/author"
              />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Clinical Relevance</label>
            <textarea
              value={form.clinical_relevance || ''}
              onChange={(e) => setForm(prev => ({ ...prev, clinical_relevance: e.target.value }))}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Controversy</label>
            <textarea
              value={form.controversy || ''}
              onChange={(e) => setForm(prev => ({ ...prev, controversy: e.target.value }))}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Misconceptions</label>
            <textarea
              value={form.misconceptions || ''}
              onChange={(e) => setForm(prev => ({ ...prev, misconceptions: e.target.value }))}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Mnemonic</label>
            <input
              type="text"
              value={form.mnemonic || ''}
              onChange={(e) => setForm(prev => ({ ...prev, mnemonic: e.target.value }))}
              style={inputStyle}
              placeholder="Memory aid"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Developmental Notes</label>
              <textarea
                value={form.developmental_notes || ''}
                onChange={(e) => setForm(prev => ({ ...prev, developmental_notes: e.target.value }))}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Measurement Notes</label>
              <textarea
                value={form.measurement_notes || ''}
                onChange={(e) => setForm(prev => ({ ...prev, measurement_notes: e.target.value }))}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Links Section - only show for existing definitions */}
          {definition.id && (
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Links ({links.length})</label>
                <button
                  type="button"
                  onClick={() => setShowAddLink(!showAddLink)}
                  style={{
                    background: showAddLink ? '#333' : 'white',
                    color: showAddLink ? 'white' : '#333',
                    border: '1px solid #ccc',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <i className="fas fa-plus" style={{ marginRight: '4px' }}></i>
                  Add Link
                </button>
              </div>

              {showAddLink && (
                <div style={{
                  background: '#fafafa',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '12px',
                  border: '1px solid #e0e0e0',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Link name"
                      value={newLink.name}
                      onChange={(e) => setNewLink(prev => ({ ...prev, name: e.target.value }))}
                      style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px', boxSizing: 'border-box' }}
                    />
                    <input
                      type="url"
                      placeholder="URL"
                      value={newLink.url}
                      onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                      style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newLink.description}
                    onChange={(e) => setNewLink(prev => ({ ...prev, description: e.target.value }))}
                    style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px', marginBottom: '8px', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => { setShowAddLink(false); setNewLink({ name: '', url: '', description: '' }); }}
                      style={{
                        background: '#e0e0e0',
                        color: '#333',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLink}
                      disabled={addingLink || !newLink.name || !newLink.url}
                      style={{
                        background: (addingLink || !newLink.name || !newLink.url) ? '#ccc' : '#111',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        fontSize: '12px',
                        cursor: (addingLink || !newLink.name || !newLink.url) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {addingLink ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              )}

              {links.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {links.map(link => (
                    <div
                      key={link.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#fafafa',
                        borderRadius: '4px',
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="fas fa-link" style={{ color: '#999', fontSize: '12px' }}></i>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#111',
                              textDecoration: 'none',
                              fontWeight: 500,
                              fontSize: '13px',
                              fontFamily: 'Inter, -apple-system, sans-serif',
                            }}
                          >
                            {link.name}
                          </a>
                        </div>
                        {link.description && (
                          <p style={{
                            fontSize: '12px',
                            color: '#888',
                            margin: '2px 0 0 20px',
                            fontFamily: 'Inter, -apple-system, sans-serif',
                          }}>
                            {link.description}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(link.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#999',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                        }}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{
                  fontSize: '13px',
                  color: '#888',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  textAlign: 'center',
                  padding: '12px',
                }}>
                  No links yet
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e0e0e0', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#e0e0e0',
                color: '#333',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: saving ? '#ccc' : '#111',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
