import React, { useEffect, useCallback } from 'react';
import { useBulkUpload } from './BulkUploadContext';

export default function ProcessingPhase() {
  const { state, dispatch } = useBulkUpload();
  const { batch } = state;

  // Poll for updates
  const pollBatch = useCallback(async () => {
    if (!batch?.id) return;

    try {
      const response = await fetch(`/upload_batches/${batch.id}.json`);
      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'SET_BATCH', payload: data });

        // Transition to review when complete
        if (data.status === 'completed' || data.status === 'failed') {
          dispatch({ type: 'SET_PHASE', payload: 'review' });
        }
      }
    } catch (err) {
      console.error('Error polling batch:', err);
    }
  }, [batch?.id, dispatch]);

  useEffect(() => {
    if (!batch || batch.status !== 'processing') return;

    const interval = setInterval(pollBatch, 2000);
    return () => clearInterval(interval);
  }, [batch?.status, pollBatch]);

  if (!batch) {
    return (
      <div style={{
        padding: 'var(--space-12)',
        textAlign: 'center',
      }}>
        <p>No batch data available</p>
      </div>
    );
  }

  // Calculate progress — must match backend UploadBatch#progress_percentage
  const IN_PROGRESS = ['pending', 'uploading', 'extracting'];
  const items = batch.items || [];
  const totalCount = batch.total_count || items.length;
  const processedCount = items.filter(item => !IN_PROGRESS.includes(item.status)).length;
  const progress = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;

  // Group items by status for display
  const statusGroups = {
    extracted: items.filter(i => i.status === 'extracted').length,
    review_needed: items.filter(i => i.status === 'review_needed').length,
    failed: items.filter(i => i.status === 'failed').length,
    processing: items.filter(i => IN_PROGRESS.includes(i.status)).length,
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6)' }}>
    <div style={{
      padding: 'var(--space-8)',
    }}>
      {/* Main progress */}
      <div style={{
        textAlign: 'center',
        marginBottom: 'var(--space-8)',
      }}>
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--accent-blue) 10%, white)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-4)',
          position: 'relative',
        }}>
          {/* Circular progress indicator */}
          <svg width="120" height="120" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--neutral-200)"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--accent-blue)"
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 54}`}
              strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
          </svg>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              color: 'var(--accent-blue)',
            }}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          color: 'var(--neutral-800)',
          marginBottom: 'var(--space-2)',
        }}>
          Extracting Metadata...
        </h2>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          color: 'var(--neutral-500)',
        }}>
          {processedCount} of {totalCount} files processed
        </p>
      </div>

      {/* Status breakdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        <StatusCard
          icon="fa-check-circle"
          color="var(--accent-green)"
          label="Extracted"
          count={statusGroups.extracted}
        />
        <StatusCard
          icon="fa-exclamation-triangle"
          color="var(--accent-orange)"
          label="Needs Review"
          count={statusGroups.review_needed}
        />
        <StatusCard
          icon="fa-times-circle"
          color="var(--accent-red)"
          label="Failed"
          count={statusGroups.failed}
        />
        <StatusCard
          icon="fa-spinner fa-spin"
          color="var(--accent-blue)"
          label="Processing"
          count={statusGroups.processing}
        />
      </div>

      {/* Live item updates */}
      <div style={{
        border: '1px solid var(--neutral-200)',
        borderRadius: '8px',
        maxHeight: '200px',
        overflowY: 'auto',
      }}>
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--neutral-200)',
          background: 'var(--neutral-50)',
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          color: 'var(--neutral-600)',
        }}>
          Recent Activity
        </div>
        {items.slice(-10).reverse().map(item => (
          <div
            key={item.id}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderBottom: '1px solid var(--neutral-100)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
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
          </div>
        ))}
      </div>

      {/* Estimated time */}
      {statusGroups.processing > 0 && (
        <p style={{
          marginTop: 'var(--space-4)',
          textAlign: 'center',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--neutral-500)',
        }}>
          <i className="fas fa-clock" style={{ marginRight: 'var(--space-2)' }}></i>
          Estimated time remaining: ~{Math.ceil(statusGroups.processing * 0.5)} minutes
        </p>
      )}
    </div>
    </div>
  );
}

function StatusCard({ icon, color, label, count }) {
  return (
    <div style={{
      padding: 'var(--space-4)',
      borderRadius: '8px',
      border: '1px solid var(--neutral-200)',
      textAlign: 'center',
    }}>
      <i
        className={`fas ${icon}`}
        style={{ fontSize: 'var(--text-xl)', color, marginBottom: 'var(--space-2)' }}
      ></i>
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
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-500)',
      }}>
        {label}
      </div>
    </div>
  );
}

function StatusIcon({ status }) {
  const configs = {
    extracted: { icon: 'fa-check-circle', color: 'var(--accent-green)' },
    review_needed: { icon: 'fa-exclamation-triangle', color: 'var(--accent-orange)' },
    failed: { icon: 'fa-times-circle', color: 'var(--accent-red)' },
    processing: { icon: 'fa-spinner fa-spin', color: 'var(--accent-blue)' },
    pending: { icon: 'fa-clock', color: 'var(--neutral-400)' },
    approved: { icon: 'fa-check-double', color: 'var(--accent-green)' },
    created: { icon: 'fa-check-double', color: 'var(--accent-green)' },
  };

  const config = configs[status] || configs.pending;

  return (
    <i
      className={`fas ${config.icon}`}
      style={{ fontSize: 'var(--text-sm)', color: config.color }}
    ></i>
  );
}
