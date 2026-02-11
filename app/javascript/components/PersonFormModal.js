import React, { useState, useEffect, useRef, useCallback } from 'react';
import SlidePanel from './SlidePanel';
import ConceptSelector from './ConceptSelector';
import TagSelector from './TagSelector';
import SourceSelector from './SourceSelector';
import RichTextEditor from './RichTextEditor';

export default function PersonFormModal({ isOpen, onClose, onSuccess, item }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'pending', 'saving', 'saved', 'error'
  const saveTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);
  const lastSavedData = useRef(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    role: 'theorist',
    email: '',
    url: '',
    summary: '',
    aka: [],
    concept_ids: [],
    source_ids: [],
    tags: []
  });
  const [error, setError] = useState('');

  // Autosave function for existing items
  const performAutosave = useCallback(async (dataToSave) => {
    if (!item?.id) return;

    setSaveStatus('saving');

    try {
      const response = await fetch(`/people/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ person: dataToSave }),
      });

      if (response.ok) {
        lastSavedData.current = JSON.stringify(dataToSave);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Autosave error:', error);
      setSaveStatus('error');
    }
  }, [item?.id]);

  // Handle close with pending save check
  const handleClose = useCallback(async () => {
    // If there's a pending save, save immediately before closing
    if (saveStatus === 'pending' && item?.id) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      await performAutosave(formData);
    }
    // If currently saving, wait for it to complete
    else if (saveStatus === 'saving') {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    onClose();
  }, [saveStatus, item?.id, formData, performAutosave, onClose]);

  // Debounced autosave effect
  useEffect(() => {
    if (!isOpen || !item?.id) return;

    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedData.current = JSON.stringify(formData);
      return;
    }

    // Skip if data hasn't changed
    if (JSON.stringify(formData) === lastSavedData.current) return;

    // Show pending state immediately when data changes
    setSaveStatus('pending');

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new debounced save
    saveTimeoutRef.current = setTimeout(() => {
      performAutosave(formData);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, isOpen, item?.id, performAutosave]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
      setSaveStatus('idle');
      isInitialMount.current = true;
      if (item) {
        // Combine first_name and middle_name if middle_name exists (for legacy data)
        const combinedFirstName = [item.first_name, item.middle_name]
          .filter(Boolean)
          .join(' ') || '';

        const newFormData = {
          first_name: combinedFirstName,
          last_name: item.last_name || '',
          role: item.role || 'theorist',
          email: item.email || '',
          url: item.url || '',
          summary: item.summary || '',
          aka: item.aka || [],
          concept_ids: item.concept_ids || [],
          source_ids: item.source_ids || [],
          tags: item.tags || []
        };
        setFormData(newFormData);
        lastSavedData.current = JSON.stringify(newFormData);
      } else {
        setFormData({
          first_name: '',
          last_name: '',
          role: 'theorist',
          email: '',
          url: '',
          summary: '',
          aka: [],
          concept_ids: [],
          source_ids: [],
          tags: []
        });
        lastSavedData.current = null;
      }
      setError('');
    }
  }, [isOpen, item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const url = item ? `/people/${item.id}` : '/people';
      const method = item ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ person: formData }),
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data);
        onClose();
      } else {
        const data = await response.json();
        setError(data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error saving person:', error);
      setError('An error occurred while saving the person');
    }
  };

  const handleArrayInput = (value) => {
    const items = value.split('\n').filter(item => item.trim());
    setFormData({ ...formData, aka: items });
  };

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--neutral-200)',
          background: 'var(--sidebar-bg)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--accent-gold)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <i className="fas fa-user" style={{ fontSize: 'var(--text-base)', opacity: 0.7 }}></i>
              {item ? (`${formData.first_name} ${formData.last_name}`.trim() || item.full_name || 'Untitled Person') : 'New Person'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {/* Save Status - only show for editing */}
            {item && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                background: 'white',
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-sm)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-body)',
              }}>
                {saveStatus === 'pending' && (
                  <>
                    <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--neutral-400)' }}></i>
                    <span style={{ color: 'var(--neutral-500)' }}>Save Pending...</span>
                  </>
                )}
                {saveStatus === 'saving' && (
                  <>
                    <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--accent-gold)' }}></i>
                    <span style={{ color: 'var(--accent-gold)' }}>Saving...</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <i className="fas fa-check" style={{ color: 'var(--accent-green)' }}></i>
                    <span style={{ color: 'var(--accent-green)' }}>Saved</span>
                  </>
                )}
                {saveStatus === 'error' && (
                  <>
                    <i className="fas fa-exclamation-circle" style={{ color: 'var(--error)' }}></i>
                    <span style={{ color: 'var(--error)' }}>Error</span>
                  </>
                )}
                {saveStatus === 'idle' && (
                  <span style={{ color: 'var(--neutral-400)' }}>Auto-Saving Enabled</span>
                )}
              </div>
            )}
            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--neutral-400)',
                fontSize: 'var(--text-xl)',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--neutral-200)';
                e.currentTarget.style.color = 'var(--neutral-700)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--neutral-400)';
              }}
              title="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ margin: 'var(--space-4)', marginBottom: 0 }}>
            <span className="alert-title"><i className="fas fa-times-circle"></i> Error:</span>
            {error}
          </div>
        )}

        {/* Sidebar + Content Layout */}
        <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden', position: 'relative' }}>
          {/* Left Sidebar Navigation */}
          <div className="w-12 md:w-[200px]" style={{
            background: 'var(--sidebar-bg)',
            padding: 'var(--space-2)',
            paddingTop: 'var(--space-3)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div className="hidden md:block" style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--neutral-500)',
              marginBottom: 'var(--space-3)',
              fontFamily: 'var(--font-body)',
            }}>
              Sections
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className="justify-center md:justify-start"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--accent-gold)',
                background: activeTab === 'basic' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                textAlign: 'left',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-body)',
                fontWeight: activeTab === 'basic' ? 600 : 400,
                marginBottom: 'var(--space-1)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'basic') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'basic') e.currentTarget.style.background = 'transparent';
              }}
              title="Basic Info"
            >
              <i className="fas fa-info-circle" style={{ width: '16px', color: 'var(--accent-gold)' }}></i>
              <span className="hidden md:inline">Basic Info</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className="justify-center md:justify-start"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--accent-gold)',
                background: activeTab === 'details' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                textAlign: 'left',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-body)',
                fontWeight: activeTab === 'details' ? 600 : 400,
                marginBottom: 'var(--space-1)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'details') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'details') e.currentTarget.style.background = 'transparent';
              }}
              title="Details"
            >
              <i className="fas fa-file-alt" style={{ width: '16px', color: 'var(--accent-gold)' }}></i>
              <span className="hidden md:inline">Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('metadata')}
              className="justify-center md:justify-start"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--accent-gold)',
                background: activeTab === 'metadata' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                textAlign: 'left',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-body)',
                fontWeight: activeTab === 'metadata' ? 600 : 400,
                marginBottom: 'var(--space-1)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'metadata') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'metadata') e.currentTarget.style.background = 'transparent';
              }}
              title="Concepts & Tags"
            >
              <i className="fas fa-tags" style={{ width: '16px', color: 'var(--accent-gold)' }}></i>
              <span className="hidden md:inline">Concepts & Tags</span>
            </button>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', background: 'white' }}>
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 700,
                  color: 'var(--accent-gold)',
                  marginBottom: 'var(--space-4)',
                }}>
                  Basic Information
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {/* Name Fields */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                      <label className="form-label">First/Given Name(s) *</label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="form-input"
                        style={{
                          width: '100%',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-base)'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.border = '2px solid var(--accent-gold)';
                          e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent-gold) 10%, transparent)';
                          e.currentTarget.style.padding = 'calc(var(--space-3) - 1px)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.border = '1px solid var(--neutral-300)';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.padding = 'var(--space-3)';
                        }}
                        placeholder="e.g., Aaron T."
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Last Name *</label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="form-input"
                        style={{
                          width: '100%',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-base)'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.border = '2px solid var(--accent-gold)';
                          e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent-gold) 10%, transparent)';
                          e.currentTarget.style.padding = 'calc(var(--space-3) - 1px)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.border = '1px solid var(--neutral-300)';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.padding = 'var(--space-3)';
                        }}
                        placeholder="e.g., Beck"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="form-select"
                      style={{
                        width: '100%',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-base)'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.border = '2px solid var(--accent-gold)';
                        e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent-gold) 10%, transparent)';
                        e.currentTarget.style.padding = 'calc(var(--space-3) - 1px)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.border = '1px solid var(--neutral-300)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.padding = 'var(--space-3)';
                      }}
                    >
                      <option value="theorist">Theorist</option>
                      <option value="clinician">Clinician</option>
                      <option value="researcher">Researcher</option>
                      <option value="peer">Peer</option>
                      <option value="client">Client</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div>
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="form-input"
                        style={{
                          width: '100%',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-base)'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.border = '2px solid var(--accent-gold)';
                          e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent-gold) 10%, transparent)';
                          e.currentTarget.style.padding = 'calc(var(--space-3) - 1px)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.border = '1px solid var(--neutral-300)';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.padding = 'var(--space-3)';
                        }}
                        placeholder="email@example.com"
                      />
                    </div>

                    <div>
                      <label className="form-label">URL</label>
                      <input
                        type="url"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        className="form-input"
                        style={{
                          width: '100%',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-base)'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.border = '2px solid var(--accent-gold)';
                          e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent-gold) 10%, transparent)';
                          e.currentTarget.style.padding = 'calc(var(--space-3) - 1px)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.border = '1px solid var(--neutral-300)';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.padding = 'var(--space-3)';
                        }}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Also Known As (one per line)</label>
                    <textarea
                      value={formData.aka.join('\n')}
                      onChange={(e) => handleArrayInput(e.target.value)}
                      rows="3"
                      className="form-textarea"
                      style={{
                        width: '100%',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-base)',
                        resize: 'vertical'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.border = '2px solid var(--accent-gold)';
                        e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent-gold) 10%, transparent)';
                        e.currentTarget.style.padding = 'calc(var(--space-3) - 1px)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.border = '1px solid var(--neutral-300)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.padding = 'var(--space-3)';
                      }}
                      placeholder="Aaron T. Beck&#10;A.T. Beck"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Details Tab */}
            {activeTab === 'details' && (
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 700,
                  color: 'var(--accent-gold)',
                  marginBottom: 'var(--space-4)',
                }}>
                  Details
                </h2>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-4)',
                  height: '100%'
                }}>
                  <div>
                    <label className="form-label">Summary</label>
                    <RichTextEditor
                      value={formData.summary}
                      onChange={(html) => setFormData({ ...formData, summary: html })}
                      placeholder="Brief summary of this person and their work..."
                      rows={15}
                      themeColor="var(--accent-gold)"
                    />
                  </div>

                  <div>
                    <label className="form-label">Sources</label>
                    <div style={{ height: '370px' }}>
                      <SourceSelector
                        selectedSourceIds={formData.source_ids}
                        onChange={(source_ids) => setFormData({ ...formData, source_ids })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Metadata Tab */}
            {activeTab === 'metadata' && (
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 700,
                  color: 'var(--accent-gold)',
                  marginBottom: 'var(--space-4)',
                }}>
                  Concepts & Tags
                </h2>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-4)',
                  height: '100%'
                }}>
                  <div>
                    <label className="form-label">Concepts</label>
                    <div style={{ height: '370px' }}>
                      <ConceptSelector
                        selectedConceptIds={formData.concept_ids}
                        onChange={(concept_ids) => setFormData({ ...formData, concept_ids })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Tags</label>
                    <div style={{ height: '370px' }}>
                      <TagSelector
                        selectedTags={formData.tags}
                        onChange={(tags) => setFormData({ ...formData, tags })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - only show for new people, editing uses autosave */}
        {!item && (
          <div style={{
            borderTop: '1px solid var(--neutral-200)',
            padding: 'var(--space-6)',
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--space-3)',
          }}>
            <button
              type="submit"
              className="btn-primary"
              style={{ background: 'var(--accent-gold)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#8a6624'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-gold)'}
            >
              Create Person
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </SlidePanel>
  );
}
