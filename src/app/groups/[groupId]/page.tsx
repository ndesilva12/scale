'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import {
  ArrowLeft,
  UserPlus,
  Settings,
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
import MemberGraph from '@/components/graph/MemberGraph';
import MetricSelector from '@/components/graph/MetricSelector';
import DataTable from '@/components/graph/DataTable';
import AddMemberForm from '@/components/groups/AddMemberForm';
import RatingForm from '@/components/groups/RatingForm';
import { Group, GroupMember, Rating, AggregatedScore, ClaimRequest } from '@/types';
import {
  getGroup,
  subscribeToGroup,
  subscribeToMembers,
  subscribeToRatings,
  addMember,
  createInvitation,
  submitRating,
  calculateAggregatedScores,
  getGroupClaimRequests,
  respondToClaimRequest,
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

  const handleApproveClaimRequest = async (request: ClaimRequest) => {
    // In a real app, you'd get the claimant's info from Clerk
    await respondToClaimRequest(request.id, true, 'Claimed User', null);
    setClaimRequests((prev) => prev.filter((r) => r.id !== request.id));
  };

  const handleRejectClaimRequest = async (request: ClaimRequest) => {
    await respondToClaimRequest(request.id, false, '', null);
    setClaimRequests((prev) => prev.filter((r) => r.id !== request.id));
  };

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

        {/* View mode tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
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
          {canRate && (
            <Button
              variant={viewMode === 'rate' ? 'primary' : 'ghost'}
              onClick={() => setViewMode('rate')}
              size="sm"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Rate Members
            </Button>
          )}
        </div>

        {/* Content */}
        {viewMode === 'graph' && (
          <div className="space-y-6">
            {/* Metric selectors */}
            {group.metrics.length > 0 && (
              <Card className="p-4">
                <MetricSelector
                  metrics={group.metrics}
                  xMetricId={xMetricId}
                  yMetricId={yMetricId}
                  onXMetricChange={setXMetricId}
                  onYMetricChange={setYMetricId}
                />
              </Card>
            )}

            {/* Graph */}
            <Card className="p-6 md:p-8">
              <div className="ml-8 md:ml-12 mb-8 md:mb-12">
                <div className="aspect-square max-h-[600px]">
                  <MemberGraph
                    members={members}
                    metrics={group.metrics}
                    scores={scores}
                    xMetricId={xMetricId}
                    yMetricId={yMetricId}
                    onMemberClick={handleMemberClick}
                  />
                </div>
              </div>
            </Card>
          </div>
        )}

        {viewMode === 'table' && (
          <Card className="p-6">
            <DataTable
              members={members}
              metrics={group.metrics}
              scores={scores}
              groupId={groupId}
              onMemberClick={handleMemberClick}
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
