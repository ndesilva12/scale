'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import {
  ArrowLeft,
  UserPlus,
  BarChart3,
  Table,
  SlidersHorizontal,
  Users,
  AlertCircle,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import MemberGraph from '@/components/graph/MemberGraph';
import DataTable from '@/components/graph/DataTable';
import AddMemberForm from '@/components/groups/AddMemberForm';
import RatingForm from '@/components/groups/RatingForm';
import { Group, GroupMember, Rating, AggregatedScore, ClaimRequest } from '@/types';
import {
  subscribeToGroup,
  subscribeToMembers,
  subscribeToRatings,
  addMember,
  createInvitation,
  submitRating,
  calculateAggregatedScores,
  getGroupClaimRequests,
  respondToClaimRequest,
  updateMemberVisibility,
  uploadMemberImage,
  updateMember,
} from '@/lib/firestore';

type ViewMode = 'graph' | 'table' | 'rate';

export default function GroupPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [claimRequests, setClaimRequests] = useState<ClaimRequest[]>([]);
  const [scores, setScores] = useState<AggregatedScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showClaimRequestsModal, setShowClaimRequestsModal] = useState(false);

  // Graph state
  const [xMetricId, setXMetricId] = useState<string>('');
  const [yMetricId, setYMetricId] = useState<string>('');

  const isCreator = group?.creatorId === user?.id;
  const currentMember = members.find((m) => m.clerkId === user?.id);
  const canRate = currentMember?.status === 'accepted';

  // Subscribe to real-time updates
  useEffect(() => {
    if (!groupId) return;

    const unsubscribeGroup = subscribeToGroup(groupId, (updatedGroup) => {
      setGroup(updatedGroup);
      if (updatedGroup && updatedGroup.metrics.length > 0) {
        if (!xMetricId) setXMetricId(updatedGroup.metrics[0].id);
        if (!yMetricId && updatedGroup.metrics.length > 1) {
          setYMetricId(updatedGroup.metrics[1].id);
        } else if (!yMetricId) {
          setYMetricId(updatedGroup.metrics[0].id);
        }
      }
      setLoading(false);
    });

    const unsubscribeMembers = subscribeToMembers(groupId, setMembers);
    const unsubscribeRatings = subscribeToRatings(groupId, setRatings);

    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
      unsubscribeRatings();
    };
  }, [groupId]);

  // Calculate scores when ratings or members change
  useEffect(() => {
    if (group && members.length > 0) {
      const calculatedScores = calculateAggregatedScores(members, group.metrics, ratings);
      setScores(calculatedScores);
    }
  }, [group, members, ratings]);

  // Load claim requests for creator
  useEffect(() => {
    if (isCreator && groupId) {
      getGroupClaimRequests(groupId).then(setClaimRequests);
    }
  }, [isCreator, groupId]);

  const handleAddMember = async (data: { email: string; name: string; placeholderImageUrl: string }) => {
    if (!user || !group) return;

    const member = await addMember(
      groupId,
      data.email,
      data.name,
      data.placeholderImageUrl || null
    );

    await createInvitation(
      groupId,
      group.name,
      data.email,
      member.id,
      user.id,
      user.fullName || user.emailAddresses[0]?.emailAddress || 'Unknown'
    );

    setShowAddMemberModal(false);
  };

  const handleSubmitRating = async (metricId: string, targetMemberId: string, value: number) => {
    if (!user) return;
    await submitRating(groupId, metricId, user.id, targetMemberId, value);
  };

  const handleMemberClick = (member: GroupMember) => {
    router.push(`/groups/${groupId}/members/${member.id}`);
  };

  const handleToggleVisibility = async (memberId: string, visible: boolean) => {
    await updateMemberVisibility(memberId, visible);
  };

  const handleEditMember = async (memberId: string, data: { name: string; email: string }) => {
    await updateMember(memberId, { name: data.name, email: data.email });
  };

  const handleApproveClaimRequest = async (request: ClaimRequest) => {
    await respondToClaimRequest(request.id, true, 'Claimed User', null);
    setClaimRequests((prev) => prev.filter((r) => r.id !== request.id));
  };

  const handleRejectClaimRequest = async (request: ClaimRequest) => {
    await respondToClaimRequest(request.id, false, '', null);
    setClaimRequests((prev) => prev.filter((r) => r.id !== request.id));
  };

  // Get visible members for the graph
  const visibleMembers = members.filter((m) => m.visibleInGraph);

  // Metric options for selectors
  const metricOptions = group?.metrics.map((m) => ({ value: m.id, label: m.name })) || [];

  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Group Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This group may have been deleted or you don&apos;t have access to it.
            </p>
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link and header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {group.name}
              </h1>
              {group.description && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">{group.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {claimRequests.length > 0 && isCreator && (
                <Button
                  variant="outline"
                  onClick={() => setShowClaimRequestsModal(true)}
                  className="relative"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Claims
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {claimRequests.length}
                  </span>
                </Button>
              )}
              {isCreator && (
                <Button onClick={() => setShowAddMemberModal(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Member
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Unified control bar */}
        <Card className="p-3 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* View mode buttons */}
            <div className="flex gap-1 border-r border-gray-200 dark:border-gray-700 pr-3">
              <Button
                variant={viewMode === 'graph' ? 'primary' : 'ghost'}
                onClick={() => setViewMode('graph')}
                size="sm"
              >
                <BarChart3 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Graph</span>
              </Button>
              <Button
                variant={viewMode === 'table' ? 'primary' : 'ghost'}
                onClick={() => setViewMode('table')}
                size="sm"
              >
                <Table className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Data</span>
              </Button>
              {canRate && (
                <Button
                  variant={viewMode === 'rate' ? 'primary' : 'ghost'}
                  onClick={() => setViewMode('rate')}
                  size="sm"
                >
                  <SlidersHorizontal className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Rate</span>
                </Button>
              )}
            </div>

            {/* Metric selectors - only show for graph view */}
            {viewMode === 'graph' && group.metrics.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    Y:
                  </label>
                  <select
                    value={yMetricId}
                    onChange={(e) => setYMetricId(e.target.value)}
                    className="text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    {metricOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    X:
                  </label>
                  <select
                    value={xMetricId}
                    onChange={(e) => setXMetricId(e.target.value)}
                    className="text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    {metricOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Content */}
        {viewMode === 'graph' && (
          <Card className="p-4 sm:p-6">
            {/* Graph Title */}
            <h2 className="text-center text-2xl md:text-3xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 dark:from-blue-400 dark:via-blue-300 dark:to-cyan-400 bg-clip-text text-transparent">
                {group.metrics.find((m) => m.id === yMetricId)?.name || 'Y Metric'}
              </span>
              <span className="mx-3 text-gray-300 dark:text-gray-600 font-normal">×</span>
              <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 dark:from-emerald-400 dark:via-emerald-300 dark:to-teal-400 bg-clip-text text-transparent">
                {group.metrics.find((m) => m.id === xMetricId)?.name || 'X Metric'}
              </span>
            </h2>
            <div className="w-full" style={{ paddingLeft: '3rem', paddingBottom: '2rem' }}>
              <div className="w-full aspect-[4/3] lg:aspect-[16/10] max-h-[70vh]">
                <MemberGraph
                  members={visibleMembers}
                  metrics={group.metrics}
                  scores={scores}
                  xMetricId={xMetricId}
                  yMetricId={yMetricId}
                  onMemberClick={handleMemberClick}
                  currentUserId={user?.id || null}
                  existingRatings={ratings}
                  onSubmitRating={handleSubmitRating}
                  canRate={canRate}
                  isCreator={isCreator}
                />
              </div>
            </div>
          </Card>
        )}

        {viewMode === 'table' && (
          <Card className="p-6">
            <DataTable
              members={members}
              metrics={group.metrics}
              scores={scores}
              groupId={groupId}
              onMemberClick={handleMemberClick}
              onToggleVisibility={handleToggleVisibility}
              showVisibilityToggle={true}
              currentUserId={user?.id || null}
              existingRatings={ratings}
              onSubmitRating={handleSubmitRating}
              canRate={canRate}
              isCreator={isCreator}
              onEditMember={handleEditMember}
            />
          </Card>
        )}

        {viewMode === 'rate' && canRate && (
          <Card className="p-6">
            <RatingForm
              members={members}
              metrics={group.metrics}
              currentUserId={user?.id || ''}
              existingRatings={ratings}
              onSubmitRating={handleSubmitRating}
            />
          </Card>
        )}

        {/* Empty state for no members */}
        {members.length === 0 && (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No members yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {isCreator
                ? 'Add members to start rating and visualizing your group.'
                : 'The group creator hasn\'t added any members yet.'}
            </p>
            {isCreator && (
              <Button onClick={() => setShowAddMemberModal(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add First Member
              </Button>
            )}
          </Card>
        )}
      </main>

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        title="Add New Member"
      >
        <AddMemberForm
          onSubmit={handleAddMember}
          onCancel={() => setShowAddMemberModal(false)}
          onUploadImage={(file) => uploadMemberImage(groupId, file)}
          existingEmails={members.map((m) => m.email.toLowerCase())}
        />
      </Modal>

      {/* Claim Requests Modal */}
      <Modal
        isOpen={showClaimRequestsModal}
        onClose={() => setShowClaimRequestsModal(false)}
        title="Claim Requests"
      >
        <div className="space-y-4">
          {claimRequests.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No pending claim requests
            </p>
          ) : (
            claimRequests.map((request) => {
              const placeholder = members.find((m) => m.id === request.placeholderMemberId);
              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Claiming: {placeholder?.name || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Requested on {request.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectClaimRequest(request)}
                    >
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => handleApproveClaimRequest(request)}>
                      Approve
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
}
