import React, { useState, useEffect } from 'react';

export default function PacksIndex() {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPacks();
  }, []);

  const fetchPacks = async () => {
    try {
      const response = await fetch('/packs.json');
      if (response.ok) {
        const data = await response.json();
        setPacks(data);
      } else {
        setError('Failed to load packs');
      }
    } catch (err) {
      setError('Failed to load packs');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (priceCents) => {
    if (priceCents === 0) return 'Free';
    return `$${(priceCents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-600)' }}>Loading packs...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-6) var(--space-8)',
        background: 'color-mix(in srgb, var(--accent-maroon) 15%, white)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{
                fontSize: 'var(--text-4xl)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--accent-maroon)',
                margin: 0,
              }}>Concept Packs</h1>
              <p style={{
                fontSize: 'var(--text-base)',
                color: 'var(--neutral-600)',
                fontFamily: 'var(--font-body)',
                marginTop: 'var(--space-1)',
              }}>
                Pre-built concept collections to accelerate your learning
              </p>
            </div>
            <a
              href="/packs/owned"
              style={{
                background: 'var(--accent-maroon)',
                color: 'white',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: '4px',
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 'var(--text-sm)',
              }}
            >
              My Packs
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 'var(--space-8)', maxWidth: '1200px', margin: '0 auto' }}>
        {error && (
          <div style={{
            padding: 'var(--space-3)',
            backgroundColor: '#fee',
            color: '#c00',
            borderRadius: '4px',
            marginBottom: 'var(--space-4)',
            fontFamily: 'var(--font-body)',
          }}>
            {error}
          </div>
        )}

        {packs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-12)',
            color: 'var(--neutral-500)',
            fontFamily: 'var(--font-body)',
          }}>
            <i className="fas fa-box-open" style={{ fontSize: '3rem', marginBottom: 'var(--space-4)', display: 'block' }}></i>
            No packs available yet
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--space-6)',
          }}>
            {packs.map(pack => (
              <div
                key={pack.id}
                className="card"
                style={{
                  padding: 'var(--space-6)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                    <h2 style={{
                      fontSize: 'var(--text-xl)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-display)',
                      color: 'var(--accent-maroon)',
                      margin: 0,
                    }}>
                      {pack.name}
                    </h2>
                    {pack.owned && (
                      <span style={{
                        background: 'var(--accent-green)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)',
                      }}>
                        Owned
                      </span>
                    )}
                  </div>

                  {pack.description && (
                    <p style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--neutral-600)',
                      fontFamily: 'var(--font-body)',
                      marginBottom: 'var(--space-4)',
                      lineHeight: 1.5,
                    }}>
                      {pack.description}
                    </p>
                  )}

                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--neutral-500)',
                    fontFamily: 'var(--font-body)',
                    marginBottom: 'var(--space-4)',
                  }}>
                    <i className="fas fa-lightbulb" style={{ marginRight: 'var(--space-2)' }}></i>
                    {pack.concept_count} concepts
                  </div>

                  {pack.concepts_preview && pack.concepts_preview.length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--space-1)',
                      marginBottom: 'var(--space-4)',
                    }}>
                      {pack.concepts_preview.map((label, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: 'var(--neutral-100)',
                            color: 'var(--neutral-600)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'var(--font-body)',
                          }}
                        >
                          {label}
                        </span>
                      ))}
                      {pack.concept_count > 5 && (
                        <span style={{
                          color: 'var(--neutral-400)',
                          fontSize: 'var(--text-xs)',
                          fontFamily: 'var(--font-body)',
                          padding: '2px 4px',
                        }}>
                          +{pack.concept_count - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 'var(--space-4)',
                  borderTop: '1px solid var(--neutral-200)',
                }}>
                  <span style={{
                    fontSize: 'var(--text-xl)',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    color: pack.price_cents === 0 ? 'var(--accent-green)' : 'var(--neutral-900)',
                  }}>
                    {formatPrice(pack.price_cents)}
                  </span>

                  <a
                    href={`/packs/${pack.id}`}
                    style={{
                      background: pack.owned ? 'var(--neutral-200)' : 'var(--accent-maroon)',
                      color: pack.owned ? 'var(--neutral-700)' : 'white',
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {pack.owned ? 'View' : 'Learn More'}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
