import React, { useState, useEffect } from 'react';

const ACCENT_GREEN = '#556B2F';
const ACCENT_GREEN_LIGHT = '#e8ebe0';

export default function PacksIndex() {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'owned', 'available'

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

  const filteredPacks = packs.filter(pack => {
    if (filter === 'owned') return pack.owned;
    if (filter === 'available') return !pack.owned;
    return true;
  });

  const ownedCount = packs.filter(p => p.owned).length;
  const availableCount = packs.filter(p => !p.owned).length;

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
      {/* Hero Header */}
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
            Concept Packs
          </h1>
          <p style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.7)',
            fontFamily: 'Inter, -apple-system, sans-serif',
            marginTop: '12px',
            maxWidth: '500px',
            lineHeight: 1.5,
          }}>
            {ownedCount > 0
              ? `You own ${ownedCount} pack${ownedCount !== 1 ? 's' : ''}. Browse ${availableCount} more available.`
              : 'Curated collections of research concepts to accelerate your learning'
            }
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e5e5e5',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 32px',
          display: 'flex',
          gap: '0',
        }}>
          {[
            { key: 'all', label: 'All Packs', count: packs.length },
            { key: 'owned', label: 'My Library', count: ownedCount, icon: 'fa-unlock' },
            { key: 'available', label: 'Available', count: availableCount, icon: 'fa-lock' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                padding: '16px 24px',
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: filter === tab.key ? ACCENT_GREEN : '#666',
                cursor: 'pointer',
                borderBottom: filter === tab.key ? `2px solid ${ACCENT_GREEN}` : '2px solid transparent',
                marginBottom: '-1px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              {tab.icon && <i className={`fas ${tab.icon}`} style={{ fontSize: '12px' }}></i>}
              {tab.label}
              <span style={{
                background: filter === tab.key ? ACCENT_GREEN_LIGHT : '#f0f0f0',
                color: filter === tab.key ? ACCENT_GREEN : '#888',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
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

        {filteredPacks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 32px',
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #e5e5e5',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: '#f5f5f5',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <i className={`fas ${filter === 'owned' ? 'fa-box-open' : 'fa-check-circle'}`} style={{ fontSize: '32px', color: '#999' }}></i>
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 600,
              fontFamily: 'Inter, -apple-system, sans-serif',
              color: '#111',
              margin: '0 0 8px 0',
            }}>
              {filter === 'owned' ? 'No packs yet' : 'All caught up!'}
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#666',
              fontFamily: 'Inter, -apple-system, sans-serif',
              margin: 0,
            }}>
              {filter === 'owned'
                ? 'Browse available packs to start your collection'
                : 'You own all available packs'
              }
            </p>
            {filter === 'owned' && availableCount > 0 && (
              <button
                onClick={() => setFilter('available')}
                style={{
                  marginTop: '24px',
                  background: ACCENT_GREEN,
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Browse Available Packs
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '24px',
          }}>
            {filteredPacks.map(pack => (
              <PackCard key={pack.id} pack={pack} formatPrice={formatPrice} />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PackCard({ pack, formatPrice }) {
  const isOwned = pack.owned;

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        border: `1px solid ${isOwned ? ACCENT_GREEN : '#e5e5e5'}`,
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      onClick={() => window.location.href = `/packs/${pack.id}`}
    >
      {/* Status Banner */}
      <div style={{
        background: isOwned ? ACCENT_GREEN : '#f5f5f5',
        color: isOwned ? 'white' : '#666',
        padding: '8px 20px',
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: 'Inter, -apple-system, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        <i className={`fas ${isOwned ? 'fa-unlock' : 'fa-lock'}`} style={{ fontSize: '10px' }}></i>
        {isOwned ? 'In Your Library' : 'Available'}
      </div>

      <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{
            fontSize: '22px',
            fontWeight: 600,
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: '#111',
            margin: '0 0 12px 0',
            letterSpacing: '-0.01em',
          }}>
            {pack.name}
          </h2>

          {pack.description && (
            <p style={{
              fontSize: '15px',
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
            marginBottom: '16px',
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
              {pack.concepts_preview.slice(0, 4).map((label, idx) => (
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
              {pack.concept_count > 4 && (
                <span style={{
                  color: '#999',
                  fontSize: '12px',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  padding: '4px 6px',
                }}>
                  +{pack.concept_count - 4} more
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '20px',
          marginTop: '20px',
          borderTop: '1px solid #f0f0f0',
        }}>
          {isOwned ? (
            <>
              <span style={{
                fontSize: '14px',
                color: ACCENT_GREEN,
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <i className="fas fa-check-circle"></i>
                Owned
              </span>
              <span style={{
                background: ACCENT_GREEN_LIGHT,
                color: ACCENT_GREEN,
                padding: '10px 20px',
                borderRadius: '8px',
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
              }}>
                View Pack
              </span>
            </>
          ) : (
            <>
              <span style={{
                fontSize: '28px',
                fontWeight: 700,
                fontFamily: 'Inter, -apple-system, sans-serif',
                color: pack.price_cents === 0 ? ACCENT_GREEN : '#111',
                letterSpacing: '-0.02em',
              }}>
                {formatPrice(pack.price_cents)}
              </span>
              <span style={{
                background: ACCENT_GREEN,
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
              }}>
                {pack.price_cents === 0 ? 'Get Free' : 'Purchase'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
