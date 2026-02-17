import React, { useState, useEffect, useRef, useCallback } from 'react';
import SlidePanel from './SlidePanel';
import ConceptSelector from './ConceptSelector';
import TagSelector from './TagSelector';
import SourceSelector from './SourceSelector';
import RichTextEditor from './RichTextEditor';

// Helper to fetch and manage collections

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

  // Collections state
  const [collections, setCollections] = useState([]);
  const [itemCollections, setItemCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState('');

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
      setCollectionFilter('');
      fetchCollections();
      if (item) {
        fetchItemCollections(item.id);
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
        setItemCollections([]);
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

  const fetchCollections = async () => {
    setLoadingCollections(true);
    try {
      const response = await fetch('/collections.json');
      const data = await response.json();
      setCollections(data);
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  const fetchItemCollections = async (personId) => {
    try {
      const response = await fetch(`/people/${personId}.json`);
      const data = await response.json();
      setItemCollections(data.collections || []);
    } catch (error) {
      console.error('Error fetching item collections:', error);
    }
  };

  const handleAddToCollection = async (collectionId) => {
    if (!item?.id) return;

    try {
      const response = await fetch(`/collections/${collectionId}/add_item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          item_type: 'Person',
          item_id: item.id
        }),
      });

      if (response.ok) {
        const collection = collections.find(c => c.id === collectionId);
        if (collection && !itemCollections.find(c => c.id === collectionId)) {
          setItemCollections([...itemCollections, collection]);
        }
      }
    } catch (error) {
      console.error('Error adding to collection:', error);
    }
  };

  const handleRemoveFromCollection = async (collectionId) => {
    if (!item?.id) return;

    try {
      const response = await fetch(`/collections/${collectionId}/remove_item`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          item_type: 'Person',
          item_id: item.id
        }),
      });

      if (response.ok) {
        setItemCollections(itemCollections.filter(c => c.id !== collectionId));
      }
    } catch (error) {
      console.error('Error removing from collection:', error);
    }
  };

  const handleCreateCollection = async (name) => {
    if (!name.trim()) return;

    try {
      const response = await fetch('/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          collection: { name: name.trim() }
        }),
      });

      if (response.ok) {
        const newCollection = await response.json();
        setCollections([newCollection, ...collections]);
        setCollectionFilter('');
        if (item?.id) {
          handleAddToCollection(newCollection.id);
        }
        return newCollection;
      }
    } catch (error) {
      console.error('Error creating collection:', error);
    }
    return null;
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
          background: 'var(--accent-gold)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <i className="fas fa-user" style={{ fontSize: 'var(--text-base)', opacity: 0.9 }}></i>
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
                background: 'rgba(255,255,255,0.9)',
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius)',
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
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
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
                e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
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
            background: '#e2e2e2',
            padding: 'var(--space-2)',
            paddingTop: 'var(--space-3)',
            flexShrink: 0,
            boxShadow: 'inset -8px 0 16px -8px rgba(0, 0, 0, 0.15)',
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
                color: 'var(--neutral-700)',
                background: activeTab === 'basic' ? '#c8c8c8' : 'transparent',
                border: 'none',
                textAlign: 'left',
                transition: 'background 0.15s',
                fontFamily: 'var(--font-body)',
                marginBottom: '0.25rem',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'basic') e.currentTarget.style.background = '#d8d8d8';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'basic') e.currentTarget.style.background = 'transparent';
              }}
              title="Basic Info"
            >
              <i className="fas fa-info-circle" style={{ width: '16px' }}></i>
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
                color: 'var(--neutral-700)',
                background: activeTab === 'details' ? '#c8c8c8' : 'transparent',
                border: 'none',
                textAlign: 'left',
                transition: 'background 0.15s',
                fontFamily: 'var(--font-body)',
                marginBottom: '0.25rem',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'details') e.currentTarget.style.background = '#d8d8d8';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'details') e.currentTarget.style.background = 'transparent';
              }}
              title="Details"
            >
              <i className="fas fa-file-alt" style={{ width: '16px' }}></i>
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
                color: 'var(--neutral-700)',
                background: activeTab === 'metadata' ? '#c8c8c8' : 'transparent',
                border: 'none',
                textAlign: 'left',
                transition: 'background 0.15s',
                fontFamily: 'var(--font-body)',
                marginBottom: '0.25rem',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'metadata') e.currentTarget.style.background = '#d8d8d8';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'metadata') e.currentTarget.style.background = 'transparent';
              }}
              title="Relationships"
            >
              <i className="fas fa-project-diagram" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Relationships</span>
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

            {/* Relationships Tab */}
            {activeTab === 'metadata' && (
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 700,
                  color: 'var(--accent-gold)',
                  marginBottom: 'var(--space-4)',
                }}>
                  Relationships
                </h2>

                {/* Row 1: Concepts and Tags */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  {/* Concepts */}
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 700,
                      color: 'var(--accent-green)',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}>
                      <i className="fas fa-lightbulb" style={{ fontSize: 'var(--text-sm)' }}></i>
                      Concepts
                    </div>
                    <div style={{ height: '280px' }}>
                      <ConceptSelector
                        selectedConceptIds={formData.concept_ids}
                        onChange={(concept_ids) => setFormData({ ...formData, concept_ids })}
                        themeColor="var(--accent-green)"
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 700,
                      color: 'var(--accent-purple)',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}>
                      <i className="fas fa-tag" style={{ fontSize: 'var(--text-sm)' }}></i>
                      Tags
                    </div>
                    <div style={{ height: '280px' }}>
                      <TagSelector
                        selectedTags={formData.tags}
                        onChange={(tags) => setFormData({ ...formData, tags })}
                        themeColor="var(--accent-purple)"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Collections */}
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 700,
                    color: 'var(--accent-maroon)',
                    marginBottom: 'var(--space-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}>
                    <i className="fas fa-folder" style={{ fontSize: 'var(--text-sm)' }}></i>
                    Collections
                  </div>

                  {!item?.id ? (
                    <div style={{
                      height: '280px',
                      padding: 'var(--space-4)',
                      background: 'var(--neutral-100)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--neutral-300)',
                      color: 'var(--neutral-500)',
                      fontSize: 'var(--text-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}>
                      Save the person first to add them to collections.
                    </div>
                  ) : (
                    <div style={{
                      border: '1px solid var(--neutral-300)',
                      borderRadius: 'var(--radius)',
                      overflow: 'hidden',
                      height: '280px',
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'white',
                    }}>
                      {/* In Collections */}
                      <div style={{
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--accent-maroon-light)',
                        borderBottom: '1px solid var(--neutral-200)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--accent-maroon)',
                      }}>
                        In Collections ({itemCollections.length})
                      </div>
                      <div style={{
                        flex: '0 0 auto',
                        maxHeight: '100px',
                        overflowY: 'auto',
                        borderBottom: '1px solid var(--neutral-200)',
                      }}>
                        {itemCollections.length === 0 ? (
                          <div style={{
                            padding: 'var(--space-2)',
                            color: 'var(--neutral-400)',
                            fontSize: 'var(--text-xs)',
                            textAlign: 'center',
                          }}>
                            Not in any collections yet
                          </div>
                        ) : (
                          <div style={{ padding: 'var(--space-2)' }}>
                            {itemCollections.map(collection => (
                              <div
                                key={collection.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: 'var(--space-1) var(--space-2)',
                                  background: 'var(--accent-maroon-light)',
                                  borderRadius: 'var(--radius)',
                                  marginBottom: 'var(--space-1)',
                                }}
                              >
                                <span style={{
                                  fontSize: 'var(--text-xs)',
                                  color: 'var(--neutral-700)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--space-1)',
                                }}>
                                  <i className="fas fa-folder" style={{ color: 'var(--accent-maroon)', fontSize: '10px' }}></i>
                                  {collection.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromCollection(collection.id)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--neutral-400)',
                                    cursor: 'pointer',
                                    padding: '2px 4px',
                                    fontSize: '10px',
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error)'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-400)'}
                                  title="Remove from collection"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add to Collection */}
                      <div style={{
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--neutral-100)',
                        borderBottom: '1px solid var(--neutral-200)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--neutral-500)',
                      }}>
                        Add to Collection
                      </div>
                      {/* Filter/Create Input */}
                      <div style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--neutral-200)' }}>
                        <input
                          type="text"
                          value={collectionFilter}
                          onChange={(e) => setCollectionFilter(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const filterLower = collectionFilter.trim().toLowerCase();
                              const canCreate = collectionFilter.trim() &&
                                !collections.some(c => c.name.toLowerCase() === filterLower);
                              if (canCreate) {
                                handleCreateCollection(collectionFilter.trim());
                              }
                            }
                          }}
                          placeholder="Type to filter or create..."
                          style={{
                            width: '100%',
                            padding: 'var(--space-1) var(--space-2)',
                            border: '1px solid var(--neutral-300)',
                            borderRadius: 'var(--radius)',
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'var(--font-body)',
                          }}
                        />
                        {(() => {
                          const filterLower = collectionFilter.trim().toLowerCase();
                          const canCreate = collectionFilter.trim() &&
                            !collections.some(c => c.name.toLowerCase() === filterLower);
                          if (canCreate) {
                            return (
                              <button
                                type="button"
                                onClick={() => handleCreateCollection(collectionFilter.trim())}
                                style={{
                                  background: 'none',
                                  padding: 0,
                                  color: 'var(--accent-maroon)',
                                  fontSize: 'var(--text-xs)',
                                  border: 'none',
                                  cursor: 'pointer',
                                  marginTop: 'var(--space-1)',
                                  fontFamily: 'var(--font-body)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--space-1)',
                                }}
                              >
                                <i className="fas fa-plus"></i> Create "{collectionFilter.trim()}"
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: 'var(--space-1)',
                      }}>
                        {loadingCollections ? (
                          <div style={{
                            padding: 'var(--space-2)',
                            color: 'var(--neutral-400)',
                            fontSize: 'var(--text-xs)',
                            textAlign: 'center',
                          }}>
                            Loading...
                          </div>
                        ) : (() => {
                          const availableCollections = collections
                            .filter(c => !itemCollections.find(ic => ic.id === c.id))
                            .filter(c => !collectionFilter.trim() ||
                              c.name.toLowerCase().includes(collectionFilter.trim().toLowerCase()));

                          if (availableCollections.length === 0) {
                            return (
                              <div style={{
                                padding: 'var(--space-2)',
                                color: 'var(--neutral-400)',
                                fontSize: 'var(--text-xs)',
                                textAlign: 'center',
                              }}>
                                {collectionFilter.trim()
                                  ? 'No matches. Press Enter to create.'
                                  : collections.length === 0
                                    ? 'No collections yet.'
                                    : 'In all collections'}
                              </div>
                            );
                          }

                          return availableCollections.map(collection => (
                            <div
                              key={collection.id}
                              onClick={() => handleAddToCollection(collection.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-1)',
                                padding: 'var(--space-1) var(--space-2)',
                                borderRadius: 'var(--radius)',
                                cursor: 'pointer',
                                marginBottom: '2px',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-100)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <i className="fas fa-folder" style={{ color: 'var(--neutral-400)', fontSize: '10px' }}></i>
                              <span style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--neutral-600)',
                                flex: 1,
                              }}>
                                {collection.name}
                              </span>
                              <i className="fas fa-plus" style={{ color: 'var(--accent-maroon)', fontSize: '10px' }}></i>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - only show for new people, editing uses autosave */}
        {!item && (
          <div style={{
            borderTop: '1px solid var(--neutral-200)',
            background: 'white',
            padding: 'var(--space-4) var(--space-6)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1.25rem',
                background: 'white',
                color: 'var(--accent-gold)',
                border: '1px solid var(--accent-gold)',
                borderRadius: '6px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '0.5rem 1.25rem',
                background: 'var(--accent-gold)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#8a6624'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-gold)'}
            >
              Create Person
            </button>
          </div>
        )}
      </form>
    </SlidePanel>
  );
}
