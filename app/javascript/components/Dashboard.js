import React, { useState, useEffect } from 'react';
import ConceptRelationshipMap from './ConceptRelationshipMap';
import ConceptFormModal from './ConceptFormModal';
import SourceFormModal from './SourceFormModal';
import PersonFormModal from './PersonFormModal';
import NoteFormModal from './NoteFormModal';
import TagFormModal from './TagFormModal';
import ConnectionFormModal from './ConnectionFormModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [conceptsRes, sourcesRes, peopleRes, connectionsRes, notesRes, tagsRes] = await Promise.all([
        fetch('/concepts.json'),
        fetch('/sources.json'),
        fetch('/people.json'),
        fetch('/connections.json'),
        fetch('/notes.json'),
        fetch('/tags.json')
      ]);

      const [concepts, sources, people, connections, notes, tags] = await Promise.all([
        conceptsRes.json(),
        sourcesRes.json(),
        peopleRes.json(),
        connectionsRes.json(),
        notesRes.json(),
        tagsRes.json()
      ]);

      // Calculate stats
      const conceptsByType = concepts.reduce((acc, concept) => {
        acc[concept.node_type] = (acc[concept.node_type] || 0) + 1;
        return acc;
      }, {});

      const conceptsByStatus = concepts.reduce((acc, concept) => {
        const status = concept.level_status || 'mapped';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const needsReview = concepts.filter(c => {
        if (!c.last_reviewed_on) return true;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return new Date(c.last_reviewed_on) < thirtyDaysAgo;
      }).length;

      setStats({
        totalConcepts: concepts.length,
        totalSources: sources.length,
        totalPeople: people.length,
        totalConnections: connections.length,
        totalNotes: notes.length,
        totalTags: tags.length,
        conceptsByType,
        conceptsByStatus,
        needsReview,
        pinnedNotes: notes.filter(n => n.pinned).length
      });

      // Combine recent activity
      const activity = [
        ...concepts.slice(0, 5).map(c => ({ type: 'concept', item: c, date: c.updated_at })),
        ...notes.slice(0, 5).map(n => ({ type: 'note', item: n, date: n.created_at })),
        ...connections.slice(0, 5).map(c => ({ type: 'connection', item: c, date: c.created_at }))
      ]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);

      setRecentActivity(activity);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <h1 className="text-3xl sm:text-4xl mb-6 sm:mb-8">Dashboard</h1>

      {/* Overview Stats with Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatActionCard
          label="Concepts"
          subtitle="Knowledge constructs"
          value={stats.totalConcepts}
          link="/concepts"
          onAdd={() => setShowConceptModal(true)}
        />
        <StatActionCard
          label="Sources"
          subtitle="References & resources"
          value={stats.totalSources}
          link="/sources"
          onAdd={() => setShowSourceModal(true)}
        />
        <StatActionCard
          label="People"
          subtitle="Authors & researchers"
          value={stats.totalPeople}
          link="/people"
          onAdd={() => setShowPersonModal(true)}
        />
        <StatActionCard
          label="Connections"
          subtitle="Concept relationships"
          value={stats.totalConnections}
          link="/connections"
          onAdd={() => setShowConnectionModal(true)}
        />
        <StatActionCard
          label="Notes"
          subtitle="Insights & reflections"
          value={stats.totalNotes}
          link="/notes"
          onAdd={() => setShowNoteModal(true)}
        />
        <StatActionCard
          label="Tags"
          subtitle="Organizing labels"
          value={stats.totalTags}
          link="/tags"
          onAdd={() => setShowTagModal(true)}
        />
      </div>

      {/* Modals */}
      <ConceptFormModal
        isOpen={showConceptModal}
        onClose={() => setShowConceptModal(false)}
        onSuccess={() => {
          fetchDashboardData();
          setShowConceptModal(false);
        }}
      />
      <SourceFormModal
        isOpen={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        onSuccess={() => {
          fetchDashboardData();
          setShowSourceModal(false);
        }}
      />
      <PersonFormModal
        isOpen={showPersonModal}
        onClose={() => setShowPersonModal(false)}
        onSuccess={() => {
          fetchDashboardData();
          setShowPersonModal(false);
        }}
      />
      <NoteFormModal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        onSuccess={() => {
          fetchDashboardData();
          setShowNoteModal(false);
        }}
      />
      <TagFormModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        onSuccess={() => {
          fetchDashboardData();
          setShowTagModal(false);
        }}
      />
      <ConnectionFormModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onSuccess={() => {
          fetchDashboardData();
          setShowConnectionModal(false);
        }}
      />

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Concepts by Type */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h2 className="text-2xl mb-4">Concepts by Type</h2>
          <div className="space-y-3">
            {Object.entries(stats.conceptsByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="capitalize">{type.replace('_', ' ')}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-sand rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${(count / stats.totalConcepts) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Learning Progress */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h2 className="text-2xl mb-4">Mastery Progress</h2>
          <div className="space-y-3">
            {Object.entries(stats.conceptsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="capitalize">{status}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-sand rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        status === 'deep' ? 'bg-green-600' :
                        status === 'basic' ? 'bg-yellow-600' :
                        'bg-gray-400'
                      }`}
                      style={{ width: `${(count / stats.totalConcepts) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Concept Relationship Map */}
      <ConceptRelationshipMap />
    </div>
  );
}

function StatActionCard({ label, subtitle, value, link, onAdd }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 hover:shadow-md transition-shadow relative">
      <a href={link} className="block">
        <div className="text-3xl sm:text-4xl font-light mb-1">{value}</div>
        <div className="text-base sm:text-lg mb-0.5" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
          {label}
        </div>
        <div className="text-xs text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
          {subtitle}
        </div>
      </a>
      {onAdd && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onAdd();
          }}
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-primary text-sand rounded-full hover:bg-accent-dark transition-colors"
          title={`Add ${label.slice(0, -1)}`}
        >
          <FontAwesomeIcon icon={faPlus} className="text-xs" />
        </button>
      )}
    </div>
  );
}

