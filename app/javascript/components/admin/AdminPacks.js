import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import AdminPageHeader from './AdminPageHeader';

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

const labelStyle = {
  display: 'block',
  marginBottom: 'var(--space-1)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--neutral-600)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export default function AdminPacks() {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftsOpen, setDraftsOpen] = useState(true);

  useEffect(() => {
    fetchPacks();
  }, []);

  const fetchPacks = async () => {
    try {
      const res = await fetch('/admin/packs.json');
      const data = await res.json();
      setPacks(data);
    } catch {
      setError('Failed to load packs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreated = (newPack) => {
    setPacks([{ ...newPack, concept_definitions_count: 0, purchases_count: 0 }, ...packs]);
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
    } catch {
      alert('Failed to delete');
    }
  };

  const published = packs.filter((p) => p.published);
  const drafts = packs.filter((p) => !p.published);

  return (
    <AdminLayout currentPage="packs">
      <AdminPageHeader title="Packs" subtitle="Bundle concepts for sale, manage Stripe, publish and draft." />

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))' }}>
        {error && <Banner>{error}</Banner>}

        <InlineCreator onCreated={handleCreated} />

        <Section title="Published" count={published.length} emptyText="Nothing live yet." emphasize>
          {published.map((p) => (
            <PackRow key={p.id} pack={p} onDelete={handleDelete} emphasize />
          ))}
        </Section>

        <Section
          title="Drafts"
          count={drafts.length}
          emptyText="No drafts in the works."
          collapsible
          open={draftsOpen}
          onToggle={() => setDraftsOpen((o) => !o)}
        >
          {draftsOpen && drafts.map((p) => <PackRow key={p.id} pack={p} onDelete={handleDelete} muted />)}
        </Section>

        {loading && packs.length === 0 && (
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-500)', marginTop: 'var(--space-4)' }}>
            Loading…
          </p>
        )}
      </div>
    </AdminLayout>
  );
}

function Section({ title, count, emptyText, children, emphasize, collapsible, open, onToggle }) {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      <div
        onClick={collapsible ? onToggle : undefined}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--space-2)',
          paddingBottom: 'var(--space-2)',
          borderBottom: `1px solid ${emphasize ? 'var(--admin-brown)' : 'var(--neutral-200)'}`,
          marginBottom: 'var(--space-3)',
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {collapsible && (
          <i
            className={`fas fa-chevron-${open ? 'down' : 'right'}`}
            style={{ fontSize: '11px', color: 'var(--neutral-500)', width: '12px' }}
          ></i>
        )}
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: emphasize ? 'var(--admin-brown-dark)' : 'var(--neutral-700)',
          }}
        >
          {title}
        </h2>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--neutral-500)', fontWeight: 500 }}>
          {count}
        </span>
      </div>

      {(!collapsible || open) && !hasChildren && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--neutral-500)', padding: 'var(--space-3) var(--space-2)' }}>
          {emptyText}
        </div>
      )}

      {hasChildren && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>{children}</div>
      )}
    </div>
  );
}

