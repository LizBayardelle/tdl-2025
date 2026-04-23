import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import AdminPageHeader from './AdminPageHeader';

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
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ pack: formData }),
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
        headers: { 'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content },
      });

      if (res.ok) {
        setPacks(packs.filter((p) => p.id !== id));
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
    padding: 'var(--space-2) var(--space-3)',
    border: '1px solid var(--neutral-300)',
    borderRadius: 'var(--radius)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-body)',
    boxSizing: 'border-box',
    background: 'white',
  };

  const actions = (
    <button
      onClick={() => setShowForm(!showForm)}
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'white',
        color: 'var(--neutral-900)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--text-xl)',
        transition: 'all 0.15s',
        boxShadow: 'var(--shadow-md)',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      title="New Pack"
    >
      <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'}`}></i>
    </button>
  );

  return (
    <AdminLayout currentPage="packs">
      <AdminPageHeader title="Packs" subtitle="Manage concept packs and Stripe integration" actions={actions} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)' }}>
        {error && (
          <div
            style={{
              padding: 'var(--space-3)',
              background: 'var(--accent-red-light)',
              color: 'var(--accent-red)',
              borderRadius: 'var(--radius)',
              marginBottom: 'var(--space-4)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {error}
          </div>
        )}

        {showForm && (
          <div
            style={{
              background: 'white',
              padding: 'var(--space-6)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--neutral-200)',
              marginBottom: 'var(--space-6)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--neutral-900)',
                marginTop: 0,
                marginBottom: 'var(--space-4)',
              }}
            >
              Create New Pack
            </h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 'var(--space-1)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--neutral-600)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
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
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 'var(--space-1)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--neutral-600)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 'var(--space-1)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--neutral-600)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
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
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: saving ? 'var(--neutral-300)' : 'var(--neutral-800)',
                    color: 'white',
                    border: 'none',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 'var(--text-sm)',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Creating...' : 'Create Pack'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    background: 'white',
                    color: 'var(--neutral-700)',
                    border: '1px solid var(--neutral-300)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius)',
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-sm)',
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
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-500)' }}>Loading...</p>
        ) : packs.length === 0 ? (
          <div
            style={{
              background: 'white',
              padding: 'var(--space-8)',
              borderRadius: 'var(--radius)',
              textAlign: 'center',
              color: 'var(--neutral-500)',
              fontFamily: 'var(--font-body)',
              border: '1px solid var(--neutral-200)',
            }}
          >
            <i
              className="fas fa-box-open"
              style={{ fontSize: '32px', marginBottom: 'var(--space-3)', display: 'block', color: 'var(--neutral-300)' }}
            ></i>
            No packs yet. Create your first pack above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {packs.map((pack) => (
              <div
                key={pack.id}
                style={{
                  background: 'white',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--neutral-200)',
                  padding: 'var(--space-4)',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-3)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <a
                      href={`/admin/packs/${pack.id}`}
                      style={{
                        fontFamily: 'var(--font-display)',
                        color: 'var(--neutral-900)',
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: 'var(--text-lg)',
                      }}
                    >
                      {pack.name}
                    </a>
                    {pack.description && (
                      <p
                        style={{
                          fontSize: 'var(--text-sm)',
                          color: 'var(--neutral-500)',
                          margin: '4px 0 0 0',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        {pack.description.substring(0, 120)}
                        {pack.description.length > 120 ? '...' : ''}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-display)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      background: pack.published ? 'var(--neutral-800)' : 'var(--neutral-100)',
                      color: pack.published ? 'white' : 'var(--neutral-600)',
                      border: pack.published ? 'none' : '1px solid var(--neutral-300)',
                    }}
                  >
                    {pack.published ? 'Published' : 'Draft'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-4)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--neutral-600)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  <span>
                    <strong style={{ color: 'var(--neutral-900)' }}>{formatPrice(pack.price_cents)}</strong>
                  </span>
                  <span>
                    <i className="fas fa-cubes" style={{ marginRight: '4px', color: 'var(--neutral-400)' }}></i>
                    {pack.concept_definitions_count || 0} concepts
                  </span>
                  <span>
                    <i className="fas fa-shopping-cart" style={{ marginRight: '4px', color: 'var(--neutral-400)' }}></i>
                    {pack.purchases_count || 0} purchases
                  </span>
                  <span>
                    {pack.stripe_price_id ? (
                      <>
                        <i className="fas fa-check-circle" style={{ color: 'var(--neutral-800)', marginRight: '4px' }}></i>
                        Stripe
                      </>
                    ) : (
                      <>
                        <i className="fas fa-exclamation-circle" style={{ color: 'var(--neutral-300)', marginRight: '4px' }}></i>
                        No Stripe
                      </>
                    )}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-4)',
                    paddingTop: 'var(--space-3)',
                    borderTop: '1px solid var(--neutral-100)',
                  }}
                >
                  <a
                    href={`/admin/packs/${pack.id}`}
                    style={{
                      color: 'var(--neutral-900)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)',
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
                      color: 'var(--neutral-500)',
                      cursor: 'pointer',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)',
                      padding: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-red)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--neutral-500)')}
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
