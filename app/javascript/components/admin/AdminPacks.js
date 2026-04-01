import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';

export default function AdminPacks() {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', price_cents: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPacks();
  }, []);

  const fetchPacks = async () => {
    try {
      const res = await fetch('/admin/packs.json');
      const data = await res.json();
      setPacks(data);
    } catch (err) {
      setError('Failed to load packs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/admin/packs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({ pack: formData })
      });

      if (res.ok) {
        const newPack = await res.json();
        setPacks([{ ...newPack, concept_definitions_count: 0, purchases_count: 0 }, ...packs]);
        setFormData({ name: '', description: '', price_cents: 0 });
        setShowForm(false);
      } else {
        const data = await res.json();
        setError(data.errors?.join(', ') || 'Failed to create pack');
      }
    } catch (err) {
      setError('Failed to create pack');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this pack? This cannot be undone.')) return;

    try {
      const res = await fetch(`/admin/packs/${id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content }
      });

      if (res.ok) {
        setPacks(packs.filter(p => p.id !== id));
      } else {
        const data = await res.json();
        alert(data.errors?.join(', ') || 'Failed to delete');
      }
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const formatPrice = (cents) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '16px',
    fontFamily: 'Inter, -apple-system, sans-serif',
    boxSizing: 'border-box',
  };

  return (
    <AdminLayout currentPage="packs">
      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: '#111',
            margin: 0,
          }}>
            Packs
          </h1>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: '#111',
              color: 'white',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '4px',
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontWeight: 500,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="fas fa-plus"></i>
            New Pack
          </button>
        </div>

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
          </div>
        )}

        {showForm && (
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            marginBottom: '20px',
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              fontFamily: 'Inter, -apple-system, sans-serif',
              marginBottom: '16px',
              color: '#111',
            }}>
              Create New Pack
            </h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontFamily: 'Inter, -apple-system, sans-serif', fontSize: '14px', fontWeight: 500, color: '#333' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontFamily: 'Inter, -apple-system, sans-serif', fontSize: '14px', fontWeight: 500, color: '#333' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontFamily: 'Inter, -apple-system, sans-serif', fontSize: '14px', fontWeight: 500, color: '#333' }}>
                  Price (cents, 0 = free)
                </label>
                <input
                  type="number"
                  value={formData.price_cents}
                  onChange={(e) => setFormData({ ...formData, price_cents: parseInt(e.target.value) || 0 })}
                  min="0"
                  style={{ ...inputStyle, maxWidth: '150px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                  {saving ? 'Creating...' : 'Create Pack'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p style={{ fontFamily: 'Inter, -apple-system, sans-serif', color: '#666' }}>Loading...</p>
        ) : packs.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '32px',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#666',
            fontFamily: 'Inter, -apple-system, sans-serif',
            border: '1px solid #e0e0e0',
          }}>
            <i className="fas fa-box-open" style={{ fontSize: '32px', marginBottom: '12px', display: 'block', color: '#999' }}></i>
            No packs yet. Create your first pack above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {packs.map(pack => (
              <div
                key={pack.id}
                style={{
                  background: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  padding: '16px',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <a
                      href={`/admin/packs/${pack.id}`}
                      style={{
                        color: '#111',
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: '16px',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                      }}
                    >
                      {pack.name}
                    </a>
                    {pack.description && (
                      <p style={{
                        fontSize: '13px',
                        color: '#888',
                        margin: '4px 0 0 0',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                      }}>
                        {pack.description.substring(0, 80)}{pack.description.length > 80 ? '...' : ''}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      background: pack.published ? '#111' : '#e0e0e0',
                      color: pack.published ? 'white' : '#666',
                    }}>
                      {pack.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px',
                  fontSize: '13px',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  color: '#666',
                  marginBottom: '12px',
                }}>
                  <span>
                    <strong style={{ color: '#333' }}>{formatPrice(pack.price_cents)}</strong>
                  </span>
                  <span>
                    <i className="fas fa-cubes" style={{ marginRight: '4px', color: '#999' }}></i>
                    {pack.concept_definitions_count || 0} concepts
                  </span>
                  <span>
                    <i className="fas fa-shopping-cart" style={{ marginRight: '4px', color: '#999' }}></i>
                    {pack.purchases_count || 0} purchases
                  </span>
                  <span>
                    {pack.stripe_price_id ? (
                      <><i className="fas fa-check-circle" style={{ color: '#333', marginRight: '4px' }}></i>Stripe</>
                    ) : (
                      <><i className="fas fa-exclamation-circle" style={{ color: '#ccc', marginRight: '4px' }}></i>No Stripe</>
                    )}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f0f0f0',
                }}>
                  <a
                    href={`/admin/packs/${pack.id}`}
                    style={{
                      color: '#111',
                      fontSize: '14px',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    Edit
                  </a>
                  <button
                    onClick={() => handleDelete(pack.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#999',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      padding: 0,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
