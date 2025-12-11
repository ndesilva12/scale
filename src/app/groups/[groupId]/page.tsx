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
  Settings,
  Anchor,
  Settings2,
  Lock,
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
import { Group, GroupMember, Rating, AggregatedScore, ClaimRequest, Metric, MetricPrefix, MetricSuffix } from '@/types';
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
  updateGroup,
  removeMember,
  createClaimToken,
} from '@/lib/firestore';
import Input from '@/components/ui/Input';

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
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [editingMetrics, setEditingMetrics] = useState<Metric[]>([]);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupDescription, setEditingGroupDescription] = useState('');
  const [editingLockedYMetricId, setEditingLockedYMetricId] = useState<string | null>(null);
  const [editingLockedXMetricId, setEditingLockedXMetricId] = useState<string | null>(null);
  const [editingCaptainControlEnabled, setEditingCaptainControlEnabled] = useState(false);
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);

  // Graph state
  const [xMetricId, setXMetricId] = useState<string>('');
  const [yMetricId, setYMetricId] = useState<string>('');

  // Use captainId with backward compatibility for creatorId
  const isCaptain = group?.captainId === user?.id;
  const currentMember = members.find((m) => m.clerkId === user?.id);
  const canRate = currentMember?.status === 'accepted';

  // Subscribe to real-time updates
  useEffect(() => {
    if (!groupId) return;

    const unsubscribeGroup = subscribeToGroup(groupId, (updatedGroup) => {
      setGroup(updatedGroup);
      if (updatedGroup && updatedGroup.metrics.length > 0) {
        // Use locked metrics if set, otherwise use defaults
        if (updatedGroup.lockedXMetricId) {
          setXMetricId(updatedGroup.lockedXMetricId);
        } else if (!xMetricId) {
          setXMetricId(updatedGroup.metrics[0].id);
        }

        if (updatedGroup.lockedYMetricId) {
          setYMetricId(updatedGroup.lockedYMetricId);
        } else if (!yMetricId && updatedGroup.metrics.length > 1) {
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

  // Load claim requests for captain
  useEffect(() => {
    if (isCaptain && groupId) {
      getGroupClaimRequests(groupId).then(setClaimRequests);
    }
  }, [isCaptain, groupId]);

  // Auto-add captain as member if not already in group (for groups created before this feature)
  useEffect(() => {
    const addCaptainAsMember = async () => {
      if (!user || !group || !isCaptain) return;

      // Check if captain is already a member
      const captainIsMember = members.some((m) => m.clerkId === user.id);
      if (captainIsMember) return;

      // Add captain as first member
      console.log('Auto-adding captain as member...');
      await addMember(
        groupId,
        user.emailAddresses[0]?.emailAddress || '',
        user.fullName || user.firstName || 'Captain',
        null, // placeholderImageUrl
        user.id, // clerkId
        'accepted', // status
        user.imageUrl, // imageUrl
        true // isCaptain
      );
    };

    // Only run when we have loaded the group and members
    if (group && members !== undefined && !loading) {
      addCaptainAsMember();
    }
  }, [group, members, isCaptain, user, groupId, loading]);

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

  const handleEditMember = async (memberId: string, data: { name: string; email: string; imageUrl?: string }) => {
    await updateMember(memberId, { name: data.name, email: data.email, placeholderImageUrl: data.imageUrl });
  };

  const handleOpenMetricsModal = () => {
    if (group) {
      setEditingMetrics([...group.metrics]);
      setShowMetricsModal(true);
    }
  };

  const handleSaveMetrics = async () => {
    if (!group) return;
    await updateGroup(groupId, { metrics: editingMetrics });
    setShowMetricsModal(false);
  };

  const handleAddMetric = () => {
    const newMetric: Metric = {
      id: `metric-${Date.now()}`,
      name: '',
      description: '',
      order: editingMetrics.length,
      minValue: 0,
      maxValue: 100,
      prefix: '',
      suffix: '',
    };
    setEditingMetrics([...editingMetrics, newMetric]);
  };

  const handleUpdateMetric = (index: number, updates: Partial<Metric>) => {
    setEditingMetrics(editingMetrics.map((m, i) => (i === index ? { ...m, ...updates } : m)));
  };

  const handleDeleteMetric = (index: number) => {
    setEditingMetrics(editingMetrics.filter((_, i) => i !== index));
  };

  const handleUploadMemberImage = async (memberId: string, file: File) => {
    const imageUrl = await uploadMemberImage(groupId, file);
    await updateMember(memberId, { placeholderImageUrl: imageUrl });
  };

  const handleApproveClaimRequest = async (request: ClaimRequest) => {
    await respondToClaimRequest(request.id, true, 'Claimed User', null);
    setClaimRequests((prev) => prev.filter((r) => r.id !== request.id));
  };

  const handleRejectClaimRequest = async (request: ClaimRequest) => {
    await respondToClaimRequest(request.id, false, '', null);
    setClaimRequests((prev) => prev.filter((r) => r.id !== request.id));
  };

  const handleOpenGroupSettings = () => {
    if (group) {
      setEditingGroupName(group.name);
      setEditingGroupDescription(group.description || '');
      setEditingLockedYMetricId(group.lockedYMetricId);
      setEditingLockedXMetricId(group.lockedXMetricId);
      setEditingCaptainControlEnabled(group.captainControlEnabled);
      setShowGroupSettingsModal(true);
    }
  };

  const handleSaveGroupSettings = async () => {
    if (!group) return;
    setSavingGroupSettings(true);
    try {
      await updateGroup(groupId, {
        name: editingGroupName.trim(),
        description: editingGroupDescription.trim(),
        lockedYMetricId: editingLockedYMetricId,
        lockedXMetricId: editingLockedXMetricId,
        captainControlEnabled: editingCaptainControlEnabled,
      });
      setShowGroupSettingsModal(false);
    } finally {
      setSavingGroupSettings(false);
    }
  };

  // Check if axes are locked
  const isYAxisLocked = !!group?.lockedYMetricId;
  const isXAxisLocked = !!group?.lockedXMetricId;

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member? This will also delete their ratings.')) {
      return;
    }
    await removeMember(memberId);
  };

  const handleCreateClaimLink = async (memberId: string, email?: string) => {
    if (!user) return null;
    const claimToken = await createClaimToken(groupId, memberId, user.id, email || null);
    return `${window.location.origin}/claim/${claimToken.token}`;
  };

  const handleCopyClaimLink = async (memberId: string) => {
    const link = await handleCreateClaimLink(memberId);
    if (link) {
      await navigator.clipboard.writeText(link);
      alert('Claim link copied to clipboard!');
    }
  };

  const handleSendClaimInvite = async (memberId: string, email: string) => {
    const link = await handleCreateClaimLink(memberId, email);
    if (link) {
      // For now, just copy the link. In the future, this could send an email
      await navigator.clipboard.writeText(link);
      alert(`Claim link for ${email} copied to clipboard! Send this link to them to claim their profile.`);
    }
  };

  const handleToggleDisplayMode = async (memberId: string, mode: 'user' | 'custom') => {
    await updateMember(memberId, { displayMode: mode });
  };

  const handleUpdateCustomDisplay = async (memberId: string, data: { customName?: string; customImageUrl?: string }) => {
    await updateMember(memberId, data);
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
              {claimRequests.length > 0 && isCaptain && (
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
              {isCaptain && (
                <>
                  <Button variant="outline" onClick={handleOpenGroupSettings}>
                    <Settings2 className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                  <Button variant="outline" onClick={handleOpenMetricsModal}>
                    <Settings className="w-4 h-4 mr-2" />
                    Metrics
                  </Button>
                  <Button onClick={() => setShowAddMemberModal(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </>
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
                <span className="hidden sm:inline">Scale</span>
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
                  isCaptain={isCaptain}
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
              isCaptain={isCaptain}
              captainControlEnabled={group.captainControlEnabled}
              onEditMember={handleEditMember}
              onUploadMemberImage={handleUploadMemberImage}
              onUploadCustomImage={async (memberId, file) => {
                const imageUrl = await uploadMemberImage(groupId, file);
                await updateMember(memberId, { customImageUrl: imageUrl });
              }}
              onRemoveMember={handleRemoveMember}
              onCopyClaimLink={handleCopyClaimLink}
              onSendClaimInvite={handleSendClaimInvite}
              onToggleDisplayMode={handleToggleDisplayMode}
              onUpdateCustomDisplay={handleUpdateCustomDisplay}
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
              {isCaptain
                ? 'Add members to start rating and visualizing your group.'
                : 'The group captain hasn\'t added any members yet.'}
            </p>
            {isCaptain && (
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
          groupId={groupId}
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

      {/* Metrics Management Modal */}
      <Modal
        isOpen={showMetricsModal}
        onClose={() => setShowMetricsModal(false)}
        title="Manage Metrics"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {editingMetrics.map((metric, index) => (
            <div key={metric.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Metric {index + 1}</span>
                <button
                  onClick={() => handleDeleteMetric(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>

              <input
                type="text"
                placeholder="Metric name"
                value={metric.name}
                onChange={(e) => handleUpdateMetric(index, { name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
              />

              <input
                type="text"
                placeholder="Description (optional)"
                value={metric.description}
                onChange={(e) => handleUpdateMetric(index, { description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min Value</label>
                  <input
                    type="number"
                    value={metric.minValue}
                    onChange={(e) => handleUpdateMetric(index, { minValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Value</label>
                  <input
                    type="number"
                    max={1000000}
                    value={metric.maxValue}
                    onChange={(e) => handleUpdateMetric(index, { maxValue: Math.min(1000000, Number(e.target.value)) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Prefix</label>
                  <select
                    value={metric.prefix}
                    onChange={(e) => handleUpdateMetric(index, { prefix: e.target.value as MetricPrefix })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                  >
                    <option value="">None</option>
                    <option value="#">#</option>
                    <option value="$">$</option>
                    <option value="€">€</option>
                    <option value="£">£</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Suffix</label>
                  <select
                    value={metric.suffix}
                    onChange={(e) => handleUpdateMetric(index, { suffix: e.target.value as MetricSuffix })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                  >
                    <option value="">None</option>
                    <option value="%">%</option>
                    <option value="K">K (thousands)</option>
                    <option value="M">M (millions)</option>
                    <option value="B">B (billions)</option>
                    <option value="T">T (trillions)</option>
                    <option value=" thousand"> thousand</option>
                    <option value=" million"> million</option>
                    <option value=" billion"> billion</option>
                    <option value=" trillion"> trillion</option>
                  </select>
                </div>
              </div>

            </div>
          ))}

          {editingMetrics.length < 10 && (
            <Button variant="outline" onClick={handleAddMetric} className="w-full">
              + Add Metric
            </Button>
          )}
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={() => setShowMetricsModal(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSaveMetrics} className="flex-1">
            Save Metrics
          </Button>
        </div>
      </Modal>

      {/* Group Settings Modal */}
      <Modal
        isOpen={showGroupSettingsModal}
        onClose={() => setShowGroupSettingsModal(false)}
        title="Group Settings"
      >
        <div className="space-y-4">
          <Input
            label="Group Name"
            id="group-name"
            value={editingGroupName}
            onChange={(e) => setEditingGroupName(e.target.value)}
            placeholder="Enter group name"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={editingGroupDescription}
              onChange={(e) => setEditingGroupDescription(e.target.value)}
              placeholder="Describe what this group is for..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* Captain Control Toggle */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Captain Control
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Always use custom display names and images set by captain
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCaptainControlEnabled(!editingCaptainControlEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editingCaptainControlEnabled
                    ? 'bg-blue-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editingCaptainControlEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={() => setShowGroupSettingsModal(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSaveGroupSettings} loading={savingGroupSettings} className="flex-1">
            Save Settings
          </Button>
        </div>
      </Modal>
    </div>
  );
}
