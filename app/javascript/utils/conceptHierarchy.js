// Utility functions for organizing concepts into hierarchical structures

/**
 * Builds a hierarchical structure from flat concept list
 * Returns an array of objects with concept and children
 */
export function buildConceptHierarchy(concepts) {
  if (!concepts || concepts.length === 0) return [];

  // Create a map for quick lookup
  const conceptMap = new Map(concepts.map(c => [c.id, { ...c, children: [] }]));

  // Build parent-child relationships
  const roots = [];

  concepts.forEach(concept => {
    let isChild = false;

    // Check if this concept has any parent_of relationships pointing TO it (incoming)
    // This means this concept is a child
    if (concept.incoming_connections) {
      const parentConnections = concept.incoming_connections.filter(
        conn => conn.rel_type === 'parent_of'
      );

      parentConnections.forEach(conn => {
        const parentId = conn.src_concept.id;
        const parent = conceptMap.get(parentId);

        if (parent && parent.id !== concept.id) {
          // Add this concept as a child of the parent
          const childConcept = conceptMap.get(concept.id);
          if (childConcept && !parent.children.find(c => c.id === childConcept.id)) {
            parent.children.push(childConcept);
            isChild = true;
          }
        }
      });
    }

    // If this concept is not a child of anything, it's a root
    if (!isChild) {
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
 */
export function flattenHierarchy(hierarchyNodes, depth = 0) {
  const result = [];

  hierarchyNodes.forEach(node => {
    result.push({ concept: node, depth });

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
