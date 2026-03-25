import React, { useState, useRef, useEffect, useMemo } from 'react';
import { buildConceptHierarchy, flattenHierarchy, getIndentPrefix } from '../utils/conceptHierarchy';

/**
 * A type-to-filter concept selector with option to create new concepts.
 * Single-select, returns concept ID via onChange.
 */
export default function ConceptSearchSelect({
  concepts,
  value,
  onChange,
  excludeId = null,
  placeholder = "Type to search constructs...",
  onCreateConcept,
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Build flat list from hierarchy
  const flatConcepts = useMemo(() => {
    if (!concepts) return [];
    const filtered = excludeId
      ? concepts.filter(c => c.id !== excludeId)
      : concepts;
    const hierarchy = buildConceptHierarchy(filtered);
    return flattenHierarchy(hierarchy);
  }, [concepts, excludeId]);

  // Filter by query with smart sorting and limit
  const filteredConcepts = useMemo(() => {
    if (!query.trim()) return flatConcepts.slice(0, 15);
    const lower = query.toLowerCase();

    // Filter matches (by label only)
    const matches = flatConcepts.filter(({ concept }) =>
      concept.label.toLowerCase().includes(lower)
    );

    // Sort: exact matches first, then starts-with, then contains
    matches.sort((a, b) => {
      const aLabel = a.concept.label.toLowerCase();
      const bLabel = b.concept.label.toLowerCase();

      // Exact match
      const aExact = aLabel === lower;
      const bExact = bLabel === lower;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      // Starts with
      const aStarts = aLabel.startsWith(lower);
      const bStarts = bLabel.startsWith(lower);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      // Alphabetical
      return aLabel.localeCompare(bLabel);
    });

    // Limit to 15 results
    return matches.slice(0, 15);
  }, [flatConcepts, query]);

  const canCreate = query.trim() &&
    !concepts?.some(c => c.label.toLowerCase() === query.trim().toLowerCase());

  // Selected concept label
  const selectedConcept = concepts?.find(c => c.id === parseInt(value));

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [filteredConcepts.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const items = listRef.current.children;
      if (items[highlightIndex]) {
        items[highlightIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex, isOpen]);

  const handleSelect = (conceptId) => {
    onChange({ target: { value: String(conceptId) } });
    setQuery('');
    setIsOpen(false);
  };

  const handleCreate = async () => {
    if (!canCreate || !onCreateConcept) return;
    const newConcept = await onCreateConcept(query.trim());
    if (newConcept) {
      handleSelect(newConcept.id);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ target: { value: '' } });
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    const totalItems = filteredConcepts.length + (canCreate ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(prev => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (canCreate && highlightIndex === filteredConcepts.length) {
          handleCreate();
        } else if (filteredConcepts[highlightIndex]) {
          handleSelect(filteredConcepts[highlightIndex].concept.id);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
      {/* Input / Display */}
      <div
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          border: '1px solid var(--neutral-300)',
          borderRadius: 'var(--radius)',
          background: 'white',
          padding: 'var(--space-2) var(--space-3)',
          cursor: 'text',
          minHeight: '38px',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedConcept ? selectedConcept.label : placeholder}
            style={{
              border: 'none',
              outline: 'none',
              flex: 1,
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              background: 'transparent',
              padding: 0,
            }}
            autoFocus
          />
        ) : (
          <span style={{
            flex: 1,
            color: selectedConcept ? 'var(--neutral-900)' : 'var(--neutral-400)',
            fontSize: 'var(--text-sm)',
          }}>
            {selectedConcept ? (
              <>
                {selectedConcept.label}
                <span style={{ color: 'var(--neutral-500)', marginLeft: 'var(--space-1)' }}>
                  ({selectedConcept.concept_type})
                </span>
              </>
            ) : placeholder}
          </span>
        )}
        {selectedConcept && !isOpen && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--neutral-400)',
              fontSize: '16px',
              padding: '0 var(--space-1)',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--neutral-700)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-400)'}
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '250px',
            overflowY: 'auto',
            background: 'white',
            border: '1px solid var(--neutral-300)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius) var(--radius)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 50,
          }}
        >
          {filteredConcepts.length === 0 && !canCreate && (
            <div style={{
              padding: 'var(--space-3)',
              color: 'var(--neutral-500)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              textAlign: 'center',
            }}>
              No matching constructs
            </div>
          )}

          {filteredConcepts.map(({ concept, depth }, index) => (
            <div
              key={concept.id}
              onClick={() => handleSelect(concept.id)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                background: highlightIndex === index ? 'var(--neutral-100)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                borderBottom: '1px solid var(--neutral-100)',
              }}
              onMouseEnter={() => setHighlightIndex(index)}
            >
              <span style={{ whiteSpace: 'pre' }}>{getIndentPrefix(depth)}</span>
              <span>{concept.label}</span>
              {concept.concept_type && (
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--neutral-500)',
                  marginLeft: 'auto',
                }}>
                  {concept.concept_type}
                </span>
              )}
            </div>
          ))}

          {canCreate && onCreateConcept && (
            <div
              onClick={handleCreate}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                background: highlightIndex === filteredConcepts.length ? 'var(--accent-green-light)' : 'transparent',
                color: 'var(--primary)',
                fontWeight: 600,
                borderTop: '1px solid var(--neutral-200)',
              }}
              onMouseEnter={() => setHighlightIndex(filteredConcepts.length)}
            >
              + Create "{query.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
