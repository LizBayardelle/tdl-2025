// Utility functions for organizing concepts into hierarchical structures

// Relationships where the SOURCE is the parent (outgoing = I am parent of child)
const PARENT_OUTGOING_TYPES = ['parent_of', 'contains'];

// Relationships where the SOURCE is the child (outgoing = I am child of parent)
const CHILD_OUTGOING_TYPES = ['child_of', 'is_inside', 'is_a'];

// Human-readable labels for relationship types in hierarchy
const REL_TYPE_LABELS = {
  'parent_of': 'child',
  'child_of': 'child',
  'contains': 'inside',
  'is_inside': 'inside',
  'is_a': 'type of',
};

/**
 * Builds a hierarchical structure from flat concept list
 * Returns an array of objects with concept and children
 */
export function buildConceptHierarchy(concepts) {
  if (!concepts || concepts.length === 0) return [];

  // Create a map for quick lookup
  const conceptMap = new Map(concepts.map(c => [c.id, { ...c, children: [], parentRelType: null }]));

  // Track which concepts are children
  const childIds = new Set();

  concepts.forEach(concept => {
    // Check INCOMING connections where source is parent-type
    // e.g., incoming parent_of means: src is parent of me, so I am child
    // e.g., incoming contains means: src contains me, so I am child (inside)
    if (concept.incoming_connections) {
      concept.incoming_connections.forEach(conn => {
        if (PARENT_OUTGOING_TYPES.includes(conn.rel_type)) {
          const parentId = conn.src_concept?.id;
          const parent = conceptMap.get(parentId);

          if (parent && parent.id !== concept.id) {
            const childConcept = conceptMap.get(concept.id);
            if (childConcept && !parent.children.find(c => c.id === childConcept.id)) {
              childConcept.parentRelType = conn.rel_type;
              parent.children.push(childConcept);
              childIds.add(concept.id);
            }
          }
        }
      });
    }

    // Check OUTGOING connections where source is child-type
    // e.g., outgoing child_of means: I am child of dst
    // e.g., outgoing is_inside means: I am inside dst
    // e.g., outgoing is_a means: I am a type of dst
    if (concept.outgoing_connections) {
      concept.outgoing_connections.forEach(conn => {
        if (CHILD_OUTGOING_TYPES.includes(conn.rel_type)) {
          const parentId = conn.dst_concept?.id;
          const parent = conceptMap.get(parentId);

          if (parent && parent.id !== concept.id) {
            const childConcept = conceptMap.get(concept.id);
            if (childConcept && !parent.children.find(c => c.id === childConcept.id)) {
              childConcept.parentRelType = conn.rel_type;
              parent.children.push(childConcept);
              childIds.add(concept.id);
            }
          }
        }
      });
    }
  });

  // Collect roots (concepts that are not children of anything)
  const roots = [];
  concepts.forEach(concept => {
    if (!childIds.has(concept.id)) {
      roots.push(conceptMap.get(concept.id));
    }
  });

  // Sort roots alphabetically by label
  roots.sort((a, b) => a.label.localeCompare(b.label));

  // Sort children alphabetically for each parent
  roots.forEach(root => {
    sortChildrenRecursively(root);
  });

  return roots;
}

/**
 * Get human-readable label for a parent-child relationship type
 */
export function getRelTypeLabel(relType) {
  return REL_TYPE_LABELS[relType] || relType?.replace(/_/g, ' ');
}

/**
 * Recursively sorts children alphabetically
 */
function sortChildrenRecursively(node) {
  if (node.children && node.children.length > 0) {
    node.children.sort((a, b) => a.label.localeCompare(b.label));
    node.children.forEach(child => sortChildrenRecursively(child));
  }
}

/**
 * Flattens hierarchical structure into array with depth indicators
 * Useful for rendering in a dropdown with indentation
 * Each item has: concept, depth, and parentRelType (if it's a child)
 */
export function flattenHierarchy(hierarchyNodes, depth = 0) {
  const result = [];

  hierarchyNodes.forEach(node => {
    result.push({
      concept: node,
      depth,
      parentRelType: node.parentRelType || null
    });

    if (node.children && node.children.length > 0) {
      result.push(...flattenHierarchy(node.children, depth + 1));
    }
  });

  return result;
}

/**
 * Gets indentation prefix for a given depth
 */
export function getIndentPrefix(depth) {
  return '\u00A0\u00A0'.repeat(depth * 2); // Non-breaking spaces for indentation
}
