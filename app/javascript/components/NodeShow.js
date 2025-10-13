import React, { useState, useEffect } from 'react';
import { NoteForm } from './NotesIndex';

export default function NodeShow({ nodeId }) {
  const [node, setNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showEdges, setShowEdges] = useState(true);

  useEffect(() => {
    fetchNode();
  }, []);

  const fetchNode = async () => {
    try {
      const response = await fetch(`/nodes/${nodeId}.json`);
      const data = await response.json();
      setNode(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching node:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="text-center py-12">
        <p className="text-lg">Node not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <a href="/nodes" className="text-sm text-primary hover:text-accent-dark">
          ← Back to Constructs
        </a>
      </div>

      {editing ? (
        <NodeEditForm
          node={node}
          onSuccess={(updatedNode) => {
            setNode(updatedNode);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <NodeDisplay node={node} onEdit={() => setEditing(true)} />

          <div className="mt-8">
            <EdgeManager nodeId={nodeId} />
          </div>

          <div className="mt-8">
            <NodeNotes nodeId={nodeId} />
          </div>
        </>
      )}
    </div>
  );
}

function NodeDisplay({ node, onEdit }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs uppercase tracking-wider text-primary bg-sand px-3 py-1 rounded">
              {node.node_type}
            </span>
            {node.level_status && (
              <span className="text-xs uppercase tracking-wider text-accent-dark bg-accent-light px-3 py-1 rounded">
                {node.level_status}
              </span>
            )}
          </div>
          <h1 className="text-4xl mb-2">{node.label}</h1>
          <p className="text-sm text-gray-600">
            Last updated: {new Date(node.updated_at).toLocaleDateString()}
            {node.last_reviewed_on && (
              <span className="ml-4">
                Last reviewed: {new Date(node.last_reviewed_on).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="px-4 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          Edit
        </button>
      </div>

      {/* Three-level mastery summaries */}
      <div className="space-y-6 mb-8">
        {node.summary_top && (
          <Section title="Summary (Top-level)" content={node.summary_top} />
        )}
        {node.summary_mid && (
          <Section title="Summary (Mid-level)" content={node.summary_mid} />
        )}
        {node.summary_deep && (
          <Section title="Summary (Deep)" content={node.summary_deep} />
        )}
      </div>

      {/* Array fields */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <ArraySection title="Mechanisms" items={node.mechanisms} />
        <ArraySection title="Signature Techniques" items={node.signature_techniques} />
        <ArraySection title="Strengths" items={node.strengths} />
        <ArraySection title="Weaknesses" items={node.weaknesses} />
        <ArraySection title="Adjacent Models" items={node.adjacent_models} />
        <ArraySection title="Contrasts With" items={node.contrasts_with} />
        <ArraySection title="Integrates With" items={node.integrates_with} />
        <ArraySection title="Intake Questions" items={node.intake_questions} />
        <ArraySection title="Micro Skills" items={node.micro_skills} />
        <ArraySection title="Practice Prompts" items={node.practice_prompts} />
        <ArraySection title="Assessment Links" items={node.assessment_links} />
      </div>

      {/* Evidence and reflection */}
      {node.evidence_brief && (
        <Section title="Evidence Brief" content={node.evidence_brief} className="mb-6" />
      )}
      {node.confidence_note && (
        <Section title="Confidence Note" content={node.confidence_note} className="mb-6" />
      )}

      {/* Tags */}
      {node.tags && node.tags.length > 0 && (
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-lg mb-2">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {node.tags.map((tag, idx) => (
              <span key={idx} className="text-xs bg-sand px-3 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, content, className = '' }) {
  return (
    <div className={className}>
      <h3 className="text-lg mb-2">{title}</h3>
      <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}

function ArraySection({ title, items }) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg mb-2">{title}</h3>
      <ul className="list-disc list-inside space-y-1">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function NodeEditForm({ node, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    label: node.label || '',
    node_type: node.node_type || 'model',
    level_status: node.level_status || 'mapped',
    summary_top: node.summary_top || '',
    summary_mid: node.summary_mid || '',
    summary_deep: node.summary_deep || '',
    evidence_brief: node.evidence_brief || '',
    confidence_note: node.confidence_note || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`/nodes/${node.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ node: formData }),
      });

      if (response.ok) {
        const updatedNode = await response.json();
        onSuccess(updatedNode);
      } else {
        const data = await response.json();
        alert('Error: ' + data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error updating node:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-300 rounded-lg p-8">
      <h2 className="text-2xl mb-6">Edit Construct</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Label *</label>
          <input
            type="text"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select
              value={formData.node_type}
              onChange={(e) => setFormData({ ...formData, node_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="model">Model</option>
              <option value="technique">Technique</option>
              <option value="mechanism">Mechanism</option>
              <option value="construct">Construct</option>
              <option value="measure">Measure</option>
              <option value="population">Population</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={formData.level_status}
              onChange={(e) => setFormData({ ...formData, level_status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="mapped">Mapped</option>
              <option value="basic">Basic</option>
              <option value="deep">Deep</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Summary Top (2-3 sentences)
          </label>
          <textarea
            value={formData.summary_top}
            onChange={(e) => setFormData({ ...formData, summary_top: e.target.value })}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Summary Mid (~200 words)
          </label>
          <textarea
            value={formData.summary_mid}
            onChange={(e) => setFormData({ ...formData, summary_mid: e.target.value })}
            rows="6"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Summary Deep (~600 words)
          </label>
          <textarea
            value={formData.summary_deep}
            onChange={(e) => setFormData({ ...formData, summary_deep: e.target.value })}
            rows="12"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Evidence Brief</label>
          <textarea
            value={formData.evidence_brief}
            onChange={(e) => setFormData({ ...formData, evidence_brief: e.target.value })}
            rows="4"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Confidence Note</label>
          <textarea
            value={formData.confidence_note}
            onChange={(e) => setFormData({ ...formData, confidence_note: e.target.value })}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          Save Changes
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

function EdgeManager({ nodeId }) {
  const [edges, setEdges] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingEdge, setCreatingEdge] = useState(false);

  useEffect(() => {
    fetchEdges();
    fetchNodes();
  }, []);

  const fetchEdges = async () => {
    try {
      const response = await fetch(`/edges.json?node_id=${nodeId}`);
      const data = await response.json();
      setEdges(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching edges:', error);
      setLoading(false);
    }
  };

  const fetchNodes = async () => {
    try {
      const response = await fetch('/nodes.json');
      const data = await response.json();
      setNodes(data.filter(n => n.id !== parseInt(nodeId)));
    } catch (error) {
      console.error('Error fetching nodes:', error);
    }
  };

  const handleDeleteEdge = async (edgeId) => {
    if (!confirm('Delete this relationship?')) return;

    try {
      const response = await fetch(`/edges/${edgeId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setEdges(edges.filter(e => e.id !== edgeId));
      }
    } catch (error) {
      console.error('Error deleting edge:', error);
    }
  };

  const relTypeLabels = {
    adjacent: 'Adjacent to',
    contrasts_with: 'Contrasts with',
    integrates_with: 'Integrates with',
    builds_on: 'Builds on',
    subsumes: 'Subsumes'
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl">Relationships</h2>
        <button
          onClick={() => setCreatingEdge(!creatingEdge)}
          className="px-4 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          {creatingEdge ? 'Cancel' : '+ Add Relationship'}
        </button>
      </div>

      {creatingEdge && (
        <EdgeForm
          nodeId={nodeId}
          nodes={nodes}
          onSuccess={(newEdge) => {
            setEdges([newEdge, ...edges]);
            setCreatingEdge(false);
          }}
          onCancel={() => setCreatingEdge(false)}
        />
      )}

      {loading ? (
        <p className="text-sm">Loading relationships...</p>
      ) : edges.length === 0 ? (
        <p className="text-sm text-gray-600">No relationships yet</p>
      ) : (
        <div className="space-y-4">
          {edges.map(edge => {
            const isSource = edge.src.id === parseInt(nodeId);
            const otherNode = isSource ? edge.dst : edge.src;
            const direction = isSource ? '→' : '←';

            return (
              <div key={edge.id} className="flex items-start justify-between border-b border-gray-200 pb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
                      {relTypeLabels[edge.rel_type]}
                    </span>
                    {edge.strength && (
                      <span className="text-xs text-gray-600">
                        Strength: {edge.strength}/5
                      </span>
                    )}
                    <span className="text-gray-400">{direction}</span>
                  </div>
                  <a
                    href={`/nodes/${otherNode.id}`}
                    className="text-lg hover:text-primary"
                  >
                    {otherNode.label}
                  </a>
                  <p className="text-xs text-gray-500 mt-1">{otherNode.node_type}</p>
                  {edge.description && (
                    <p className="text-sm mt-2">{edge.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteEdge(edge.id)}
                  className="text-sm text-accent-dark hover:text-primary ml-4"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EdgeForm({ nodeId, nodes, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    src_id: nodeId,
    dst_id: '',
    rel_type: 'adjacent',
    strength: 3,
    description: '',
    tags: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      tags: formData.tags.split('\n').filter(t => t.trim())
    };

    try {
      const response = await fetch('/edges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ edge: payload }),
      });

      if (response.ok) {
        const newEdge = await response.json();
        onSuccess(newEdge);
      } else {
        const data = await response.json();
        alert('Error: ' + data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error creating edge:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-sand rounded-lg p-6 mb-6">
      <h3 className="text-lg mb-4">New Relationship</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">To Construct *</label>
          <select
            value={formData.dst_id}
            onChange={(e) => setFormData({ ...formData, dst_id: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            required
          >
            <option value="">Select a construct...</option>
            {nodes.map(node => (
              <option key={node.id} value={node.id}>
                {node.label} ({node.node_type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Relationship Type *</label>
          <select
            value={formData.rel_type}
            onChange={(e) => setFormData({ ...formData, rel_type: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          >
            <option value="adjacent">Adjacent</option>
            <option value="contrasts_with">Contrasts with</option>
            <option value="integrates_with">Integrates with</option>
            <option value="builds_on">Builds on</option>
            <option value="subsumes">Subsumes</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Strength (1-5)</label>
          <input
            type="number"
            min="1"
            max="5"
            value={formData.strength}
            onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="Why are these constructs related?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tags (one per line)</label>
          <textarea
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          Create Relationship
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

function NodeNotes({ nodeId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingNote, setCreatingNote] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/notes.json?node_id=${nodeId}`);
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
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl">Notes</h2>
        <button
          onClick={() => setCreatingNote(!creatingNote)}
          className="px-4 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          {creatingNote ? 'Cancel' : '+ Add Note'}
        </button>
      </div>

      {creatingNote && (
        <NoteForm
          nodeId={nodeId}
          onSuccess={(newNote) => {
            setNotes([newNote, ...notes]);
            setCreatingNote(false);
          }}
          onCancel={() => setCreatingNote(false)}
        />
      )}

      {loading ? (
        <p className="text-sm">Loading notes...</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-600">No notes yet</p>
      ) : (
        <div className="space-y-4">
          {notes.map(note => (
            <div key={note.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <span className={`text-xs uppercase tracking-wider px-3 py-1 rounded ${noteTypeColors[note.note_type] || 'bg-gray-100'}`}>
                  {noteTypeLabels[note.note_type] || note.note_type}
                </span>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-sm text-accent-dark hover:text-primary"
                >
                  Delete
                </button>
              </div>

              <p className="mb-3 whitespace-pre-wrap">{note.body}</p>

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
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
