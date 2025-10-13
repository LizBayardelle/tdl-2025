import React, { useState, useEffect } from 'react';
import ConceptRelationshipMap from './ConceptRelationshipMap';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl mb-8">Dashboard</h1>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-300 rounded-lg p-6 mb-8">
        <h2 className="text-2xl mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ActionCard
            title="Add Concept"
            description="Create a new knowledge concept"
            link="/concepts"
          />
          <ActionCard
            title="Add Note"
            description="Capture a new insight or reflection"
            link="/notes"
          />
          <ActionCard
            title="Add Source"
            description="Add a new reference or resource"
            link="/sources"
          />
          <ActionCard
            title="View Graph"
            description="Explore your knowledge network"
            link="/connections"
          />
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Concepts" value={stats.totalConcepts} link="/concepts" />
        <StatCard label="Sources" value={stats.totalSources} link="/sources" />
        <StatCard label="People" value={stats.totalPeople} link="/people" />
        <StatCard label="Connections" value={stats.totalConnections} link="/connections" />
        <StatCard label="Notes" value={stats.totalNotes} link="/notes" />
        <StatCard label="Tags" value={stats.totalTags} link="/tags" />
      </div>

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

          {stats.needsReview > 0 && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm">
                <span className="font-medium">{stats.needsReview}</span> concept
                {stats.needsReview === 1 ? '' : 's'} need review (not reviewed in 30+ days)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Concept Relationship Map */}
      <ConceptRelationshipMap />
    </div>
  );
}

function StatCard({ label, value, link }) {
  return (
    <a
      href={link}
      className="bg-white border border-gray-300 rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="text-3xl font-light mb-1">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </a>
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

function ActionCard({ title, description, link }) {
  return (
    <a
      href={link}
      className="border border-gray-300 rounded-lg p-4 hover:bg-sand transition-colors"
    >
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </a>
  );
}
