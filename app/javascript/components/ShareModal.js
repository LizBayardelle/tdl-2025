import React, { useState, useEffect } from 'react';
import Modal from './Modal';

const PERMISSION_OPTIONS = [
  { value: 'viewer', label: 'Viewer', description: 'Can view only' },
  { value: 'editor', label: 'Editor', description: 'Can view and edit' },
  { value: 'collaborator', label: 'Collaborator', description: 'Can view, edit, and add items' }
];

export default function ShareModal({ isOpen, onClose, shareable }) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('viewer');
  const [includeSourceNotes, setIncludeSourceNotes] = useState(false);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isCollection = shareable?.type === 'Collection';

  useEffect(() => {
    if (isOpen && shareable) {
      fetchShares();
    }
  }, [isOpen, shareable]);

  const fetchShares = async () => {
    setLoading(true);
    try {
      const response = await fetch('/shares.json');
      if (response.ok) {
        const allShares = await response.json();
        const itemShares = allShares.filter(
          s => s.shareable_type === shareable.type && s.shareable_id === shareable.id
        );
        setShares(itemShares);
      }
    } catch (err) {
      console.error('Failed to fetch shares:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({
          share: {
            email: email.trim(),
            permission,
            shareable_type: shareable.type,
            shareable_id: shareable.id,
            include_source_notes: isCollection ? includeSourceNotes : false
          }
        })
      });

      if (response.ok) {
        const newShare = await response.json();
        setShares([...shares, {
          id: newShare.id,
          email: email.trim(),
          permission: newShare.permission,
          pending: !newShare.recipient_id,
          include_source_notes: newShare.include_source_notes,
          created_at: newShare.created_at
        }]);
        setEmail('');
        setSuccess('Share created successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.errors?.join(', ') || data.error || 'Failed to share');
      }
    } catch (err) {
      setError('Failed to share');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePermission = async (shareId, newPermission) => {
    try {
      const response = await fetch(`/shares/${shareId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({
          share: { permission: newPermission }
        })
      });

      if (response.ok) {
        setShares(shares.map(s =>
          s.id === shareId ? { ...s, permission: newPermission } : s
        ));
      }
    } catch (err) {
      console.error('Failed to update permission:', err);
    }
  };

  const handleToggleSourceNotes = async (shareId, next) => {
    try {
      const response = await fetch(`/shares/${shareId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({
          share: { include_source_notes: next }
        })
      });

      if (response.ok) {
        setShares(shares.map(s =>
          s.id === shareId ? { ...s, include_source_notes: next } : s
        ));
      }
    } catch (err) {
      console.error('Failed to update source-notes setting:', err);
    }
  };

  const handleRevoke = async (shareId) => {
    if (!confirm('Are you sure you want to revoke this share?')) return;

    try {
      const response = await fetch(`/shares/${shareId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        }
      });

      if (response.ok) {
        setShares(shares.filter(s => s.id !== shareId));
      }
    } catch (err) {
      console.error('Failed to revoke share:', err);
    }
  };

  const getItemName = () => {
    switch (shareable?.type) {
      case 'Collection': return shareable.name;
      case 'Source': return shareable.title;
      case 'Concept': return shareable.label;
      case 'Person': return shareable.full_name;
      case 'Note': return shareable.title || 'Note';
      default: return 'Item';
    }
  };

  const getTypeColor = () => {
    switch (shareable?.type) {
      case 'Collection': return 'var(--primary)';
      case 'Source': return 'var(--accent-blue)';
      case 'Concept': return 'var(--accent-green)';
      case 'Person': return 'var(--accent-gold)';
      case 'Note': return 'var(--accent-teal)';
      default: return 'var(--primary)';
    }
  };

  const getTypeIcon = () => {
    switch (shareable?.type) {
      case 'Collection': return 'fa-folder';
      case 'Source': return 'fa-book';
      case 'Concept': return 'fa-lightbulb';
      case 'Person': return 'fa-user';
      case 'Note': return 'fa-sticky-note';
      default: return 'fa-share-alt';
    }
  };

  const themeColor = getTypeColor();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="medium">
      <ShareModalStyles themeColor={themeColor} />

      {/* Header */}
      <div
        style={{
          padding: 'var(--space-4) var(--space-6)',
          background: themeColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <i className={`fas ${getTypeIcon()}`} style={{ fontSize: 'var(--text-base)' }}></i>
          </div>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              color: 'white',
            }}>
              Share {shareable?.type}
            </h2>
            <div style={{
              fontSize: 'var(--text-xs)',
              color: 'rgba(255,255,255,0.8)',
              fontFamily: 'var(--font-body)',
            }}>
              {getItemName()}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--text-lg)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: 'var(--space-6)', overflowY: 'auto' }}>
        {error && (
          <div className="share-alert share-alert--error">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        {success && (
          <div className="share-alert share-alert--success">
            <i className="fas fa-check-circle"></i>
            {success}
          </div>
        )}

        {/* Share Form */}
        <form onSubmit={handleShare} style={{ marginBottom: 'var(--space-6)' }}>
          <label className="share-label">
            Invite by email
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className="share-input"
              style={{ flex: 1 }}
            />
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
              className="share-select"
            >
              {PERMISSION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="share-btn-primary"
              style={{
                opacity: submitting || !email.trim() ? 0.5 : 1,
                cursor: submitting || !email.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? (
                <i className="fas fa-circle-notch fa-spin"></i>
              ) : (
                <><i className="fas fa-paper-plane"></i> Share</>
              )}
            </button>
          </div>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--neutral-500)',
            fontFamily: 'var(--font-body)',
          }}>
            {PERMISSION_OPTIONS.find(o => o.value === permission)?.description}
          </div>

          {isCollection && (
            <label className="share-source-notes-toggle" title="When on, notes attached to any source in this collection are visible too — even if not added to the collection directly.">
              <input
                type="checkbox"
                checked={includeSourceNotes}
                onChange={(e) => setIncludeSourceNotes(e.target.checked)}
              />
              <span>
                <strong>Also share notes from sources in this collection</strong>
                <span className="share-source-notes-hint">
                  Recipients see notes you've taken on any source in the collection.
                </span>
              </span>
            </label>
          )}
        </form>

        {/* Current Shares */}
        <div>
          <label className="share-label">
            <i className="fas fa-users" style={{ marginRight: 'var(--space-2)' }}></i>
            Shared with ({shares.length})
          </label>

          {loading ? (
            <div className="share-empty-state">
              <i className="fas fa-circle-notch fa-spin"></i>
              <span>Loading...</span>
            </div>
          ) : shares.length === 0 ? (
            <div className="share-empty-state">
              <i className="fas fa-user-friends"></i>
              <span>Not shared with anyone yet</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {shares.map(share => (
                <div key={share.id} className="share-item">
                  <div className="share-item-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 500,
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--neutral-800)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}>
                        <i className="fas fa-user-circle" style={{ color: 'var(--neutral-400)' }}></i>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {share.email}
                        </span>
                        {share.pending && (
                          <span className="share-pending-badge">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <select
                        value={share.permission}
                        onChange={(e) => handleUpdatePermission(share.id, e.target.value)}
                        className="share-select share-select--small"
                      >
                        {PERMISSION_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRevoke(share.id)}
                        className="share-btn-danger"
                        title="Revoke access"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  {isCollection && (
                    <label className="share-item-source-notes">
                      <input
                        type="checkbox"
                        checked={!!share.include_source_notes}
                        onChange={(e) => handleToggleSourceNotes(share.id, e.target.checked)}
                      />
                      <span>Also share source notes</span>
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ShareModalStyles({ themeColor }) {
  return (
    <style>{`
      .share-label {
        display: block;
        font-family: var(--font-display);
        font-size: var(--text-xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--neutral-500);
        margin-bottom: var(--space-2);
      }

      .share-input,
      .share-select {
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--neutral-300);
        border-radius: 4px;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
        background: white;
      }

      .share-input:focus,
      .share-select:focus {
        border-color: ${themeColor};
        box-shadow: 0 0 0 3px color-mix(in srgb, ${themeColor} 15%, transparent);
      }

      .share-select--small {
        padding: var(--space-1) var(--space-2);
        font-size: var(--text-xs);
      }

      .share-btn-primary {
        padding: var(--space-2) var(--space-4);
        background: ${themeColor};
        color: white;
        border: none;
        border-radius: 4px;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        transition: opacity 0.15s;
      }

      .share-btn-danger {
        padding: var(--space-1) var(--space-2);
        background: none;
        color: var(--neutral-400);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: color 0.15s, background 0.15s;
      }

      .share-btn-danger:hover {
        color: var(--error);
        background: color-mix(in srgb, var(--error) 10%, transparent);
      }

      .share-alert {
        padding: var(--space-3) var(--space-4);
        border-radius: 4px;
        margin-bottom: var(--space-4);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .share-alert--error {
        background: color-mix(in srgb, var(--error) 10%, white);
        color: var(--error);
      }

      .share-alert--success {
        background: color-mix(in srgb, var(--accent-green) 10%, white);
        color: var(--accent-green);
      }

      .share-empty-state {
        text-align: center;
        padding: var(--space-6);
        color: var(--neutral-400);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        background: var(--neutral-100);
        border-radius: 4px;
      }

      .share-empty-state i {
        font-size: var(--text-xl);
      }

      .share-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-3);
        background: var(--neutral-50);
        border: 1px solid var(--neutral-200);
        border-radius: 4px;
        gap: var(--space-3);
      }

      .share-pending-badge {
        font-size: var(--text-xs);
        padding: 2px 6px;
        background: color-mix(in srgb, var(--accent-gold) 20%, white);
        color: var(--accent-gold);
        border-radius: 3px;
        font-weight: 500;
        flex-shrink: 0;
      }

      .share-source-notes-toggle {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin-top: var(--space-3);
        padding: var(--space-3);
        background: color-mix(in srgb, ${themeColor} 6%, white);
        border: 1px solid color-mix(in srgb, ${themeColor} 25%, transparent);
        border-radius: 4px;
        cursor: pointer;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--neutral-800);
      }
      .share-source-notes-toggle input[type="checkbox"] {
        margin-top: 3px;
        accent-color: ${themeColor};
        cursor: pointer;
      }
      .share-source-notes-toggle > span {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .share-source-notes-hint {
        font-size: var(--text-xs);
        color: var(--neutral-500);
        font-weight: 400;
      }

      .share-item {
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-2);
      }
      .share-item-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .share-item-source-notes {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-body);
        font-size: var(--text-xs);
        color: var(--neutral-600);
        cursor: pointer;
        padding-left: 22px;
      }
      .share-item-source-notes input[type="checkbox"] {
        accent-color: ${themeColor};
        cursor: pointer;
      }
    `}</style>
  );
}
