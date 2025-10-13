import React, { useState, useEffect } from 'react';

export default function NotesIndex() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [filterType, showPinnedOnly]);

  const fetchNotes = async () => {
    try {
      let url = '/notes.json?';
      if (filterType !== 'all') url += `note_type=${filterType}&`;
      if (showPinnedOnly) url += 'pinned=true';

      const response = await fetch(url);
      const data = await response.json();
      setNotes(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setLoading(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return;

    try {
      const response = await fetch(`/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setNotes(notes.filter(n => n.id !== noteId));
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleTogglePin = async (note) => {
    try {
      const response = await fetch(`/notes/${note.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ note: { pinned: !note.pinned } }),
      });

      if (response.ok) {
        const updatedNote = await response.json();
        setNotes(notes.map(n => n.id === note.id ? updatedNote : n));
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const noteTypeLabels = {
    reflection: 'Reflection',
    question: 'Question',
    insight: 'Insight',
    critique: 'Critique',
    application: 'Application',
    synthesis: 'Synthesis'
  };

  const noteTypeColors = {
    reflection: 'bg-blue-100 text-blue-800',
    question: 'bg-purple-100 text-purple-800',
    insight: 'bg-yellow-100 text-yellow-800',
    critique: 'bg-red-100 text-red-800',
    application: 'bg-green-100 text-green-800',
    synthesis: 'bg-indigo-100 text-indigo-800'
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl mb-4">Notes & Reflections</h1>
        <p className="text-lg mb-6">
          Capture insights, questions, and reflections as you learn
        </p>

        <div className="flex items-center gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Filter by Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="all">All Types</option>
              <option value="reflection">Reflection</option>
              <option value="question">Question</option>
              <option value="insight">Insight</option>
              <option value="critique">Critique</option>
              <option value="application">Application</option>
              <option value="synthesis">Synthesis</option>
            </select>
          </div>

          <div className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              id="pinned-filter"
              checked={showPinnedOnly}
              onChange={(e) => setShowPinnedOnly(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="pinned-filter" className="text-sm">
              Pinned only
            </label>
          </div>

          <button
            onClick={() => setCreatingNote(!creatingNote)}
            className="ml-auto mt-6 px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
          >
            {creatingNote ? 'Cancel' : '+ New Note'}
          </button>
        </div>

        {creatingNote && (
          <NoteForm
            onSuccess={(newNote) => {
              setNotes([newNote, ...notes]);
              setCreatingNote(false);
            }}
            onCancel={() => setCreatingNote(false)}
          />
        )}
      </div>

      {loading ? (
        <p>Loading notes...</p>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-300 rounded-lg">
          <p className="text-lg text-gray-600">No notes yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map(note => (
            <div
              key={note.id}
              className="bg-white border border-gray-300 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                  {note.pinned && (
                    <span className="text-primary text-lg" title="Pinned">📌</span>
                  )}
                  <span className={`text-xs uppercase tracking-wider px-3 py-1 rounded ${noteTypeColors[note.note_type] || 'bg-gray-100'}`}>
                    {noteTypeLabels[note.note_type] || note.note_type}
                  </span>
                  {note.concept && (
                    <a
                      href={`/concepts/${note.concept.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      → {note.concept.label}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleTogglePin(note)}
                    className="text-sm text-gray-600 hover:text-primary"
                  >
                    {note.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="text-sm text-accent-dark hover:text-primary"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="mb-3 whitespace-pre-wrap leading-relaxed">{note.body}</p>

              {note.context && (
                <div className="bg-sand rounded p-3 mb-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Context:</span> {note.context}
                  </p>
                </div>
              )}

              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {note.tags.map((tag, idx) => (
                    <span key={idx} className="text-xs bg-sand px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500">
                {new Date(note.created_at).toLocaleDateString()}
                {note.noted_on && note.noted_on !== new Date(note.created_at).toISOString().split('T')[0] && (
                  <span className="ml-3">Noted: {new Date(note.noted_on).toLocaleDateString()}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteForm({ onSuccess, onCancel, conceptId = null }) {
  const [concepts, setConcepts] = useState([]);
  const [formData, setFormData] = useState({
    body: '',
    note_type: 'reflection',
    context: '',
    pinned: false,
    noted_on: new Date().toISOString().split('T')[0],
    concept_id: conceptId || '',
    tags: ''
  });

  useEffect(() => {
    if (!conceptId) {
      fetchConcepts();
    }
  }, []);

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

    const payload = {
      ...formData,
      concept_id: formData.concept_id || null,
      tags: formData.tags.split('\n').filter(t => t.trim())
    };

    try {
      const response = await fetch('/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ note: payload }),
      });

      if (response.ok) {
        const newNote = await response.json();
        onSuccess(newNote);
      } else {
        const data = await response.json();
        alert('Error: ' + data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
      <h3 className="text-xl mb-4">New Note</h3>

      <div className="space-y-4">
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
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Body *</label>
          <textarea
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            rows="6"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="What are you thinking about?"
            required
          />
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
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          Create Note
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded hover:bg-sand"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export { NoteForm };
