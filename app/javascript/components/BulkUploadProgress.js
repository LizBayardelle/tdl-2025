import React from 'react';

export default function BulkUploadProgress({ batch }) {
  const stats = batch.stats || {};
  const progress = batch.progress_percentage || 0;

  const statusCounts = [
    { key: 'pending', label: 'Pending', icon: 'fas fa-clock', color: 'var(--neutral-400)' },
    { key: 'extracting', label: 'Extracting', icon: 'fas fa-cog fa-spin', color: 'var(--accent-blue)' },
    { key: 'extracted', label: 'Extracted', icon: 'fas fa-check', color: 'var(--accent-blue)' },
    { key: 'review_needed', label: 'Needs Review', icon: 'fas fa-exclamation-triangle', color: 'var(--accent-blue)' },
    { key: 'failed', label: 'Failed', icon: 'fas fa-times', color: 'var(--accent-red, #dc2626)' },
  ];

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      border: '1px solid var(--neutral-200)',
      padding: 'var(--space-6)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-6)',
      }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: 'var(--neutral-800)',
            marginBottom: 'var(--space-1)',
          }}>
            <i className="fas fa-cog fa-spin" style={{ marginRight: 'var(--space-2)', color: 'var(--accent-blue)' }}></i>
            Processing {batch.total_count} PDFs
          </h2>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-500)',
          }}>
            Extracting metadata and checking for duplicates...
          </p>
        </div>
        <div style={{
          textAlign: 'right',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 700,
            color: 'var(--accent-blue)',
          }}>
            {progress}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '12px',
        background: 'var(--neutral-200)',
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: 'var(--space-6)',
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'var(--accent-blue)',
          transition: 'width 0.5s ease',
          borderRadius: '6px',
        }}></div>
      </div>

      {/* Status breakdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        {statusCounts.map(({ key, label, icon, color }) => {
          const count = stats[key] || 0;
          if (count === 0 && key !== 'extracting') return null;

          return (
            <div
              key={key}
              style={{
                padding: 'var(--space-4)',
                background: '#e2e2e2',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              <i className={icon} style={{ fontSize: '1.5rem', color, marginBottom: 'var(--space-2)', display: 'block' }}></i>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 700,
                color: 'var(--neutral-800)',
              }}>
                {count}
              </div>
              <div style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-xs)',
                color: 'var(--neutral-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Processing items list */}
      {batch.items && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--neutral-600)',
            marginBottom: 'var(--space-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Recent Activity
          </h3>
          <div style={{
            maxHeight: '250px',
            overflowY: 'auto',
            border: '1px solid var(--neutral-200)',
            borderRadius: '8px',
          }}>
            {batch.items.slice(-10).reverse().map((item, idx) => (
              <div
                key={item.id}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderBottom: idx < 9 ? '1px solid var(--neutral-100)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <StatusIcon status={item.status} />
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-700)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.extracted_metadata?.title || item.original_filename}
                </span>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }) {
  const icons = {
    pending: { icon: 'fas fa-clock', color: 'var(--neutral-400)' },
    uploading: { icon: 'fas fa-upload', color: 'var(--accent-blue)' },
    extracting: { icon: 'fas fa-cog fa-spin', color: 'var(--accent-blue)' },
    extracted: { icon: 'fas fa-check-circle', color: 'var(--accent-blue)' },
    review_needed: { icon: 'fas fa-exclamation-triangle', color: 'var(--accent-blue)' },
    approved: { icon: 'fas fa-thumbs-up', color: 'var(--accent-blue)' },
    created: { icon: 'fas fa-check-double', color: 'var(--accent-blue)' },
    failed: { icon: 'fas fa-times-circle', color: 'var(--accent-red, #dc2626)' },
  };

  const { icon, color } = icons[status] || icons.pending;

  return <i className={icon} style={{ color, width: '20px', textAlign: 'center' }}></i>;
}

function StatusBadge({ status }) {
  const badges = {
    pending: { label: 'Pending', bg: 'var(--neutral-100)', color: 'var(--neutral-600)' },
    uploading: { label: 'Uploading', bg: 'color-mix(in srgb, var(--accent-blue) 15%, white)', color: 'var(--accent-blue)' },
    extracting: { label: 'Extracting', bg: 'color-mix(in srgb, var(--accent-blue) 15%, white)', color: 'var(--accent-blue)' },
    extracted: { label: 'Ready', bg: 'color-mix(in srgb, var(--accent-blue) 15%, white)', color: 'var(--accent-blue)' },
    review_needed: { label: 'Review', bg: 'color-mix(in srgb, var(--accent-blue) 15%, white)', color: 'var(--accent-blue)' },
    approved: { label: 'Approved', bg: 'color-mix(in srgb, var(--accent-blue) 15%, white)', color: 'var(--accent-blue)' },
    created: { label: 'Created', bg: 'color-mix(in srgb, var(--accent-blue) 15%, white)', color: 'var(--accent-blue)' },
    failed: { label: 'Failed', bg: '#fecaca', color: '#dc2626' },
  };

  const { label, bg, color } = badges[status] || badges.pending;

  return (
    <span style={{
      padding: '2px 8px',
      background: bg,
      color: color,
      borderRadius: '4px',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-xs)',
      fontWeight: 500,
    }}>
      {label}
    </span>
  );
}
