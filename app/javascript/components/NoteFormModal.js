import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import ConceptSelector from './ConceptSelector';
import TagSelector from './TagSelector';
import SourceSelector from './SourceSelector';

export default function NoteFormModal({ isOpen, onClose, onSuccess, item, conceptId, sourceId }) {
  const [activeTab, setActiveTab] = useState('content');
  const [formData, setFormData] = useState({
    body: '',
    note_type: 'note',
    context: '',
    pinned: false,
    noted_on: new Date().toISOString().split('T')[0],
    concept_ids: [],
    source_id: null,
    tags: []
  });
  const [error, setError] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto',
        },
      }),
    ],
    content: formData.body,
    onUpdate: ({ editor }) => {
      setFormData({ ...formData, body: editor.getHTML() });
    },
  });

  useEffect(() => {
    if (editor && isOpen) {
      editor.commands.setContent(formData.body || '');
    }
  }, [isOpen, editor]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('content');
      if (item) {
        setFormData({
          body: item.body || '',
          note_type: item.note_type || 'note',
          context: item.context || '',
          pinned: item.pinned || false,
          noted_on: item.noted_on || new Date().toISOString().split('T')[0],
          concept_ids: item.concepts?.map(c => c.id) || (conceptId ? [conceptId] : []),
          source_id: item.source_id || sourceId || null,
          tags: item.tags?.map(t => t.name) || []
        });
      } else {
        setFormData({
          body: '',
          note_type: 'note',
          context: '',
          pinned: false,
          noted_on: new Date().toISOString().split('T')[0],
          concept_ids: conceptId ? [conceptId] : [],
          source_id: sourceId || null,
          tags: []
        });
      }
      setError('');
    }
  }, [isOpen, item, conceptId, sourceId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      ...formData,
      concept_ids: formData.concept_ids || [],
      source_id: formData.source_id || null,
      tags: formData.tags || []
    };

    try {
      console.log('Submitting note. item:', item, 'item.id:', item?.id);
      const url = item ? `/notes/${item.id}` : '/notes';
      const method = item ? 'PATCH' : 'POST';
      console.log('URL:', url, 'Method:', method);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ note: payload }),
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
      console.error('Error saving note:', error);
      setError('An error occurred while saving the note');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="large"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '90vh' }}>
        {error && (
          <div className="alert alert-error" style={{ margin: 'var(--space-4)', marginBottom: 0 }}>
            <span className="alert-title"><i className="fas fa-times-circle"></i> Error:</span>
            {error}
          </div>
        )}

        {/* Sidebar + Content Layout */}
        <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden', position: 'relative' }}>
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 'var(--space-4)',
              right: 'var(--space-4)',
              zIndex: 10,
              background: 'white',
              border: 'none',
              color: 'var(--neutral-500)',
              fontSize: 'var(--text-2xl)',
              cursor: 'pointer',
              padding: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              boxShadow: 'var(--shadow-md)',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--neutral-100)';
              e.currentTarget.style.color = 'var(--neutral-900)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.color = 'var(--neutral-500)';
            }}
          >
            ×
          </button>
          {/* Left Sidebar Navigation */}
          <div className="w-12 md:w-[200px]" style={{
            background: 'var(--sidebar-bg)',
            padding: 'var(--space-2)',
            paddingTop: 'var(--space-6)',
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
              onClick={() => setActiveTab('content')}
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
                background: activeTab === 'content' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'content') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'content') e.currentTarget.style.background = 'transparent';
              }}
              title="Content"
            >
              <i className="fas fa-file-alt" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Content</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('connections')}
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
                background: activeTab === 'connections' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'connections') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'connections') e.currentTarget.style.background = 'transparent';
              }}
              title="Connections"
            >
              <i className="fas fa-project-diagram" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Connections</span>
            </button>
          </div>

          {/* Content Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--background)',
            padding: 'var(--space-6)',
          }}>
            {activeTab === 'content' && (
              <div className="space-y-4">
            <div>
              <label className="form-label required teal">Type</label>
              <select
                value={formData.note_type}
                onChange={(e) => setFormData({ ...formData, note_type: e.target.value })}
                className="form-select"
              >
                <option value="note">Note</option>
                <option value="question">Question</option>
                <option value="synthesis">Synthesis</option>
                <option value="connection">Connection</option>
                <option value="todo">To Do Item</option>
              </select>
            </div>

            <div>
              <label className="form-label required teal">Body</label>
              <div style={{
                border: '1px solid var(--neutral-300)',
                borderRadius: 'var(--radius)',
                background: 'white',
                overflow: 'hidden'
              }}>
            {editor && (
              <div style={{
                borderBottom: '1px solid var(--neutral-200)',
                padding: 'var(--space-2)',
                display: 'flex',
                gap: 'var(--space-1)',
                flexWrap: 'wrap',
                background: 'white'
              }}>
                {/* Text formatting */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: editor.isActive('bold') ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => !editor.isActive('bold') && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)')}
                  onMouseLeave={(e) => !editor.isActive('bold') && (e.currentTarget.style.background = 'transparent')}
                  title="Bold"
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: editor.isActive('italic') ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => !editor.isActive('italic') && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)')}
                  onMouseLeave={(e) => !editor.isActive('italic') && (e.currentTarget.style.background = 'transparent')}
                  title="Italic"
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: editor.isActive('underline') ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => !editor.isActive('underline') && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)')}
                  onMouseLeave={(e) => !editor.isActive('underline') && (e.currentTarget.style.background = 'transparent')}
                  title="Underline"
                >
                  <u>U</u>
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: editor.isActive('strike') ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => !editor.isActive('strike') && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)')}
                  onMouseLeave={(e) => !editor.isActive('strike') && (e.currentTarget.style.background = 'transparent')}
                  title="Strikethrough"
                >
                  <s>S</s>
                </button>

                <div style={{ width: '1px', height: '24px', background: 'rgba(99, 156, 161, 0.2)', margin: '0 var(--space-1)' }}></div>

                {/* Headings dropdown */}
                <select
                  onChange={(e) => {
                    const level = parseInt(e.target.value);
                    if (level) {
                      editor.chain().focus().toggleHeading({ level }).run();
                    } else {
                      editor.chain().focus().setParagraph().run();
                    }
                  }}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    border: '1px solid rgba(99, 156, 161, 0.2)',
                    background: 'var(--neutral-50)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  value={
                    editor.isActive('heading', { level: 1 }) ? '1' :
                    editor.isActive('heading', { level: 2 }) ? '2' :
                    editor.isActive('heading', { level: 3 }) ? '3' :
                    editor.isActive('heading', { level: 4 }) ? '4' :
                    editor.isActive('heading', { level: 5 }) ? '5' :
                    editor.isActive('heading', { level: 6 }) ? '6' : ''
                  }
                >
                  <option value="">Paragraph</option>
                  <option value="1">Heading 1</option>
                  <option value="2">Heading 2</option>
                  <option value="3">Heading 3</option>
                  <option value="4">Heading 4</option>
                  <option value="5">Heading 5</option>
                  <option value="6">Heading 6</option>
                </select>

                <div style={{ width: '1px', height: '24px', background: 'rgba(99, 156, 161, 0.2)', margin: '0 var(--space-1)' }}></div>

                {/* Text color */}
                <input
                  type="color"
                  onInput={(e) => editor.chain().focus().setColor(e.target.value).run()}
                  value={editor.getAttributes('textStyle').color || '#000000'}
                  style={{
                    width: '32px',
                    height: '24px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: '1px solid rgba(99, 156, 161, 0.2)'
                  }}
                  title="Text Color"
                />

                {/* Highlight */}
                <input
                  type="color"
                  onInput={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                  style={{
                    width: '32px',
                    height: '24px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: '1px solid rgba(99, 156, 161, 0.2)'
                  }}
                  title="Highlight Color"
                />

                <div style={{ width: '1px', height: '24px', background: 'rgba(99, 156, 161, 0.2)', margin: '0 var(--space-1)' }}></div>

                {/* Text alignment */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: editor.isActive({ textAlign: 'left' }) ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => !editor.isActive({ textAlign: 'left' }) && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)')}
                  onMouseLeave={(e) => !editor.isActive({ textAlign: 'left' }) && (e.currentTarget.style.background = 'transparent')}
                  title="Align Left"
                >
                  ⬅
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: editor.isActive({ textAlign: 'center' }) ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => !editor.isActive({ textAlign: 'center' }) && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)')}
                  onMouseLeave={(e) => !editor.isActive({ textAlign: 'center' }) && (e.currentTarget.style.background = 'transparent')}
                  title="Align Center"
                >
                  ↔
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: editor.isActive({ textAlign: 'right' }) ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => !editor.isActive({ textAlign: 'right' }) && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)')}
                  onMouseLeave={(e) => !editor.isActive({ textAlign: 'right' }) && (e.currentTarget.style.background = 'transparent')}
                  title="Align Right"
                >
                  ➡
                </button>

                <div style={{ width: '1px', height: '24px', background: 'rgba(99, 156, 161, 0.2)', margin: '0 var(--space-1)' }}></div>

                {/* Lists */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: editor.isActive('bulletList') ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => !editor.isActive('bulletList') && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)')}
                  onMouseLeave={(e) => !editor.isActive('bulletList') && (e.currentTarget.style.background = 'transparent')}
                  title="Bullet List"
                >
                  • List
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: editor.isActive('orderedList') ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => !editor.isActive('orderedList') && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)')}
                  onMouseLeave={(e) => !editor.isActive('orderedList') && (e.currentTarget.style.background = 'transparent')}
                  title="Numbered List"
                >
                  1. List
                </button>

                <div style={{ width: '1px', height: '24px', background: 'rgba(99, 156, 161, 0.2)', margin: '0 var(--space-1)' }}></div>

                {/* Link */}
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt('Enter URL:');
                    if (url) {
                      editor.chain().focus().setLink({ href: url }).run();
                    }
                  }}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: editor.isActive('link') ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => !editor.isActive('link') && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)')}
                  onMouseLeave={(e) => !editor.isActive('link') && (e.currentTarget.style.background = 'transparent')}
                  title="Add Link"
                >
                  🔗
                </button>

                {/* Blockquote */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: editor.isActive('blockquote') ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => !editor.isActive('blockquote') && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)')}
                  onMouseLeave={(e) => !editor.isActive('blockquote') && (e.currentTarget.style.background = 'transparent')}
                  title="Blockquote"
                >
                  &ldquo;&rdquo;
                </button>

                {/* Horizontal Rule */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setHorizontalRule().run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title="Horizontal Rule"
                >
                  ―
                </button>

                <div style={{ width: '1px', height: '24px', background: 'rgba(99, 156, 161, 0.2)', margin: '0 var(--space-1)' }}></div>

                {/* Table */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title="Insert Table"
                >
                  ▦
                </button>

                {/* Image */}
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt('Enter image URL:');
                    if (url) {
                      editor.chain().focus().setImage({ src: url }).run();
                    }
                  }}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title="Insert Image"
                >
                  🖼
                </button>
              </div>
            )}
                <EditorContent
                  editor={editor}
                  className="px-4 py-2 min-h-[150px] prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[150px] [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100"
                />
              </div>
            </div>

                <div>
                  <label className="form-label">Context</label>
                  <textarea
                    value={formData.context}
                    onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                    rows="2"
                    className="form-textarea"
                    placeholder="What prompted this note?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Date Noted</label>
                    <input
                      type="date"
                      value={formData.noted_on}
                      onChange={(e) => setFormData({ ...formData, noted_on: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>
                    <input
                      type="checkbox"
                      id="pinned"
                      checked={formData.pinned}
                      onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                      style={{
                        borderRadius: '4px',
                        border: '1px solid var(--neutral-300)',
                        accentColor: '#639CA1'
                      }}
                    />
                    <label htmlFor="pinned" className="text-sm">
                      Pin this note
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'connections' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ height: '300px' }}>
                  {!sourceId && (
                    <div style={{ height: '100%' }}>
                      <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Link to Source</label>
                      <SourceSelector
                        selectedSourceId={formData.source_id}
                        onChange={(sourceId) => setFormData({ ...formData, source_id: sourceId })}
                        multiple={false}
                        themeColor="#639CA1"
                      />
                    </div>
                  )}

                  {!conceptId && (
                    <div style={{ height: '100%' }}>
                      <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Link to Constructs</label>
                      <ConceptSelector
                        selectedConceptIds={formData.concept_ids}
                        onChange={(conceptIds) => setFormData({ ...formData, concept_ids: conceptIds })}
                        themeColor="#639CA1"
                      />
                    </div>
                  )}

                  <div style={{ height: '100%' }}>
                    <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Tags</label>
                    <TagSelector
                      selectedTags={formData.tags}
                      onChange={(tags) => setFormData({ ...formData, tags: tags })}
                      themeColor="#639CA1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--neutral-200)',
          background: 'var(--background)',
          padding: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-3)',
        }}>
          <button
            type="submit"
            className="btn-primary"
            style={{
              background: '#639CA1',
              color: 'white'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#527d81'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#639CA1'}
          >
            {item ? 'Save Changes' : 'Create Note'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
