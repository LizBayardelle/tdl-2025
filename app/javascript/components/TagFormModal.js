import React, { useState, useEffect } from 'react';
import Modal from './Modal';

export default function TagFormModal({ isOpen, onClose, onSuccess, item }) {
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (item) {
      setFormData({
        name: item.name || '',
        description: item.description || '',
      });
    } else {
      setFormData({ name: '', description: '' });
    }
    setError('');
  }, [isOpen, item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const url    = item ? `/tags/${item.id}` : '/tags';
      const method = item ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]')?.content,
        },
        body: JSON.stringify({ tag: formData }),
      });
      if (r.ok) {
        const data = await r.json();
        onSuccess(data);
        onClose();
      } else {
        const data = await r.json();
        setError(data.errors?.join(', ') || 'Failed to save tag');
      }
    } catch (e) {
      console.error('Save error:', e);
      setError('An error occurred while saving the tag.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="medium">
      <form onSubmit={handleSubmit} className="tfm">
        <TfmStyles />

        <header className="tfm-head">
          <h2 className="tfm-title">
            {item ? (formData.name || item.name || 'Untitled tag') : 'New tag'}
          </h2>
          <button
            type="button"
            className="tfm-close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <i className="fas fa-times" />
          </button>
        </header>

        <div className="tfm-body">
          {error && (
            <div className="tfm-error" role="alert">
              <i className="fas fa-circle-exclamation" /> {error}
            </div>
          )}

          <Field label="Name" required>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
              placeholder='e.g. "Dissertation Lit Review"'
              autoFocus
              required
            />
          </Field>

          <Field
            label="Description"
            hint="Optional — what this tag represents.  Renders as the project subtitle on /tags."
          >
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="form-textarea"
              placeholder="What is this tag for?"
            />
          </Field>

        </div>

        <footer className="tfm-foot">
          <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="sp-action sp-action-primary tfm-foot-save"
            disabled={submitting || !formData.name.trim()}
          >
            {submitting ? 'Saving…' : (item ? 'Save changes' : 'Create tag')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div className="tfm-field">
      <label className="tfm-label">
        {label}{required && <span className="tfm-req">*</span>}
      </label>
      {children}
      {hint && <p className="tfm-hint">{hint}</p>}
    </div>
  );
}

function TfmStyles() {
  return (
    <style>{`
      .tfm {
        display: flex;
        flex-direction: column;
        max-height: 90vh;
        background: var(--paper);
      }

      /* ---------- Header ---------- */
      .tfm-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        background: var(--primary);
        flex-shrink: 0;
        z-index: 5;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
      }
      .tfm-title {
        margin: 0;
        font-family: var(--font-display);
        font-size: 17px;
        font-weight: 600;
        color: var(--paper);
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tfm-close {
        width: 30px;
        height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.15);
        border: none;
        border-radius: 50%;
        color: var(--paper);
        cursor: pointer;
        font-size: 13px;
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .tfm-close:hover { background: rgba(255, 255, 255, 0.3); }

      /* ---------- Body ---------- */
      .tfm-body {
        flex: 1;
        overflow-y: auto;
        padding: 22px 24px 28px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .tfm-error {
        padding: 10px 14px;
        background: color-mix(in srgb, var(--error) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
        border-radius: var(--r-md);
        color: var(--error);
        font-family: var(--font-body);
        font-size: 13px;
      }
      .tfm-error i { margin-right: 6px; }

      /* ---------- Field ---------- */
      .tfm-field { display: flex; flex-direction: column; gap: 6px; }
      .tfm-label {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--primary);
      }
      .tfm-req { color: var(--error); margin-left: 4px; }
      .tfm-hint {
        margin: 0;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        font-style: italic;
        line-height: 1.5;
      }

      /* ---------- Footer ---------- */
      .tfm-foot {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        padding: 14px 24px;
        border-top: 1px solid var(--ink-line);
        background: var(--paper-soft);
        flex-shrink: 0;
      }
      .tfm-foot-save {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }
      .tfm-foot-save:hover:not(:disabled) {
        background: var(--primary-dark);
        border-color: var(--primary-dark);
      }
    `}</style>
  );
}
