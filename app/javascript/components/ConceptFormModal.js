import React, { useState, useEffect, useRef, useCallback } from 'react';
import SlidePanel from './SlidePanel';
import ConceptSearchSelect from './ConceptSearchSelect';
import InlineRelTypeSelect, { getRelTypeCategory } from './InlineRelTypeSelect';
import TagSelector from './TagSelector';
import { NODE_TYPES } from '../config/nodeTypes';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBold, faItalic, faUnderline, faStrikethrough,
  faListUl, faListOl, faLink, faUnlink, faQuoteLeft
} from '@fortawesome/free-solid-svg-icons';

export default function ConceptFormModal({ isOpen, onClose, onSuccess, item, onEditRelatedConcept, stackDepth = 0 }) {
  const [concepts, setConcepts] = useState([]);
  const [activeTab, setActiveTab] = useState('basics');
  const [deletedRelationshipIds, setDeletedRelationshipIds] = useState([]);
  const [newRelationships, setNewRelationships] = useState([]);
  const [updatedRelationships, setUpdatedRelationships] = useState({}); // { id: newRelType }
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [typeDropdownPos, setTypeDropdownPos] = useState({ top: 0, left: 0 });
  const typeDropdownTriggerRef = useRef(null);
  const [formData, setFormData] = useState({
    label: '',
    node_type: 'undeclared',
    level_status: 'mapped',
    summary_top: '',
    summary_mid: '',
    summary_deep: '',
    tags: [],
    new_relationship_dst_concept_id: '',
    new_relationship_rel_type: 'related_to'
  });
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const saveTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);
  const lastSavedData = useRef(null);

  // Editor extensions configuration
  const editorExtensions = [
    StarterKit,
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'text-primary underline' },
    }),
  ];

  // WYSIWYG editors for summary fields
  const editorTop = useEditor({
    extensions: editorExtensions,
    content: formData.summary_top,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, summary_top: editor.getHTML() }));
    },
  });

  const editorMid = useEditor({
    extensions: editorExtensions,
    content: formData.summary_mid,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, summary_mid: editor.getHTML() }));
    },
  });

  const editorDeep = useEditor({
    extensions: editorExtensions,
    content: formData.summary_deep,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, summary_deep: editor.getHTML() }));
    },
  });

  // Toolbar styles
  const toolbarButtonStyle = (isActive) => ({
    padding: 'var(--space-1)',
    borderRadius: '4px',
    fontSize: 'var(--text-xs)',
    color: 'var(--primary)',
    background: isActive ? 'var(--accent-green-light)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
  });

  const toolbarHover = (isActive) => ({
    onMouseEnter: (e) => !isActive && (e.currentTarget.style.background = 'var(--neutral-100)'),
    onMouseLeave: (e) => !isActive && (e.currentTarget.style.background = 'transparent'),
  });

  // Autosave function for existing items
  const performAutosave = useCallback(async (dataToSave) => {
    if (!item?.id) return;

    setSaveStatus('saving');

    try {
      const response = await fetch(`/concepts/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ concept: dataToSave }),
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

  // Debounced autosave effect
  useEffect(() => {
    if (!isOpen || !item?.id) return;

    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedData.current = JSON.stringify(formData);
      return;
    }

    // Skip if data hasn't changed (exclude relationship form fields)
    const dataToCompare = { ...formData };
    delete dataToCompare.new_relationship_dst_concept_id;
    delete dataToCompare.new_relationship_rel_type;

    const lastData = lastSavedData.current ? JSON.parse(lastSavedData.current) : null;
    if (lastData) {
      delete lastData.new_relationship_dst_concept_id;
      delete lastData.new_relationship_rel_type;
    }

    if (JSON.stringify(dataToCompare) === JSON.stringify(lastData)) return;

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
      setActiveTab('basics');
      setDeletedRelationshipIds([]);
      setNewRelationships([]);
      setUpdatedRelationships({});
      setTypeDropdownOpen(false);
      setSaveStatus('idle');
      isInitialMount.current = true;
      fetchConcepts();
      if (item) {
        const newFormData = {
          label: item.label || '',
          node_type: item.node_type || 'undeclared',
          level_status: item.level_status || 'mapped',
          summary_top: item.summary_top || '',
          summary_mid: item.summary_mid || '',
          summary_deep: item.summary_deep || '',
          tags: item.tags || [],
          new_relationship_dst_concept_id: '',
          new_relationship_rel_type: 'related_to'
        };
        setFormData(newFormData);
        lastSavedData.current = JSON.stringify(newFormData);
        // Set editor content
        if (editorTop) editorTop.commands.setContent(newFormData.summary_top);
        if (editorMid) editorMid.commands.setContent(newFormData.summary_mid);
        if (editorDeep) editorDeep.commands.setContent(newFormData.summary_deep);
      } else {
        const newFormData = {
          label: '',
          node_type: 'undeclared',
          level_status: 'mapped',
          summary_top: '',
          summary_mid: '',
          summary_deep: '',
          tags: [],
          new_relationship_dst_concept_id: '',
          new_relationship_rel_type: 'related_to'
        };
        setFormData(newFormData);
        lastSavedData.current = null;
        // Clear editor content
        if (editorTop) editorTop.commands.setContent('');
        if (editorMid) editorMid.commands.setContent('');
        if (editorDeep) editorDeep.commands.setContent('');
      }
      setError('');
    }
  }, [isOpen, item, editorTop, editorMid, editorDeep]);

  const fetchConcepts = async () => {
    try {
      const response = await fetch('/concepts.json');
      const data = await response.json();
      setConcepts(data);
    } catch (error) {
      console.error('Error fetching concepts:', error);
    }
  };

  const handleDeleteRelationship = async (relationshipId) => {
    if (!confirm('Are you sure you want to delete this relationship?')) return;

    try {
      const response = await fetch(`/connections/${relationshipId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setDeletedRelationshipIds([...deletedRelationshipIds, relationshipId]);
      } else {
        alert('Failed to delete relationship');
      }
    } catch (error) {
      console.error('Error deleting relationship:', error);
      alert('An error occurred while deleting the relationship');
    }
  };

  const handleAddRelationship = async () => {
    if (!item?.id) {
      alert('Please save the construct first before adding relationships');
      return;
    }

    if (!formData.new_relationship_dst_concept_id) {
      alert('Please select a construct to relate to');
      return;
    }

    try {
      const response = await fetch('/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          connection: {
            src_concept_id: item.id,
            dst_concept_id: formData.new_relationship_dst_concept_id,
            rel_type: formData.new_relationship_rel_type,
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Find the destination concept
        const dstConcept = concepts.find(c => c.id === parseInt(formData.new_relationship_dst_concept_id));

        // Add to newRelationships state
        setNewRelationships([
          ...newRelationships,
          {
            id: data.id,
            rel_type: formData.new_relationship_rel_type,
            dst_concept: dstConcept,
            relationship_label: data.relationship_label,
          }
        ]);

        // Reset the form
        setFormData({
          ...formData,
          new_relationship_dst_concept_id: '',
          new_relationship_rel_type: 'related_to'
        });
      } else {
        const data = await response.json();
        alert(data.errors?.join(', ') || 'Failed to create relationship');
      }
    } catch (error) {
      console.error('Error creating relationship:', error);
      alert('An error occurred while creating the relationship');
    }
  };

  const handleUpdateRelationshipType = async (connectionId, newRelType) => {
    try {
      const response = await fetch(`/connections/${connectionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          connection: { rel_type: newRelType }
        }),
      });

      if (response.ok) {
        // Track the update locally so UI reflects the change
        setUpdatedRelationships(prev => ({ ...prev, [connectionId]: newRelType }));
      } else {
        const data = await response.json();
        alert(data.errors?.join(', ') || 'Failed to update relationship');
      }
    } catch (error) {
      console.error('Error updating relationship:', error);
      alert('An error occurred while updating the relationship');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const url = item ? `/concepts/${item.id}` : '/concepts';
      const method = item ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ concept: formData }),
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
      console.error('Error saving concept:', error);
      setError('An error occurred while saving the concept');
    }
  };

  const handleCreateConcept = async (label) => {
    try {
      const response = await fetch('/concepts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ concept: { label, node_type: 'concept' } }),
      });

      if (response.ok) {
        const newConcept = await response.json();
        setConcepts(prev => [...prev, newConcept]);
        return newConcept;
      }
    } catch (error) {
      console.error('Error creating concept:', error);
    }
    return null;
  };

  const handleClose = async () => {
    // If there's a pending save, save immediately before closing
    if (saveStatus === 'pending' && item?.id) {
      // Clear the debounce timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Save immediately and wait for it
      await performAutosave(formData);
    }
    // If currently saving, wait for it to complete
    else if (saveStatus === 'saving') {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    // If we added, deleted, or updated relationships, refresh the parent
    if (newRelationships.length > 0 || deletedRelationshipIds.length > 0 || Object.keys(updatedRelationships).length > 0) {
      onSuccess();
    }
    onClose();
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
            {/* Back Button - shown when in stacked modal */}
            {stackDepth > 0 && (
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: 'var(--accent-green-light)',
                  border: '1px solid var(--primary)',
                  color: 'var(--primary)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  padding: 'var(--space-1) var(--space-2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  borderRadius: 'var(--radius)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent-green-light)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                title="Go back to previous concept"
              >
                <i className="fas fa-arrow-left"></i>
                <span className="hidden md:inline">Back</span>
              </button>
            )}
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <i className="fas fa-lightbulb" style={{ fontSize: 'var(--text-base)', opacity: 0.7 }}></i>
              {item ? (formData.label || item.label || 'Untitled Concept') : 'New Construct'}
            </h2>
            {stackDepth > 0 && (
              <span style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--neutral-400)',
                background: 'var(--neutral-100)',
                padding: '2px 8px',
                borderRadius: '10px',
              }}>
                Level {stackDepth + 1}
              </span>
            )}
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
                    <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--primary)' }}></i>
                    <span style={{ color: 'var(--primary)' }}>Saving...</span>
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
              onClick={() => setActiveTab('basics')}
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
                background: activeTab === 'basics' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'basics') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'basics') e.currentTarget.style.background = 'transparent';
              }}
              title="Basics"
            >
              <i className="fas fa-info-circle" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Basics</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('summaries')}
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
                background: activeTab === 'summaries' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'summaries') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'summaries') e.currentTarget.style.background = 'transparent';
              }}
              title="Summaries"
            >
              <i className="fas fa-align-left" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Summaries</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('relationships')}
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
                background: activeTab === 'relationships' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'relationships') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'relationships') e.currentTarget.style.background = 'transparent';
              }}
              title="Relationships"
            >
              <i className="fas fa-project-diagram" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Relationships</span>
            </button>
          </div>

          {/* Content Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--background)',
            padding: 'var(--space-6)',
          }}>
          {activeTab === 'basics' && (
            <div className="space-y-4">
              <div>
                <label className="form-label required">Label</label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div style={{ position: 'relative' }}>
                  <label className="form-label required">Type</label>
                  <button
                    type="button"
                    ref={typeDropdownTriggerRef}
                    onClick={() => {
                      if (typeDropdownTriggerRef.current) {
                        const rect = typeDropdownTriggerRef.current.getBoundingClientRect();
                        const dropdownHeight = 400;
                        const dropdownWidth = 320;
                        let top = rect.bottom + 4;
                        if (top + dropdownHeight > window.innerHeight) {
                          top = Math.max(8, rect.top - dropdownHeight - 4);
                        }
                        let left = rect.left;
                        if (left + dropdownWidth > window.innerWidth) {
                          left = window.innerWidth - dropdownWidth - 8;
                        }
                        setTypeDropdownPos({ top, left });
                      }
                      setTypeDropdownOpen(!typeDropdownOpen);
                    }}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      border: '1px solid var(--neutral-300)',
                      borderRadius: 'var(--radius)',
                      background: 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <span>{NODE_TYPES.find(t => t.value === formData.node_type)?.label || formData.node_type}</span>
                    <i className="fas fa-chevron-down" style={{ fontSize: '10px', color: 'var(--neutral-400)' }}></i>
                  </button>
                  {typeDropdownOpen && (
                    <>
                      <div
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 9998,
                        }}
                        onClick={() => setTypeDropdownOpen(false)}
                      />
                      <div style={{
                        position: 'fixed',
                        top: typeDropdownPos.top,
                        left: typeDropdownPos.left,
                        width: '320px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        background: 'white',
                        border: '1px solid var(--neutral-300)',
                        borderRadius: 'var(--radius)',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 9999,
                      }}>
                        {NODE_TYPES.map(opt => (
                          <div
                            key={opt.value}
                            onClick={() => {
                              setFormData({ ...formData, node_type: opt.value });
                              setTypeDropdownOpen(false);
                            }}
                            style={{
                              padding: 'var(--space-3)',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--neutral-100)',
                              background: formData.node_type === opt.value ? 'var(--accent-green-light)' : 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              if (formData.node_type !== opt.value) {
                                e.currentTarget.style.background = 'var(--neutral-50)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = formData.node_type === opt.value ? 'var(--accent-green-light)' : 'transparent';
                            }}
                          >
                            <div style={{
                              fontWeight: 600,
                              fontSize: 'var(--text-sm)',
                              color: 'var(--neutral-900)',
                              marginBottom: '2px',
                            }}>
                              {opt.label}
                            </div>
                            <div style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--neutral-500)',
                              lineHeight: 1.4,
                            }}>
                              {opt.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {formData.node_type && (
                    <p style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--neutral-500)',
                      marginTop: 'var(--space-1)',
                      lineHeight: 1.4,
                    }}>
                      {NODE_TYPES.find(t => t.value === formData.node_type)?.description}
                    </p>
                  )}
                </div>

                <div>
                  <label className="form-label">Status</label>
                  <select
                    value={formData.level_status}
                    onChange={(e) => setFormData({ ...formData, level_status: e.target.value })}
                    className="form-select"
                  >
                    <option value="mapped">Mapped</option>
                    <option value="basic">Basic</option>
                    <option value="deep">Deep</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">
                  Summary Top
                </label>
                <div className="form-helper">2-3 sentences</div>
                <div style={{
                  border: '1px solid var(--neutral-300)',
                  borderRadius: 'var(--radius)',
                  background: 'white',
                  overflow: 'hidden'
                }}>
                  {editorTop && (
                    <div style={{
                      borderBottom: '1px solid var(--neutral-200)',
                      padding: 'var(--space-1) var(--space-2)',
                      display: 'flex',
                      gap: '2px',
                      flexWrap: 'wrap',
                      background: 'var(--neutral-50)'
                    }}>
                      <button type="button" onClick={() => editorTop.chain().focus().toggleBold().run()}
                        style={toolbarButtonStyle(editorTop.isActive('bold'))} {...toolbarHover(editorTop.isActive('bold'))} title="Bold">
                        <FontAwesomeIcon icon={faBold} />
                      </button>
                      <button type="button" onClick={() => editorTop.chain().focus().toggleItalic().run()}
                        style={toolbarButtonStyle(editorTop.isActive('italic'))} {...toolbarHover(editorTop.isActive('italic'))} title="Italic">
                        <FontAwesomeIcon icon={faItalic} />
                      </button>
                      <button type="button" onClick={() => editorTop.chain().focus().toggleUnderline().run()}
                        style={toolbarButtonStyle(editorTop.isActive('underline'))} {...toolbarHover(editorTop.isActive('underline'))} title="Underline">
                        <FontAwesomeIcon icon={faUnderline} />
                      </button>
                      <button type="button" onClick={() => editorTop.chain().focus().toggleBulletList().run()}
                        style={toolbarButtonStyle(editorTop.isActive('bulletList'))} {...toolbarHover(editorTop.isActive('bulletList'))} title="Bullet List">
                        <FontAwesomeIcon icon={faListUl} />
                      </button>
                      <button type="button" onClick={() => {
                        const url = window.prompt('Enter URL:');
                        if (url) editorTop.chain().focus().setLink({ href: url }).run();
                      }} style={toolbarButtonStyle(editorTop.isActive('link'))} {...toolbarHover(editorTop.isActive('link'))} title="Add Link">
                        <FontAwesomeIcon icon={faLink} />
                      </button>
                    </div>
                  )}
                  <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                    <EditorContent
                      editor={editorTop}
                      className="px-3 py-2 min-h-[80px] prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60px] [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="space-y-4">
              <div>
                <label className="form-label">Summary Mid</label>
                <div className="form-helper">~200 words</div>
                <div style={{
                  border: '1px solid var(--neutral-300)',
                  borderRadius: 'var(--radius)',
                  background: 'white',
                  overflow: 'hidden'
                }}>
                  {editorMid && (
                    <div style={{
                      borderBottom: '1px solid var(--neutral-200)',
                      padding: 'var(--space-1) var(--space-2)',
                      display: 'flex',
                      gap: '2px',
                      flexWrap: 'wrap',
                      background: 'var(--neutral-50)'
                    }}>
                      <button type="button" onClick={() => editorMid.chain().focus().toggleBold().run()}
                        style={toolbarButtonStyle(editorMid.isActive('bold'))} {...toolbarHover(editorMid.isActive('bold'))} title="Bold">
                        <FontAwesomeIcon icon={faBold} />
                      </button>
                      <button type="button" onClick={() => editorMid.chain().focus().toggleItalic().run()}
                        style={toolbarButtonStyle(editorMid.isActive('italic'))} {...toolbarHover(editorMid.isActive('italic'))} title="Italic">
                        <FontAwesomeIcon icon={faItalic} />
                      </button>
                      <button type="button" onClick={() => editorMid.chain().focus().toggleUnderline().run()}
                        style={toolbarButtonStyle(editorMid.isActive('underline'))} {...toolbarHover(editorMid.isActive('underline'))} title="Underline">
                        <FontAwesomeIcon icon={faUnderline} />
                      </button>
                      <button type="button" onClick={() => editorMid.chain().focus().toggleStrike().run()}
                        style={toolbarButtonStyle(editorMid.isActive('strike'))} {...toolbarHover(editorMid.isActive('strike'))} title="Strikethrough">
                        <FontAwesomeIcon icon={faStrikethrough} />
                      </button>
                      <div style={{ width: '1px', height: '20px', background: 'var(--neutral-300)', margin: '0 4px' }}></div>
                      <button type="button" onClick={() => editorMid.chain().focus().toggleBulletList().run()}
                        style={toolbarButtonStyle(editorMid.isActive('bulletList'))} {...toolbarHover(editorMid.isActive('bulletList'))} title="Bullet List">
                        <FontAwesomeIcon icon={faListUl} />
                      </button>
                      <button type="button" onClick={() => editorMid.chain().focus().toggleOrderedList().run()}
                        style={toolbarButtonStyle(editorMid.isActive('orderedList'))} {...toolbarHover(editorMid.isActive('orderedList'))} title="Numbered List">
                        <FontAwesomeIcon icon={faListOl} />
                      </button>
                      <button type="button" onClick={() => editorMid.chain().focus().toggleBlockquote().run()}
                        style={toolbarButtonStyle(editorMid.isActive('blockquote'))} {...toolbarHover(editorMid.isActive('blockquote'))} title="Quote">
                        <FontAwesomeIcon icon={faQuoteLeft} />
                      </button>
                      <div style={{ width: '1px', height: '20px', background: 'var(--neutral-300)', margin: '0 4px' }}></div>
                      <button type="button" onClick={() => {
                        const url = window.prompt('Enter URL:');
                        if (url) editorMid.chain().focus().setLink({ href: url }).run();
                      }} style={toolbarButtonStyle(editorMid.isActive('link'))} {...toolbarHover(editorMid.isActive('link'))} title="Add Link">
                        <FontAwesomeIcon icon={faLink} />
                      </button>
                      {editorMid.isActive('link') && (
                        <button type="button" onClick={() => editorMid.chain().focus().unsetLink().run()}
                          style={toolbarButtonStyle(false)} {...toolbarHover(false)} title="Remove Link">
                          <FontAwesomeIcon icon={faUnlink} />
                        </button>
                      )}
                    </div>
                  )}
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <EditorContent
                      editor={editorMid}
                      className="px-3 py-2 min-h-[150px] prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[130px] [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">Summary Deep</label>
                <div className="form-helper">~600 words</div>
                <div style={{
                  border: '1px solid var(--neutral-300)',
                  borderRadius: 'var(--radius)',
                  background: 'white',
                  overflow: 'hidden'
                }}>
                  {editorDeep && (
                    <div style={{
                      borderBottom: '1px solid var(--neutral-200)',
                      padding: 'var(--space-1) var(--space-2)',
                      display: 'flex',
                      gap: '2px',
                      flexWrap: 'wrap',
                      background: 'var(--neutral-50)'
                    }}>
                      <button type="button" onClick={() => editorDeep.chain().focus().toggleBold().run()}
                        style={toolbarButtonStyle(editorDeep.isActive('bold'))} {...toolbarHover(editorDeep.isActive('bold'))} title="Bold">
                        <FontAwesomeIcon icon={faBold} />
                      </button>
                      <button type="button" onClick={() => editorDeep.chain().focus().toggleItalic().run()}
                        style={toolbarButtonStyle(editorDeep.isActive('italic'))} {...toolbarHover(editorDeep.isActive('italic'))} title="Italic">
                        <FontAwesomeIcon icon={faItalic} />
                      </button>
                      <button type="button" onClick={() => editorDeep.chain().focus().toggleUnderline().run()}
                        style={toolbarButtonStyle(editorDeep.isActive('underline'))} {...toolbarHover(editorDeep.isActive('underline'))} title="Underline">
                        <FontAwesomeIcon icon={faUnderline} />
                      </button>
                      <button type="button" onClick={() => editorDeep.chain().focus().toggleStrike().run()}
                        style={toolbarButtonStyle(editorDeep.isActive('strike'))} {...toolbarHover(editorDeep.isActive('strike'))} title="Strikethrough">
                        <FontAwesomeIcon icon={faStrikethrough} />
                      </button>
                      <div style={{ width: '1px', height: '20px', background: 'var(--neutral-300)', margin: '0 4px' }}></div>
                      <select
                        onChange={(e) => {
                          const level = parseInt(e.target.value);
                          if (level) editorDeep.chain().focus().toggleHeading({ level }).run();
                          else editorDeep.chain().focus().setParagraph().run();
                        }}
                        style={{
                          padding: '2px 4px',
                          borderRadius: '4px',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--primary)',
                          border: '1px solid var(--neutral-300)',
                          background: 'white',
                          cursor: 'pointer',
                        }}
                        value={
                          editorDeep.isActive('heading', { level: 2 }) ? '2' :
                          editorDeep.isActive('heading', { level: 3 }) ? '3' :
                          editorDeep.isActive('heading', { level: 4 }) ? '4' : ''
                        }
                      >
                        <option value="">Paragraph</option>
                        <option value="2">Heading 2</option>
                        <option value="3">Heading 3</option>
                        <option value="4">Heading 4</option>
                      </select>
                      <div style={{ width: '1px', height: '20px', background: 'var(--neutral-300)', margin: '0 4px' }}></div>
                      <button type="button" onClick={() => editorDeep.chain().focus().toggleBulletList().run()}
                        style={toolbarButtonStyle(editorDeep.isActive('bulletList'))} {...toolbarHover(editorDeep.isActive('bulletList'))} title="Bullet List">
                        <FontAwesomeIcon icon={faListUl} />
                      </button>
                      <button type="button" onClick={() => editorDeep.chain().focus().toggleOrderedList().run()}
                        style={toolbarButtonStyle(editorDeep.isActive('orderedList'))} {...toolbarHover(editorDeep.isActive('orderedList'))} title="Numbered List">
                        <FontAwesomeIcon icon={faListOl} />
                      </button>
                      <button type="button" onClick={() => editorDeep.chain().focus().toggleBlockquote().run()}
                        style={toolbarButtonStyle(editorDeep.isActive('blockquote'))} {...toolbarHover(editorDeep.isActive('blockquote'))} title="Quote">
                        <FontAwesomeIcon icon={faQuoteLeft} />
                      </button>
                      <div style={{ width: '1px', height: '20px', background: 'var(--neutral-300)', margin: '0 4px' }}></div>
                      <button type="button" onClick={() => {
                        const url = window.prompt('Enter URL:');
                        if (url) editorDeep.chain().focus().setLink({ href: url }).run();
                      }} style={toolbarButtonStyle(editorDeep.isActive('link'))} {...toolbarHover(editorDeep.isActive('link'))} title="Add Link">
                        <FontAwesomeIcon icon={faLink} />
                      </button>
                      {editorDeep.isActive('link') && (
                        <button type="button" onClick={() => editorDeep.chain().focus().unsetLink().run()}
                          style={toolbarButtonStyle(false)} {...toolbarHover(false)} title="Remove Link">
                          <FontAwesomeIcon icon={faUnlink} />
                        </button>
                      )}
                    </div>
                  )}
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <EditorContent
                      editor={editorDeep}
                      className="px-3 py-2 min-h-[250px] prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[230px] [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_h4]:text-base [&_h4]:font-bold [&_h4]:mt-2 [&_h4]:mb-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'relationships' && (
            <div className="space-y-4">
              {/* Relationships */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color: 'var(--primary)',
                marginBottom: 'var(--space-3)',
              }}>
                Relationships
              </div>

              <div style={{
                background: 'var(--accent-green-light)',
                border: '2px solid var(--primary)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-4)',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr 2fr auto',
                  gap: 'var(--space-2)',
                  alignItems: 'center',
                  marginBottom: 'var(--space-3)',
                }}>
                  <span style={{
                    fontWeight: 600,
                    color: 'var(--primary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-base)',
                    lineHeight: 1,
                  }}>
                    {formData.label || 'This'}
                  </span>
                  <select
                    value={formData.new_relationship_rel_type}
                    onChange={(e) => setFormData({ ...formData, new_relationship_rel_type: e.target.value })}
                    className="form-select"
                  >
                    <optgroup label="Hierarchical">
                      <option value="parent_of">is a parent of</option>
                      <option value="child_of">is a child of</option>
                      <option value="is_a">is a (categorization)</option>
                    </optgroup>
                    <optgroup label="Sequential">
                      <option value="prerequisite_for">is a prerequisite for</option>
                      <option value="builds_on">builds on</option>
                      <option value="derived_from">is derived from</option>
                    </optgroup>
                    <optgroup label="Semantic">
                      <option value="related_to">is related to</option>
                      <option value="contrasts_with">contrasts with</option>
                      <option value="integrates_with">integrates with</option>
                      <option value="associated_with">is associated with</option>
                    </optgroup>
                    <optgroup label="Influence">
                      <option value="influenced">influenced</option>
                      <option value="supports">supports</option>
                      <option value="critiques">critiques</option>
                    </optgroup>
                    <optgroup label="Positional">
                      <option value="is_above">is above</option>
                      <option value="is_below">is below</option>
                      <option value="contains">contains</option>
                      <option value="is_inside">is inside</option>
                      <option value="faces">faces</option>
                      <option value="faces_away_from">faces away from</option>
                      <option value="is_near">is near</option>
                    </optgroup>
                    <optgroup label="Positional — Anatomical">
                      <option value="superior_to">is superior to</option>
                      <option value="inferior_to">is inferior to</option>
                      <option value="anterior_to">is anterior to</option>
                      <option value="posterior_to">is posterior to</option>
                      <option value="medial_to">is medial to</option>
                      <option value="lateral_to">is lateral to</option>
                      <option value="dorsal_to">is dorsal to</option>
                      <option value="ventral_to">is ventral to</option>
                      <option value="rostral_to">is rostral to</option>
                      <option value="caudal_to">is caudal to</option>
                      <option value="proximal_to">is proximal to</option>
                      <option value="distal_to">is distal to</option>
                      <option value="ipsilateral_to">is ipsilateral to</option>
                      <option value="contralateral_to">is contralateral to</option>
                    </optgroup>
                    <optgroup label="Other">
                      <option value="authored">authored</option>
                      <option value="applies_to">applies to</option>
                      <option value="treats">treats</option>
                    </optgroup>
                  </select>
                  <ConceptSearchSelect
                    concepts={concepts}
                    value={formData.new_relationship_dst_concept_id}
                    onChange={(e) => setFormData({ ...formData, new_relationship_dst_concept_id: e.target.value })}
                    excludeId={item?.id}
                    placeholder="Type to search constructs..."
                    onCreateConcept={handleCreateConcept}
                  />
                  <button
                    type="button"
                    onClick={handleAddRelationship}
                    className="btn-primary"
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      whiteSpace: 'nowrap',
                    }}
                    disabled={!item?.id || !formData.new_relationship_dst_concept_id}
                  >
                    Add
                  </button>
                </div>

                {!item?.id && (
                  <p className="form-helper" style={{ marginTop: 'var(--space-2)', color: 'var(--neutral-500)' }}>
                    Save the construct first before adding relationships.
                  </p>
                )}

                {/* Existing Relationships — grouped by category with inline editable types */}
                {item && (() => {
                  const categoryOrder = ['Hierarchical', 'Sequential', 'Semantic', 'Influence', 'Positional', 'Positional - Anatomical', 'Other'];

                  // Normalize all connections into a flat list with effective rel_type
                  const allConns = [];
                  (item.outgoing_connections || [])
                    .filter(c => !deletedRelationshipIds.includes(c.id))
                    .forEach(c => {
                      const effectiveRelType = updatedRelationships[c.id] || c.rel_type;
                      allConns.push({ ...c, rel_type: effectiveRelType, originalRelType: c.rel_type, direction: 'out', key: `out-${c.id}` });
                    });
                  newRelationships.forEach(c => allConns.push({ ...c, direction: 'new', key: `new-${c.id}` }));
                  (item.incoming_connections || [])
                    .filter(c => !deletedRelationshipIds.includes(c.id))
                    .forEach(c => {
                      const effectiveRelType = updatedRelationships[c.id] || c.rel_type;
                      allConns.push({ ...c, rel_type: effectiveRelType, originalRelType: c.rel_type, direction: 'in', key: `in-${c.id}` });
                    });

                  if (allConns.length === 0) return null;

                  // Group by category
                  const grouped = {};
                  allConns.forEach(c => {
                    const cat = getRelTypeCategory(c.rel_type);
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(c);
                  });

                  return (
                    <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {categoryOrder.filter(cat => grouped[cat]).map(cat => (
                        <div key={cat} style={{
                          background: 'white',
                          border: '1px solid var(--neutral-300)',
                          borderRadius: 'var(--radius)',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--neutral-100)',
                            borderBottom: '1px solid var(--neutral-300)',
                            fontFamily: 'var(--font-display)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}>
                            {cat}
                          </div>
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                            {grouped[cat].map(conn => (
                              <li
                                key={conn.key}
                                style={{
                                  padding: 'var(--space-2) var(--space-3)',
                                  borderBottom: '1px solid var(--neutral-100)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--space-2)',
                                  fontSize: 'var(--text-sm)',
                                  ...(conn.direction === 'new' ? { background: 'var(--accent-green-light)' } : {}),
                                }}
                              >
                                <span style={{ color: 'var(--neutral-400)', fontSize: 'var(--text-xs)', flexShrink: 0 }}>
                                  {conn.direction === 'in' ? '\u2190' : '\u2192'}
                                </span>
                                {conn.direction === 'in' ? (
                                  <>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                      <a
                                        href={`/concepts/${conn.src_concept?.id}`}
                                        style={{
                                          color: 'var(--primary)',
                                          textDecoration: 'underline',
                                          textDecorationStyle: 'dotted',
                                          textUnderlineOffset: '2px'
                                        }}
                                      >
                                        {conn.src_concept?.label || 'Unknown'}
                                      </a>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (conn.src_concept?.id && onEditRelatedConcept) {
                                            onEditRelatedConcept(conn.src_concept.id);
                                          }
                                        }}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: 'var(--neutral-400)',
                                          cursor: 'pointer',
                                          padding: '2px 4px',
                                          fontSize: '11px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          borderRadius: '2px',
                                          transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.color = 'var(--primary)';
                                          e.currentTarget.style.background = 'var(--neutral-100)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.color = 'var(--neutral-400)';
                                          e.currentTarget.style.background = 'transparent';
                                        }}
                                        title={`Edit ${conn.src_concept?.label}`}
                                      >
                                        <i className="fas fa-pen"></i>
                                      </button>
                                    </span>
                                    <InlineRelTypeSelect
                                      value={conn.rel_type}
                                      onChange={(newType) => handleUpdateRelationshipType(conn.id, newType)}
                                                                          />
                                    <span style={{ fontWeight: 600, color: 'var(--neutral-700)' }}>
                                      {item.label}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ fontWeight: 600, color: 'var(--neutral-700)' }}>
                                      {item.label}
                                    </span>
                                    <InlineRelTypeSelect
                                      value={conn.rel_type}
                                      onChange={(newType) => handleUpdateRelationshipType(conn.id, newType)}
                                                                          />
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                      <a
                                        href={`/concepts/${conn.dst_concept?.id}`}
                                        style={{
                                          color: 'var(--primary)',
                                          textDecoration: 'underline',
                                          textDecorationStyle: 'dotted',
                                          textUnderlineOffset: '2px'
                                        }}
                                      >
                                        {conn.dst_concept?.label || 'Unknown'}
                                      </a>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (conn.dst_concept?.id && onEditRelatedConcept) {
                                            onEditRelatedConcept(conn.dst_concept.id);
                                          }
                                        }}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: 'var(--neutral-400)',
                                          cursor: 'pointer',
                                          padding: '2px 4px',
                                          fontSize: '11px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          borderRadius: '2px',
                                          transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.color = 'var(--primary)';
                                          e.currentTarget.style.background = 'var(--neutral-100)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.color = 'var(--neutral-400)';
                                          e.currentTarget.style.background = 'transparent';
                                        }}
                                        title={`Edit ${conn.dst_concept?.label}`}
                                      >
                                        <i className="fas fa-pen"></i>
                                      </button>
                                    </span>
                                  </>
                                )}
                                {conn.relationship_label && (
                                  <span style={{
                                    fontSize: 'var(--text-xs)',
                                    color: 'var(--neutral-500)',
                                    fontStyle: 'italic',
                                  }}>
                                    "{conn.relationship_label}"
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRelationship(conn.id)}
                                  style={{
                                    marginLeft: 'auto',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--error)',
                                    cursor: 'pointer',
                                    padding: 'var(--space-1)',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background 0.15s',
                                    flexShrink: 0,
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--error) 15%, transparent)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <i className="fas fa-times" style={{ fontSize: '14px' }}></i>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Tags */}
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-xl)',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  marginBottom: 'var(--space-3)',
                }}>
                  Tags
                </div>
                <div style={{ height: '350px' }}>
                  <TagSelector
                    selectedTags={formData.tags}
                    onChange={(tags) => setFormData({ ...formData, tags: tags })}
                    themeColor="var(--accent-green)"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Footer - only show for new constructs, editing uses autosave + X button */}
        {!item ? (
          <div style={{
            borderTop: '1px solid var(--neutral-200)',
            background: 'var(--background)',
            padding: 'var(--space-6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}>
            <button
              type="submit"
              className="btn-primary"
            >
              Create Construct
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </form>
    </SlidePanel>
  );
}
