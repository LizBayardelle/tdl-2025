import React, { useState, useEffect } from 'react';

const ACCENT_GREEN = '#556B2F';
const ACCENT_GREEN_LIGHT = '#e8ebe0';

export default function PackShow({ packId }) {
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState(null);

  useEffect(() => {
    fetchPack();
    const params = new URLSearchParams(window.location.search);
    if (params.get('purchased') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [packId]);

  const fetchPack = async () => {
    try {
      const response = await fetch(`/packs/${packId}.json`);
      if (response.ok) {
        const data = await response.json();
        setPack(data);
        // Auto-select first concept if owned
        if (data.owned && data.concept_definitions?.length > 0) {
          setSelectedConcept(data.concept_definitions[0]);
        }
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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
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

  if (error || !pack) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '48px',
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #e5e5e5',
        }}>
          <p style={{
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: '#dc2626',
            fontSize: '16px',
            margin: '0 0 20px 0',
          }}>
            {error || 'Pack not found'}
          </p>
          <a href="/packs" style={{
            color: '#666',
            textDecoration: 'none',
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: '14px',
          }}>
            <i className="fas fa-arrow-left" style={{ marginRight: '8px' }}></i>
            Back to Packs
          </a>
        </div>
      </div>
    );
  }

  // Owned view - sidebar + content
  if (pack.owned) {
    return <OwnedPackView pack={pack} selectedConcept={selectedConcept} setSelectedConcept={setSelectedConcept} />;
  }

  // Not owned view - preview with purchase CTA
  return <UnownedPackView pack={pack} formatPrice={formatPrice} handlePurchase={handlePurchase} purchasing={purchasing} />;
}

// ============ OWNED PACK VIEW ============
function OwnedPackView({ pack, selectedConcept, setSelectedConcept }) {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#f5f5f5',
    }}>
      {/* Sidebar */}
      <div style={{
        width: '320px',
        background: 'white',
        borderRight: '1px solid #e5e5e5',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e5e5',
        }}>
          <a
            href="/packs"
            style={{
              color: '#888',
              textDecoration: 'none',
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '16px',
            }}
          >
            <i className="fas fa-arrow-left"></i>
            Back to Packs
          </a>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 700,
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: '#111',
            margin: 0,
          }}>
            {pack.name}
          </h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            fontSize: '13px',
            color: ACCENT_GREEN,
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontWeight: 500,
          }}>
            <i className="fas fa-unlock"></i>
            {pack.concept_definitions?.length || 0} concepts
          </div>
        </div>

        {/* Concept List */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px',
        }}>
          {pack.concept_definitions?.map((concept, index) => (
            <button
              key={concept.id}
              onClick={() => setSelectedConcept(concept)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: selectedConcept?.id === concept.id ? ACCENT_GREEN_LIGHT : 'transparent',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                borderLeft: selectedConcept?.id === concept.id ? `3px solid ${ACCENT_GREEN}` : '3px solid transparent',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <span style={{
                  width: '24px',
                  height: '24px',
                  background: selectedConcept?.id === concept.id ? ACCENT_GREEN : '#e5e5e5',
                  color: selectedConcept?.id === concept.id ? 'white' : '#888',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  flexShrink: 0,
                }}>
                  {index + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    color: '#111',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {concept.label}
                  </div>
                  {concept.concept_type && (
                    <div style={{
                      fontSize: '11px',
                      color: '#888',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      marginTop: '2px',
                      textTransform: 'capitalize',
                    }}>
                      {concept.concept_type.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px',
      }}>
        {selectedConcept ? (
          <ConceptContent concept={selectedConcept} />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#888',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}>
            Select a concept from the sidebar
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============ CONCEPT CONTENT ============
function ConceptContent({ concept }) {
  const Section = ({ title, content, icon }) => {
    if (!content) return null;
    return (
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: ACCENT_GREEN,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {icon && <i className={`fas ${icon}`} style={{ fontSize: '12px' }}></i>}
          {title}
        </h3>
        <div style={{
          fontSize: '15px',
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#333',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
        }}>
          {content}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 700,
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: '#111',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            {concept.label}
          </h2>
          {concept.concept_type && (
            <span style={{
              background: ACCENT_GREEN_LIGHT,
              color: ACCENT_GREEN,
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}>
              {concept.concept_type.replace(/_/g, ' ')}
            </span>
          )}
          {concept.school_of_thought && (
            <span style={{
              background: '#f0f0f0',
              color: '#666',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontWeight: 500,
            }}>
              <i className="fas fa-university" style={{ marginRight: '6px', fontSize: '10px' }}></i>
              {concept.school_of_thought}
            </span>
          )}
        </div>
        {concept.aliases && concept.aliases.length > 0 && (
          <div style={{
            fontSize: '14px',
            color: '#666',
            fontFamily: 'Inter, -apple-system, sans-serif',
            marginBottom: '12px',
          }}>
            Also known as: {concept.aliases.join(', ')}
          </div>
        )}
        {/* Summary below header, outside white box */}
        {concept.summary && (
          <p style={{
            fontSize: '17px',
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: '#555',
            lineHeight: 1.6,
            margin: 0,
          }}>
            {concept.summary}
          </p>
        )}
      </div>

      {/* Content Sections */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid #e5e5e5',
        padding: '32px',
      }}>
        <Section title="Description" content={concept.description} icon="fa-file-alt" />
        <Section title="Examples" content={concept.examples} icon="fa-lightbulb" />
        <Section title="Location" content={concept.location} icon="fa-map-marker-alt" />
        <Section title="Etymology" content={concept.etymology} icon="fa-language" />
        <Section title="History" content={concept.history} icon="fa-history" />
        <Section title="Clinical Relevance" content={concept.clinical_relevance} icon="fa-heartbeat" />
        <Section title="Controversy" content={concept.controversy} icon="fa-exclamation-triangle" />
        <Section title="Misconceptions" content={concept.misconceptions} icon="fa-times-circle" />
        <Section title="Developmental Notes" content={concept.developmental_notes} icon="fa-child" />
        <Section title="Measurement Notes" content={concept.measurement_notes} icon="fa-ruler" />
        {concept.attribution && (
          <div style={{
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: '1px solid #e5e5e5',
            fontSize: '13px',
            color: '#888',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}>
            <i className="fas fa-quote-left" style={{ marginRight: '8px' }}></i>
            Attribution: {concept.attribution}
          </div>
        )}

        {/* Links */}
        {concept.links && concept.links.length > 0 && (
          <div style={{
            marginTop: '28px',
            paddingTop: '28px',
            borderTop: '1px solid #e5e5e5',
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'Inter, -apple-system, sans-serif',
              color: ACCENT_GREEN,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <i className="fas fa-link" style={{ fontSize: '12px' }}></i>
              Related Links
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {concept.links.map(link => {
                // Extract domain for favicon
                let faviconUrl = null;
                try {
                  const domain = new URL(link.url).hostname;
                  faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
                } catch (e) {
                  // Invalid URL, skip favicon
                }

                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      background: '#fafafa',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fafafa'}
                  >
                    {faviconUrl ? (
                      <img
                        src={faviconUrl}
                        alt=""
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <i className="fas fa-external-link-alt" style={{ color: ACCENT_GREEN, fontSize: '14px' }}></i>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        color: '#111',
                      }}>
                        {link.name}
                      </div>
                      {link.description && (
                        <div style={{
                          fontSize: '12px',
                          color: '#888',
                          fontFamily: 'Inter, -apple-system, sans-serif',
                          marginTop: '2px',
                        }}>
                          {link.description}
                        </div>
                      )}
                    </div>
                    <i className="fas fa-external-link-alt" style={{ color: '#ccc', fontSize: '11px', flexShrink: 0 }}></i>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mnemonic Box - separate from factual content */}
      {concept.mnemonic && (
        <div style={{
          marginTop: '24px',
          background: 'linear-gradient(135deg, #fdfcfa 0%, #f9f7f4 100%)',
          borderRadius: '16px',
          border: '1px solid #e8e4dc',
          padding: '24px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '12px',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              background: ACCENT_GREEN_LIGHT,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <i className="fas fa-brain" style={{ color: ACCENT_GREEN, fontSize: '16px' }}></i>
            </div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'Inter, -apple-system, sans-serif',
              color: ACCENT_GREEN,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: 0,
            }}>
              Memory Aid
            </h3>
          </div>
          <div style={{
            fontSize: '16px',
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: '#444',
            lineHeight: 1.6,
            fontStyle: 'italic',
          }}>
            {concept.mnemonic}
          </div>
          <div style={{
            fontSize: '12px',
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: '#999',
            fontStyle: 'italic',
            marginTop: '12px',
          }}>
            Custom mnemonic created for this pack — not from standard educational materials.
          </div>
        </div>
      )}
    </div>
  );
}

// ============ UNOWNED PACK VIEW ============
function UnownedPackView({ pack, formatPrice, handlePurchase, purchasing }) {
  const [hoveredConcept, setHoveredConcept] = useState(null);

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#f5f5f5',
    }}>
      {/* Sidebar - Preview */}
      <div style={{
        width: '320px',
        background: 'white',
        borderRight: '1px solid #e5e5e5',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e5e5',
        }}>
          <a
            href="/packs"
            style={{
              color: '#888',
              textDecoration: 'none',
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '16px',
            }}
          >
            <i className="fas fa-arrow-left"></i>
            Back to Packs
          </a>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 700,
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: '#111',
            margin: 0,
          }}>
            {pack.name}
          </h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            fontSize: '13px',
            color: '#888',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}>
            <i className="fas fa-lock"></i>
            {pack.concept_definitions?.length || 0} concepts
          </div>
        </div>

        {/* Concept List - Locked */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px',
        }}>
          {pack.concept_definitions?.map((concept, index) => (
            <div
              key={concept.id}
              onMouseEnter={() => setHoveredConcept(concept)}
              onMouseLeave={() => setHoveredConcept(null)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: hoveredConcept?.id === concept.id ? '#fafafa' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '4px',
                borderLeft: '3px solid transparent',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <span style={{
                  width: '24px',
                  height: '24px',
                  background: '#e5e5e5',
                  color: '#aaa',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  flexShrink: 0,
                }}>
                  {index + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    color: '#111',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {concept.label}
                  </div>
                  {concept.concept_type && (
                    <div style={{
                      fontSize: '11px',
                      color: '#aaa',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      marginTop: '2px',
                      textTransform: 'capitalize',
                    }}>
                      {concept.concept_type.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
                <i className="fas fa-lock" style={{ color: '#ccc', fontSize: '11px' }}></i>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content - Purchase CTA */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Preview Area */}
        <div style={{
          flex: 1,
          padding: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            maxWidth: '500px',
            textAlign: 'center',
          }}>
            {/* Lock Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #f0f0f0 0%, #e5e5e5 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <i className="fas fa-lock" style={{ fontSize: '32px', color: '#999' }}></i>
            </div>

            <h2 style={{
              fontSize: '28px',
              fontWeight: 700,
              fontFamily: 'Inter, -apple-system, sans-serif',
              color: '#111',
              margin: '0 0 12px 0',
              letterSpacing: '-0.02em',
            }}>
              {pack.name}
            </h2>

            {pack.description && (
              <p style={{
                fontSize: '16px',
                color: '#666',
                fontFamily: 'Inter, -apple-system, sans-serif',
                lineHeight: 1.6,
                margin: '0 0 24px 0',
              }}>
                {pack.description}
              </p>
            )}

            {/* Stats */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '32px',
              marginBottom: '32px',
            }}>
              <div>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  color: '#111',
                }}>
                  {pack.concept_definitions?.length || 0}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#888',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                }}>
                  Concepts
                </div>
              </div>
              <div style={{ width: '1px', background: '#e5e5e5' }} />
              <div>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  color: pack.price_cents === 0 ? ACCENT_GREEN : '#111',
                }}>
                  {formatPrice(pack.price_cents)}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#888',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                }}>
                  {pack.price_cents === 0 ? 'Get it free' : 'One-time'}
                </div>
              </div>
            </div>

            {/* Purchase Button */}
            <button
              onClick={handlePurchase}
              disabled={purchasing}
              style={{
                background: purchasing ? '#ccc' : ACCENT_GREEN,
                color: 'white',
                padding: '16px 48px',
                borderRadius: '12px',
                border: 'none',
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                cursor: purchasing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {purchasing ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  Processing...
                </>
              ) : (
                <>
                  <i className="fas fa-unlock"></i>
                  {pack.price_cents === 0 ? 'Unlock Pack' : `Purchase for ${formatPrice(pack.price_cents)}`}
                </>
              )}
            </button>

            <p style={{
              fontSize: '13px',
              color: '#999',
              fontFamily: 'Inter, -apple-system, sans-serif',
              marginTop: '16px',
            }}>
              <i className="fas fa-shield-alt" style={{ marginRight: '6px' }}></i>
              Secure checkout via Stripe
            </p>
          </div>
        </div>

        {/* Hover Preview */}
        {hoveredConcept && (
          <div style={{
            borderTop: '1px solid #e5e5e5',
            background: 'white',
            padding: '24px 32px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '8px',
              flexWrap: 'wrap',
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 600,
                fontFamily: 'Inter, -apple-system, sans-serif',
                color: '#111',
                margin: 0,
              }}>
                {hoveredConcept.label}
              </h3>
              {hoveredConcept.concept_type && (
                <span style={{
                  background: ACCENT_GREEN_LIGHT,
                  color: ACCENT_GREEN,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  fontWeight: 500,
                  textTransform: 'capitalize',
                }}>
                  {hoveredConcept.concept_type.replace(/_/g, ' ')}
                </span>
              )}
              {hoveredConcept.school_of_thought && (
                <span style={{
                  background: '#f0f0f0',
                  color: '#666',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  fontWeight: 500,
                }}>
                  <i className="fas fa-university" style={{ marginRight: '5px', fontSize: '9px' }}></i>
                  {hoveredConcept.school_of_thought}
                </span>
              )}
            </div>
            {hoveredConcept.summary_preview ? (
              <p style={{
                fontSize: '14px',
                color: '#666',
                fontFamily: 'Inter, -apple-system, sans-serif',
                margin: 0,
                lineHeight: 1.5,
              }}>
                {hoveredConcept.summary_preview}
                <span style={{ color: '#999' }}> ...</span>
              </p>
            ) : (
              <p style={{
                fontSize: '14px',
                color: '#999',
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontStyle: 'italic',
                margin: 0,
              }}>
                Full content available after purchase
              </p>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
