import React from 'react';

export default function BulkActionBar({
  stats,
  onBulkApprove,
  onRetryFailed,
  onNewBatch,
  approving,
  filter,
  onFilterChange
}) {
  const { ready, needsReview, failed, approved, created } = stats;
  const totalDone = approved + created;

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: 'var(--space-3) var(--space-4)',
      marginBottom: 'var(--space-4)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 'var(--space-4)',
      zIndex: 100,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)',
    }}>
      {/* Stats pills */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <StatPill
          count={ready}
          label="Ready"
          color="var(--accent-green)"
          active={filter === 'ready'}
          onClick={() => onFilterChange(filter === 'ready' ? 'all' : 'ready')}
        />
        <StatPill
          count={needsReview}
          label="Needs Review"
          color="var(--accent-orange)"
          active={filter === 'needs_review'}
          onClick={() => onFilterChange(filter === 'needs_review' ? 'all' : 'needs_review')}
        />
        <StatPill
          count={failed}
          label="Failed"
          color="var(--accent-red)"
          active={filter === 'failed'}
          onClick={() => onFilterChange(filter === 'failed' ? 'all' : 'failed')}
        />
        {totalDone > 0 && (
          <StatPill
            count={totalDone}
            label="Done"
            color="var(--neutral-400)"
            active={false}
            onClick={() => {}}
          />
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        {failed > 0 && (
          <button
            onClick={onRetryFailed}
            className="btn-outline-source"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <i className="fas fa-redo"></i>
            Retry Failed ({failed})
          </button>
        )}

        {ready > 0 && (
          <button
            onClick={onBulkApprove}
            disabled={approving}
            className="btn-source"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {approving ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Approving...
              </>
            ) : (
              <>
                <i className="fas fa-check-double"></i>
                Approve All Ready ({ready})
              </>
            )}
          </button>
        )}

        {totalDone > 0 && ready === 0 && needsReview === 0 && failed === 0 && (
          <button
            onClick={onNewBatch}
            className="btn-source"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <i className="fas fa-plus"></i>
            Upload More
          </button>
        )}
      </div>
    </div>
  );
}

function StatPill({ count, label, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: '20px',
        border: active ? `2px solid ${color}` : '1px solid var(--neutral-200)',
        background: active ? `color-mix(in srgb, ${color} 10%, white)` : 'var(--neutral-50)',
        cursor: count > 0 ? 'pointer' : 'default',
        opacity: count > 0 ? 1 : 0.5,
        transition: 'all 0.2s ease',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-base)',
        fontWeight: 700,
        color: color,
      }}>
        {count}
      </span>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-600)',
      }}>
        {label}
      </span>
    </button>
  );
}
