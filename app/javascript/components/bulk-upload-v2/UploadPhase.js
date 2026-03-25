import React, { useState, useCallback, useRef } from 'react';
import { useBulkUpload } from './BulkUploadContext';

export default function UploadPhase() {
  const { state, dispatch } = useBulkUpload();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // If we have a pending batch, show it
  const hasPendingBatch = state.batch && state.batch.status === 'pending';

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const collectPdfFiles = async (items) => {
    const pdfFiles = [];

    const processEntry = async (entry) => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file((file) => {
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
              pdfFiles.push(file);
            }
            resolve();
          });
        });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        return new Promise((resolve) => {
          reader.readEntries(async (entries) => {
            for (const subEntry of entries) {
              await processEntry(subEntry);
            }
            resolve();
          });
        });
      }
    };

    for (const item of items) {
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          await processEntry(entry);
        }
      } else if (item.getAsFile) {
        const file = item.getAsFile();
        if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
          pdfFiles.push(file);
        }
      }
    }

    return pdfFiles;
  };

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError('');

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const pdfFiles = await collectPdfFiles(items);

    if (pdfFiles.length === 0) {
      setError('No PDF files found in the dropped items.');
      return;
    }

    await uploadFiles(pdfFiles);
  }, []);

  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files).filter(
      file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );

    if (files.length === 0) {
      setError('No PDF files selected.');
      return;
    }

    await uploadFiles(files);
  }, []);

  const uploadFiles = async (files) => {
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    setError('');

    try {
      const formData = new FormData();
      formData.append('name', `Upload ${new Date().toLocaleString()}`);

      files.forEach((file, idx) => {
        formData.append('files[]', file);
        setUploadProgress({ current: idx + 1, total: files.length });
      });

      const response = await fetch('/batch_uploads', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: formData,
      });

      if (response.ok) {
        const batch = await response.json();
        // Fetch full batch with items
        const fullResponse = await fetch(`/batch_uploads/${batch.id}.json`);
        if (fullResponse.ok) {
          const fullBatch = await fullResponse.json();
          dispatch({ type: 'SET_BATCH', payload: fullBatch });
        } else {
          dispatch({ type: 'SET_BATCH', payload: batch });
        }
      } else {
        const data = await response.json();
        setError(data.errors?.join(', ') || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('An error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  const handleStartProcessing = async () => {
    if (!state.batch) return;

    try {
      const response = await fetch(`/batch_uploads/${state.batch.id}/start_processing`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'SET_BATCH', payload: data });
        dispatch({ type: 'SET_PHASE', payload: 'processing' });
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to start processing');
      }
    } catch (err) {
      setError('Failed to start processing');
    }
  };

  const handleCancelBatch = async () => {
    if (!state.batch) return;

    if (!confirm('Are you sure you want to cancel this upload batch? All uploaded files will be removed.')) {
      return;
    }

    try {
      const response = await fetch(`/batch_uploads/${state.batch.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        dispatch({ type: 'RESET' });
      }
    } catch (err) {
      setError('Failed to cancel batch');
    }
  };

  // Uploading state
  if (uploading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6)' }}>
        <div
          style={{
            padding: 'var(--space-12)',
            textAlign: 'center',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--accent-blue) 15%, white)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-4)',
        }}>
          <i className="fas fa-cloud-upload-alt fa-spin" style={{ fontSize: '2.5rem', color: 'var(--accent-blue)' }}></i>
        </div>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          color: 'var(--neutral-700)',
          marginBottom: 'var(--space-2)',
        }}>
          Uploading PDFs...
        </h2>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          color: 'var(--neutral-500)',
          marginBottom: 'var(--space-4)',
        }}>
          {uploadProgress.current} of {uploadProgress.total} files
        </p>
        <div style={{
          width: '200px',
          height: '8px',
          background: 'var(--neutral-200)',
          borderRadius: '4px',
          margin: '0 auto',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
            height: '100%',
            background: 'var(--accent-blue)',
            transition: 'width 0.3s ease',
          }}></div>
        </div>
        </div>
      </div>
    );
  }

  // Pending batch - show files and start button
  if (hasPendingBatch) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6)' }}>
      <div
        style={{
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'color-mix(in srgb, var(--accent-blue) 15%, white)',
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid color-mix(in srgb, var(--accent-blue) 25%, white)',
        }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              color: 'var(--neutral-800)',
              margin: 0,
            }}>
              {state.batch.total_count} PDFs Ready to Process
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              color: 'var(--neutral-500)',
              margin: 0,
            }}>
              Click "Start Processing" to begin extracting metadata
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={handleCancelBatch} className="btn-outline-source" style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)' }}>
              Cancel
            </button>
            <button
              onClick={handleStartProcessing}
              className="btn-source"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)' }}
            >
              <i className="fas fa-play"></i>
              Start Processing
            </button>
          </div>
        </div>

        {/* File list preview */}
        <div style={{ padding: 'var(--space-4)' }}>
          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid var(--neutral-200)',
            borderRadius: '6px',
            background: 'white',
          }}>
          {state.batch.items?.map((item, idx) => (
            <div
              key={item.id}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: idx < state.batch.items.length - 1 ? '1px solid var(--neutral-100)' : 'none',
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
      </div>
    );
  }

  // Dropzone
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6)' }}>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          background: isDragging ? 'color-mix(in srgb, var(--accent-blue) 10%, white)' : 'white',
          border: `3px dashed ${isDragging ? 'var(--accent-blue)' : 'var(--neutral-300)'}`,
          borderRadius: '12px',
          padding: 'var(--space-12)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <i
          className="fas fa-folder-open"
          style={{
            fontSize: '5rem',
            color: isDragging ? 'var(--accent-blue)' : 'var(--neutral-400)',
            marginBottom: 'var(--space-6)',
            transition: 'color 0.2s ease',
          }}
        ></i>

        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          color: 'var(--neutral-700)',
          marginBottom: 'var(--space-2)',
        }}>
          {isDragging ? 'Drop your PDFs here' : 'Drop a folder or PDFs here'}
        </h2>

        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          color: 'var(--neutral-500)',
          marginBottom: 'var(--space-6)',
          maxWidth: '400px',
        }}>
          Drag and drop a folder containing PDFs, or multiple PDF files.
          We'll extract DOIs and fetch metadata automatically.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button
            type="button"
            className="btn-source"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <i className="fas fa-file-pdf"></i>
            Select PDFs
          </button>

          <button
            type="button"
            className="btn-outline-source"
            onClick={(e) => {
              e.stopPropagation();
              folderInputRef.current?.click();
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <i className="fas fa-folder"></i>
            Select Folder
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      <div style={{
        marginTop: 'var(--space-4)',
        padding: 'var(--space-4)',
        background: '#e2e2e2',
        borderRadius: '8px',
        border: '1px solid var(--neutral-200)',
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          color: 'var(--neutral-700)',
          marginBottom: 'var(--space-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <i className="fas fa-info-circle" style={{ color: 'var(--accent-blue)' }}></i>
          How it works
        </h3>
        <ol style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--neutral-600)',
          paddingLeft: 'var(--space-5)',
          margin: 0,
        }}>
          <li style={{ marginBottom: 'var(--space-1)' }}>Upload your PDFs (up to 300+ at once)</li>
          <li style={{ marginBottom: 'var(--space-1)' }}>We extract DOIs and fetch metadata from CrossRef, OpenAlex, and more</li>
          <li style={{ marginBottom: 'var(--space-1)' }}>Review and link authors - create once, link everywhere</li>
          <li>Approve to create sources with PDFs attached</li>
        </ol>
      </div>
    </div>
  );
}
