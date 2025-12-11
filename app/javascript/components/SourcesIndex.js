import React, { useState, useEffect } from 'react';
import SourceFormModal from './SourceFormModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

export default function SourcesIndex() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterKind, setFilterKind] = useState('all');

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const response = await fetch('/sources.json');
      const data = await response.json();
      setSources(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching sources:', error);
      setLoading(false);
    }
  };

  const filteredSources = filterKind === 'all'
    ? sources
    : sources.filter(source => source.kind === filterKind);

  const kinds = ['manual', 'textbook', 'rct', 'meta_analysis', 'guideline', 'video_demo', 'article', 'chapter'];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-lg">Loading sources...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl">Sources</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark transition-colors"
        >
          {showForm ? 'Cancel' : 'New Source'}
        </button>
      </div>

      <SourceFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          fetchSources();
          setShowForm(false);
        }}
      />

      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterKind('all')}
          className={`px-4 py-2 rounded text-sm ${
            filterKind === 'all'
              ? 'bg-primary text-sand'
              : 'bg-white border border-gray-300 hover:bg-sand'
          }`}
        >
          All ({sources.length})
        </button>
        {kinds.map(kind => {
          const count = sources.filter(s => s.kind === kind).length;
          if (count === 0) return null;
          return (
            <button
              key={kind}
              onClick={() => setFilterKind(kind)}
              className={`px-4 py-2 rounded capitalize text-sm ${
                filterKind === kind
                  ? 'bg-primary text-sand'
                  : 'bg-white border border-gray-300 hover:bg-sand'
              }`}
            >
              {kind.replace('_', ' ')} ({count})
            </button>
          );
        })}
      </div>

      {filteredSources.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-300 rounded">
          <p className="text-lg mb-4">No sources yet.</p>
          <p className="text-sm">Add your first source to build your evidence base.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSources.map(source => (
            <SourceCard key={source.id} source={source} onUpdate={fetchSources} />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceCard({ source, onUpdate }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this source?')) return;

    try {
      const response = await fetch(`/sources/${source.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting source:', error);
    }
  };

  // Build citation info based on source type
  const getCitationInfo = () => {
    const parts = [];

    if (source.kind === 'article' || source.kind === 'rct' || source.kind === 'meta_analysis') {
      if (source.journal_name) parts.push(source.journal_name);
      const volIssue = [source.volume, source.issue && `(${source.issue})`].filter(Boolean).join('');
      if (volIssue) parts.push(volIssue);
      if (source.pages) parts.push(`pp. ${source.pages}`);
    } else if (source.kind === 'textbook' || source.kind === 'manual') {
      if (source.publisher_or_venue) parts.push(source.publisher_or_venue);
      if (source.edition) parts.push(source.edition);
    } else if (source.kind === 'chapter') {
      if (source.book_title) parts.push(`In: ${source.book_title}`);
      if (source.pages) parts.push(`pp. ${source.pages}`);
    } else if (source.kind === 'video_demo') {
      if (source.website_name) parts.push(source.website_name);
    }

    return parts.length > 0 ? parts.join(', ') : null;
  };

  const citationInfo = getCitationInfo();

  return (
    <>
      <div className="bg-white border border-gray-300 rounded p-6 hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {source.kind && (
                <span className="text-xs uppercase tracking-wider text-primary bg-sand px-3 py-1 rounded">
                  {source.kind.replace('_', ' ')}
                </span>
              )}
              {source.year && (
                <span className="text-xs text-gray-600">{source.year}</span>
              )}
              {source.doi && (
                <a
                  href={`https://doi.org/${source.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-accent-dark font-mono underline"
                  title="View on DOI.org"
                >
                  DOI: {source.doi}
                </a>
              )}
            </div>
            <h3 className="text-xl mb-2">
              <a href={`/sources/${source.id}`} className="hover:text-primary">
                {source.title}
              </a>
            </h3>
            {source.authors && (
              <p className="text-sm text-gray-600 mb-2">{source.authors}</p>
            )}
            {citationInfo && (
              <p className="text-sm text-gray-500 mb-2 italic">{citationInfo}</p>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            {source.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-sand transition-colors"
                title="View Source"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </a>
            )}
            <button
              onClick={() => setShowEdit(true)}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-sand transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1 text-xs text-white bg-accent hover:bg-accent-dark rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {source.abstract && (
          <div className="mb-3">
            <p className={`text-sm text-gray-700 ${showFullAbstract ? '' : 'line-clamp-3'}`}>
              {source.abstract}
            </p>
            {source.abstract.length > 200 && (
              <button
                onClick={() => setShowFullAbstract(!showFullAbstract)}
                className="text-xs hover:text-accent-dark mt-1"
                style={{ background: 'none', padding: 0, color: '#414431' }}
              >
                {showFullAbstract ? 'Show Less' : 'Show More'}
              </button>
            )}
          </div>
        )}

        {source.summary && !source.abstract && (
          <p className="text-sm mb-3">{source.summary}</p>
        )}

        {(source.concepts?.length > 0 || source.tags?.length > 0 || source.people?.length > 0) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {source.concepts?.map((concept) => (
              <a
                key={concept.id}
                href={`/concepts/${concept.id}`}
                className="text-xs bg-accent-dark text-sand px-3 py-1 rounded hover:bg-primary-light transition-colors"
              >
                {concept.label}
              </a>
            ))}
            {source.tags?.map((tag, idx) => (
              <a
                key={idx}
                href={`/tags/${tag}`}
                className="text-xs bg-primary text-sand px-3 py-1 rounded hover:bg-primary-light transition-colors"
              >
                {tag}
              </a>
            ))}
            {source.people?.map((person) => (
              <a
                key={person.id}
                href={`/people/${person.id}`}
                className="text-xs bg-sand text-primary border border-primary px-3 py-1 rounded hover:bg-primary-light transition-colors"
              >
                {person.full_name}
              </a>
            ))}
          </div>
        )}

        {source.methodologies && source.methodologies.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {source.methodologies.map((methodology, idx) => (
              <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded">
                {methodology}
              </span>
            ))}
          </div>
        )}

        {source.keywords && source.keywords.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {source.keywords.slice(0, 5).map((keyword, idx) => (
              <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                {keyword}
              </span>
            ))}
            {source.keywords.length > 5 && (
              <span className="text-xs text-gray-500 px-2 py-1">
                +{source.keywords.length - 5} more
              </span>
            )}
          </div>
        )}

        {source.pdf_url && (
          <div className="text-xs mb-3 flex items-center gap-3">
            <a
              href={source.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-accent-dark underline font-medium"
            >
              📄 View PDF
            </a>
            <a
              href={`/sources/${source.id}/study`}
              className="text-accent-dark hover:text-plum underline font-medium"
            >
              📖 Study PDF
            </a>
          </div>
        )}

        <div className="pt-3 border-t border-gray-200 text-xs text-gray-500 flex items-center gap-2">
          <span>{source.notes_count || 0} note{source.notes_count !== 1 ? 's' : ''}</span>
          <span>•</span>
          <a href={`/notes/new?source_id=${source.id}`} className="text-primary hover:text-accent-dark">
            + New Note
          </a>
        </div>
      </div>

      <SourceFormModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        onSuccess={() => {
          onUpdate();
          setShowEdit(false);
        }}
        item={source}
      />
    </>
  );
}
