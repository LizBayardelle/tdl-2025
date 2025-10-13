import React, { useState, useEffect, useRef } from 'react';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (query.trim().length < 2) {
      setResults(null);
      setShowResults(false);
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query]);

  const performSearch = async (searchQuery) => {
    try {
      const response = await fetch(`/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setResults(data);
      setShowResults(true);
      setLoading(false);
    } catch (error) {
      console.error('Search error:', error);
      setLoading(false);
    }
  };

  const totalResults = results
    ? results.nodes.length + results.sources.length + results.people.length + results.notes.length + results.tags.length
    : 0;

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setShowResults(true)}
          placeholder="Search across everything..."
          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded bg-white"
        />
        <div className="absolute left-3 top-2.5 text-gray-400">
          🔍
        </div>
        {loading && (
          <div className="absolute right-3 top-2.5 text-gray-400">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {showResults && results && totalResults > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              Found {totalResults} result{totalResults === 1 ? '' : 's'} for "{results.query}"
            </p>
          </div>

          {results.nodes.length > 0 && (
            <SearchSection title="Constructs" items={results.nodes} type="node" />
          )}

          {results.sources.length > 0 && (
            <SearchSection title="Sources" items={results.sources} type="source" />
          )}

          {results.people.length > 0 && (
            <SearchSection title="People" items={results.people} type="person" />
          )}

          {results.notes.length > 0 && (
            <SearchSection title="Notes" items={results.notes} type="note" />
          )}

          {results.tags.length > 0 && (
            <SearchSection title="Tags" items={results.tags} type="tag" />
          )}
        </div>
      )}

      {showResults && results && totalResults === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-6 text-center">
          <p className="text-gray-600">No results found for "{results.query}"</p>
        </div>
      )}
    </div>
  );
}

function SearchSection({ title, items, type }) {
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <div className="px-3 py-2 bg-sand">
        <h3 className="text-xs uppercase tracking-wider font-medium">{title}</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {items.map((item) => (
          <SearchResultItem key={item.id} item={item} type={type} />
        ))}
      </div>
    </div>
  );
}

function SearchResultItem({ item, type }) {
  const getLink = () => {
    if (type === 'node') return `/nodes/${item.id}`;
    if (type === 'source') return `/sources`;
    if (type === 'person') return `/people`;
    if (type === 'note') return `/notes`;
    if (type === 'tag') return `/tags`;
    return '#';
  };

  const getTitle = () => {
    if (type === 'node') return item.label;
    if (type === 'source') return item.title;
    if (type === 'person') return item.full_name;
    if (type === 'note') return item.body?.substring(0, 100) + (item.body?.length > 100 ? '...' : '');
    if (type === 'tag') return item.name;
    return '';
  };

  const getSubtitle = () => {
    if (type === 'node') return item.summary_top;
    if (type === 'source') return item.authors;
    if (type === 'person') return item.role;
    if (type === 'note' && item.node) return `→ ${item.node.label}`;
    if (type === 'tag') return `${item.taggings_count} items`;
    return '';
  };

  const getBadge = () => {
    if (type === 'node') return item.node_type;
    if (type === 'source') return item.kind;
    if (type === 'person') return item.role;
    if (type === 'note') return item.note_type;
    return null;
  };

  return (
    <a
      href={getLink()}
      className="block px-4 py-3 hover:bg-sand transition-colors"
      onClick={() => window.location.href = getLink()}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getBadge() && (
              <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-0.5 rounded">
                {getBadge()}
              </span>
            )}
            {type === 'tag' && item.color && (
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            )}
          </div>
          <p className="font-medium text-sm mb-1 truncate">{getTitle()}</p>
          {getSubtitle() && (
            <p className="text-xs text-gray-600 truncate">{getSubtitle()}</p>
          )}
        </div>
      </div>
    </a>
  );
}

export { GlobalSearch };
