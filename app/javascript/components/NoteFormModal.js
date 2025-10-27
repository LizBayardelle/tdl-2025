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

export default function NoteFormModal({ isOpen, onClose, onSuccess, item, conceptId }) {
  const [concepts, setConcepts] = useState([]);
  const [formData, setFormData] = useState({
    body: '',
    note_type: 'reflection',
    context: '',
    pinned: false,
    noted_on: new Date().toISOString().split('T')[0],
    concept_id: '',
    tags: ''
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
      if (!conceptId && !item) {
        fetchConcepts();
      }
      if (item) {
        setFormData({
          body: item.body || '',
          note_type: item.note_type || 'reflection',
          context: item.context || '',
          pinned: item.pinned || false,
          noted_on: item.noted_on || new Date().toISOString().split('T')[0],
          concept_id: item.concept_id || conceptId || '',
          tags: (item.tags || []).join('\n')
        });
      } else {
        setFormData({
          body: '',
          note_type: 'reflection',
          context: '',
          pinned: false,
          noted_on: new Date().toISOString().split('T')[0],
          concept_id: conceptId || '',
          tags: ''
        });
      }
      setError('');
    }
  }, [isOpen, item, conceptId]);

  const fetchConcepts = async () => {
    try {
      const response = await fetch('/concepts.json');
      const data = await response.json();
      setConcepts(data);
    } catch (error) {
      console.error('Error fetching concepts:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      ...formData,
      concept_id: formData.concept_id || null,
      tags: formData.tags.split('\n').filter(t => t.trim())
    };

    try {
      const url = item ? `/notes/${item.id}` : '/notes';
      const method = item ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
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
      title={item ? 'Edit Note' : 'New Note'}
      size="medium"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Type *</label>
          <select
            value={formData.note_type}
            onChange={(e) => setFormData({ ...formData, note_type: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          >
            <option value="reflection">Reflection</option>
            <option value="question">Question</option>
            <option value="insight">Insight</option>
            <option value="critique">Critique</option>
            <option value="application">Application</option>
            <option value="synthesis">Synthesis</option>
            <option value="source_notes">Source Notes</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Body *</label>
          <div className="border border-gray-300 rounded bg-white">
            {editor && (
              <div className="border-b border-gray-200 p-2 flex gap-1 flex-wrap bg-sand">
                {/* Text formatting */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`px-3 py-1 rounded text-sm text-olive ${editor.isActive('bold') ? 'bg-olive/20' : 'hover:bg-olive/10'}`}
                  title="Bold"
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`px-3 py-1 rounded text-sm text-olive ${editor.isActive('italic') ? 'bg-olive/20' : 'hover:bg-olive/10'}`}
                  title="Italic"
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  className={`px-3 py-1 rounded text-sm text-olive ${editor.isActive('underline') ? 'bg-olive/20' : 'hover:bg-olive/10'}`}
                  title="Underline"
                >
                  <u>U</u>
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  className={`px-3 py-1 rounded text-sm text-olive ${editor.isActive('strike') ? 'bg-olive/20' : 'hover:bg-olive/10'}`}
                  title="Strikethrough"
                >
                  <s>S</s>
                </button>

                <div className="w-px h-6 bg-olive/20 mx-1"></div>

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
                  className="px-2 py-1 rounded text-sm text-olive border border-olive/20 bg-sand hover:bg-olive/10"
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

                <div className="w-px h-6 bg-olive/20 mx-1"></div>

                {/* Text color */}
                <input
                  type="color"
                  onInput={(e) => editor.chain().focus().setColor(e.target.value).run()}
                  value={editor.getAttributes('textStyle').color || '#000000'}
                  className="w-8 h-6 rounded cursor-pointer border border-olive/20"
                  title="Text Color"
                />

                {/* Highlight */}
                <input
                  type="color"
                  onInput={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                  className="w-8 h-6 rounded cursor-pointer border border-olive/20"
                  title="Highlight Color"
                />

                <div className="w-px h-6 bg-olive/20 mx-1"></div>

                {/* Text alignment */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  className={`px-3 py-1 rounded text-sm text-olive ${editor.isActive({ textAlign: 'left' }) ? 'bg-olive/20' : 'hover:bg-olive/10'}`}
                  title="Align Left"
                >
                  ⬅
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  className={`px-3 py-1 rounded text-sm text-olive ${editor.isActive({ textAlign: 'center' }) ? 'bg-olive/20' : 'hover:bg-olive/10'}`}
                  title="Align Center"
                >
                  ↔
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  className={`px-3 py-1 rounded text-sm text-olive ${editor.isActive({ textAlign: 'right' }) ? 'bg-olive/20' : 'hover:bg-olive/10'}`}
                  title="Align Right"
                >
                  ➡
                </button>

                <div className="w-px h-6 bg-olive/20 mx-1"></div>

                {/* Lists */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`px-3 py-1 rounded text-sm text-olive ${editor.isActive('bulletList') ? 'bg-olive/20' : 'hover:bg-olive/10'}`}
                  title="Bullet List"
                >
                  • List
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={`px-3 py-1 rounded text-sm text-olive ${editor.isActive('orderedList') ? 'bg-olive/20' : 'hover:bg-olive/10'}`}
                  title="Numbered List"
                >
                  1. List
                </button>

                <div className="w-px h-6 bg-olive/20 mx-1"></div>

                {/* Link */}
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt('Enter URL:');
                    if (url) {
                      editor.chain().focus().setLink({ href: url }).run();
                    }
                  }}
                  className={`px-3 py-1 rounded text-sm text-olive ${editor.isActive('link') ? 'bg-olive/20' : 'hover:bg-olive/10'}`}
                  title="Add Link"
                >
                  🔗
                </button>

                {/* Blockquote */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  className={`px-3 py-1 rounded text-sm text-olive ${editor.isActive('blockquote') ? 'bg-olive/20' : 'hover:bg-olive/10'}`}
                  title="Blockquote"
                >
                  &ldquo;&rdquo;
                </button>

                {/* Horizontal Rule */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setHorizontalRule().run()}
                  className="px-3 py-1 rounded text-sm text-olive hover:bg-olive/10"
                  title="Horizontal Rule"
                >
                  ―
                </button>

                <div className="w-px h-6 bg-olive/20 mx-1"></div>

                {/* Table */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                  className="px-3 py-1 rounded text-sm text-olive hover:bg-olive/10"
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
                  className="px-3 py-1 rounded text-sm text-olive hover:bg-olive/10"
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
          <label className="block text-sm font-medium mb-1">Context</label>
          <textarea
            value={formData.context}
            onChange={(e) => setFormData({ ...formData, context: e.target.value })}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="What prompted this note?"
          />
        </div>

        {!conceptId && (
          <div>
            <label className="block text-sm font-medium mb-1">Link to Construct</label>
            <select
              value={formData.concept_id}
              onChange={(e) => setFormData({ ...formData, concept_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="">None (general note)</option>
              {concepts.map(concept => (
                <option key={concept.id} value={concept.id}>
                  {concept.label} ({concept.node_type})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Tags (one per line)</label>
          <textarea
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date Noted</label>
            <input
              type="date"
              value={formData.noted_on}
              onChange={(e) => setFormData({ ...formData, noted_on: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            />
          </div>

          <div className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              id="pinned"
              checked={formData.pinned}
              onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="pinned" className="text-sm">
              Pin this note
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
          >
            {item ? 'Save Changes' : 'Create Note'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded hover:bg-sand"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
