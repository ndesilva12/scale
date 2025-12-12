'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
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
  MoreVertical,
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
  const [editingDefaultYMetricId, setEditingDefaultYMetricId] = useState<string | null>(null);
  const [editingDefaultXMetricId, setEditingDefaultXMetricId] = useState<string | null>(null);
  const [editingLockedYMetricId, setEditingLockedYMetricId] = useState<string | null>(null);
  const [editingLockedXMetricId, setEditingLockedXMetricId] = useState<string | null>(null);
  const [editingCaptainControlEnabled, setEditingCaptainControlEnabled] = useState(false);
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);
  const [showMobileCaptainMenu, setShowMobileCaptainMenu] = useState(false);

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
        // Priority: locked > current selection > default > fallback
        // Note: empty string "" means "None" was explicitly selected
        if (updatedGroup.lockedXMetricId) {
          setXMetricId(updatedGroup.lockedXMetricId);
        } else if (!xMetricId) {
          // Use nullish coalescing - only fallback if null/undefined, not empty string
          const defaultX = updatedGroup.defaultXMetricId;
          setXMetricId(defaultX !== null && defaultX !== undefined ? defaultX : updatedGroup.metrics[0].id);
        }

        if (updatedGroup.lockedYMetricId) {
          setYMetricId(updatedGroup.lockedYMetricId);
        } else if (!yMetricId) {
          const fallbackY = updatedGroup.metrics.length > 1 ? updatedGroup.metrics[1].id : updatedGroup.metrics[0].id;
          const defaultY = updatedGroup.defaultYMetricId;
          setYMetricId(defaultY !== null && defaultY !== undefined ? defaultY : fallbackY);
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

  const handleAddMember = async (data: { email: string | null; name: string; placeholderImageUrl: string; description: string | null }) => {
    if (!user || !group) return;

    const member = await addMember(
      groupId,
      data.email,
      data.name,
      data.placeholderImageUrl || null,
      null, // clerkId
      'placeholder', // status
      null, // imageUrl
      false, // isCaptain
      data.description
    );

    // Only create invitation if email is provided
    if (data.email) {
      await createInvitation(
        groupId,
        group.name,
        data.email,
        member.id,
        user.id,
        user.fullName || user.emailAddresses[0]?.emailAddress || 'Unknown'
      );
    }

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
      setEditingDefaultYMetricId(group.defaultYMetricId);
      setEditingDefaultXMetricId(group.defaultXMetricId);
      setShowMetricsModal(true);
    }
  };

  const handleSaveMetrics = async () => {
    if (!group) return;
    await updateGroup(groupId, {
      metrics: editingMetrics,
      defaultYMetricId: editingDefaultYMetricId,
      defaultXMetricId: editingDefaultXMetricId,
    });
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
          <div className="animate-spin w-8 h-8 border-4 border-red-800 border-t-transparent rounded-full" />
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
    <div className={`min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 ${viewMode === 'graph' ? 'sm:min-h-screen' : ''}`}>
      <Header />

      <main className={`flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8 ${viewMode === 'graph' ? 'sm:py-8 flex flex-col' : ''}`}>
        {/* Mobile header - inline: back chevron + title + menu */}
        <div className="flex sm:hidden items-center justify-between mb-2">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Link
              href="/dashboard"
              className="p-1 -ml-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {group.name}
            </h1>
          </div>

          {/* Mobile captain menu (three-dot) */}
          {isCaptain && (
            <div className="relative">
              <button
                onClick={() => setShowMobileCaptainMenu(!showMobileCaptainMenu)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <MoreVertical className="w-5 h-5" />
                {claimRequests.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {showMobileCaptainMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-30">
                  <div className="py-1">
                    {claimRequests.length > 0 && (
                      <button
                        onClick={() => {
                          setShowClaimRequestsModal(true);
                          setShowMobileCaptainMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Users className="w-4 h-4" />
                        Claims
                        <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {claimRequests.length}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleOpenGroupSettings();
                        setShowMobileCaptainMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Settings2 className="w-4 h-4" />
                      Settings
                    </button>
                    <button
                      onClick={() => {
                        handleOpenMetricsModal();
                        setShowMobileCaptainMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Settings className="w-4 h-4" />
                      Metrics
                    </button>
                    <button
                      onClick={() => {
                        setShowAddMemberModal(true);
                        setShowMobileCaptainMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop header - full layout */}
        <div className="hidden sm:block mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {group.name}
              </h1>
              {group.description && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">{group.description}</p>
              )}
            </div>

            {/* Desktop captain buttons */}
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
                  <Button variant="secondary" onClick={() => setShowAddMemberModal(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Desktop control bar - hidden on mobile when graph view */}
        <Card className={`p-2 sm:p-4 mb-4 sm:mb-6 ${viewMode === 'graph' ? 'hidden sm:block' : ''}`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            {/* View mode buttons - full width on mobile, flex on desktop */}
            <div className="flex w-full gap-1 sm:gap-2">
              <Button
                variant={viewMode === 'graph' ? 'primary' : 'ghost'}
                onClick={() => setViewMode('graph')}
                className="flex-1 justify-center py-2.5 sm:py-3 text-sm sm:text-base"
              >
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                Scale
              </Button>
              <Button
                variant={viewMode === 'table' ? 'primary' : 'ghost'}
                onClick={() => setViewMode('table')}
                className="flex-1 justify-center py-2.5 sm:py-3 text-sm sm:text-base"
              >
                <Table className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                Data
              </Button>
              {canRate && (
                <Button
                  variant={viewMode === 'rate' ? 'primary' : 'ghost'}
                  onClick={() => setViewMode('rate')}
                  className="flex-1 justify-center py-2.5 sm:py-3 text-sm sm:text-base"
                >
                  <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                  Rate
                </Button>
              )}
            </div>

            {/* Metric selectors - only show for graph view on desktop, fill remaining space */}
            {viewMode === 'graph' && group.metrics.length > 0 && (
              <div className="hidden sm:flex items-center gap-4 flex-1 justify-end">
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    Y:
                  </label>
                  <select
                    value={yMetricId}
                    onChange={(e) => setYMetricId(e.target.value)}
                    disabled={isYAxisLocked}
                    className="flex-1 text-base px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-800 disabled:opacity-50"
                  >
                    <option value="">None</option>
                    {metricOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    X:
                  </label>
                  <select
                    value={xMetricId}
                    onChange={(e) => setXMetricId(e.target.value)}
                    disabled={isXAxisLocked}
                    className="flex-1 text-base px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-800 disabled:opacity-50"
                  >
                    <option value="">None</option>
                    {metricOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Content */}
        {viewMode === 'graph' && (
          <div className="flex-1 flex flex-col sm:block -mx-4 sm:mx-0">
            {/* Mobile: tabs directly above graph */}
            <div className="flex sm:hidden gap-1 px-2 pb-1 bg-gray-50 dark:bg-gray-900">
              <Button
                variant="primary"
                onClick={() => setViewMode('graph')}
                size="sm"
                className="flex-1 justify-center"
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                Scale
              </Button>
              <Button
                variant="ghost"
                onClick={() => setViewMode('table')}
                size="sm"
                className="flex-1 justify-center"
              >
                <Table className="w-4 h-4 mr-1" />
                Data
              </Button>
              {canRate && (
                <Button
                  variant="ghost"
                  onClick={() => setViewMode('rate')}
                  size="sm"
                  className="flex-1 justify-center"
                >
                  <SlidersHorizontal className="w-4 h-4 mr-1" />
                  Rate
                </Button>
              )}
            </div>

            <Card className="flex-1 flex flex-col p-0 sm:p-6 rounded-none sm:rounded-xl overflow-hidden">
              {/* Graph Title - hidden on mobile since axis labels are inline */}
              <h2 className="hidden sm:block text-center text-3xl md:text-4xl font-extrabold mb-4 text-gray-800 dark:text-white">
                {yMetricId && xMetricId ? (
                  // Both axes selected
                  <>
                    <span>
                      {group.metrics.find((m) => m.id === yMetricId)?.name}
                    </span>
                    <span className="mx-3 text-gray-400 dark:text-gray-500 font-normal">×</span>
                    <span>
                      {group.metrics.find((m) => m.id === xMetricId)?.name}
                    </span>
                  </>
                ) : yMetricId ? (
                  // Only Y axis selected
                  <span>
                    {group.metrics.find((m) => m.id === yMetricId)?.name}
                  </span>
                ) : xMetricId ? (
                  // Only X axis selected
                  <span>
                    {group.metrics.find((m) => m.id === xMetricId)?.name}
                  </span>
                ) : (
                  // Neither axis selected
                  <span className="text-gray-400 dark:text-gray-500">Items</span>
                )}
              </h2>
              <div className="flex-1 w-full sm:pl-12 sm:pb-8">
                <div className="w-full h-full sm:aspect-[4/3] lg:aspect-[16/10] sm:max-h-[70vh]">
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

              {/* Mobile: axis selectors at bottom of graph card */}
              {group.metrics.length > 0 && (
                <div className="sm:hidden flex items-center justify-center gap-4 py-2 px-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Y:</label>
                    <select
                      value={yMetricId}
                      onChange={(e) => setYMetricId(e.target.value)}
                      disabled={isYAxisLocked}
                      className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
                    >
                      <option value="">None</option>
                      {metricOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">X:</label>
                    <select
                      value={xMetricId}
                      onChange={(e) => setXMetricId(e.target.value)}
                      disabled={isXAxisLocked}
                      className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
                    >
                      <option value="">None</option>
                      {metricOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {viewMode === 'table' && (
          <Card className="p-2 sm:p-6 -mx-4 sm:mx-0 rounded-none sm:rounded-xl overflow-auto max-h-[calc(100vh-200px)]">
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
          <Card className="p-4 sm:p-6 -mx-4 sm:mx-0 rounded-none sm:rounded-xl">
            <RatingForm
              members={members}
              metrics={group.metrics}
              currentUserId={user?.id || ''}
              existingRatings={ratings}
              onSubmitRating={handleSubmitRating}
            />
          </Card>
        )}

        {/* Empty state for no items */}
        {members.length === 0 && (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No items yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {isCaptain
                ? 'Add items to start rating and visualizing your group.'
                : 'The group captain hasn\'t added any items yet.'}
            </p>
            {isCaptain && (
              <Button variant="secondary" onClick={() => setShowAddMemberModal(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add First Item
              </Button>
            )}
          </Card>
        )}
      </main>

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        title="Add Item"
      >
        <AddMemberForm
          onSubmit={handleAddMember}
          onCancel={() => setShowAddMemberModal(false)}
          onUploadImage={(file) => uploadMemberImage(groupId, file)}
          existingEmails={members.filter((m) => m.email).map((m) => m.email!.toLowerCase())}
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
        size="3xl"
      >
        <div className="max-h-[60vh] overflow-y-auto space-y-3">
          {editingMetrics.map((metric, index) => {
            // Combine prefix and suffix into a single value for the dropdown
            const qualifierValue = metric.prefix || metric.suffix || '';
            const handleQualifierChange = (value: string) => {
              // Check if it's a prefix (currency symbols, #) or suffix (%, K, M, etc)
              const prefixes = ['#', '$', '€', '£'];
              if (prefixes.includes(value)) {
                handleUpdateMetric(index, { prefix: value as MetricPrefix, suffix: '' as MetricSuffix });
              } else {
                handleUpdateMetric(index, { prefix: '' as MetricPrefix, suffix: value as MetricSuffix });
              }
            };

            return (
              <div
                key={metric.id}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2"
              >
                {/* Row 1: Name, Min, Max, Format, Delete */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  {/* Name - largest, takes remaining space */}
                  <div className="flex-1 min-w-0 order-1">
                    <input
                      type="text"
                      placeholder="Metric name"
                      value={metric.name}
                      onChange={(e) => handleUpdateMetric(index, { name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                    />
                  </div>

                  {/* Min/Max/Format group - fixed widths */}
                  <div className="flex items-center gap-2 order-2 sm:order-2">
                    <div className="w-16 sm:w-20">
                      <input
                        type="number"
                        placeholder="Min"
                        value={metric.minValue}
                        onChange={(e) => handleUpdateMetric(index, { minValue: Number(e.target.value) })}
                        className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-center"
                      />
                    </div>
                    <div className="w-16 sm:w-20">
                      <input
                        type="number"
                        max={1000000}
                        placeholder="Max"
                        value={metric.maxValue}
                        onChange={(e) => handleUpdateMetric(index, { maxValue: Math.min(1000000, Number(e.target.value)) })}
                        className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-center"
                      />
                    </div>
                    <div className="w-16 sm:w-24">
                      <select
                        value={qualifierValue}
                        onChange={(e) => handleQualifierChange(e.target.value)}
                        className="w-full px-1 sm:px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                      >
                        <option value="">-</option>
                        <optgroup label="Prefix">
                          <option value="#">#</option>
                          <option value="$">$</option>
                          <option value="€">€</option>
                          <option value="£">£</option>
                        </optgroup>
                        <optgroup label="Suffix">
                          <option value="%">%</option>
                          <option value="K">K</option>
                          <option value="M">M</option>
                          <option value="B">B</option>
                          <option value="T">T</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteMetric(index)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg order-3"
                    title="Remove metric"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Row 2: Description - full width */}
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={metric.description}
                  onChange={(e) => handleUpdateMetric(index, { description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
            );
          })}

          {editingMetrics.length < 10 && (
            <Button variant="outline" onClick={handleAddMetric} className="w-full">
              + Add Metric
            </Button>
          )}

          {/* Default Axis Selection */}
          {editingMetrics.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg">
              <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-3">Default Graph Axes</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                    Default Y-Axis
                  </label>
                  <select
                    value={editingDefaultYMetricId ?? ''}
                    onChange={(e) => setEditingDefaultYMetricId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-900"
                  >
                    <option value="">None</option>
                    {editingMetrics.map((m) => (
                      <option key={m.id} value={m.id}>{m.name || 'Unnamed'}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                    Default X-Axis
                  </label>
                  <select
                    value={editingDefaultXMetricId ?? ''}
                    onChange={(e) => setEditingDefaultXMetricId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-900"
                  >
                    <option value="">None</option>
                    {editingMetrics.map((m) => (
                      <option key={m.id} value={m.id}>{m.name || 'Unnamed'}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-red-800 dark:text-red-400 mt-2">
                These will be the initial axes shown when viewing the graph. Users can still change them.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={() => setShowMetricsModal(false)} className="flex-1">
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSaveMetrics} className="flex-1">
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
              className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-red-800 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                    ? 'bg-red-800'
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
          <Button variant="secondary" onClick={handleSaveGroupSettings} loading={savingGroupSettings} className="flex-1">
            Save Settings
          </Button>
        </div>
      </Modal>
    </div>
  );
}