function ActivityItem({ activity }) {
  const { type, item, date } = activity;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (type === 'concept') {
    return (
      <a href={`/concepts/${item.id}`} className="flex items-start justify-between p-3 rounded hover:bg-sand">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
              {item.node_type}
            </span>
            <span className="font-medium">{item.label}</span>
          </div>
          {item.summary_top && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-1">{item.summary_top}</p>
          )}
        </div>
        <span className="text-xs text-gray-500 ml-4">{formatDate(date)}</span>
      </a>
    );
  }

  if (type === 'note') {
    return (
      <div className="flex items-start justify-between p-3 rounded hover:bg-sand">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
              {item.note_type}
            </span>
            {item.concept && (
              <a href={`/concepts/${item.concept.id}`} className="text-sm text-gray-600 hover:underline">
                → {item.concept.label}
              </a>
            )}
          </div>
          <p className="text-sm mt-1 line-clamp-2">{item.body}</p>
        </div>
        <span className="text-xs text-gray-500 ml-4">{formatDate(date)}</span>
      </div>
    );
  }

  if (type === 'connection') {
    return (
      <div className="flex items-start justify-between p-3 rounded hover:bg-sand">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
              {item.rel_type?.replace('_', ' ')}
            </span>
            <span className="text-sm">
              <a href={`/concepts/${item.src_concept?.id}`} className="hover:underline">{item.src_concept?.label}</a>
              {' → '}
              <a href={`/concepts/${item.dst_concept?.id}`} className="hover:underline">{item.dst_concept?.label}</a>
            </span>
          </div>
        </div>
        <span className="text-xs text-gray-500 ml-4">{formatDate(date)}</span>
      </div>
    );
  }

  return null;
}
