// Entry point for the build script in your package.json
import React from 'react';
import { createRoot } from 'react-dom/client';

// Import components
import NodesIndex from './components/NodesIndex';
import NodeShow from './components/NodeShow';
import SourcesIndex from './components/SourcesIndex';
import PeopleIndex from './components/PeopleIndex';
import EdgeVisualization from './components/EdgeVisualization';
import NotesIndex from './components/NotesIndex';
import TagsIndex from './components/TagsIndex';
import Dashboard from './components/Dashboard';
import GlobalSearch from './components/GlobalSearch';
import PathwaysIndex from './components/PathwaysIndex';
import UserDropdown from './components/UserDropdown';

// Initialize React components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const nodesIndexRoot = document.getElementById('nodes-index-root');
  if (nodesIndexRoot) {
    createRoot(nodesIndexRoot).render(<NodesIndex />);
  }

  const nodeShowRoot = document.getElementById('node-show-root');
  if (nodeShowRoot) {
    const nodeId = nodeShowRoot.dataset.nodeId;
    createRoot(nodeShowRoot).render(<NodeShow nodeId={nodeId} />);
  }

  const sourcesIndexRoot = document.getElementById('sources-index-root');
  if (sourcesIndexRoot) {
    createRoot(sourcesIndexRoot).render(<SourcesIndex />);
  }

  const peopleIndexRoot = document.getElementById('people-index-root');
  if (peopleIndexRoot) {
    createRoot(peopleIndexRoot).render(<PeopleIndex />);
  }

  const edgeVisualizationRoot = document.getElementById('edge-visualization-root');
  if (edgeVisualizationRoot) {
    createRoot(edgeVisualizationRoot).render(<EdgeVisualization />);
  }

  const notesIndexRoot = document.getElementById('notes-index-root');
  if (notesIndexRoot) {
    createRoot(notesIndexRoot).render(<NotesIndex />);
  }

  const tagsIndexRoot = document.getElementById('tags-index-root');
  if (tagsIndexRoot) {
    createRoot(tagsIndexRoot).render(<TagsIndex />);
  }

  const dashboardRoot = document.getElementById('dashboard-root');
  if (dashboardRoot) {
    createRoot(dashboardRoot).render(<Dashboard />);
  }

  const globalSearchRoot = document.getElementById('global-search-root');
  if (globalSearchRoot) {
    createRoot(globalSearchRoot).render(<GlobalSearch />);
  }

  const pathwaysIndexRoot = document.getElementById('pathways-index-root');
  if (pathwaysIndexRoot) {
    createRoot(pathwaysIndexRoot).render(<PathwaysIndex />);
  }

  const userDropdownRoot = document.getElementById('user-dropdown-root');
  if (userDropdownRoot) {
    const userEmail = userDropdownRoot.dataset.userEmail;
    createRoot(userDropdownRoot).render(<UserDropdown userEmail={userEmail} />);
  }
});
