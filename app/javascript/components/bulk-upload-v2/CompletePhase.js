import React from 'react';
import { useBulkUpload } from './BulkUploadContext';

export default function CompletePhase() {
  const { state, dispatch, enrichedItems } = useBulkUpload();
  const { completionStats, batch } = state;

  // Calculate stats if not provided
  const stats = completionStats || {
    sources: enrichedItems.filter(i => i.status === 'created').length,
    skipped: enrichedItems.filter(i => i.status === 'skipped').length,
    people: state.pendingPeople.filter(p => p.realId).length,
    concepts: state.pendingConcepts?.filter(c => c.realId)?.length || 0
  };

  const handleUploadMore = () => {
    dispatch({ type: 'RESET' });
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6)' }}>
    <div style={{
      padding: 'var(--space-12)',
      textAlign: 'center',
    }}>
      {/* Success icon */}
      <div style={{
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        background: 'color-mix(in srgb, var(--accent-green) 15%, white)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto var(--space-6)',
      }}>
        <i className="fas fa-check-circle" style={{
          fontSize: '3rem',
          color: 'var(--accent-green)',
        }}></i>
      </div>

      {/* Title */}
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-2xl)',
        fontWeight: 700,
        color: 'var(--neutral-800)',
        marginBottom: 'var(--space-2)',
      }}>
        Upload Complete!
      </h2>

      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-base)',
        color: 'var(--neutral-500)',
        marginBottom: 'var(--space-8)',
      }}>
        Your library has been updated with the new sources.
      </p>

      {/* Stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 'var(--space-8)',
        marginBottom: 'var(--space-8)',
      }}>
        <StatCard
          icon="fa-book"
          color="var(--accent-blue)"
          count={stats.sources}
          label="Sources Created"
        />
        {stats.people > 0 && (
          <StatCard
            icon="fa-user-plus"
            color="var(--accent-green)"
            count={stats.people}
            label="New People"
          />
        )}
        {stats.concepts > 0 && (
          <StatCard
            icon="fa-tags"
            color="var(--accent-purple)"
            count={stats.concepts}
            label="New Concepts"
          />
        )}
        {stats.skipped > 0 && (
          <StatCard
            icon="fa-ban"
            color="var(--neutral-400)"
            count={stats.skipped}
            label="Skipped"
          />
        )}
      </div>

      {/* Recently created items */}
      {(() => {
        const createdItems = enrichedItems.filter(i => i.status === 'created' && i.source_id);
        if (createdItems.length === 0) return null;

        return (
          <div style={{
            marginBottom: 'var(--space-8)',
            maxWidth: '600px',
            margin: '0 auto var(--space-8)',
          }}>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--neutral-600)',
              marginBottom: 'var(--space-3)',
              textAlign: 'left',
            }}>
              Recently Created Sources
            </h3>
            <div style={{
              border: '1px solid var(--neutral-200)',
              borderRadius: '8px',
              maxHeight: '200px',
              overflowY: 'auto',
              background: 'white',
            }}>
              {createdItems.slice(0, 10).map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: idx < Math.min(createdItems.length, 10) - 1 ? '1px solid var(--neutral-100)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    textAlign: 'left',
                  }}
                >
                  <i className="fas fa-check-circle" style={{ color: 'var(--accent-green)' }}></i>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--neutral-700)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.extracted_metadata?.title || item.original_filename}
                    </div>
                    {item.extracted_metadata?.year && (
                      <div style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                      }}>
                        {item.extracted_metadata.year}
                      </div>
                    )}
                  </div>
                  <a
                    href={`/sources/${item.source_id}`}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--accent-blue)',
                      textDecoration: 'none',
                    }}
                  >
                    View <i className="fas fa-arrow-right"></i>
                  </a>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 'var(--space-3)',
      }}>
        <a
          href="/sources"
          className="btn-outline-source"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            textDecoration: 'none',
          }}
        >
          <i className="fas fa-book"></i>
          View All Sources
        </a>
        <button
          onClick={handleUploadMore}
          className="btn-source"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
          }}
        >
          <i className="fas fa-plus"></i>
          Upload More PDFs
        </button>
      </div>
    </div>
    </div>
  );
}

function StatCard({ icon, color, count, label }) {
  return (
    <div style={{
      textAlign: 'center',
    }}>
      <div style={{
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: `color-mix(in srgb, ${color} 15%, white)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto var(--space-2)',
      }}>
        <i className={`fas ${icon}`} style={{ fontSize: '1.5rem', color }}></i>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-3xl)',
        fontWeight: 700,
        color: 'var(--neutral-800)',
      }}>
        {count}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-500)',
      }}>
        {label}
      </div>
    </div>
  );
}
