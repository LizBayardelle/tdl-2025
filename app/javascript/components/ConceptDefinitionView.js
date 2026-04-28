import React from 'react';

// Public-facing view of a ConceptDefinition.  Used in the admin generation
// review tab as a live preview, and (later) the standalone /concepts/:id
// show page.
//
// Expects a `concept` shape with:
//   label, concept_type, school_of_thought, aliases, summary,
//   description, examples, location, etymology, history, controversy,
//   clinical_relevance, misconceptions, developmental_notes, measurement_notes,
//   attribution, mnemonic
//   links?: [{ id?, name, url, description? }]

const ACCENT_GREEN = '#556B2F';
const ACCENT_GREEN_LIGHT = '#e8ebe0';

export default function ConceptDefinitionView({ concept }) {
  if (!concept) return null;

  return (
    <div style={{ maxWidth: '800px' }}>
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
              {concept.links.map((link, i) => {
                let faviconUrl = null;
                try {
                  const domain = new URL(link.url).hostname;
                  faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
                } catch (e) {
                  // Invalid URL, skip favicon
                }

                return (
                  <a
                    key={link.id ?? `${link.url}-${i}`}
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
                        style={{ width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0 }}
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
            Custom mnemonic created for this concept — not from standard educational materials.
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, content, icon }) {
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
}
