'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Anchor, Pencil, Check, X, Camera, Trash2, Link2, Mail, User, Settings, Users, ChevronUp, ChevronDown } from 'lucide-react';
import { GroupMember, Metric, AggregatedScore, Rating, MemberDisplayMode, MemberRatingMode, getMemberDisplayName, getMemberDisplayImage } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';

interface DataTableProps {
  members: GroupMember[];
  metrics: Metric[];
  scores: AggregatedScore[];
  groupId: string;
  onMemberClick?: (member: GroupMember) => void;
  onToggleVisibility?: (memberId: string, visible: boolean) => void;
  showVisibilityToggle?: boolean;
  currentUserId?: string | null;
  existingRatings?: Rating[];
  onSubmitRating?: (metricId: string, targetMemberId: string, value: number) => Promise<void>;
  canRate?: boolean;
  isCaptain?: boolean;
  isOriginalCaptain?: boolean;
  captainControlEnabled?: boolean;
  coCaptainIds?: string[];
  onEditMember?: (memberId: string, data: { name: string; email: string; imageUrl?: string }) => Promise<void>;
  onUploadMemberImage?: (memberId: string, file: File) => Promise<void>;
  onUploadCustomImage?: (memberId: string, file: File) => Promise<void>;
  onRemoveMember?: (memberId: string) => Promise<void>;
  onCopyClaimLink?: (memberId: string) => Promise<void>;
  onSendClaimInvite?: (memberId: string, email: string) => Promise<void>;
  onToggleDisplayMode?: (memberId: string, mode: MemberDisplayMode) => Promise<void>;
  onUpdateCustomDisplay?: (memberId: string, data: { customName?: string; customImageUrl?: string }) => Promise<void>;
  onToggleRatingMode?: (memberId: string, mode: MemberRatingMode) => Promise<void>;
  onToggleCoCaptain?: (memberId: string, clerkId: string, isCoCaptain: boolean) => Promise<void>;
}

