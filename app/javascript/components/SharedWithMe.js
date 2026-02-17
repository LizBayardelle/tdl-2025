import React, { useState, useEffect } from 'react';

export default function SharedWithMe() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReceivedShares();
  }, []);

  const fetchReceivedShares = async () => {
    setLoading(true);
    try {
      const response = await fetch('/shares/received.json');
      if (response.ok) {
        const data = await response.json();
        setShares(data);
      } else {
        setError('Failed to load shares');
      }
    } catch (err) {
      setError('Failed to load shares');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Collection': return '\uD83D\uDCC2';
      case 'Source': return '\uD83D\uDCDA';
      case 'Concept': return '\uD83D\uDCA1';
      case 'Person': return '\uD83D\uDC64';
      case 'Note': return '\uD83D\uDCDD';
      default: return '\uD83D\uDCCE';
    }
  };

  const getItemLink = (share) => {
    switch (share.shareable_type) {
      case 'Collection':
        return `/collections/${share.shareable_id}`;
      case 'Source':
        return `/sources/${share.shareable_id}`;
      case 'Concept':
        return `/concepts/${share.shareable_id}`;
      case 'Person':
        return `/people/${share.shareable_id}`;
      case 'Note':
        return `/notes/${share.shareable_id}`;
      default:
        return '#';
    }
  };

  const formatPermission = (permission) => {
    return permission.charAt(0).toUpperCase() + permission.slice(1);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Loading shared items...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: 'var(--color-error-bg, #fee)',
        color: 'var(--color-error, #c00)',
        borderRadius: '8px',
        margin: '1rem'
      }}>
        {error}
      </div>
    );
  }

  // Group shares by type
  const groupedShares = shares.reduce((acc, share) => {
    const type = share.shareable_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(share);
    return acc;
  }, {});

  const typeOrder = ['Collection', 'Source', 'Concept', 'Person', 'Note'];

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
        Shared With Me
      </h1>

      {shares.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--color-text-secondary)',
          backgroundColor: 'var(--color-bg-secondary, #fafafa)',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>\uD83D\uDCE5</div>
          <div>No items have been shared with you yet.</div>
        </div>
      ) : (
        <div>
          {typeOrder.map(type => {
            const typeShares = groupedShares[type];
            if (!typeShares || typeShares.length === 0) return null;

            return (
              <div key={type} style={{ marginBottom: '2rem' }}>
                <h2 style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>{getTypeIcon(type)}</span>
                  {type === 'Person' ? 'People' : `${type}s`}
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.125rem 0.5rem',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: '10px'
                  }}>
                    {typeShares.length}
                  </span>
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {typeShares.map(share => (
                    <a
                      key={share.id}
                      href={getItemLink(share)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        textDecoration: 'none',
                        color: 'inherit',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-primary)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {share.shareable_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                          Shared by {share.email}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: share.permission === 'collaborator' ? 'var(--color-primary-bg, #e3f2fd)' :
                                          share.permission === 'editor' ? 'var(--color-success-bg, #e8f5e9)' :
                                          'var(--color-bg-secondary)',
                          color: share.permission === 'collaborator' ? 'var(--color-primary)' :
                                share.permission === 'editor' ? 'var(--color-success, #2e7d32)' :
                                'var(--color-text-secondary)',
                          borderRadius: '4px'
                        }}>
                          {formatPermission(share.permission)}
                        </span>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>\u2192</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
