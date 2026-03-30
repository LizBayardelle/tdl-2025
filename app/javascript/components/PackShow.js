import React, { useState, useEffect } from 'react';

export default function PackShow({ packId }) {
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchPack();
    // Check for purchase success
    const params = new URLSearchParams(window.location.search);
    if (params.get('purchased') === 'true') {
      // Refresh to get updated ownership status
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [packId]);

  const fetchPack = async () => {
    try {
      const response = await fetch(`/packs/${packId}.json`);
      if (response.ok) {
        const data = await response.json();
        setPack(data);
      } else {
        setError('Failed to load pack');
      }
    } catch (err) {
      setError('Failed to load pack');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    setPurchasing(true);
    // Form submission for checkout
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `/checkout/${packId}`;
    const csrfToken = document.querySelector('[name="csrf-token"]').content;
    const csrfInput = document.createElement('input');
    csrfInput.type = 'hidden';
    csrfInput.name = 'authenticity_token';
    csrfInput.value = csrfToken;
    form.appendChild(csrfInput);
    document.body.appendChild(form);
    form.submit();
  };

  const formatPrice = (priceCents) => {
    if (priceCents === 0) return 'Free';
    return `$${(priceCents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-600)' }}>Loading...</p>
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: '#c00' }}>{error || 'Pack not found'}</p>
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
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <a
            href="/packs"
            style={{
              color: 'var(--neutral-600)',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <i className="fas fa-arrow-left"></i>
            Back to Packs
          </a>

          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 'var(--space-6)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <h1 style={{
                  fontSize: 'var(--text-4xl)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent-maroon)',
                  margin: 0,
                }}>
                  {pack.name}
                </h1>
                {pack.owned && (
                  <span style={{
                    background: 'var(--accent-green)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                  }}>
                    Owned
                  </span>
                )}
              </div>
              {pack.description && (
                <p style={{
                  fontSize: 'var(--text-lg)',
                  color: 'var(--neutral-600)',
                  fontFamily: 'var(--font-body)',
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  {pack.description}
                </p>
              )}
            </div>

            <div style={{
              background: 'white',
              padding: 'var(--space-6)',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-md)',
              minWidth: '200px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 'var(--text-3xl)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: pack.price_cents === 0 ? 'var(--accent-green)' : 'var(--neutral-900)',
                marginBottom: 'var(--space-2)',
              }}>
                {formatPrice(pack.price_cents)}
              </div>
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-500)',
                fontFamily: 'var(--font-body)',
                marginBottom: 'var(--space-4)',
              }}>
                {pack.concept_count} concepts
              </div>
              {pack.owned ? (
                <div style={{
                  background: 'var(--neutral-100)',
                  color: 'var(--neutral-600)',
                  padding: 'var(--space-3) var(--space-6)',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}>
                  <i className="fas fa-check" style={{ marginRight: 'var(--space-2)' }}></i>
                  In Your Library
                </div>
              ) : (
                <button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  style={{
                    width: '100%',
                    background: purchasing ? 'var(--neutral-300)' : 'var(--accent-maroon)',
                    color: 'white',
                    padding: 'var(--space-3) var(--space-6)',
                    borderRadius: '4px',
                    border: 'none',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 'var(--text-base)',
                    cursor: purchasing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {purchasing ? 'Processing...' : (pack.price_cents === 0 ? 'Add to Library' : 'Purchase')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Concepts List */}
      <div style={{ padding: 'var(--space-8)', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
          color: 'var(--neutral-900)',
          marginBottom: 'var(--space-6)',
        }}>
          Included Concepts ({pack.concept_definitions?.length || 0})
        </h2>

        {pack.concept_definitions && pack.concept_definitions.length > 0 ? (
          <div style={{
            display: 'grid',
            gap: 'var(--space-3)',
          }}>
            {pack.concept_definitions.map(def => (
              <div
                key={def.id}
                className="card"
                style={{
                  padding: 'var(--space-4)',
                  borderLeft: '3px solid var(--accent-green)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{
                      fontSize: 'var(--text-base)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-body)',
                      color: 'var(--neutral-900)',
                      margin: 0,
                      marginBottom: 'var(--space-1)',
                    }}>
                      {def.label}
                    </h3>
                    {def.summary && (
                      <p style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--neutral-600)',
                        fontFamily: 'var(--font-body)',
                        margin: 0,
                        lineHeight: 1.4,
                      }}>
                        {def.summary}
                      </p>
                    )}
                  </div>
                  {def.concept_type && (
                    <span style={{
                      background: 'var(--neutral-100)',
                      color: 'var(--neutral-600)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-body)',
                      whiteSpace: 'nowrap',
                    }}>
                      {def.concept_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{
            color: 'var(--neutral-500)',
            fontFamily: 'var(--font-body)',
            textAlign: 'center',
            padding: 'var(--space-8)',
          }}>
            No concepts in this pack yet
          </p>
        )}
      </div>
    </div>
  );
}
