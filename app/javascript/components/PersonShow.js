import React, { useState } from 'react';
import PersonFormModal from './PersonFormModal';

export default function PersonShow() {
  const [showEditModal, setShowEditModal] = useState(false);
  const rootElement = document.getElementById('person-show-root');
  const personData = rootElement ? JSON.parse(rootElement.dataset.person) : null;

  if (!personData) return null;

  const handleEditClick = () => {
    setShowEditModal(true);
  };

  const handleSuccess = () => {
    window.location.reload();
  };

  // Attach handler to edit button
  React.useEffect(() => {
    const editButton = document.querySelector('[data-action="click->person-show#openEditModal"]');
    if (editButton) {
      const handler = (e) => {
        e.preventDefault();
        handleEditClick();
      };
      editButton.addEventListener('click', handler);
      return () => editButton.removeEventListener('click', handler);
    }
  }, []);

  return (
    <PersonFormModal
      isOpen={showEditModal}
      onClose={() => setShowEditModal(false)}
      onSuccess={handleSuccess}
      item={{
        id: personData.id,
        full_name: personData.full_name,
        role: personData.role,
        summary: personData.summary,
        aka: personData.aka || [],
        concept_ids: personData.concepts ? personData.concepts.map(c => c.id) : [],
        source_ids: personData.sources ? personData.sources.map(s => s.id) : [],
        tags: personData.tags || []
      }}
    />
  );
}