function PackRow({ pack, emphasize, muted, onDelete }) {
  const formatPrice = (cents) => (cents === 0 ? 'Free' : `$${(cents / 100).toFixed(2)}`);

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(pack.id);
  };

  return (
    <a
      href={`/admin/packs/${pack.id}`}
      style={{
        background: 'white',
        borderRadius: 'var(--radius)',
        border: `1px solid ${emphasize ? 'var(--admin-brown)' : 'var(--neutral-200)'}`,
        padding: 'var(--space-4) var(--space-5)',
        textDecoration: 'none',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        opacity: muted ? 0.85 : 1,
        display: 'block',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = emphasize ? 'var(--admin-brown-dark)' : 'var(--neutral-300)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = emphasize ? 'var(--admin-brown)' : 'var(--neutral-200)';
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--neutral-900)',
              fontWeight: 600,
              fontSize: 'var(--text-lg)',
            }}
          >
            {pack.name}
          </div>
          {pack.description && (
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-500)',
                margin: '4px 0 0 0',
                fontFamily: 'var(--font-body)',
                lineHeight: 1.4,
              }}
            >
              {pack.description.length > 140 ? pack.description.substring(0, 140) + '…' : pack.description}
            </p>
          )}
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: pack.published ? 'var(--admin-brown-dark)' : 'var(--neutral-100)',
            color: pack.published ? 'white' : 'var(--neutral-600)',
            border: pack.published ? 'none' : '1px solid var(--neutral-300)',
            whiteSpace: 'nowrap',
          }}
        >
          {pack.published ? 'Published' : 'Draft'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space-5)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-body)',
          color: 'var(--neutral-600)',
        }}
      >
        <Stat icon="fa-tag" label={formatPrice(pack.price_cents)} emphasize />
        <Stat icon="fa-cubes" label={`${pack.concept_definitions_count || 0} concepts`} />
        <Stat icon="fa-shopping-cart" label={`${pack.purchases_count || 0} purchases`} />
        {pack.stripe_price_id ? (
          <Stat icon="fa-check-circle" label="Stripe connected" tone="brown" />
        ) : (
          <Stat icon="fa-circle-exclamation" label="No Stripe" tone="muted" />
        )}

        <button
          onClick={handleDelete}
          title="Delete pack"
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: 'var(--neutral-400)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 'var(--radius)',
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--neutral-900)';
            e.currentTarget.style.background = 'var(--neutral-100)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--neutral-400)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <i className="fas fa-trash"></i>
        </button>
      </div>
    </a>
  );
}

function Stat({ icon, label, emphasize, tone }) {
  const color = tone === 'muted'
    ? 'var(--neutral-400)'
    : tone === 'brown'
    ? 'var(--admin-brown-dark)'
    : 'var(--neutral-400)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
      <i className={`fas ${icon}`} style={{ color, fontSize: '12px' }}></i>
      <span style={{ color: emphasize ? 'var(--neutral-900)' : 'var(--neutral-700)', fontWeight: emphasize ? 600 : 400 }}>
        {label}
      </span>
    </span>
  );
}

function InlineCreator({ onCreated }) {
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', price_cents: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setFormData({ name: '', description: '', price_cents: 0 });
    setError('');
    setExpanded(false);
  };

  const submit = async (e) => {
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
        onCreated(newPack);
        reset();
      } else {
        const data = await res.json();
        setError(data.errors?.join(', ') || 'Failed to create pack');
      }
    } catch {
      setError('Failed to create pack');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--admin-brown-light)',
            border: '1px dashed var(--admin-brown)',
            borderRadius: 'var(--radius)',
            color: 'var(--admin-brown-dark)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <i className="fas fa-plus"></i>
          New pack…
        </button>
      ) : (
        <form onSubmit={submit}>
          {error && <Banner>{error}</Banner>}

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={labelStyle}>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Neuroanatomy Essentials"
              style={inputStyle}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="What's this pack about?"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={labelStyle}>Price (cents · 0 = free)</label>
            <input
              type="number"
              value={formData.price_cents}
              onChange={(e) => setFormData({ ...formData, price_cents: parseInt(e.target.value) || 0 })}
              min="0"
              style={{ ...inputStyle, maxWidth: '180px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <button
              type="submit"
              disabled={saving || !formData.name.trim()}
              style={{
                background: saving || !formData.name.trim() ? 'var(--neutral-300)' : 'var(--admin-brown-dark)',
                color: 'white',
                border: 'none',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 'var(--text-sm)',
                cursor: saving || !formData.name.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Creating…' : 'Create pack'}
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                background: 'white',
                color: 'var(--neutral-700)',
                border: '1px solid var(--neutral-300)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--neutral-500)', marginLeft: 'var(--space-2)' }}>
              Packs start as drafts. Publish from inside the pack.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}

function Banner({ children }) {
  return (
    <div
      style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--neutral-900)',
        color: 'white',
        borderRadius: 'var(--radius)',
        marginBottom: 'var(--space-4)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
      }}
    >
      {children}
    </div>
  );
}
