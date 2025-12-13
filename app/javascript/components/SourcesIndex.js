import React, { useState, useEffect } from 'react';
import SourceFormModal from './SourceFormModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

export default function SourcesIndex() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterKind, setFilterKind] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterConcept, setFilterConcept] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [filterPerson, setFilterPerson] = useState('all');

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

  // Get unique values for filters
  const years = [...new Set(sources.map(s => s.year).filter(Boolean))].sort((a, b) => b - a);

  const conceptsMap = new Map();
  sources.forEach(s => {
    (s.concepts || []).forEach(c => {
      if (!conceptsMap.has(c.id)) {
        conceptsMap.set(c.id, { id: c.id, label: c.label });
      }
    });
  });
  const allConcepts = Array.from(conceptsMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  const allTags = [...new Set(sources.flatMap(s => s.tags || []))].sort();

  const peopleMap = new Map();
  sources.forEach(s => {
    (s.people || []).forEach(p => {
      if (!peopleMap.has(p.id)) {
        peopleMap.set(p.id, { id: p.id, full_name: p.full_name });
      }
    });
  });
  const allPeople = Array.from(peopleMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));

  // Filter sources
  const filteredSources = sources.filter(source => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = source.title?.toLowerCase().includes(query);
      const matchesAuthors = typeof source.authors === 'string' && source.authors.toLowerCase().includes(query);
      const matchesAbstract = source.abstract?.toLowerCase().includes(query);
      const matchesSummary = source.summary?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesAuthors && !matchesAbstract && !matchesSummary) {
        return false;
      }
    }

    // Kind filter
    if (filterKind !== 'all' && source.kind !== filterKind) {
      return false;
    }

    // Year filter
    if (filterYear !== 'all' && source.year !== parseInt(filterYear)) {
      return false;
    }

    // Concept filter
    if (filterConcept !== 'all' && !source.concepts?.some(c => c.id === parseInt(filterConcept))) {
      return false;
    }

    // Tag filter
    if (filterTag !== 'all' && !source.tags?.includes(filterTag)) {
      return false;
    }

    // Person filter
    if (filterPerson !== 'all' && !source.people?.some(p => p.id === parseInt(filterPerson))) {
      return false;
    }

    return true;
  });

  const kinds = ['article', 'book', 'book_chapter', 'conference', 'report', 'thesis', 'dissertation', 'website', 'video', 'podcast', 'other'];

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

      {/* Search Box */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search sources by title, author, abstract, or summary..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none"
        />
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
          >
            <option value="all">All Types</option>
            <option value="article">Article</option>
            <option value="book">Book</option>
            <option value="book_chapter">Book Chapter</option>
            <option value="conference">Conference Paper</option>
            <option value="report">Report</option>
            <option value="thesis">Thesis</option>
            <option value="dissertation">Dissertation</option>
            <option value="website">Website</option>
            <option value="video">Video</option>
            <option value="podcast">Podcast</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Year</label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
          >
            <option value="all">All Years</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Construct</label>
          <select
            value={filterConcept}
            onChange={(e) => setFilterConcept(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
          >
            <option value="all">All Constructs</option>
            {allConcepts.map(concept => (
              <option key={concept.id} value={concept.id}>
                {concept.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tag</label>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
          >
            <option value="all">All Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Author</label>
          <select
            value={filterPerson}
            onChange={(e) => setFilterPerson(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
          >
            <option value="all">All Authors</option>
            {allPeople.map(person => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {filteredSources.length} of {sources.length} sources
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

    if (source.kind === 'article' || source.kind === 'conference') {
      if (source.journal_name) parts.push(source.journal_name);
      const volIssue = [source.volume, source.issue && `(${source.issue})`].filter(Boolean).join('');
      if (volIssue) parts.push(volIssue);
      if (source.pages) parts.push(`pp. ${source.pages}`);
    } else if (source.kind === 'book') {
      if (source.publisher_or_venue) parts.push(source.publisher_or_venue);
      if (source.edition) parts.push(source.edition);
    } else if (source.kind === 'book_chapter') {
      if (source.book_title) parts.push(`In: ${source.book_title}`);
      if (source.pages) parts.push(`pp. ${source.pages}`);
    } else if (source.kind === 'report' || source.kind === 'thesis' || source.kind === 'dissertation') {
      if (source.publisher_or_venue) parts.push(source.publisher_or_venue);
    } else if (source.kind === 'video' || source.kind === 'website' || source.kind === 'podcast') {
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
                className="text-xs bg-sand text-primary px-3 py-1 rounded hover:bg-primary hover:text-sand transition-colors"
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