export default function DataTable({
  members,
  metrics,
  scores,
  groupId,
  onMemberClick,
  onToggleVisibility,
  showVisibilityToggle = false,
  currentUserId,
  existingRatings = [],
  onSubmitRating,
  canRate = false,
  isCaptain = false,
  isOriginalCaptain = false,
  captainControlEnabled = false,
  coCaptainIds = [],
  onEditMember,
  onUploadMemberImage,
  onUploadCustomImage,
  onRemoveMember,
  onCopyClaimLink,
  onSendClaimInvite,
  onToggleDisplayMode,
  onUpdateCustomDisplay,
  onToggleRatingMode,
  onToggleCoCaptain,
}: DataTableProps) {
  const [editingCell, setEditingCell] = useState<{ memberId: string; metricId: string } | null>(null);
  const [editValue, setEditValue] = useState<number>(50);
  const [saving, setSaving] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editMemberData, setEditMemberData] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [showMemberActions, setShowMemberActions] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [editingDisplaySettings, setEditingDisplaySettings] = useState<string | null>(null);
  const [customNameInput, setCustomNameInput] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customImageInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeMembers = useMemo(() => {
    const filtered = members.filter((m) => m.status === 'accepted' || m.status === 'placeholder');

    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      if (sortColumn === 'name') {
        const nameA = getMemberDisplayName(a).toLowerCase();
        const nameB = getMemberDisplayName(b).toLowerCase();
        return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }

      // Sort by metric score
      const scoreA = scores.find((s) => s.memberId === a.id && s.metricId === sortColumn)?.averageValue ?? 0;
      const scoreB = scores.find((s) => s.memberId === b.id && s.metricId === sortColumn)?.averageValue ?? 0;
      return sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    });
  }, [members, sortColumn, sortDirection, scores]);

  const getScore = (memberId: string, metricId: string): number => {
    const score = scores.find(
      (s) => s.memberId === memberId && s.metricId === metricId
    );
    return score?.averageValue ?? 0;
  };

  const getRatingCount = (memberId: string, metricId: string): number => {
    const score = scores.find(
      (s) => s.memberId === memberId && s.metricId === metricId
    );
    return score?.totalRatings ?? 0;
  };

  const getUserRating = (memberId: string, metricId: string): number | null => {
    if (!currentUserId) return null;
    const rating = existingRatings.find(
      (r) => r.targetMemberId === memberId && r.metricId === metricId && r.raterId === currentUserId
    );
    return rating?.value ?? null;
  };

  // Normalize score to 0-100 based on metric's min/max range
  const getScoreColor = (value: number, metric?: Metric) => {
    const min = metric?.minValue ?? 0;
    const max = metric?.maxValue ?? 100;
    const range = max - min;
    const normalizedValue = range > 0 ? ((value - min) / range) * 100 : 50;

    if (normalizedValue >= 75) return 'text-green-600 dark:text-green-400';
    if (normalizedValue >= 50) return 'text-yellow-500 dark:text-yellow-400';
    if (normalizedValue >= 25) return 'text-orange-500 dark:text-orange-400';
    return 'text-red-500 dark:text-red-400';
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleStartEdit = (memberId: string, metricId: string) => {
    const existingValue = getUserRating(memberId, metricId);
    setEditingCell({ memberId, metricId });
    setEditValue(existingValue ?? 50);
  };

  // Auto-save with debounce
  const autoSaveRating = useCallback(async (metricId: string, memberId: string, value: number) => {
    if (!onSubmitRating) return;

    setSaving(true);
    try {
      await onSubmitRating(metricId, memberId, value);
    } finally {
      setSaving(false);
    }
  }, [onSubmitRating]);

  const handleSliderChange = (value: number) => {
    setEditValue(value);

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (500ms debounce)
    if (editingCell) {
      saveTimeoutRef.current = setTimeout(() => {
        autoSaveRating(editingCell.metricId, editingCell.memberId, value);
      }, 500);
    }
  };

  const handleCancelEdit = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setEditingCell(null);
  };

  const handleStartEditMember = (member: GroupMember) => {
    setEditingMember(member.id);
    setEditMemberData({ name: member.name, email: member.email || '' });
  };

  const handleSaveMember = async () => {
    if (!editingMember || !onEditMember) return;

    setSaving(true);
    try {
      await onEditMember(editingMember, editMemberData);
      setEditingMember(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEditMember = () => {
    setEditingMember(null);
  };

  const handleImageUpload = async (memberId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadMemberImage) return;

    setUploadingImage(memberId);
    try {
      await onUploadMemberImage(memberId, file);
    } finally {
      setUploadingImage(null);
    }
  };

  const canEditMember = (member: GroupMember) => {
    // Captain can edit unclaimed (placeholder) members directly
    return isCaptain && member.status === 'placeholder' && !member.clerkId;
  };

  const canEditCustomDisplay = (member: GroupMember) => {
    // Captain can edit custom display for all members (name/image shown in group)
    return isCaptain && !member.isCaptain;
  };

  const handleToggleMemberActions = (memberId: string) => {
    if (showMemberActions === memberId) {
      setShowMemberActions(null);
      setDropdownPosition(null);
    } else {
      const button = actionButtonRefs.current[memberId];
      if (button) {
        const rect = button.getBoundingClientRect();
        const dropdownWidth = 288; // w-72 = 18rem = 288px
        // Calculate left position, ensuring it stays within viewport
        let left = rect.left;
        // If dropdown would overflow right side, align to right edge of viewport with padding
        if (left + dropdownWidth > window.innerWidth - 16) {
          left = window.innerWidth - dropdownWidth - 16;
        }
        // Ensure it doesn't go off left side
        if (left < 16) {
          left = 16;
        }
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: left,
        });
      }
      setShowMemberActions(memberId);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showMemberActions) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-dropdown]') && !target.closest('[data-action-button]')) {
          setShowMemberActions(null);
          setDropdownPosition(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMemberActions]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleCustomImageUpload = async (memberId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadCustomImage) return;

    setUploadingImage(memberId);
    try {
      await onUploadCustomImage(memberId, file);
    } finally {
      setUploadingImage(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const memberId = fileInputRef.current?.dataset.memberId;
          if (memberId) {
            handleImageUpload(memberId, e);
          }
        }}
        className="hidden"
      />
      <input
        ref={customImageInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const memberId = customImageInputRef.current?.dataset.memberId;
          if (memberId) {
            handleCustomImageUpload(memberId, e);
          }
        }}
        className="hidden"
      />

      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-20 bg-gray-800">
          <tr className="border-b border-gray-700">
            <th
              className="text-left py-2 sm:py-3 px-2 sm:px-3 font-semibold text-white cursor-pointer hover:bg-gray-700 transition-colors sticky left-0 bg-gray-800 z-10 min-w-[100px] sm:min-w-[140px]"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs sm:text-sm">Item</span>
                {sortColumn === 'name' && (
                  sortDirection === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                )}
              </div>
            </th>
            {metrics.map((metric) => (
              <th
                key={metric.id}
                className="text-center py-2 sm:py-3 px-2 sm:px-4 font-semibold text-white min-w-[70px] sm:min-w-[100px] cursor-pointer hover:bg-gray-700 transition-colors"
                title={metric.description}
                onClick={() => handleSort(metric.id)}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs sm:text-sm">{metric.name}</span>
                  {sortColumn === metric.id && (
                    sortDirection === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                  )}
                </div>
              </th>
            ))}
            {/* Actions header at the end */}
            {isCaptain && (
              <th className="text-center py-2 sm:py-3 px-2 font-semibold text-white w-16 sm:w-20">
                <Settings className="w-4 h-4 mx-auto text-gray-400" />
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {activeMembers.map((member) => (
            <tr
              key={member.id}
              className={`border-b border-gray-700 hover:bg-gray-700/50 transition-colors ${
                !member.visibleInGraph ? 'opacity-50' : ''
              }`}
            >
              <td className="py-2 sm:py-3 px-2 sm:px-3 sticky left-0 bg-gray-800 z-10">
                {editingMember === member.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editMemberData.name}
                      onChange={(e) => setEditMemberData((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                      placeholder="Name"
                    />
                    <input
                      type="email"
                      value={editMemberData.email}
                      onChange={(e) => setEditMemberData((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                      placeholder="Email"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleSaveMember}
                        disabled={saving}
                        className="p-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={handleCancelEditMember}
                        className="p-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/groups/${groupId}/members/${member.id}`}
                    className="flex items-center gap-2 hover:text-lime-400 transition-colors"
                    onClick={(e) => {
                      if (onMemberClick) {
                        e.preventDefault();
                        onMemberClick(member);
                      }
                    }}
                  >
                    <div className="relative group flex-shrink-0">
                      <Avatar
                        src={getMemberDisplayImage(member)}
                        alt={getMemberDisplayName(member)}
                        size="sm"
                      />
                      {canEditMember(member) && onUploadMemberImage && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (fileInputRef.current) {
                              fileInputRef.current.dataset.memberId = member.id;
                              fileInputRef.current.click();
                            }
                          }}
                          className="absolute -bottom-1 -right-1 w-4 h-4 bg-lime-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Upload image"
                        >
                          {uploadingImage === member.id ? (
                            <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Camera className="w-2 h-2" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white text-xs sm:text-sm truncate flex items-center gap-1">
                        <span className="truncate">{getMemberDisplayName(member)}</span>
                        {member.isCaptain && <Anchor className="w-3 h-3 text-lime-500 flex-shrink-0" />}
                        {!member.isCaptain && member.clerkId && coCaptainIds.includes(member.clerkId) && (
                          <Anchor className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-400 truncate">
                        {member.isCaptain
                          ? 'Captain'
                          : member.clerkId && coCaptainIds.includes(member.clerkId)
                            ? 'Co-Captain'
                            : member.status === 'placeholder'
                              ? 'Pending'
                              : 'Active'}
                      </div>
                    </div>
                  </Link>
                )}
              </td>
              {metrics.map((metric) => {
                const score = getScore(member.id, metric.id);
                const count = getRatingCount(member.id, metric.id);
                const userRating = getUserRating(member.id, metric.id);
                const isEditing = editingCell?.memberId === member.id && editingCell?.metricId === metric.id;

                return (
                  <td
                    key={metric.id}
                    className="py-2 sm:py-3 px-2 sm:px-4 text-center"
                  >
                    {isEditing ? (
                      <div className="flex flex-col items-center gap-2">
                        <input
                          type="range"
                          min={metric.minValue}
                          max={metric.maxValue}
                          value={editValue}
                          onChange={(e) => handleSliderChange(Number(e.target.value))}
                          className="w-full h-2 accent-lime-500"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {metric.prefix}{editValue}{metric.suffix}
                          </span>
                          {saving && (
                            <div className="w-3 h-3 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
                          )}
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 bg-gray-600 text-white rounded hover:bg-gray-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`${canRate && onSubmitRating ? 'cursor-pointer hover:bg-gray-700 rounded-lg p-1.5 -m-1.5 transition-colors' : ''}`}
                        onClick={() => canRate && onSubmitRating && handleStartEdit(member.id, metric.id)}
                      >
                        <div className={`font-semibold text-sm ${getScoreColor(score, metric)}`}>
                          {metric.prefix}{score.toFixed(1)}{metric.suffix}
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-400">
                          {count} rating{count !== 1 ? 's' : ''}
                        </div>
                        {userRating !== null && (
                          <div className="text-[10px] sm:text-xs text-lime-400 mt-0.5">
                            You: {metric.prefix}{userRating}{metric.suffix}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
              {/* Actions cell at the end */}
              {isCaptain && (
                <td className="py-2 sm:py-3 px-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {showVisibilityToggle && (
                      <button
                        onClick={() => onToggleVisibility?.(member.id, !member.visibleInGraph)}
                        className={`p-1.5 rounded transition-colors ${
                          member.visibleInGraph
                            ? 'text-lime-400 hover:bg-gray-700'
                            : 'text-gray-500 hover:bg-gray-700'
                        }`}
                        title={member.visibleInGraph ? 'Hide from graph' : 'Show in graph'}
                      >
                        {member.visibleInGraph ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      ref={(el) => { actionButtonRefs.current[member.id] = el; }}
                      data-action-button
                      onClick={() => handleToggleMemberActions(member.id)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                      title="Item actions"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {activeMembers.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No items to display
        </div>
      )}

      {/* Fixed position dropdown for member actions */}
      {showMemberActions && dropdownPosition && (
        <div
          data-dropdown
          className="fixed w-72 max-w-[calc(100vw-32px)] bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50 max-h-[70vh] overflow-y-auto"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
          }}
        >
          {(() => {
            const member = activeMembers.find((m) => m.id === showMemberActions);
            if (!member) return null;
            return (
              <div className="p-2 space-y-1">
                {/* Custom display settings for all non-captain members */}
                {canEditCustomDisplay(member) && (
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Display in Group</p>
                    <div className="flex gap-1 mb-3">
                      <button
                        onClick={() => {
                          onToggleDisplayMode?.(member.id, 'user');
                        }}
                        className={`flex-1 px-2 py-1 text-xs rounded ${
                          member.displayMode === 'user'
                            ? 'bg-lime-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <User className="w-3 h-3 inline mr-1" />
                        User Profile
                      </button>
                      <button
                        onClick={() => {
                          onToggleDisplayMode?.(member.id, 'custom');
                        }}
                        className={`flex-1 px-2 py-1 text-xs rounded ${
                          member.displayMode === 'custom'
                            ? 'bg-lime-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <Pencil className="w-3 h-3 inline mr-1" />
                        Custom
                      </button>
                    </div>

                    {/* Custom name input */}
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">Custom Name</label>
                        <input
                          type="text"
                          value={editingDisplaySettings === member.id ? customNameInput : (member.customName || '')}
                          onChange={(e) => {
                            setEditingDisplaySettings(member.id);
                            setCustomNameInput(e.target.value);
                          }}
                          onBlur={() => {
                            if (editingDisplaySettings === member.id) {
                              onUpdateCustomDisplay?.(member.id, { customName: customNameInput || undefined });
                              setEditingDisplaySettings(null);
                            }
                          }}
                          onFocus={() => {
                            setEditingDisplaySettings(member.id);
                            setCustomNameInput(member.customName || '');
                          }}
                          placeholder={member.name}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {/* Custom image upload */}
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400">Custom Image</label>
                        <div className="flex items-center gap-2 mt-1">
                          {member.customImageUrl && (
                            <img
                              src={member.customImageUrl}
                              alt="Custom"
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (customImageInputRef.current) {
                                customImageInputRef.current.dataset.memberId = member.id;
                                customImageInputRef.current.click();
                              }
                            }}
                            className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-1"
                          >
                            {uploadingImage === member.id ? (
                              <div className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Camera className="w-3 h-3" />
                                {member.customImageUrl ? 'Change' : 'Upload'}
                              </>
                            )}
                          </button>
                          {member.customImageUrl && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateCustomDisplay?.(member.id, { customImageUrl: '' });
                              }}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-700/20 rounded"
                              title="Remove custom image"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rating mode toggle for all non-captain members */}
                {canEditCustomDisplay(member) && onToggleRatingMode && (
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Rating Source</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          onToggleRatingMode(member.id, 'captain');
                        }}
                        className={`flex-1 px-2 py-1 text-xs rounded ${
                          member.ratingMode === 'captain'
                            ? 'bg-lime-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <Anchor className="w-3 h-3 inline mr-1" />
                        Captain Only
                      </button>
                      <button
                        onClick={() => {
                          onToggleRatingMode(member.id, 'group');
                        }}
                        className={`flex-1 px-2 py-1 text-xs rounded ${
                          member.ratingMode === 'group'
                            ? 'bg-lime-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <Users className="w-3 h-3 inline mr-1" />
                        Group Average
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                      {member.ratingMode === 'captain'
                        ? "Only your rating counts for this item"
                        : "Average of all group ratings"}
                    </p>
                  </div>
                )}

                {/* Co-captain toggle - only visible to original captain for claimed users */}
                {isOriginalCaptain && member.clerkId && !member.isCaptain && onToggleCoCaptain && (
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Co-Captain</p>
                    <button
                      onClick={() => {
                        const isCoCaptain = coCaptainIds.includes(member.clerkId!);
                        onToggleCoCaptain(member.id, member.clerkId!, isCoCaptain);
                      }}
                      className={`w-full px-2 py-1.5 text-xs rounded flex items-center justify-center gap-1 ${
                        coCaptainIds.includes(member.clerkId)
                          ? 'bg-lime-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <Anchor className="w-3 h-3" />
                      {coCaptainIds.includes(member.clerkId) ? 'Remove Co-Captain' : 'Make Co-Captain'}
                    </button>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                      {coCaptainIds.includes(member.clerkId)
                        ? "Has full captain permissions"
                        : "Grant captain permissions to this user"}
                    </p>
                  </div>
                )}

                {/* Claim invite options for placeholder members */}
                {member.status === 'placeholder' && !member.clerkId && (
                  <>
                    <button
                      onClick={() => {
                        onCopyClaimLink?.(member.id);
                        setShowMemberActions(null);
                        setDropdownPosition(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <Link2 className="w-4 h-4" />
                      Copy Claim Link
                    </button>
                    <div className="px-3 py-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Send claim invite to:</p>
                      <div className="flex gap-1">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={() => {
                            if (inviteEmail) {
                              onSendClaimInvite?.(member.id, inviteEmail);
                              setInviteEmail('');
                              setShowMemberActions(null);
                              setDropdownPosition(null);
                            }
                          }}
                          className="p-1 bg-lime-600 text-white rounded hover:bg-lime-600"
                          disabled={!inviteEmail}
                        >
                          <Mail className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Remove item (not for captain) */}
                {!member.isCaptain && (
                  <button
                    onClick={() => {
                      onRemoveMember?.(member.id);
                      setShowMemberActions(null);
                      setDropdownPosition(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-700/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Item
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
