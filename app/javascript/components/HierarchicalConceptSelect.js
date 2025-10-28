import React, { useMemo } from 'react';
import { buildConceptHierarchy, flattenHierarchy, getIndentPrefix } from '../utils/conceptHierarchy';

/**
 * A select dropdown that displays concepts in a hierarchical structure
 * with children nested under parents and alphabetically sorted
 */
export default function HierarchicalConceptSelect({
  concepts,
  value,
  onChange,
  excludeId = null,
  placeholder = "select a construct...",
  className = "px-3 py-1.5 border border-gray-300 rounded bg-white text-base flex-1 min-w-[200px]",
  required = false
}) {
  // Build and flatten the hierarchy
  const flatConcepts = useMemo(() => {
    if (!concepts) return [];

    // Filter out excluded concept
    const filteredConcepts = excludeId
      ? concepts.filter(c => c.id !== excludeId)
      : concepts;

    const hierarchy = buildConceptHierarchy(filteredConcepts);
    return flattenHierarchy(hierarchy);
  }, [concepts, excludeId]);

  return (
    <select
      value={value}
      onChange={onChange}
      className={className}
      required={required}
    >
      <option value="">{placeholder}</option>
      {flatConcepts.map(({ concept, depth }) => (
        <option key={concept.id} value={concept.id}>
          {getIndentPrefix(depth)}{concept.label} ({concept.node_type})
        </option>
      ))}
    </select>
  );
}
