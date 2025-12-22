'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  UserPlus,
  BarChart3,
  Table,
  SlidersHorizontal,
  AlertCircle,
  Settings,
  Settings2,
  Lock,
  MoreVertical,
  Trash2,
  GripVertical,
  Heart,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Avatar from '@/components/ui/Avatar';
import Select from '@/components/ui/Select';
import MemberGraph from '@/components/graph/MemberGraph';
import DataTable from '@/components/graph/DataTable';
import AddMemberForm from '@/components/groups/AddMemberForm';
import RatingForm from '@/components/groups/RatingForm';
import { Group, GroupMember, GroupObject, Rating, AggregatedScore, ClaimRequest, Metric, MetricPrefix, MetricSuffix, PendingObject, ObjectType } from '@/types';
import {
  subscribeToGroup,
  subscribeToMembers,
  subscribeToObjects,
  subscribeToRatings,
  subscribeToPendingObjects,
  addMember,
  addObject,
  removeObject,
  updateObject,
  submitRating,
  calculateAggregatedScores,
  getGroupClaimRequests,
  respondToClaimRequest,
  updateObjectVisibility,
  uploadObjectImage,
  updateGroup,
  createClaimToken,
  addCoCaptain,
  removeCoCaptain,
  submitPendingObject,
  respondToPendingObject,
  deleteGroup,
  followGroup,
  unfollowGroup,
} from '@/lib/firestore';
import Input from '@/components/ui/Input';

type ViewMode = 'graph' | 'table' | 'rate';

