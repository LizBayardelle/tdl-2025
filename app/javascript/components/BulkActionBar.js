import React, { useState } from 'react';

export default function BulkActionBar({ reviewCount, failedCount, onBulkApprove, onRetryFailed }) {
  const [approvingAll, setApprovingAll] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleApproveAll = async () => {
    if (!confirm(`Approve all ${reviewCount} items and create sources? This will use the auto-extracted metadata.`)) {
      return;
    }

    setApprovingAll(true);
    await onBulkApprove();
    setApprovingAll(false);
  };

  const handleRetryAll = async () => {
    if (!confirm(`Retry all ${failedCount} failed items?`)) {
      return;
    }

    setRetrying(true);
    await onRetryFailed();
    setRetrying(false);
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      border: '1px solid var(--neutral-200)',
      padding: 'var(--space-4)',
      marginBottom: 'var(--space-4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-600)',
      }}>
        <i className="fas fa-tasks" style={{ marginRight: 'var(--space-2)' }}></i>
        Bulk Actions
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        {failedCount > 0 && (
          <button
            onClick={handleRetryAll}
            disabled={retrying}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            {retrying ? (
              <><i className="fas fa-spinner fa-spin"></i> Retrying...</>
            ) : (
              <><i className="fas fa-redo"></i> Retry All Failed ({failedCount})</>
            )}
          </button>
        )}

        {reviewCount > 0 && (
          <button
            onClick={handleApproveAll}
            disabled={approvingAll}
            className="btn-success"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            {approvingAll ? (
              <><i className="fas fa-spinner fa-spin"></i> Approving...</>
            ) : (
              <><i className="fas fa-check-double"></i> Approve All ({reviewCount})</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
