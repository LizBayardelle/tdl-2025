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
        <div className="bg-sand border-b border-gray-300 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-medium">Color Coding Scheme</h2>
            <button
              onClick={onClose}
              className="text-2xl hover:text-gray-700"
              style={{ background: 'none', color: '#4B5563', padding: 0, border: 'none' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-gray-600">Loading...</p>
          ) : (
            <div className="space-y-3">
              {colors.map(color => (
                <div key={color.id} className="flex items-center gap-3 p-3 border border-gray-300 rounded">
                  {editingId === color.id ? (
                    <>
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-12 h-12 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded"
                        placeholder="Label"
                      />
                      <button
                        onClick={() => handleUpdate(color.id)}
                        className="px-3 py-2 bg-primary text-sand rounded hover:bg-accent-dark text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        className="w-12 h-12 rounded border border-gray-300"
                        style={{ backgroundColor: color.color_hex }}
                      />
                      <span className="flex-1 font-medium">{color.label}</span>
                      <button
                        onClick={() => startEdit(color)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-sand"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(color.id)}
                        className="px-3 py-1 text-sm text-white bg-accent hover:bg-accent-dark rounded"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ))}

              {/* Add new color form */}
              <div className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 rounded bg-gray-50">
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-12 h-12 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="New color label..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded bg-white"
                />
                <button
                  onClick={handleCreate}
                  disabled={!editLabel.trim()}
                  className="px-4 py-2 bg-primary text-sand rounded hover:bg-accent-dark disabled:opacity-50"
                >
                  Add Color
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
