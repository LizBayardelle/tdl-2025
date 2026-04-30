import React, { useState, useEffect } from 'react';

export default function ColorSchemeManager({ isOpen, onClose }) {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('#FFFF00');

  useEffect(() => {
    if (isOpen) {
      fetchColors();
    }
  }, [isOpen]);

  const fetchColors = async () => {
    try {
      const response = await fetch('/highlight_colors.json');
      const data = await response.json();
      setColors(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching colors:', error);
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!editLabel.trim()) return;

    try {
      const response = await fetch('/highlight_colors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          highlight_color: {
            label: editLabel,
            color_hex: editColor.toUpperCase(),
          }
        }),
      });

      if (response.ok) {
        const newColor = await response.json();
        setColors([...colors, newColor]);
        setEditLabel('');
        setEditColor('#FFFF00');
      }
    } catch (error) {
      console.error('Error creating color:', error);
    }
  };

  const handleUpdate = async (id) => {
    if (!editLabel.trim()) return;

    try {
      const response = await fetch(`/highlight_colors/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          highlight_color: {
            label: editLabel,
            color_hex: editColor.toUpperCase(),
          }
        }),
      });

      if (response.ok) {
        const updatedColor = await response.json();
        setColors(colors.map(c => c.id === id ? updatedColor : c));
        setEditingId(null);
        setEditLabel('');
        setEditColor('#FFFF00');
      }
    } catch (error) {
      console.error('Error updating color:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this color scheme?')) return;

    try {
      const response = await fetch(`/highlight_colors/${id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setColors(colors.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Error deleting color:', error);
    }
  };

  const startEdit = (color) => {
    setEditingId(color.id);
    setEditLabel(color.label);
    setEditColor(color.color_hex);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditColor('#FFFF00');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            background: 'var(--paper-soft)',
            borderBottom: '1px solid var(--ink-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
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
            Highlight colors
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ink-3)',
              fontSize: '22px',
              lineHeight: 1,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-body)' }}>Loading.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {colors.map((color) => (
                <div
                  key={color.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    background: 'var(--paper)',
                    border: '1px solid var(--ink-line)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  {editingId === color.id ? (
                    <>
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        style={{
                          width: '44px',
                          height: '36px',
                          padding: 0,
                          border: '1px solid var(--ink-line)',
                          borderRadius: 'var(--r-sm)',
                          cursor: 'pointer',
                          background: 'var(--paper)',
                        }}
                      />
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="sp-input"
                        placeholder="Label"
                        style={{ flex: 1 }}
                      />
                      <button onClick={() => handleUpdate(color.id)} className="sp-action sp-action-primary">
                        Save
                      </button>
                      <button onClick={cancelEdit} className="sp-action sp-action-secondary">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          width: '44px',
                          height: '36px',
                          background: color.color_hex,
                          border: '1px solid var(--ink-line)',
                          borderRadius: 'var(--r-sm)',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontFamily: 'var(--font-body)',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--ink)',
                        }}
                      >
                        {color.label}
                      </span>
                      <button onClick={() => startEdit(color)} className="sp-action sp-action-secondary">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(color.id)} className="sp-action sp-action-quiet sp-action-danger">
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ))}

              {/* Add new color form */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  background: 'var(--paper-soft)',
                  border: '1px dashed var(--ink-line)',
                  borderRadius: 'var(--r-md)',
                }}
              >
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  style={{
                    width: '44px',
                    height: '36px',
                    padding: 0,
                    border: '1px solid var(--ink-line)',
                    borderRadius: 'var(--r-sm)',
                    cursor: 'pointer',
                    background: 'var(--paper)',
                  }}
                />
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="New color label."
                  className="sp-input"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleCreate}
                  disabled={!editLabel.trim()}
                  className="sp-action sp-action-primary"
                >
                  Add color
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
