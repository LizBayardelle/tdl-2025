import React, { useEffect, useCallback } from 'react';
import { BulkUploadProvider, useBulkUpload } from './BulkUploadContext';
import UploadPhase from './UploadPhase';
import ProcessingPhase from './ProcessingPhase';
import ReviewPhase from './ReviewPhase';
import CompletePhase from './CompletePhase';

function WizardHeader() {
  const { state, stats } = useBulkUpload();
  const { phase, batch } = state;

  const steps = [
    { id: 'upload', label: 'Upload', icon: 'fa-cloud-upload-alt' },
    { id: 'processing', label: 'Processing', icon: 'fa-cog' },
    { id: 'review', label: 'Review', icon: 'fa-check-circle' },
    { id: 'complete', label: 'Complete', icon: 'fa-flag-checkered' }
  ];

  const currentIndex = steps.findIndex(s => s.id === phase);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 'var(--space-6) var(--space-8)',
      background: 'color-mix(in srgb, var(--accent-blue) 15%, white)',
      boxShadow: 'rgba(0, 0, 0, 0.25) 0px 6px 20px',
      position: 'relative',
      zIndex: 5,
    }}>
      {/* Title */}
      <div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 700,
          color: 'var(--neutral-800)',
          marginBottom: 'var(--space-1)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}>
          <i className="fas fa-upload" style={{ color: 'var(--accent-blue)' }}></i>
          Bulk Upload
        </h1>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--neutral-500)',
        }}>
          {phase === 'upload' && 'Upload multiple PDFs with automatic metadata extraction'}
          {phase === 'processing' && `Processing ${batch?.total_count || 0} files...`}
          {phase === 'review' && `Review ${batch?.items?.length || 0} items`}
          {phase === 'complete' && 'Upload complete!'}
        </p>
      </div>

      {/* Step Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}>
        {steps.map((step, idx) => {
          const isActive = step.id === phase;
          const isComplete = idx < currentIndex;
          const isFuture = idx > currentIndex;

          return (
            <React.Fragment key={step.id}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: '20px',
                background: isActive
                  ? 'var(--accent-blue)'
                  : isComplete
                    ? 'color-mix(in srgb, var(--accent-blue) 15%, white)'
                    : 'var(--neutral-100)',
                color: isActive
                  ? 'white'
                  : isComplete
                    ? 'var(--accent-blue)'
                    : 'var(--neutral-400)',
                transition: 'all 0.2s ease',
              }}>
                <i className={`fas ${isComplete ? 'fa-check' : step.icon}`} style={{ fontSize: 'var(--text-xs)' }}></i>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: isActive ? 600 : 400,
                }}>
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div style={{
                  width: '20px',
                  height: '2px',
                  background: idx < currentIndex ? 'var(--accent-blue)' : 'var(--neutral-200)',
                }}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function WizardContent() {
  const { state, dispatch } = useBulkUpload();

  // Fetch active batch on mount
  const fetchActiveBatch = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await fetch('/upload_batches/active.json');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          dispatch({ type: 'SET_BATCH', payload: data });
          // Determine phase based on batch status
          if (data.status === 'pending') {
            dispatch({ type: 'SET_PHASE', payload: 'upload' });
          } else if (data.status === 'processing') {
            dispatch({ type: 'SET_PHASE', payload: 'processing' });
          } else if (data.status === 'completed' || data.status === 'failed') {
            dispatch({ type: 'SET_PHASE', payload: 'review' });
          }
        }
      }
    } catch (err) {
      console.error('Error fetching active batch:', err);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load batch data' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  useEffect(() => {
    fetchActiveBatch();
  }, [fetchActiveBatch]);

  // Show loading state
  if (state.loading && !state.batch) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
      }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--accent-blue)' }}></i>
      </div>
    );
  }

  // Render current phase
  switch (state.phase) {
    case 'upload':
      return <UploadPhase />;
    case 'processing':
      return <ProcessingPhase />;
    case 'review':
      return <ReviewPhase />;
    case 'complete':
      return <CompletePhase />;
    default:
      return <UploadPhase />;
  }
}

export default function BulkUploadWizard() {
  return (
    <BulkUploadProvider>
      <WizardHeader />
      <div style={{ background: 'white', minHeight: 'calc(100vh - 150px)' }}>
        <WizardContent />
      </div>
    </BulkUploadProvider>
  );
}
