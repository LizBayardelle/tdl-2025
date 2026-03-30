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
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'Inter, -apple-system, sans-serif',
  };

  return (
    <AdminLayout currentPage="packs">
      <div style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: '#111',
          }}>
            Packs
          </h1>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: '#111',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
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
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            marginBottom: '24px',
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
                <label style={{ display: 'block', marginBottom: '4px', fontFamily: 'Inter, -apple-system, sans-serif', fontSize: '14px', fontWeight: 500, color: '#333' }}>
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
                <label style={{ display: 'block', marginBottom: '4px', fontFamily: 'Inter, -apple-system, sans-serif', fontSize: '14px', fontWeight: 500, color: '#333' }}>
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
                <label style={{ display: 'block', marginBottom: '4px', fontFamily: 'Inter, -apple-system, sans-serif', fontSize: '14px', fontWeight: 500, color: '#333' }}>
                  Price (cents, 0 = free)
                </label>
                <input
                  type="number"
                  value={formData.price_cents}
                  onChange={(e) => setFormData({ ...formData, price_cents: parseInt(e.target.value) || 0 })}
                  min="0"
                  style={{ ...inputStyle, width: '150px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: saving ? '#ccc' : '#111',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
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
                    padding: '8px 16px',
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
          <div style={{
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, -apple-system, sans-serif' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Concepts</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Purchases</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stripe</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {packs.map(pack => (
                  <tr key={pack.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <a
                        href={`/admin/packs/${pack.id}`}
                        style={{
                          color: '#111',
                          textDecoration: 'none',
                          fontWeight: 500,
                          fontSize: '14px',
                        }}
                      >
                        {pack.name}
                      </a>
                      {pack.description && (
                        <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 0 0' }}>
                          {pack.description.substring(0, 60)}{pack.description.length > 60 ? '...' : ''}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#333' }}>
                      {formatPrice(pack.price_cents)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
                      {pack.concept_definitions_count || 0}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
                      {pack.purchases_count || 0}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: pack.published ? '#111' : '#e0e0e0',
                        color: pack.published ? 'white' : '#666',
                      }}>
                        {pack.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {pack.stripe_price_id ? (
                        <i className="fas fa-check-circle" style={{ color: '#333' }} title="Synced"></i>
                      ) : (
                        <i className="fas fa-exclamation-circle" style={{ color: '#ccc' }} title="Not synced"></i>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <a
                        href={`/admin/packs/${pack.id}`}
                        style={{
                          color: '#666',
                          marginRight: '12px',
                          fontSize: '14px',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          textDecoration: 'none',
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
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
