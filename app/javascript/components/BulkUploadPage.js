import React, { useState, useEffect, useCallback } from 'react';
import BulkUploadDropzone from './BulkUploadDropzone';
import BulkUploadProgress from './BulkUploadProgress';
import BulkUploadItemList from './BulkUploadItemList';

export default function BulkUploadPage() {
  const [activeBatch, setActiveBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch active batch on mount
  const fetchActiveBatch = useCallback(async () => {
    try {
      const response = await fetch('/batch_uploads/active.json');
      if (response.ok) {
        const data = await response.json();
        setActiveBatch(data);
      }
    } catch (err) {
      console.error('Error fetching active batch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveBatch();
  }, [fetchActiveBatch]);

  // Poll for updates when processing
  useEffect(() => {
    if (!activeBatch || activeBatch.status !== 'processing') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/batch_uploads/${activeBatch.id}.json`);
        if (response.ok) {
          const data = await response.json();
          setActiveBatch(data);

          // Stop polling if completed
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Error polling batch status:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [activeBatch?.id, activeBatch?.status]);

  const handleUploadComplete = (batch) => {
    setActiveBatch(batch);
    setError('');
  };

  const handleStartProcessing = async () => {
    if (!activeBatch) return;

    try {
      const response = await fetch(`/batch_uploads/${activeBatch.id}/start_processing`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setActiveBatch(data);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to start processing');
      }
    } catch (err) {
      setError('Failed to start processing');
    }
  };

  const handleCancelBatch = async () => {
    if (!activeBatch) return;

    if (!confirm('Are you sure you want to cancel this upload batch? All uploaded files will be removed.')) {
      return;
    }

    try {
      const response = await fetch(`/batch_uploads/${activeBatch.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setActiveBatch(null);
      }
    } catch (err) {
      setError('Failed to cancel batch');
    }
  };

  const handleItemApproved = async (itemId) => {
    // Refresh the current batch data (not active, since completed batches aren't "active")
    if (!activeBatch) return;

    try {
      const response = await fetch(`/batch_uploads/${activeBatch.id}.json`);
      if (response.ok) {
        const data = await response.json();
        setActiveBatch(data);
      }
    } catch (err) {
      console.error('Error refreshing batch:', err);
    }
  };

  const handleBulkApprove = async () => {
    if (!activeBatch) return;

    const itemsToApprove = activeBatch.items.filter(
      item => item.status === 'extracted' || item.status === 'review_needed'
    );

    for (const item of itemsToApprove) {
      try {
        await fetch(`/batch_upload_items/${item.id}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
          },
          body: JSON.stringify({ decisions: item.user_decisions }),
        });
      } catch (err) {
        console.error(`Failed to approve item ${item.id}:`, err);
      }
    }

    // Refresh the current batch
    try {
      const response = await fetch(`/batch_uploads/${activeBatch.id}.json`);
      if (response.ok) {
        const data = await response.json();
        setActiveBatch(data);
      }
    } catch (err) {
      console.error('Error refreshing batch:', err);
    }
  };

  const handleRetryFailed = async () => {
    if (!activeBatch) return;

    const failedItems = activeBatch.items.filter(item => item.status === 'failed');

    for (const item of failedItems) {
      try {
        await fetch(`/batch_upload_items/${item.id}/retry`, {
          method: 'POST',
          headers: {
            'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
          },
        });
      } catch (err) {
        console.error(`Failed to retry item ${item.id}:`, err);
      }
    }

    // Refresh the current batch
    try {
      const response = await fetch(`/batch_uploads/${activeBatch.id}.json`);
      if (response.ok) {
        const data = await response.json();
        setActiveBatch(data);
      }
    } catch (err) {
      console.error('Error refreshing batch:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6)' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          padding: 'var(--space-6)',
          background: 'white',
          borderRadius: '12px',
          border: '1px solid var(--neutral-200)',
        }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--accent-blue)' }}></i>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-6)',
      }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 700,
            color: 'var(--neutral-800)',
            marginBottom: 'var(--space-2)',
          }}>
            <i className="fas fa-upload" style={{ marginRight: 'var(--space-3)', color: 'var(--accent-blue)' }}></i>
            Bulk Upload
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            color: 'var(--neutral-600)',
          }}>
            Upload multiple PDFs at once with automatic metadata extraction
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}

      {/* No active batch - show dropzone */}
      {!activeBatch && (
        <BulkUploadDropzone onUploadComplete={handleUploadComplete} />
      )}

      {/* Batch is pending - show file list and start button */}
      {activeBatch && activeBatch.status === 'pending' && (
        <div>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid var(--neutral-200)',
            padding: 'var(--space-6)',
            marginBottom: 'var(--space-4)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-4)',
            }}>
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-xl)',
                  fontWeight: 600,
                  color: 'var(--neutral-800)',
                }}>
                  {activeBatch.total_count} PDFs Ready to Process
                </h2>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-500)',
                }}>
                  Click "Start Processing" to begin extracting metadata
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button onClick={handleCancelBatch} className="btn-outline-source">
                  Cancel
                </button>
                <button onClick={handleStartProcessing} className="btn-source" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <i className="fas fa-play"></i>
                  Start Processing
                </button>
              </div>
            </div>

            {/* File list preview */}
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              border: '1px solid var(--neutral-200)',
              borderRadius: '8px',
            }}>
              {activeBatch.items?.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: idx < activeBatch.items.length - 1 ? '1px solid var(--neutral-100)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                  }}
                >
                  <i className="fas fa-file-pdf" style={{ color: 'var(--accent-blue)' }}></i>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--neutral-700)',
                    flex: 1,
                  }}>
                    {item.original_filename}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--neutral-500)',
                  }}>
                    {(item.file_size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Batch is processing - show progress */}
      {activeBatch && activeBatch.status === 'processing' && (
        <BulkUploadProgress batch={activeBatch} />
      )}

      {/* Batch is completed - show item list for review */}
      {activeBatch && (activeBatch.status === 'completed' || activeBatch.status === 'failed') && (
        <BulkUploadItemList
          batch={activeBatch}
          onItemApproved={handleItemApproved}
          onBulkApprove={handleBulkApprove}
          onRetryFailed={handleRetryFailed}
          onNewBatch={() => setActiveBatch(null)}
        />
      )}
    </div>
  );
}
