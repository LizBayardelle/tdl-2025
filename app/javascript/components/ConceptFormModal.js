import React, { useState, useEffect, useRef, useCallback } from 'react';
import SlidePanel from './SlidePanel';
import ConceptSearchSelect from './ConceptSearchSelect';
import InlineRelTypeSelect, { getRelTypeCategory } from './InlineRelTypeSelect';
import TagSelector from './TagSelector';
import SourceSelector from './SourceSelector';
import PeopleSelector from './PeopleSelector';
import CollectionSelector from './CollectionSelector';
import { NODE_TYPES } from '../config/nodeTypes';
import ConceptTypeReference, { ConceptTypeHelpButton } from './ConceptTypeReference';
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

export default function ConceptFormModal({ isOpen, onClose, onSuccess, item, onEditRelatedConcept, stackDepth = 0, initialTab = 'basics' }) {
  const [concepts, setConcepts] = useState([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [deletedRelationshipIds, setDeletedRelationshipIds] = useState([]);
  const [newRelationships, setNewRelationships] = useState([]);
  const [updatedRelationships, setUpdatedRelationships] = useState({}); // { id: newRelType }
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [typeDropdownPos, setTypeDropdownPos] = useState({ top: 0, left: 0 });
  const [showTypeRef, setShowTypeRef] = useState(false);
  const typeDropdownTriggerRef = useRef(null);
  const [formData, setFormData] = useState({
    label: '',
    concept_type: 'phenomenon',
    summary: '',
    description: '',
    location: '',
    examples: '',
    etymology: '',
    school_of_thought: '',
    history: '',
    controversy: '',
    clinical_relevance: '',
    misconceptions: '',
    mnemonic: '',
    developmental_notes: '',
    measurement_notes: '',
    aliases: [],
    tags: [],
    source_ids: [],
    person_ids: [],
    collection_ids: [],
    new_relationship_dst_concept_id: '',
    new_relationship_rel_type: 'related_to'
  });
  const [aliasInput, setAliasInput] = useState('');
  const [hasDraft, setHasDraft] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error', 'draft'
  const saveTimeoutRef = useRef(null);
  const draftTimeoutRef = useRef(null);

  const DRAFT_KEY = 'concept_draft';

  const saveDraft = useCallback((data) => {
    try {
      const draftData = { ...data };
      delete draftData.new_relationship_dst_concept_id;
      delete draftData.new_relationship_rel_type;
      // Only save if there's meaningful content
      if (draftData.label || draftData.summary || draftData.description) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
        setSaveStatus('draft');
      }
    } catch (e) {
      // localStorage full or unavailable — silent fail
    }
  }, []);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return null;
  }, []);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    setHasDraft(false);
  }, []);
  const isInitialMount = useRef(true);
  const lastSavedData = useRef(null);

  // Collections state
  const [collections, setCollections] = useState([]);
  const [itemCollections, setItemCollections] = useState([]); // collections this concept is in
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState('');

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

  // WYSIWYG editors for rich text fields
  const editorSummary = useEditor({
    extensions: editorExtensions,
    content: formData.summary,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, summary: editor.getHTML() }));
    },
  });

  const editorDescription = useEditor({
    extensions: editorExtensions,
    content: formData.description,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, description: editor.getHTML() }));
    },
  });

  const editorExamples = useEditor({
    extensions: editorExtensions,
    content: formData.examples,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, examples: editor.getHTML() }));
    },
  });

  const editorHistory = useEditor({
    extensions: editorExtensions,
    content: formData.history,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, history: editor.getHTML() }));
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

  // Draft save effect for new (unsaved) concepts
  useEffect(() => {
    if (!isOpen || item?.id) return;

    if (isInitialMount.current) return;

    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);

    draftTimeoutRef.current = setTimeout(() => {
      saveDraft(formData);
    }, 500);

    return () => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
    };
  }, [formData, isOpen, item?.id, saveDraft]);

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
      setActiveTab(initialTab);
      setDeletedRelationshipIds([]);
      setNewRelationships([]);
      setUpdatedRelationships({});
      setTypeDropdownOpen(false);
      setSaveStatus('idle');
      isInitialMount.current = true;
      fetchConcepts();
      fetchCollections();
      setCollectionFilter('');
      if (item) {
        fetchItemCollections(item.id);
        const newFormData = {
          label: item.label || '',
          concept_type: item.concept_type || 'phenomenon',
          summary: item.summary || '',
          description: item.description || '',
          location: item.location || '',
          examples: item.examples || '',
          etymology: item.etymology || '',
          school_of_thought: item.school_of_thought || '',
          history: item.history || '',
          controversy: item.controversy || '',
          clinical_relevance: item.clinical_relevance || '',
          misconceptions: item.misconceptions || '',
          mnemonic: item.mnemonic || '',
          developmental_notes: item.developmental_notes || '',
          measurement_notes: item.measurement_notes || '',
          aliases: item.aliases || [],
          tags: Array.isArray(item.tags) ? item.tags.map(t => typeof t === 'string' ? t : t.name) : [],
          source_ids: item.source_ids || (item.sources ? item.sources.map(s => s.id) : []),
          person_ids: item.person_ids || (item.people ? item.people.map(p => p.id) : []),
          collection_ids: [],
          new_relationship_dst_concept_id: '',
          new_relationship_rel_type: 'related_to'
        };
        setFormData(newFormData);
        lastSavedData.current = JSON.stringify(newFormData);
        setAliasInput('');
        if (editorSummary) editorSummary.commands.setContent(newFormData.summary);
        if (editorDescription) editorDescription.commands.setContent(newFormData.description);
        if (editorExamples) editorExamples.commands.setContent(newFormData.examples);
        if (editorHistory) editorHistory.commands.setContent(newFormData.history);
      } else {
        const draft = loadDraft();
        const emptyFormData = {
          label: '',
          concept_type: 'phenomenon',
          summary: '',
          description: '',
          location: '',
          examples: '',
          etymology: '',
          school_of_thought: '',
          history: '',
          controversy: '',
          clinical_relevance: '',
          misconceptions: '',
          mnemonic: '',
          developmental_notes: '',
          measurement_notes: '',
          aliases: [],
          tags: [],
          source_ids: [],
          person_ids: [],
          collection_ids: [],
          new_relationship_dst_concept_id: '',
          new_relationship_rel_type: 'related_to'
        };
        const newFormData = draft
          ? { ...emptyFormData, ...draft, new_relationship_dst_concept_id: '', new_relationship_rel_type: 'related_to' }
          : emptyFormData;
        setFormData(newFormData);
        setHasDraft(!!draft);
        if (draft) setSaveStatus('draft');
        lastSavedData.current = null;
        setItemCollections([]);
        setAliasInput('');
        if (editorSummary) editorSummary.commands.setContent(newFormData.summary);
        if (editorDescription) editorDescription.commands.setContent(newFormData.description);
        if (editorExamples) editorExamples.commands.setContent(newFormData.examples);
        if (editorHistory) editorHistory.commands.setContent(newFormData.history);
      }
      setError('');
    }
  }, [isOpen, item, initialTab, editorSummary, editorDescription, editorExamples, editorHistory]);

  const fetchConcepts = async () => {
    try {
      const response = await fetch('/concepts.json');
      const data = await response.json();
      setConcepts(data);
    } catch (error) {
      console.error('Error fetching concepts:', error);
    }
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

  const fetchItemCollections = async (conceptId) => {
    try {
      const response = await fetch(`/concepts/${conceptId}.json`);
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
          item_type: 'Concept',
          item_id: item.id
        }),
      });

      if (response.ok) {
        // Add to local state
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
          item_type: 'Concept',
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
        // Add to collections list
        setCollections([newCollection, ...collections]);
        // Clear filter
        setCollectionFilter('');
        // If we have an item, also add it to this new collection
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
      alert('Please save the concept first before adding relationships');
      return;
    }

    if (!formData.new_relationship_dst_concept_id) {
      alert('Please select a concept to relate to');
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
        clearDraft();
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
        body: JSON.stringify({ concept: { label, concept_type: 'phenomenon' } }),
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
    // Refresh parent when closing an existing item (to reflect autosaved changes)
    if (item?.id) {
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
          padding: 'var(--space-3) var(--space-5)',
          background: 'var(--paper)',
          borderBottom: '1px solid var(--ink-line)',
          flexShrink: 0,
          gap: 'var(--space-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
            {stackDepth > 0 && (
              <button
                type="button"
                onClick={handleClose}
                className="sp-action sp-action-quiet"
                style={{ flexShrink: 0 }}
                title="Go back to previous concept"
              >
                <i className="fas fa-arrow-left" style={{ marginRight: 6 }}></i>
                <span className="hidden md:inline">Back</span>
              </button>
            )}
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--concept)',
              letterSpacing: '-0.005em',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}>
              {item ? (formData.label || item.label || 'Untitled concept') : 'New concept'}
            </h2>
            {stackDepth > 0 && (
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                color: 'var(--ink-3)',
                background: 'var(--paper-warm)',
                padding: '2px 8px',
                borderRadius: 'var(--r-sm)',
                fontWeight: 500,
                flexShrink: 0,
              }}>
                Level {stackDepth + 1}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {/* Save Status */}
            {(item || saveStatus === 'draft') && (
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
                {saveStatus === 'draft' && (
                  <>
                    <i className="fas fa-file-alt" style={{ color: 'var(--neutral-500)' }}></i>
                    <span style={{ color: 'var(--neutral-500)' }}>Draft saved</span>
                    <button type="button" onClick={() => {
                      clearDraft();
                      const empty = {
                        label: '', concept_type: 'phenomenon', summary: '', description: '', location: '',
                        examples: '', etymology: '', school_of_thought: '', history: '', controversy: '',
                        clinical_relevance: '', misconceptions: '', mnemonic: '', developmental_notes: '',
                        measurement_notes: '', aliases: [], tags: [],
                        new_relationship_dst_concept_id: '', new_relationship_rel_type: 'related_to'
                      };
                      setFormData(empty);
                      setSaveStatus('idle');
                      if (editorSummary) editorSummary.commands.setContent('');
                      if (editorDescription) editorDescription.commands.setContent('');
                      if (editorExamples) editorExamples.commands.setContent('');
                      if (editorHistory) editorHistory.commands.setContent('');
                    }} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)',
                      fontSize: 'var(--text-xs)', textDecoration: 'underline', padding: 0, fontFamily: 'var(--font-body)',
                    }}>discard</button>
                  </>
                )}
                {saveStatus === 'pending' && (
                  <>
                    <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--neutral-400)' }}></i>
                    <span style={{ color: 'var(--neutral-500)' }}>Save Pending...</span>
                  </>
                )}
                {saveStatus === 'saving' && (
                  <>
                    <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--ink-3)' }}></i>
                    <span style={{ color: 'var(--ink-3)' }}>Saving…</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <i className="fas fa-check" style={{ color: 'var(--concept)' }}></i>
                    <span style={{ color: 'var(--concept)' }}>Saved</span>
                  </>
                )}
                {saveStatus === 'error' && (
                  <>
                    <i className="fas fa-exclamation-circle" style={{ color: 'var(--error)' }}></i>
                    <span style={{ color: 'var(--error)' }}>Error</span>
                  </>
                )}
                {saveStatus === 'idle' && item && (
                  <span style={{ color: 'var(--neutral-400)' }}>Auto-save on</span>
                )}
              </div>
            )}
            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: '1px solid transparent',
                color: 'var(--ink-3)',
                fontSize: '14px',
                cursor: 'pointer',
                padding: 0,
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--r-sm)',
                transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--paper-soft)';
                e.currentTarget.style.color = 'var(--ink)';
                e.currentTarget.style.borderColor = 'var(--ink-line)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--ink-3)';
                e.currentTarget.style.borderColor = 'transparent';
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
                fontWeight: activeTab === 'basics' ? 600 : 500,
                color: activeTab === 'basics' ? 'var(--concept)' : 'var(--ink-2)',
                background: activeTab === 'basics' ? 'var(--paper-warm)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s, color 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'basics') e.currentTarget.style.background = '#d8d8d8';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'basics') e.currentTarget.style.background = 'transparent';
              }}
              title="Basics"
            >
              <i className="fas fa-info-circle" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Basics</span>
            </button>

            {['context', 'clinical', 'connections'].map(tab => {
              const tabConfig = {
                context:     { icon: 'fas fa-map-marker-alt', label: 'Context' },
                clinical:    { icon: 'fas fa-stethoscope',    label: 'Clinical & Research' },
                connections: { icon: 'fas fa-link',           label: 'Connections' },
              }[tab];

              const handleTabClick = () => setActiveTab(tab);

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={handleTabClick}
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
                    fontWeight: activeTab === tab ? 600 : 500,
                    color: activeTab === tab ? 'var(--concept)' : 'var(--ink-2)',
                    background: activeTab === tab ? 'var(--paper-warm)' : 'transparent',
                    border: 'none',
                    transition: 'background 0.15s, color 0.15s',
                    marginBottom: '0.25rem',
                    textAlign: 'left',
                    fontFamily: 'var(--font-body)',
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab) e.currentTarget.style.background = 'var(--paper-soft)';
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab) e.currentTarget.style.background = 'transparent';
                  }}
                  title={tabConfig.label}
                >
                  <i className={tabConfig.icon} style={{ width: '16px' }}></i>
                  <span className="hidden md:inline">{tabConfig.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            background: 'white',
            padding: 'var(--space-6)',
          }}>
          {activeTab === 'basics' && (
            <div className="space-y-4">
              <div>
                <label className="form-label required">Label</label>
                <p className="form-hint">The canonical name as it would appear in a textbook index.</p>
                <input type="text" value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} className="form-input" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div style={{ position: 'relative' }}>
                  <label className="form-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    Type
                    <ConceptTypeHelpButton onClick={() => setShowTypeRef(true)} />
                  </label>
                  <p className="form-hint">What this fundamentally is, not what field it belongs to.</p>
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
                    <span>{NODE_TYPES.find(t => t.value === formData.concept_type)?.label || formData.concept_type || 'Select type...'}</span>
                    <i className="fas fa-chevron-down" style={{ fontSize: '10px', color: 'var(--neutral-400)' }}></i>
                  </button>
                  {typeDropdownOpen && (
                    <>
                      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} onClick={() => setTypeDropdownOpen(false)} />
                      <div style={{
                        position: 'fixed', top: typeDropdownPos.top, left: typeDropdownPos.left,
                        width: '320px', maxHeight: '400px', overflowY: 'auto', background: 'white',
                        border: '1px solid var(--neutral-300)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', zIndex: 9999,
                      }}>
                        {NODE_TYPES.map(opt => (
                          <div key={opt.value}
                            onClick={() => { setFormData({ ...formData, concept_type: opt.value }); setTypeDropdownOpen(false); }}
                            style={{ padding: 'var(--space-3)', cursor: 'pointer', borderBottom: '1px solid var(--ink-line-soft)', background: formData.concept_type === opt.value ? 'var(--paper-warm)' : 'transparent' }}
                            onMouseEnter={(e) => { if (formData.concept_type !== opt.value) e.currentTarget.style.background = 'var(--paper-soft)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = formData.concept_type === opt.value ? 'var(--paper-warm)' : 'transparent'; }}
                          >
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--ink)', marginBottom: '2px', letterSpacing: '-0.005em' }}>{opt.label}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: '4px' }}>{opt.description}</div>
                            {opt.examples && opt.examples.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {opt.examples.map(ex => (
                                  <span key={ex} style={{
                                    fontFamily: 'var(--font-display)', fontStyle: 'italic',
                                    fontSize: '11px', color: 'var(--ink-3)',
                                    background: 'var(--paper-soft)', border: '1px solid var(--ink-line)',
                                    padding: '1px 7px', borderRadius: 'var(--r-sm)',
                                  }}>{ex}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Aliases */}
              <div>
                <label className="form-label">Aliases</label>
                <p className="form-hint">Any other name this concept might be called.</p>
                {formData.aliases.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
                    {formData.aliases.map((alias, idx) => (
                      <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', background: 'var(--neutral-100)', borderRadius: '12px', fontSize: 'var(--text-sm)', color: 'var(--neutral-700)' }}>
                        {alias}
                        <button type="button" onClick={() => setFormData({ ...formData, aliases: formData.aliases.filter((_, i) => i !== idx) })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--neutral-400)', fontSize: '10px', lineHeight: 1 }}>
                          <i className="fas fa-times"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <input type="text" value={aliasInput} onChange={(e) => setAliasInput(e.target.value)}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ',') && aliasInput.trim()) { e.preventDefault(); const val = aliasInput.replace(/,$/,'').trim(); if (val && !formData.aliases.includes(val)) setFormData({ ...formData, aliases: [...formData.aliases, val] }); setAliasInput(''); } }}
                    className="form-input" placeholder="Type an alias, then press Enter or comma to add" style={{ flex: 1 }} />
                  <button type="button"
                    onClick={() => { const val = aliasInput.trim(); if (val && !formData.aliases.includes(val)) setFormData({ ...formData, aliases: [...formData.aliases, val] }); setAliasInput(''); }}
                    disabled={!aliasInput.trim()}
                    style={{ padding: 'var(--space-2) var(--space-3)', background: aliasInput.trim() ? 'var(--accent-green)' : 'var(--neutral-200)', color: aliasInput.trim() ? 'white' : 'var(--neutral-400)', border: 'none', borderRadius: 'var(--radius)', cursor: aliasInput.trim() ? 'pointer' : 'default', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}
                  >Add</button>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="form-label">Summary</label>
                <p className="form-hint">Quick, 1-3 sentence, top-level summary.</p>
                <div style={{ border: '1px solid var(--neutral-300)', borderRadius: 'var(--radius)', background: 'white', overflow: 'hidden' }}>
                  {editorSummary && (
                    <div style={{ borderBottom: '1px solid var(--neutral-200)', padding: 'var(--space-1) var(--space-2)', display: 'flex', gap: '2px', flexWrap: 'wrap', background: 'var(--neutral-50)' }}>
                      <button type="button" onClick={() => editorSummary.chain().focus().toggleBold().run()} style={toolbarButtonStyle(editorSummary.isActive('bold'))} {...toolbarHover(editorSummary.isActive('bold'))} title="Bold"><FontAwesomeIcon icon={faBold} /></button>
                      <button type="button" onClick={() => editorSummary.chain().focus().toggleItalic().run()} style={toolbarButtonStyle(editorSummary.isActive('italic'))} {...toolbarHover(editorSummary.isActive('italic'))} title="Italic"><FontAwesomeIcon icon={faItalic} /></button>
                      <button type="button" onClick={() => editorSummary.chain().focus().toggleUnderline().run()} style={toolbarButtonStyle(editorSummary.isActive('underline'))} {...toolbarHover(editorSummary.isActive('underline'))} title="Underline"><FontAwesomeIcon icon={faUnderline} /></button>
                      <button type="button" onClick={() => editorSummary.chain().focus().toggleBulletList().run()} style={toolbarButtonStyle(editorSummary.isActive('bulletList'))} {...toolbarHover(editorSummary.isActive('bulletList'))} title="Bullet List"><FontAwesomeIcon icon={faListUl} /></button>
                      <button type="button" onClick={() => { const url = window.prompt('Enter URL:'); if (url) editorSummary.chain().focus().setLink({ href: url }).run(); }} style={toolbarButtonStyle(editorSummary.isActive('link'))} {...toolbarHover(editorSummary.isActive('link'))} title="Add Link"><FontAwesomeIcon icon={faLink} /></button>
                    </div>
                  )}
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <EditorContent editor={editorSummary} className="px-3 py-2 min-h-[80px] prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60px] [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="form-label">Description</label>
                <p className="form-hint">Full explanation of what this is, how it works, and what defines it.</p>
                <div style={{ border: '1px solid var(--neutral-300)', borderRadius: 'var(--radius)', background: 'white', overflow: 'hidden' }}>
                  {editorDescription && (
                    <div style={{ borderBottom: '1px solid var(--neutral-200)', padding: 'var(--space-1) var(--space-2)', display: 'flex', gap: '2px', flexWrap: 'wrap', background: 'var(--neutral-50)' }}>
                      <button type="button" onClick={() => editorDescription.chain().focus().toggleBold().run()} style={toolbarButtonStyle(editorDescription.isActive('bold'))} {...toolbarHover(editorDescription.isActive('bold'))} title="Bold"><FontAwesomeIcon icon={faBold} /></button>
                      <button type="button" onClick={() => editorDescription.chain().focus().toggleItalic().run()} style={toolbarButtonStyle(editorDescription.isActive('italic'))} {...toolbarHover(editorDescription.isActive('italic'))} title="Italic"><FontAwesomeIcon icon={faItalic} /></button>
                      <button type="button" onClick={() => editorDescription.chain().focus().toggleUnderline().run()} style={toolbarButtonStyle(editorDescription.isActive('underline'))} {...toolbarHover(editorDescription.isActive('underline'))} title="Underline"><FontAwesomeIcon icon={faUnderline} /></button>
                      <button type="button" onClick={() => editorDescription.chain().focus().toggleBulletList().run()} style={toolbarButtonStyle(editorDescription.isActive('bulletList'))} {...toolbarHover(editorDescription.isActive('bulletList'))} title="Bullet List"><FontAwesomeIcon icon={faListUl} /></button>
                      <button type="button" onClick={() => { const url = window.prompt('Enter URL:'); if (url) editorDescription.chain().focus().setLink({ href: url }).run(); }} style={toolbarButtonStyle(editorDescription.isActive('link'))} {...toolbarHover(editorDescription.isActive('link'))} title="Add Link"><FontAwesomeIcon icon={faLink} /></button>
                    </div>
                  )}
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <EditorContent editor={editorDescription} className="px-3 py-2 min-h-[100px] prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[80px] [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4" />
                  </div>
                </div>
              </div>

              {/* Mnemonic */}
              <div>
                <label className="form-label">Mnemonic</label>
                <p className="form-hint">A memory device to recall key features: acronym, visual association, or phrase.</p>
                <input type="text" value={formData.mnemonic} onChange={(e) => setFormData({ ...formData, mnemonic: e.target.value })} className="form-input" />
              </div>
            </div>
          )}

          {activeTab === 'context' && (
            <div className="space-y-4">
              <div>
                <label className="form-label">Location</label>
                <p className="form-hint">Where this exists: anatomical region, neural circuit, diagnostic system, or theoretical framework.</p>
                <textarea value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="form-input" rows={3} />
              </div>

              <div>
                <label className="form-label">Etymology</label>
                <p className="form-hint">Word origins and how the name connects to its meaning or function.</p>
                <textarea value={formData.etymology} onChange={(e) => setFormData({ ...formData, etymology: e.target.value })} className="form-input" rows={3} />
              </div>

              <div>
                <label className="form-label">School of Thought</label>
                <p className="form-hint">The intellectual tradition(s) this concept emerged from or is most closely tied to.</p>
                <textarea value={formData.school_of_thought} onChange={(e) => setFormData({ ...formData, school_of_thought: e.target.value })} className="form-input" rows={2} />
              </div>

              {/* Examples */}
              <div>
                <label className="form-label">Examples</label>
                <p className="form-hint">Concrete instances, case illustrations, or real-world scenarios where this concept applies.</p>
                <div style={{ border: '1px solid var(--neutral-300)', borderRadius: 'var(--radius)', background: 'white', overflow: 'hidden' }}>
                  {editorExamples && (
                    <div style={{ borderBottom: '1px solid var(--neutral-200)', padding: 'var(--space-1) var(--space-2)', display: 'flex', gap: '2px', flexWrap: 'wrap', background: 'var(--neutral-50)' }}>
                      <button type="button" onClick={() => editorExamples.chain().focus().toggleBold().run()} style={toolbarButtonStyle(editorExamples.isActive('bold'))} {...toolbarHover(editorExamples.isActive('bold'))} title="Bold"><FontAwesomeIcon icon={faBold} /></button>
                      <button type="button" onClick={() => editorExamples.chain().focus().toggleItalic().run()} style={toolbarButtonStyle(editorExamples.isActive('italic'))} {...toolbarHover(editorExamples.isActive('italic'))} title="Italic"><FontAwesomeIcon icon={faItalic} /></button>
                      <button type="button" onClick={() => editorExamples.chain().focus().toggleUnderline().run()} style={toolbarButtonStyle(editorExamples.isActive('underline'))} {...toolbarHover(editorExamples.isActive('underline'))} title="Underline"><FontAwesomeIcon icon={faUnderline} /></button>
                      <button type="button" onClick={() => editorExamples.chain().focus().toggleBulletList().run()} style={toolbarButtonStyle(editorExamples.isActive('bulletList'))} {...toolbarHover(editorExamples.isActive('bulletList'))} title="Bullet List"><FontAwesomeIcon icon={faListUl} /></button>
                      <button type="button" onClick={() => { const url = window.prompt('Enter URL:'); if (url) editorExamples.chain().focus().setLink({ href: url }).run(); }} style={toolbarButtonStyle(editorExamples.isActive('link'))} {...toolbarHover(editorExamples.isActive('link'))} title="Add Link"><FontAwesomeIcon icon={faLink} /></button>
                    </div>
                  )}
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <EditorContent editor={editorExamples} className="px-3 py-2 min-h-[80px] prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60px] [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4" />
                  </div>
                </div>
              </div>

              {/* History */}
              <div>
                <label className="form-label">History</label>
                <p className="form-hint">Key milestones: who introduced it, when, and how understanding has evolved.</p>
                <div style={{ border: '1px solid var(--neutral-300)', borderRadius: 'var(--radius)', background: 'white', overflow: 'hidden' }}>
                  {editorHistory && (
                    <div style={{ borderBottom: '1px solid var(--neutral-200)', padding: 'var(--space-1) var(--space-2)', display: 'flex', gap: '2px', flexWrap: 'wrap', background: 'var(--neutral-50)' }}>
                      <button type="button" onClick={() => editorHistory.chain().focus().toggleBold().run()} style={toolbarButtonStyle(editorHistory.isActive('bold'))} {...toolbarHover(editorHistory.isActive('bold'))} title="Bold"><FontAwesomeIcon icon={faBold} /></button>
                      <button type="button" onClick={() => editorHistory.chain().focus().toggleItalic().run()} style={toolbarButtonStyle(editorHistory.isActive('italic'))} {...toolbarHover(editorHistory.isActive('italic'))} title="Italic"><FontAwesomeIcon icon={faItalic} /></button>
                      <button type="button" onClick={() => editorHistory.chain().focus().toggleUnderline().run()} style={toolbarButtonStyle(editorHistory.isActive('underline'))} {...toolbarHover(editorHistory.isActive('underline'))} title="Underline"><FontAwesomeIcon icon={faUnderline} /></button>
                      <button type="button" onClick={() => editorHistory.chain().focus().toggleBulletList().run()} style={toolbarButtonStyle(editorHistory.isActive('bulletList'))} {...toolbarHover(editorHistory.isActive('bulletList'))} title="Bullet List"><FontAwesomeIcon icon={faListUl} /></button>
                      <button type="button" onClick={() => { const url = window.prompt('Enter URL:'); if (url) editorHistory.chain().focus().setLink({ href: url }).run(); }} style={toolbarButtonStyle(editorHistory.isActive('link'))} {...toolbarHover(editorHistory.isActive('link'))} title="Add Link"><FontAwesomeIcon icon={faLink} /></button>
                    </div>
                  )}
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <EditorContent editor={editorHistory} className="px-3 py-2 min-h-[80px] prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60px] [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clinical' && (
            <div className="space-y-4">
              <div>
                <label className="form-label">Clinical Relevance</label>
                <p className="form-hint">How this shows up in practice: diagnosis, treatment planning, patient presentation, or clinical decision-making.</p>
                <textarea value={formData.clinical_relevance} onChange={(e) => setFormData({ ...formData, clinical_relevance: e.target.value })} className="form-input" rows={3} />
              </div>
              <div>
                <label className="form-label">Controversy</label>
                <p className="form-hint">Active debates, contested validity, or conflicting findings across studies or traditions.</p>
                <textarea value={formData.controversy} onChange={(e) => setFormData({ ...formData, controversy: e.target.value })} className="form-input" rows={2} />
              </div>
              <div>
                <label className="form-label">Misconceptions</label>
                <p className="form-hint">Common errors in how this is understood or applied, even among trained professionals.</p>
                <textarea value={formData.misconceptions} onChange={(e) => setFormData({ ...formData, misconceptions: e.target.value })} className="form-input" rows={2} />
              </div>
              <div>
                <label className="form-label">Developmental Notes</label>
                <p className="form-hint">How this changes across the lifespan: onset, maturation, aging, or critical periods.</p>
                <textarea value={formData.developmental_notes} onChange={(e) => setFormData({ ...formData, developmental_notes: e.target.value })} className="form-input" rows={2} />
              </div>
              <div>
                <label className="form-label">Measurement Notes</label>
                <p className="form-hint">How this is operationalized: scales, biomarkers, imaging modalities, or behavioral indicators.</p>
                <textarea value={formData.measurement_notes} onChange={(e) => setFormData({ ...formData, measurement_notes: e.target.value })} className="form-input" rows={2} />
              </div>
            </div>
          )}

          {activeTab === 'connections' && (
            <div className="space-y-4">
              <p className="form-hint" style={{ marginTop: 0 }}>
                Link this concept to other entities in your library.
                Concept-to-concept relationships (parent of, builds on, etc.) live on the show page.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Sources</label>
                  <p className="form-hint">Papers, books, and other sources that reference or define this concept.</p>
                  <div style={{ height: formData.source_ids.length > 0 ? '320px' : '240px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
                    <SourceSelector
                      selectedSourceIds={formData.source_ids}
                      onChange={(source_ids) => setFormData({ ...formData, source_ids })}
                      themeColor="var(--source)"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">People</label>
                  <p className="form-hint">Researchers, theorists, or clinicians directly tied to this concept.</p>
                  <div style={{ height: formData.person_ids.length > 0 ? '320px' : '240px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
                    <PeopleSelector
                      selectedPersonIds={formData.person_ids}
                      onChange={(person_ids) => setFormData({ ...formData, person_ids })}
                      themeColor="var(--person)"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Tags</label>
                  <p className="form-hint">Free-form labels for grouping concepts your way.</p>
                  <div style={{ height: formData.tags.length > 0 ? '320px' : '240px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
                    <TagSelector
                      selectedTags={formData.tags}
                      onChange={(tags) => setFormData({ ...formData, tags })}
                      themeColor="var(--ink-3)"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Collections</label>
                  <p className="form-hint">Groupings of related entities — saved reading lists, course units, etc.</p>
                  <div style={{ height: '320px', overflow: 'hidden' }}>
                    <CollectionSelector
                      itemType="Concept"
                      itemId={item?.id}
                      selectedCollectionIds={formData.collection_ids}
                      onChange={(ids) => setFormData({ ...formData, collection_ids: ids })}
                      themeColor="var(--ink-3)"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Footer - only show for new concepts, editing uses autosave + X button */}
        {!item ? (
          <div style={{
            borderTop: '1px solid var(--ink-line)',
            background: 'var(--paper)',
            padding: 'var(--space-4) var(--space-6)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexShrink: 0,
          }}>
            <button type="button" onClick={handleClose} className="sp-action sp-action-secondary">
              Cancel
            </button>
            <button type="submit" className="sp-action sp-action-primary">
              Create concept
            </button>
          </div>
        ) : null}
      </form>
      <ConceptTypeReference open={showTypeRef} onClose={() => setShowTypeRef(false)} />
    </SlidePanel>
  );
}
