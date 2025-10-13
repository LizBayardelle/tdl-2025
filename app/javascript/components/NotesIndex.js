import React, { useState, useEffect } from 'react';
import NoteFormModal from './NoteFormModal';

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

        <NoteFormModal
          isOpen={creatingNote}
          onClose={() => setCreatingNote(false)}
          onSuccess={(newNote) => {
            setNotes([newNote, ...notes]);
            setCreatingNote(false);
          }}
        />
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
                    className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-sand transition-colors"
                  >
                    {note.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="px-3 py-1 text-xs text-white bg-accent hover:bg-accent-dark rounded transition-colors"
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
