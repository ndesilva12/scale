'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Table,
  Info,
  Users,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import MemberGraph from '@/components/graph/MemberGraph';
import MetricSelector from '@/components/graph/MetricSelector';
import DataTable from '@/components/graph/DataTable';
import Avatar from '@/components/ui/Avatar';
import {
  mockGroup,
  mockMembers,
  mockMetrics,
  mockScores,
} from '@/lib/mockData';
import { GroupMember } from '@/types';

type ViewMode = 'graph' | 'table';

export default function DemoPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [xMetricId, setXMetricId] = useState(mockMetrics[0].id);
  const [yMetricId, setYMetricId] = useState(mockMetrics[1].id);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);

  const handleMemberClick = (member: GroupMember) => {
    setSelectedMember(member);
  };

  const closeMemberModal = () => {
    setSelectedMember(null);
  };

  const getScoreForMetric = (memberId: string, metricId: string): number => {
    const score = mockScores.find((s) => s.memberId === memberId && s.metricId === metricId);
    return score?.averageValue ?? 0;
  };

  const getRatingCountForMetric = (memberId: string, metricId: string): number => {
    const score = mockScores.find((s) => s.memberId === memberId && s.metricId === metricId);
    return score?.totalRatings ?? 0;
  };

  const getScoreColor = (value: number) => {
    if (value >= 75) return 'text-green-600 dark:text-green-400';
    if (value >= 50) return 'text-blue-600 dark:text-blue-400';
    if (value >= 25) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (value: number) => {
    if (value >= 75) return 'bg-green-500';
    if (value >= 50) return 'bg-blue-500';
    if (value >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link and header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  {mockGroup.name}
                </h1>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                  Demo
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-400">{mockGroup.description}</p>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <Card className="mb-6 p-4 border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">This is a demo with mock data</p>
              <p className="text-blue-700 dark:text-blue-300">
                Explore the visualization features by switching metrics and viewing the data table.
                Click on member avatars to see their detailed profile.
                <Link href="/sign-up" className="ml-1 underline font-medium">
                  Sign up
                </Link>{' '}
                to create your own groups with real data.
              </p>
            </div>
          </div>
        </Card>

        {/* View mode tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={viewMode === 'graph' ? 'primary' : 'ghost'}
            onClick={() => setViewMode('graph')}
            size="sm"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Graph
          </Button>
          <Button
            variant={viewMode === 'table' ? 'primary' : 'ghost'}
            onClick={() => setViewMode('table')}
            size="sm"
          >
            <Table className="w-4 h-4 mr-2" />
            Data Table
          </Button>
        </div>

        {/* Content */}
        {viewMode === 'graph' && (
          <div className="space-y-6">
            {/* Metric selectors */}
            <Card className="p-4">
              <MetricSelector
                metrics={mockMetrics}
                xMetricId={xMetricId}
                yMetricId={yMetricId}
                onXMetricChange={setXMetricId}
                onYMetricChange={setYMetricId}
              />
            </Card>

            {/* Graph */}
            <Card className="p-6 md:p-8">
              <div className="ml-8 md:ml-12 mb-8 md:mb-12">
                <div className="aspect-square max-h-[600px]">
                  <MemberGraph
                    members={mockMembers}
                    metrics={mockMetrics}
                    scores={mockScores}
                    xMetricId={xMetricId}
                    yMetricId={yMetricId}
                    onMemberClick={handleMemberClick}
                  />
                </div>
              </div>
            </Card>

            {/* Member legend */}
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Team Members
              </h3>
              <div className="flex flex-wrap gap-3">
                {mockMembers
                  .filter((m) => m.status === 'accepted' || m.status === 'placeholder')
                  .map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleMemberClick(member)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Avatar
                        src={member.imageUrl || member.placeholderImageUrl}
                        alt={member.name}
                        size="xs"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{member.name}</span>
                    </button>
                  ))}
              </div>
            </Card>
          </div>
        )}

        {viewMode === 'table' && (
          <Card className="p-6">
            <DataTable
              members={mockMembers}
              metrics={mockMetrics}
              scores={mockScores}
              groupId={mockGroup.id}
              onMemberClick={handleMemberClick}
            />
          </Card>
        )}
      </main>

      {/* Member detail modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeMemberModal}
          />
          <Card className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <Avatar
                  src={selectedMember.imageUrl || selectedMember.placeholderImageUrl}
                  alt={selectedMember.name}
                  size="xl"
                />
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedMember.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedMember.email}
                  </p>
                  <span
                    className={`
                      inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium
                      ${
                        selectedMember.status === 'accepted'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }
                    `}
                  >
                    {selectedMember.status === 'accepted' ? 'Active' : 'Pending'}
                  </span>
                </div>
              </div>

              {/* Scores */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Metric Scores
                </h3>
                {mockMetrics.map((metric) => {
                  const score = getScoreForMetric(selectedMember.id, metric.id);
                  const count = getRatingCountForMetric(selectedMember.id, metric.id);

                  return (
                    <div key={metric.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{metric.name}</span>
                        <span className={`font-semibold ${getScoreColor(score)}`}>
                          {score.toFixed(1)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getScoreBgColor(score)}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {count} rating{count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Close button */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button onClick={closeMemberModal} className="w-full">
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
