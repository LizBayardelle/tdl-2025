// Entry point for the build script in your package.json
import React from 'react';
import { createRoot } from 'react-dom/client';

// Import components
import ConceptsIndex from './components/ConceptsIndex';
import ConceptShow from './components/ConceptShow';
import SourcesIndex from './components/SourcesIndex';
import SourceShow from './components/SourceShow';
import PeopleIndex from './components/PeopleIndex';
import PersonShow from './components/PersonShow';
import ConnectionVisualization from './components/ConnectionVisualization';
import NotesIndex from './components/NotesIndex';
import NotesForm from './components/NotesForm';
import TagsIndex from './components/TagsIndex';
import CollectionsIndex from './components/CollectionsIndex';
import Dashboard from './components/Dashboard';
import GlobalSearch from './components/GlobalSearch';
import UserDropdown from './components/UserDropdown';
import PdfStudyMode from './components/PdfStudyMode';
import SharingHub from './components/SharingHub';
import CollectionManager from './components/CollectionManager';
import ShareModal from './components/ShareModal';
import BulkUploadPage from './components/BulkUploadPage';
import BulkUploadWizard from './components/bulk-upload-v2/BulkUploadWizard';
import PacksIndex from './components/PacksIndex';
import PackShow from './components/PackShow';
import PacksOwned from './components/PacksOwned';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminPacks from './components/admin/AdminPacks';
import AdminPackShow from './components/admin/AdminPackShow';
import AdminUsers from './components/admin/AdminUsers';

// Initialize React components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const conceptsIndexRoot = document.getElementById('concepts-index-root');
  if (conceptsIndexRoot) {
    createRoot(conceptsIndexRoot).render(<ConceptsIndex />);
  }

  const conceptShowRoot = document.getElementById('concept-show-root');
  if (conceptShowRoot) {
    const conceptId = conceptShowRoot.dataset.conceptId;
    createRoot(conceptShowRoot).render(<ConceptShow conceptId={conceptId} />);
  }

  const sourcesIndexRoot = document.getElementById('sources-index-root');
  if (sourcesIndexRoot) {
    createRoot(sourcesIndexRoot).render(<SourcesIndex />);
  }

  const sourceShowRoot = document.getElementById('source-show-root');
  if (sourceShowRoot) {
    const sourceId = sourceShowRoot.dataset.sourceId;
    createRoot(sourceShowRoot).render(<SourceShow sourceId={sourceId} />);
  }

  const peopleIndexRoot = document.getElementById('people-index-root');
  if (peopleIndexRoot) {
    createRoot(peopleIndexRoot).render(<PeopleIndex />);
  }

  const personShowRoot = document.getElementById('person-show-root');
  if (personShowRoot) {
    const personId = personShowRoot.dataset.personId;
    createRoot(personShowRoot).render(<PersonShow personId={personId} />);
  }

  const connectionVisualizationRoot = document.getElementById('connection-visualization-root');
  if (connectionVisualizationRoot) {
    createRoot(connectionVisualizationRoot).render(<ConnectionVisualization />);
  }

  const notesIndexRoot = document.getElementById('notes-index-root');
  if (notesIndexRoot) {
    createRoot(notesIndexRoot).render(<NotesIndex />);
  }

  const noteFormRoot = document.getElementById('note-form-root');
  if (noteFormRoot) {
    createRoot(noteFormRoot).render(<NotesForm />);
  }

  const tagsIndexRoot = document.getElementById('tags-index-root');
  if (tagsIndexRoot) {
    createRoot(tagsIndexRoot).render(<TagsIndex />);
  }

  const collectionsIndexRoot = document.getElementById('collections-index-root');
  if (collectionsIndexRoot) {
    createRoot(collectionsIndexRoot).render(<CollectionsIndex />);
  }

  const dashboardRoot = document.getElementById('dashboard-root');
  if (dashboardRoot) {
    createRoot(dashboardRoot).render(<Dashboard />);
  }

  const globalSearchRoot = document.getElementById('global-search-root');
  if (globalSearchRoot) {
    createRoot(globalSearchRoot).render(<GlobalSearch />);
  }

  const userDropdownRoot = document.getElementById('user-dropdown-root');
  if (userDropdownRoot) {
    const userEmail = userDropdownRoot.dataset.userEmail;
    createRoot(userDropdownRoot).render(<UserDropdown userEmail={userEmail} />);
  }

  const pdfStudyRoot = document.getElementById('pdf-study-root');
  if (pdfStudyRoot) {
    const sourceId = pdfStudyRoot.dataset.sourceId;
    const sourceTitle = pdfStudyRoot.dataset.sourceTitle;
    const pdfUrl = pdfStudyRoot.dataset.pdfUrl;
    createRoot(pdfStudyRoot).render(
      <PdfStudyMode
        sourceId={sourceId}
        sourceTitle={sourceTitle}
        pdfUrl={pdfUrl}
      />
    );
  }

  const sharingHubRoot = document.getElementById('sharing-hub-root');
  if (sharingHubRoot) {
    createRoot(sharingHubRoot).render(<SharingHub />);
  }

  // New bulk upload wizard (v2)
  const bulkUploadWizardRoot = document.getElementById('bulk-upload-wizard-root');
  if (bulkUploadWizardRoot) {
    createRoot(bulkUploadWizardRoot).render(<BulkUploadWizard />);
  }

  // Legacy bulk upload page
  const bulkUploadRoot = document.getElementById('bulk-upload-root');
  if (bulkUploadRoot) {
    createRoot(bulkUploadRoot).render(<BulkUploadPage />);
  }

  // Packs
  const packsIndexRoot = document.getElementById('packs-index-root');
  if (packsIndexRoot) {
    createRoot(packsIndexRoot).render(<PacksIndex />);
  }

  const packShowRoot = document.getElementById('pack-show-root');
  if (packShowRoot) {
    const packId = packShowRoot.dataset.packId;
    createRoot(packShowRoot).render(<PackShow packId={packId} />);
  }

  const packsOwnedRoot = document.getElementById('packs-owned-root');
  if (packsOwnedRoot) {
    createRoot(packsOwnedRoot).render(<PacksOwned />);
  }

  // Admin
  const adminDashboardRoot = document.getElementById('admin-dashboard-root');
  if (adminDashboardRoot) {
    createRoot(adminDashboardRoot).render(<AdminDashboard />);
  }

  const adminPacksRoot = document.getElementById('admin-packs-root');
  if (adminPacksRoot) {
    createRoot(adminPacksRoot).render(<AdminPacks />);
  }

  const adminPackShowRoot = document.getElementById('admin-pack-show-root');
  if (adminPackShowRoot) {
    const packId = adminPackShowRoot.dataset.packId;
    createRoot(adminPackShowRoot).render(<AdminPackShow packId={packId} />);
  }

  const adminUsersRoot = document.getElementById('admin-users-root');
  if (adminUsersRoot) {
    createRoot(adminUsersRoot).render(<AdminUsers />);
  }
});

// Export components for use in other React components
export { CollectionManager, ShareModal };