export default function GroupPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [objects, setObjects] = useState<GroupObject[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [claimRequests, setClaimRequests] = useState<ClaimRequest[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingObject[]>([]);
  const [scores, setScores] = useState<AggregatedScore[]>([]);
  const [loading, setLoading] = useState(true);
  // Initialize viewMode from URL params, default to 'graph'
  const initialTab = searchParams.get('tab');
  const [viewMode, setViewMode] = useState<ViewMode>(
    (initialTab === 'table' || initialTab === 'rate' || initialTab === 'graph') ? initialTab : 'graph'
  );
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showClaimRequestsModal, setShowClaimRequestsModal] = useState(false);
  const [showPendingItemsModal, setShowPendingItemsModal] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [editingMetrics, setEditingMetrics] = useState<Metric[]>([]);
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupDescription, setEditingGroupDescription] = useState('');
  const [editingDefaultYMetricId, setEditingDefaultYMetricId] = useState<string | null>(null);
  const [editingDefaultXMetricId, setEditingDefaultXMetricId] = useState<string | null>(null);
  const [editingLockedYMetricId, setEditingLockedYMetricId] = useState<string | null>(null);
  const [editingLockedXMetricId, setEditingLockedXMetricId] = useState<string | null>(null);
  const [editingCaptainControlEnabled, setEditingCaptainControlEnabled] = useState(false);
  const [editingIsPublic, setEditingIsPublic] = useState(true);
  const [editingIsOpen, setEditingIsOpen] = useState(false);
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showMobileCaptainMenu, setShowMobileCaptainMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Graph state
  const [xMetricId, setXMetricId] = useState<string>('');
  const [yMetricId, setYMetricId] = useState<string>('');
  const [showYAxisDropdown, setShowYAxisDropdown] = useState(false);
  const [showXAxisDropdown, setShowXAxisDropdown] = useState(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowYAxisDropdown(false);
      setShowXAxisDropdown(false);
    };
    if (showYAxisDropdown || showXAxisDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showYAxisDropdown, showXAxisDropdown]);

  // Update URL when viewMode changes (preserves tab state for back navigation)
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (viewMode !== currentTab) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', viewMode);
      window.history.replaceState({}, '', url.toString());
    }
  }, [viewMode, searchParams]);

  // Use captainId with backward compatibility for creatorId
  // Also check if user is a co-captain
  const isCaptain = group?.captainId === user?.id || (group?.coCaptainIds?.includes(user?.id || '') ?? false);
  const isOriginalCaptain = group?.captainId === user?.id; // Only original captain can promote co-captains
  const currentMember = members.find((m) => m.clerkId === user?.id);

  // Check if user is following the group
  const isFollowing = currentMember?.role === 'follower' && currentMember?.status === 'accepted';

  // canRate: if group is open, any logged in user can rate; if closed, only captain/co-captains can rate
  const canRate = group?.isOpen ? !!user : isCaptain;
  // Check if user can view the group (public groups can be viewed by anyone, private requires link access)
  const canViewGroup = group?.isPublic || isCaptain;

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
    const unsubscribeObjects = subscribeToObjects(groupId, setObjects);
    const unsubscribeRatings = subscribeToRatings(groupId, setRatings);
    const unsubscribePendingItems = subscribeToPendingObjects(groupId, setPendingItems);

    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
      unsubscribeObjects();
      unsubscribeRatings();
      unsubscribePendingItems();
    };
  }, [groupId]);

  // Calculate scores when ratings or objects change
  useEffect(() => {
    if (group && objects.length > 0) {
      const calculatedScores = calculateAggregatedScores(objects, group.metrics, ratings, group.captainId);
      setScores(calculatedScores);
    }
  }, [group, objects, ratings]);

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
        user.id, // clerkId
        user.emailAddresses[0]?.emailAddress || '',
        user.fullName || user.firstName || 'Captain',
        user.imageUrl || null, // imageUrl
        'captain', // role
        'accepted' // status
      );
    };

    // Only run when we have loaded the group and members
    if (group && members !== undefined && !loading) {
      addCaptainAsMember();
    }
  }, [group, members, isCaptain, user, groupId, loading]);

  const handleAddObject = async (data: {
    email: string | null;
    name: string;
    placeholderImageUrl: string;
    description: string | null;
    itemType: 'text' | 'link' | 'user';
    linkUrl: string | null;
    itemCategory: string | null;
  }) => {
    if (!user || !group) return;

    if (isCaptain) {
      // Captain can add items directly
      const obj = await addObject(
        groupId,
        data.name,
        data.description,
        data.placeholderImageUrl || null,
        data.itemType,
        data.linkUrl,
        data.itemCategory
      );

      // Create claim token for user-type objects
      if (data.email && data.itemType === 'user') {
        await createClaimToken(groupId, obj.id, user.id, data.email);
      }
    } else {
      // Non-captain submits item for approval
      await submitPendingObject(
        groupId,
        data.name,
        data.description,
        data.placeholderImageUrl || null,
        data.itemType,
        data.linkUrl,
        data.itemCategory,
        user.id,
        user.fullName || user.emailAddresses[0]?.emailAddress || 'Unknown'
      );
      alert('Your item has been submitted for captain approval.');
    }

    setShowAddMemberModal(false);
  };

  const handleBulkAddObjects = async (items: Array<{
    email: string | null;
    name: string;
    placeholderImageUrl: string;
    description: string | null;
    itemType: ObjectType;
    linkUrl: string | null;
    itemCategory: string | null;
  }>) => {
    if (!user || !group || !isCaptain) return;

    for (const item of items) {
      await addObject(
        groupId,
        item.name,
        item.description,
        item.placeholderImageUrl || null,
        item.itemType,
        item.linkUrl,
        item.itemCategory
      );
    }

    setShowAddMemberModal(false);
  };

  const handleSubmitRating = async (metricId: string, targetObjectId: string, value: number) => {
    if (!user) return;
    await submitRating(groupId, metricId, user.id, targetObjectId, value);
  };

  const handleObjectClick = (obj: GroupObject) => {
    router.push(`/groups/${groupId}/members/${obj.id}`);
  };

  const handleToggleVisibility = async (objectId: string, visible: boolean) => {
    await updateObjectVisibility(objectId, visible);
  };

  const handleEditObject = async (objectId: string, data: { name: string; description?: string }) => {
    await updateObject(objectId, { name: data.name, description: data.description || null });
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
      applicableCategories: [],
    };
    setEditingMetrics([...editingMetrics, newMetric]);
  };

  const handleUpdateMetric = (index: number, updates: Partial<Metric>) => {
    setEditingMetrics(editingMetrics.map((m, i) => (i === index ? { ...m, ...updates } : m)));
  };

  const handleDeleteMetric = (index: number) => {
    setEditingMetrics(editingMetrics.filter((_, i) => i !== index));
  };

  const handleUploadObjectImage = async (objectId: string, file: File) => {
    const imageUrl = await uploadObjectImage(groupId, file);
    await updateObject(objectId, { imageUrl: imageUrl });
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
      setEditingIsPublic(group.isPublic);
      setEditingIsOpen(group.isOpen);
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
        isPublic: editingIsPublic,
        isOpen: editingIsOpen,
        lastActivityAt: new Date(), // Refresh activity timestamp for trending
      });
      setShowGroupSettingsModal(false);
    } finally {
      setSavingGroupSettings(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group || !isOriginalCaptain) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${group.name}"? This will permanently delete all members, objects, ratings, and data associated with this group. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingGroup(true);
    try {
      await deleteGroup(groupId);
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to delete group:', error);
      alert('Failed to delete group. Please try again.');
    } finally {
      setDeletingGroup(false);
    }
  };

  // Follow a public group (adds to My Groups)
  const handleFollowGroup = async () => {
    if (!user || !group) return;
    setActionLoading(true);
    try {
      await followGroup(
        groupId,
        user.id,
        user.emailAddresses[0]?.emailAddress || '',
        user.fullName || user.firstName || 'User',
        user.imageUrl || null
      );
    } catch (error) {
      console.error('Failed to follow group:', error);
      alert('Failed to follow group. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Unfollow a group
  const handleUnfollowGroup = async () => {
    if (!user || !group) return;
    setActionLoading(true);
    try {
      await unfollowGroup(groupId, user.id);
    } catch (error) {
      console.error('Failed to unfollow group:', error);
      alert('Failed to unfollow group. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Check if axes are locked
  const isYAxisLocked = !!group?.lockedYMetricId;
  const isXAxisLocked = !!group?.lockedXMetricId;

  const handleRemoveObject = async (objectId: string) => {
    if (!confirm('Are you sure you want to remove this item? This will also delete its ratings.')) {
      return;
    }
    await removeObject(objectId);
  };

  const handleCreateClaimLink = async (objectId: string, email?: string) => {
    if (!user) return null;
    const claimToken = await createClaimToken(groupId, objectId, user.id, email || null);
    return `${window.location.origin}/claim/${claimToken.token}`;
  };

  const handleCopyClaimLink = async (objectId: string) => {
    const link = await handleCreateClaimLink(objectId);
    if (link) {
      await navigator.clipboard.writeText(link);
      alert('Claim link copied to clipboard!');
    }
  };

  const handleSendClaimInvite = async (objectId: string, email: string) => {
    const link = await handleCreateClaimLink(objectId, email);
    if (link) {
      // For now, just copy the link. In the future, this could send an email
      await navigator.clipboard.writeText(link);
      alert(`Claim link for ${email} copied to clipboard! Send this link to them to claim their profile.`);
    }
  };

  const handleToggleRatingMode = async (objectId: string, mode: 'captain' | 'group') => {
    await updateObject(objectId, { ratingMode: mode });
  };

  // Toggle co-captain status for a member
  const handleToggleCoCaptain = async (memberId: string, clerkId: string, isCoCaptain: boolean) => {
    if (!group) return;
    if (isCoCaptain) {
      // Remove co-captain
      await removeCoCaptain(groupId, clerkId);
    } else {
      // Add co-captain
      await addCoCaptain(groupId, clerkId);
    }
  };

  // Toggle whether a specific metric applies to a specific object
  const handleToggleMetricForObject = async (objectId: string, metricId: string, enabled: boolean) => {
    const obj = objects.find((o) => o.id === objectId);
    if (!obj) return;

    const currentDisabled = obj.disabledMetricIds || [];
    const currentEnabled = obj.enabledMetricIds || [];
    let newDisabled: string[];
    let newEnabled: string[];

    if (enabled) {
      // Remove from disabled list and add to enabled list
      newDisabled = currentDisabled.filter((id: string) => id !== metricId);
      // Add to enabled list if not already there (to override category restrictions)
      newEnabled = currentEnabled.includes(metricId)
        ? currentEnabled
        : [...currentEnabled, metricId];
    } else {
      // Remove from enabled list and add to disabled list
      newEnabled = currentEnabled.filter((id: string) => id !== metricId);
      // Add to disabled list if not already there
      newDisabled = currentDisabled.includes(metricId)
        ? currentDisabled
        : [...currentDisabled, metricId];
    }

    await updateObject(objectId, {
      disabledMetricIds: newDisabled,
      enabledMetricIds: newEnabled,
    });
  };

  // Handle pending item approval/rejection
  const handleApprovePendingItem = async (item: PendingObject) => {
    if (!user) return;
    await respondToPendingObject(item.id, true, user.id, groupId);
  };

  const handleRejectPendingItem = async (item: PendingObject) => {
    if (!user) return;
    await respondToPendingObject(item.id, false, user.id, groupId);
  };

  // Get visible objects for the graph
  const visibleObjects = objects.filter((obj) => obj.visibleInGraph);

  // Metric options for selectors
  const metricOptions = group?.metrics.map((m) => ({ value: m.id, label: m.name.toLowerCase() })) || [];

  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-lime-600 border-t-transparent rounded-full" />
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
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-lime-500" />
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

  // Access denied for private groups
  if (!canViewGroup) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <Lock className="w-12 h-12 mx-auto mb-4 text-lime-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Private Group
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This group is private. Only members can view its contents.
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
    <div className={`flex flex-col bg-gray-900 ${viewMode === 'graph' ? 'h-[100dvh] sm:min-h-screen sm:h-auto overflow-hidden sm:overflow-visible' : 'min-h-screen'}`}>
      <Header />

      <main className={`flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-2 sm:py-8 ${viewMode === 'graph' ? 'flex flex-col overflow-hidden' : ''}`}>
        {/* Group title and description - shown above all controls */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white truncate">
                {group.name}
              </h1>
              {group.description && (
                <p className="text-sm sm:text-base text-gray-400 mt-1 line-clamp-2">
                  {group.description}
                </p>
              )}
            </div>
            {/* Right side: Follow/Unfollow button */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Follow/Unfollow button for non-captains */}
              {user && !isCaptain && (
                <>
                  {isFollowing ? (
                    <Button
                      variant="outline"
                      onClick={handleUnfollowGroup}
                      loading={actionLoading}
                      className="text-sm"
                    >
                      <Heart className="w-4 h-4 mr-1.5 fill-current" />
                      Following
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={handleFollowGroup}
                      loading={actionLoading}
                      className="text-sm"
                    >
                      <Heart className="w-4 h-4 mr-1.5" />
                      Follow
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile header - back + axis selectors + menu */}
        <div className="flex sm:hidden items-center justify-between mb-3">
          <Link
            href="/dashboard"
            className="p-1 -ml-1 text-gray-400 hover:text-white flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>

          {/* Axis selectors in header - mobile */}
          {group.metrics.length > 0 && (
            <div className="flex-1 flex items-center justify-center">
              <h2 className="text-xl font-bold inline-flex items-center gap-x-1.5">
                {/* Y Axis Selector */}
                <div className="relative inline-block">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowYAxisDropdown(!showYAxisDropdown);
                      setShowXAxisDropdown(false);
                    }}
                    disabled={isYAxisLocked}
                    className="inline-flex items-center hover:opacity-80 transition-opacity disabled:opacity-50 border-b-2 border-lime-500 min-w-[50px] justify-center pb-0.5"
                  >
                    <span className="text-white text-lg">
                      {yMetricId ? group.metrics.find((m) => m.id === yMetricId)?.name.toLowerCase() : '\u00A0'}
                    </span>
                  </button>
                  {showYAxisDropdown && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-[100] py-1">
                      <button
                        onClick={() => { setYMetricId(''); setShowYAxisDropdown(false); }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 ${!yMetricId ? 'bg-lime-900/20 text-lime-300' : 'text-gray-300'}`}
                      >
                        none
                      </button>
                      {metricOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setYMetricId(opt.value); setShowYAxisDropdown(false); }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 ${yMetricId === opt.value ? 'bg-lime-900/20 text-lime-300' : 'text-gray-300'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <span className="text-gray-500 font-normal mx-1 text-lg">×</span>

                {/* X Axis Selector */}
                <div className="relative inline-block">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowXAxisDropdown(!showXAxisDropdown);
                      setShowYAxisDropdown(false);
                    }}
                    disabled={isXAxisLocked}
                    className="inline-flex items-center hover:opacity-80 transition-opacity disabled:opacity-50 border-b-2 border-lime-500 min-w-[50px] justify-center pb-0.5"
                  >
                    <span className="text-white text-lg">
                      {xMetricId ? group.metrics.find((m) => m.id === xMetricId)?.name.toLowerCase() : '\u00A0'}
                    </span>
                  </button>
                  {showXAxisDropdown && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-[100] py-1">
                      <button
                        onClick={() => { setXMetricId(''); setShowXAxisDropdown(false); }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 ${!xMetricId ? 'bg-lime-900/20 text-lime-300' : 'text-gray-300'}`}
                      >
                        none
                      </button>
                      {metricOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setXMetricId(opt.value); setShowXAxisDropdown(false); }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 ${xMetricId === opt.value ? 'bg-lime-900/20 text-lime-300' : 'text-gray-300'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </h2>
            </div>
          )}

          {/* Mobile menu (three-dot) - shown for those who can rate */}
          {canRate && (
            <div className="relative">
              <button
                onClick={() => setShowMobileCaptainMenu(!showMobileCaptainMenu)}
                className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg"
              >
                <MoreVertical className="w-5 h-5" />
                {isCaptain && (claimRequests.length > 0 || pendingItems.length > 0) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-lime-500 rounded-full" />
                )}
              </button>

              {showMobileCaptainMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-30">
                  <div className="py-1">
                    {/* Captain-only options */}
                    {isCaptain && (
                      <>
                        {claimRequests.length > 0 && (
                          <button
                            onClick={() => {
                              setShowClaimRequestsModal(true);
                              setShowMobileCaptainMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-700"
                          >
                            <UserPlus className="w-4 h-4" />
                            Claims
                            <span className="ml-auto bg-lime-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                              {claimRequests.length}
                            </span>
                          </button>
                        )}
                        {pendingItems.length > 0 && (
                          <button
                            onClick={() => {
                              setShowPendingItemsModal(true);
                              setShowMobileCaptainMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-700"
                          >
                            <UserPlus className="w-4 h-4" />
                            Pending Items
                            <span className="ml-auto bg-lime-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                              {pendingItems.length}
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            handleOpenGroupSettings();
                            setShowMobileCaptainMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-700"
                        >
                          <Settings2 className="w-4 h-4" />
                          Settings
                        </button>
                        <button
                          onClick={() => {
                            handleOpenMetricsModal();
                            setShowMobileCaptainMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-700"
                        >
                          <Settings className="w-4 h-4" />
                          Metrics
                        </button>
                      </>
                    )}
                    {/* Add button - available to all who can rate */}
                    <button
                      onClick={() => {
                        setShowAddMemberModal(true);
                        setShowMobileCaptainMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-700"
                    >
                      <UserPlus className="w-4 h-4" />
                      {isCaptain ? 'Add Item' : 'Suggest Item'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop header - back + axis selectors + captain buttons */}
        <div className="hidden sm:flex items-center justify-between mb-4 relative z-[200]">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-400 hover:text-white flex-shrink-0 z-10"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Link>

          {/* Axis selectors in header - desktop (absolutely centered) */}
          {group.metrics.length > 0 && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold inline-flex items-center gap-x-2">
                {/* Y Axis Selector */}
                <div className="relative inline-block">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowYAxisDropdown(!showYAxisDropdown);
                      setShowXAxisDropdown(false);
                    }}
                    disabled={isYAxisLocked}
                    className="inline-flex items-center hover:opacity-80 transition-opacity disabled:opacity-50 border-b-2 border-lime-500 min-w-[60px] sm:min-w-[80px] justify-center pb-1"
                  >
                    <span className="text-white">
                      {yMetricId ? group.metrics.find((m) => m.id === yMetricId)?.name.toLowerCase() : '\u00A0'}
                    </span>
                  </button>
                  {showYAxisDropdown && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-[100] py-1">
                      <button
                        onClick={() => { setYMetricId(''); setShowYAxisDropdown(false); }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 ${!yMetricId ? 'bg-lime-900/20 text-lime-300' : 'text-gray-300'}`}
                      >
                        none
                      </button>
                      {metricOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setYMetricId(opt.value); setShowYAxisDropdown(false); }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 ${yMetricId === opt.value ? 'bg-lime-900/20 text-lime-300' : 'text-gray-300'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <span className="text-gray-500 font-normal mx-1 sm:mx-2">×</span>

                {/* X Axis Selector */}
                <div className="relative inline-block">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowXAxisDropdown(!showXAxisDropdown);
                      setShowYAxisDropdown(false);
                    }}
                    disabled={isXAxisLocked}
                    className="inline-flex items-center hover:opacity-80 transition-opacity disabled:opacity-50 border-b-2 border-lime-500 min-w-[60px] sm:min-w-[80px] justify-center pb-1"
                  >
                    <span className="text-white">
                      {xMetricId ? group.metrics.find((m) => m.id === xMetricId)?.name.toLowerCase() : '\u00A0'}
                    </span>
                  </button>
                  {showXAxisDropdown && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-[100] py-1">
                      <button
                        onClick={() => { setXMetricId(''); setShowXAxisDropdown(false); }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 ${!xMetricId ? 'bg-lime-900/20 text-lime-300' : 'text-gray-300'}`}
                      >
                        none
                      </button>
                      {metricOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setXMetricId(opt.value); setShowXAxisDropdown(false); }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 ${xMetricId === opt.value ? 'bg-lime-900/20 text-lime-300' : 'text-gray-300'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </h2>
            </div>
          )}

          {/* Desktop buttons */}
          <div className="flex items-center gap-2 flex-shrink-0 z-10">
            {/* Captain-only buttons */}
            {isCaptain && (
              <>
                {claimRequests.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setShowClaimRequestsModal(true)}
                    className="relative"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Claims
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-lime-500 text-white text-xs rounded-full flex items-center justify-center">
                      {claimRequests.length}
                    </span>
                  </Button>
                )}
                {pendingItems.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setShowPendingItemsModal(true)}
                    className="relative"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Pending Items
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-lime-500 text-white text-xs rounded-full flex items-center justify-center">
                      {pendingItems.length}
                    </span>
                  </Button>
                )}
                <Button variant="outline" onClick={handleOpenGroupSettings}>
                  <Settings2 className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button variant="outline" onClick={handleOpenMetricsModal}>
                  <Settings className="w-4 h-4 mr-2" />
                  Metrics
                </Button>
              </>
            )}
            {/* Add/Suggest button - available to all who can rate */}
            {canRate && (
              <Button variant="secondary" onClick={() => setShowAddMemberModal(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                {isCaptain ? 'Add' : 'Suggest'}
              </Button>
            )}
          </div>
        </div>

        {/* Control bar tabs - glass style */}
        <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl -mx-4 sm:mx-0 p-1.5 border border-white/10">
          <div className="flex w-full gap-1">
            <button
              onClick={() => setViewMode('graph')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 text-sm sm:text-base font-medium transition-all rounded-xl ${
                viewMode === 'graph'
                  ? 'bg-white/10 text-white border border-white/30 backdrop-blur-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
              Scale
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 text-sm sm:text-base font-medium transition-all rounded-xl ${
                viewMode === 'table'
                  ? 'bg-white/10 text-white border border-white/30 backdrop-blur-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Table className="w-4 h-4 sm:w-5 sm:h-5" />
              Data
            </button>
            {canRate && (
              <button
                onClick={() => setViewMode('rate')}
                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 text-sm sm:text-base font-medium transition-all rounded-xl ${
                  viewMode === 'rate'
                    ? 'bg-white/10 text-white border border-white/30 backdrop-blur-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
                Rate
              </button>
            )}
          </div>
        </div>

        {/* Content - attached to tabs above */}
        {viewMode === 'graph' && (
          <div className="flex-1 flex flex-col -mx-4 sm:mx-0 bg-gray-900 rounded-b-xl min-h-0">
            <div className="flex-1 w-full p-2 sm:p-6 sm:pl-12 sm:pb-8 min-h-0">
              <div className="w-full h-full sm:min-h-0 sm:aspect-[4/3] lg:aspect-[16/10] sm:max-h-[70vh]">
                <MemberGraph
                  objects={visibleObjects}
                  metrics={group.metrics}
                  scores={scores}
                  xMetricId={xMetricId}
                  yMetricId={yMetricId}
                  onObjectClick={handleObjectClick}
                  currentUserId={user?.id || null}
                  existingRatings={ratings}
                  onSubmitRating={handleSubmitRating}
                  canRate={canRate}
                  isCaptain={isCaptain}
                />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'table' && (
          <div className="bg-gray-900 rounded-b-xl -mx-4 sm:mx-0 p-2 sm:p-6 overflow-auto max-h-[calc(100vh-200px)]">
            <DataTable
              objects={objects}
              metrics={group.metrics}
              scores={scores}
              groupId={groupId}
              onObjectClick={handleObjectClick}
              onToggleVisibility={handleToggleVisibility}
              showVisibilityToggle={true}
              currentUserId={user?.id || null}
              existingRatings={ratings}
              onSubmitRating={handleSubmitRating}
              canRate={canRate}
              isCaptain={isCaptain}
              onEditObject={handleEditObject}
              onUploadObjectImage={handleUploadObjectImage}
              onRemoveObject={handleRemoveObject}
              onCopyClaimLink={handleCopyClaimLink}
              onToggleRatingMode={handleToggleRatingMode}
              onToggleMetricForObject={handleToggleMetricForObject}
            />
          </div>
        )}

        {viewMode === 'rate' && canRate && (
          <div className="bg-gray-900 rounded-b-xl -mx-4 sm:mx-0 p-4 sm:p-6">
            <RatingForm
              objects={objects}
              members={members}
              metrics={group.metrics}
              currentUserId={user?.id || ''}
              existingRatings={ratings}
              onSubmitRating={handleSubmitRating}
              isCaptain={isCaptain}
              isGroupOpen={group.isOpen}
            />
          </div>
        )}

        {/* Empty state for no items */}
        {objects.length === 0 && (
          <Card className="p-12 text-center">
            <UserPlus className="w-12 h-12 mx-auto mb-4 text-gray-400" />
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
        title={isCaptain ? 'Add Item' : 'Suggest Item'}
      >
        <AddMemberForm
          onSubmit={handleAddObject}
          onBulkSubmit={isCaptain ? handleBulkAddObjects : undefined}
          onCancel={() => setShowAddMemberModal(false)}
          onUploadImage={(file) => uploadObjectImage(groupId, file)}
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
              const targetObject = objects.find((obj) => obj.id === request.objectId);
              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Claiming: {targetObject?.name || 'Unknown'}
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

      {/* Pending Items Modal */}
      <Modal
        isOpen={showPendingItemsModal}
        onClose={() => setShowPendingItemsModal(false)}
        title="Pending Item Suggestions"
      >
        <div className="space-y-4">
          {pendingItems.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No pending item suggestions
            </p>
          ) : (
            pendingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                        {item.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Suggested by {item.submittedByName} on {item.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRejectPendingItem(item)}
                  >
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => handleApprovePendingItem(item)}>
                    Approve
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Metrics Management Modal */}
      <Modal
        isOpen={showMetricsModal}
        onClose={() => setShowMetricsModal(false)}
        title="Manage Metrics"
        size="lg"
      >
        <div className="space-y-2 pb-2">
          {editingMetrics.map((metric, index) => {
            const isExpanded = expandedMetricId === metric.id;
            const qualifierValue = metric.prefix || metric.suffix || '';
            const handleQualifierChange = (value: string) => {
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
                className="border border-white/10 rounded-xl overflow-hidden bg-gray-800/50"
              >
                {/* Metric Header - Always visible */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedMetricId(isExpanded ? null : metric.id)}
                >
                  <GripVertical className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium truncate">
                        {metric.name || 'Untitled Metric'}
                      </span>
                      {(metric.prefix || metric.suffix) && (
                        <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                          {metric.prefix}{metric.minValue}–{metric.maxValue}{metric.suffix}
                        </span>
                      )}
                    </div>
                    {metric.description && !isExpanded && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{metric.description}</p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-4 bg-gray-800/30">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Name</label>
                      <input
                        type="text"
                        placeholder="Metric name"
                        value={metric.name}
                        onChange={(e) => handleUpdateMetric(index, { name: e.target.value })}
                        className="w-full px-3 py-2.5 text-white bg-gray-900 border border-white/20 rounded-xl focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30"
                      />
                    </div>

                    {/* Range & Format */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Min Value</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={metric.minValue}
                          onChange={(e) => handleUpdateMetric(index, { minValue: Number(e.target.value) })}
                          className="w-full px-3 py-2.5 text-white text-center bg-gray-900 border border-white/20 rounded-xl focus:border-lime-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Max Value</label>
                        <input
                          type="number"
                          max={1000000}
                          placeholder="100"
                          value={metric.maxValue}
                          onChange={(e) => handleUpdateMetric(index, { maxValue: Math.min(1000000, Number(e.target.value)) })}
                          className="w-full px-3 py-2.5 text-white text-center bg-gray-900 border border-white/20 rounded-xl focus:border-lime-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Format</label>
                        <select
                          value={qualifierValue}
                          onChange={(e) => handleQualifierChange(e.target.value)}
                          className="w-full px-3 py-2.5 text-white bg-gray-900 border border-white/20 rounded-xl focus:border-lime-500"
                        >
                          <option value="">None</option>
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

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                      <input
                        type="text"
                        placeholder="Brief description of what this metric measures"
                        value={metric.description}
                        onChange={(e) => handleUpdateMetric(index, { description: e.target.value })}
                        className="w-full px-3 py-2.5 text-white bg-gray-900 border border-white/20 rounded-xl focus:border-lime-500"
                      />
                    </div>

                    {/* Delete button - inside expanded content */}
                    <button
                      onClick={() => handleDeleteMetric(index)}
                      className="w-full py-2 flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors border border-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Metric
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {editingMetrics.length < 10 && (
            <button
              onClick={() => {
                handleAddMetric();
                // Auto-expand the new metric
                setTimeout(() => {
                  const newMetricId = editingMetrics[editingMetrics.length]?.id;
                  if (newMetricId) setExpandedMetricId(newMetricId);
                }, 0);
              }}
              className="w-full py-3 border-2 border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <span className="text-lg">+</span>
              Add Metric
            </button>
          )}

          {/* Default Axis Selection */}
          {editingMetrics.length > 0 && (
            <div className="mt-4 p-4 bg-lime-900/20 border border-lime-700/50 rounded-xl">
              <p className="text-sm font-medium text-lime-300 mb-3">Default Graph Axes</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-lime-400/80 mb-1.5">Y-Axis</label>
                  <select
                    value={editingDefaultYMetricId ?? ''}
                    onChange={(e) => setEditingDefaultYMetricId(e.target.value)}
                    className="w-full px-3 py-2 text-white bg-gray-900 border border-lime-600/50 rounded-xl focus:border-lime-500"
                  >
                    <option value="">None</option>
                    {editingMetrics.map((m) => (
                      <option key={m.id} value={m.id}>{m.name || 'Unnamed'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-lime-400/80 mb-1.5">X-Axis</label>
                  <select
                    value={editingDefaultXMetricId ?? ''}
                    onChange={(e) => setEditingDefaultXMetricId(e.target.value)}
                    className="w-full px-3 py-2 text-white bg-gray-900 border border-lime-600/50 rounded-xl focus:border-lime-500"
                  >
                    <option value="">None</option>
                    {editingMetrics.map((m) => (
                      <option key={m.id} value={m.id}>{m.name || 'Unnamed'}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t border-white/10">
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
              className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-lime-600 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* Public/Private Toggle */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Public Group
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {editingIsPublic ? 'Anyone can view this group' : 'Only those with the link can view this group'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingIsPublic(!editingIsPublic)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editingIsPublic
                    ? 'bg-lime-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editingIsPublic ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Open/Closed Toggle */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Open Ratings
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {editingIsOpen ? 'Anyone can rate items' : 'Only captain/co-captains can rate items'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingIsOpen(!editingIsOpen)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editingIsOpen
                    ? 'bg-lime-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editingIsOpen ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
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
                    ? 'bg-lime-600'
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

          {/* Danger Zone - Only for original captain */}
          {isOriginalCaptain && (
            <div className="mt-6 p-4 border border-red-500/30 bg-red-500/10 rounded-lg">
              <h3 className="text-sm font-medium text-red-400 mb-2">Danger Zone</h3>
              <p className="text-xs text-gray-400 mb-3">
                Permanently delete this group and all its data. This cannot be undone.
              </p>
              <Button
                variant="outline"
                onClick={handleDeleteGroup}
                loading={deletingGroup}
                className="w-full border-red-500/50 text-red-400 hover:bg-red-500/20"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Group
              </Button>
            </div>
          )}
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
