import React, { useState, useEffect } from 'react';
import Modal from './Modal';

export default function TagFormModal({ isOpen, onClose, onSuccess, item }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#674675'
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setFormData({
          name: item.name || '',
          description: item.description || '',
          color: item.color || '#674675'
        });
      } else {
        setFormData({
          name: '',
          description: '',
          color: '#674675'
        });
      }
      setError('');
    }
  }, [isOpen, item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const url = item ? `/tags/${item.id}` : '/tags';
      const method = item ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ tag: formData }),
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data);
        onClose();
      } else {
        const data = await response.json();
        setError(data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error saving tag:', error);
      setError('An error occurred while saving the tag');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="medium"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden', position: 'relative' }}>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            zIndex: 10,
            background: 'white',
            border: 'none',
            color: 'var(--neutral-500)',
            fontSize: 'var(--text-2xl)',
            cursor: 'pointer',
            padding: 0,
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            boxShadow: 'var(--shadow-md)',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--neutral-100)';
            e.currentTarget.style.color = 'var(--neutral-900)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = 'var(--neutral-500)';
          }}
        >
          ×
        </button>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--background)',
          padding: 'var(--space-6)'
        }}>
          {error && (
            <div style={{
              background: 'var(--accent-purple-light)',
              border: '1px solid var(--accent-purple)',
              color: 'var(--error)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius)',
              marginBottom: 'var(--space-4)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label required">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
              style={{
                width: '100%',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-base)'
              }}
              required
            />
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              className="form-textarea"
              style={{
                width: '100%',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-base)',
                resize: 'vertical'
              }}
              placeholder="What does this tag represent?"
            />
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                style={{
                  width: '60px',
                  height: '40px',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer'
                }}
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="form-input"
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 'var(--text-sm)'
                }}
                placeholder="#674675"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--neutral-200)',
          background: 'var(--background)',
          padding: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-3)',
        }}>
          <button
            type="submit"
            className="btn-primary"
            style={{
              background: 'var(--accent-purple)',
              fontFamily: 'var(--font-body)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-purple) 80%, black)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-purple)'}
          >
            {item ? 'Save Changes' : 'Create Tag'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              color: 'var(--accent-purple)',
              background: 'var(--accent-purple-light)',
              border: '1px solid var(--accent-purple)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-purple)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-purple-light)';
              e.currentTarget.style.color = 'var(--accent-purple)';
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
