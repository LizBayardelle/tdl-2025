import React, { useState, useEffect } from 'react';

const ACCENT_GREEN = '#556B2F';
const ACCENT_GREEN_LIGHT = '#e8ebe0';

export default function PacksOwned() {
  const [ownedPacks, setOwnedPacks] = useState([]);
  const [availablePacks, setAvailablePacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPacks();
  }, []);

  const fetchPacks = async () => {
    try {
      const [ownedRes, allRes] = await Promise.all([
        fetch('/packs/owned.json'),
        fetch('/packs.json')
      ]);

      if (ownedRes.ok && allRes.ok) {
        const owned = await ownedRes.json();
        const all = await allRes.json();

        setOwnedPacks(owned);
        // Filter out owned packs to show only available ones
        const ownedIds = new Set(owned.map(p => p.id));
        setAvailablePacks(all.filter(p => !ownedIds.has(p.id)));
      } else {
        setError('Failed to load packs');
      }
    } catch (err) {
      setError('Failed to load packs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPrice = (priceCents) => {
    if (priceCents === 0) return 'Free';
    return `$${(priceCents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%)',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e0e0e0',
          borderTopColor: ACCENT_GREEN,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #111 0%, #333 100%)',
        padding: '64px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 700,
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: 'white',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            My Library
          </h1>
          <p style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.7)',
            fontFamily: 'Inter, -apple-system, sans-serif',
            marginTop: '12px',
          }}>
            {ownedPacks.length === 0
              ? 'Your concept pack collection'
              : `${ownedPacks.length} pack${ownedPacks.length !== 1 ? 's' : ''} in your collection`
            }
          </p>
        </div>
      </div>

      <div style={{ padding: '48px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        {error && (
          <div style={{
            padding: '16px 20px',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            borderRadius: '12px',
            marginBottom: '24px',
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: '14px',
            border: '1px solid #fecaca',
          }}>
            {error}
          </div>
        )}

        {/* Owned Packs Section */}
        {ownedPacks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 32px',
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #e5e5e5',
            marginBottom: '48px',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: ACCENT_GREEN_LIGHT,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <i className="fas fa-box-open" style={{ fontSize: '32px', color: ACCENT_GREEN }}></i>
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 600,
              fontFamily: 'Inter, -apple-system, sans-serif',
              color: '#111',
              margin: '0 0 8px 0',
            }}>
              Your library is empty
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#666',
              fontFamily: 'Inter, -apple-system, sans-serif',
              margin: 0,
            }}>
              Browse packs below to start building your collection
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: 600,
                fontFamily: 'Inter, -apple-system, sans-serif',
                color: '#111',
                margin: '0 0 20px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <i className="fas fa-book" style={{ color: ACCENT_GREEN }}></i>
                Your Packs
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '20px',
              }}>
                {ownedPacks.map(pack => (
                  <div
                    key={pack.id}
                    style={{
                      background: 'white',
                      borderRadius: '16px',
                      border: '1px solid #e5e5e5',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.08)';
                      e.currentTarget.style.borderColor = ACCENT_GREEN;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = '#e5e5e5';
                    }}
                    onClick={() => window.location.href = `/packs/${pack.id}`}
                  >
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: 600,
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        color: '#111',
                        margin: '0 0 12px 0',
                        letterSpacing: '-0.01em',
                      }}>
                        {pack.name}
                      </h3>

                      {pack.description && (
                        <p style={{
                          fontSize: '14px',
                          color: '#666',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          marginBottom: '16px',
                          lineHeight: 1.6,
                        }}>
                          {pack.description}
                        </p>
                      )}

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '14px',
                        color: '#666',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        marginBottom: '12px',
                      }}>
                        <i className="fas fa-cubes" style={{ fontSize: '12px', color: ACCENT_GREEN }}></i>
                        <span>{pack.concept_count} concepts</span>
                      </div>

                      {pack.concepts_preview && pack.concepts_preview.length > 0 && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}>
                          {pack.concepts_preview.slice(0, 3).map((label, idx) => (
                            <span
                              key={idx}
                              style={{
                                background: ACCENT_GREEN_LIGHT,
                                color: ACCENT_GREEN,
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontFamily: 'Inter, -apple-system, sans-serif',
                                fontWeight: 500,
                              }}
                            >
                              {label}
                            </span>
                          ))}
                          {pack.concept_count > 3 && (
                            <span style={{
                              color: '#999',
                              fontSize: '12px',
                              fontFamily: 'Inter, -apple-system, sans-serif',
                              padding: '4px 6px',
                            }}>
                              +{pack.concept_count - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {pack.purchased_at && (
                      <div style={{
                        paddingTop: '16px',
                        marginTop: '16px',
                        borderTop: '1px solid #f0f0f0',
                        fontSize: '12px',
                        color: '#999',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                      }}>
                        Added {formatDate(pack.purchased_at)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Discover More Packs Section */}
        {availablePacks.length > 0 && (
          <div style={{
            marginTop: ownedPacks.length > 0 ? '48px' : '0',
            paddingTop: ownedPacks.length > 0 ? '48px' : '0',
            borderTop: ownedPacks.length > 0 ? '1px solid #e5e5e5' : 'none',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '16px',
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: 600,
                fontFamily: 'Inter, -apple-system, sans-serif',
                color: '#111',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <i className="fas fa-compass" style={{ color: ACCENT_GREEN }}></i>
                Discover More Packs
              </h2>
              <a
                href="/packs"
                style={{
                  color: ACCENT_GREEN,
                  textDecoration: 'none',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                View all packs
                <i className="fas fa-arrow-right" style={{ fontSize: '12px' }}></i>
              </a>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
            }}>
              {availablePacks.slice(0, 3).map(pack => (
                <div
                  key={pack.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    border: '1px solid #e5e5e5',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = '#ccc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = '#e5e5e5';
                  }}
                  onClick={() => window.location.href = `/packs/${pack.id}`}
                >
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      color: '#111',
                      margin: '0 0 8px 0',
                    }}>
                      {pack.name}
                    </h3>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      color: '#888',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      marginBottom: '12px',
                    }}>
                      <i className="fas fa-cubes" style={{ fontSize: '11px', color: ACCENT_GREEN }}></i>
                      <span>{pack.concept_count} concepts</span>
                    </div>

                    {pack.description && (
                      <p style={{
                        fontSize: '14px',
                        color: '#666',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        margin: 0,
                        lineHeight: 1.5,
                      }}>
                        {pack.description.length > 80
                          ? pack.description.substring(0, 80) + '...'
                          : pack.description
                        }
                      </p>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '16px',
                    marginTop: '16px',
                    borderTop: '1px solid #f0f0f0',
                  }}>
                    <span style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      color: pack.price_cents === 0 ? ACCENT_GREEN : '#111',
                    }}>
                      {formatPrice(pack.price_cents)}
                    </span>
                    <span style={{
                      background: ACCENT_GREEN,
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      fontWeight: 500,
                    }}>
                      View Pack
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {availablePacks.length > 3 && (
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <a
                  href="/packs"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'white',
                    color: ACCENT_GREEN,
                    padding: '12px 24px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    border: `1px solid ${ACCENT_GREEN}`,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = ACCENT_GREEN;
                    e.target.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'white';
                    e.target.style.color = ACCENT_GREEN;
                  }}
                >
                  Browse All {availablePacks.length} Available Packs
                  <i className="fas fa-arrow-right"></i>
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
