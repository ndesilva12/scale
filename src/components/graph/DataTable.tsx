'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Crown, Pencil, Check, X } from 'lucide-react';
import { GroupMember, Metric, AggregatedScore, Rating } from '@/types';
import Avatar from '@/components/ui/Avatar';

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
  isCreator?: boolean;
  onEditMember?: (memberId: string, data: { name: string; email: string }) => Promise<void>;
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
  isCreator = false,
  onEditMember,
}: DataTableProps) {
  const [editingCell, setEditingCell] = useState<{ memberId: string; metricId: string } | null>(null);
  const [editValue, setEditValue] = useState<number>(50);
  const [saving, setSaving] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editMemberData, setEditMemberData] = useState<{ name: string; email: string }>({ name: '', email: '' });

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'accepted' || m.status === 'placeholder'),
    [members]
  );

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

  const getScoreColor = (value: number) => {
    if (value >= 75) return 'text-green-600 dark:text-green-400';
    if (value >= 50) return 'text-blue-600 dark:text-blue-400';
    if (value >= 25) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const handleStartEdit = (memberId: string, metricId: string) => {
    const existingValue = getUserRating(memberId, metricId);
    setEditingCell({ memberId, metricId });
    setEditValue(existingValue ?? 50);
  };

  const handleSaveRating = async () => {
    if (!editingCell || !onSubmitRating) return;

    setSaving(true);
    try {
      await onSubmitRating(editingCell.metricId, editingCell.memberId, editValue);
      setEditingCell(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  const handleStartEditMember = (member: GroupMember) => {
    setEditingMember(member.id);
    setEditMemberData({ name: member.name, email: member.email });
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

  const canEditMember = (member: GroupMember) => {
    // Creator can edit unclaimed (placeholder) members
    return isCreator && member.status === 'placeholder' && !member.clerkId;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {showVisibilityToggle && (
              <th className="text-center py-3 px-2 font-semibold text-gray-900 dark:text-white w-12">
                <Eye className="w-4 h-4 mx-auto text-gray-400" />
              </th>
            )}
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">
              Member
            </th>
            {metrics.map((metric) => (
              <th
                key={metric.id}
                className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white min-w-[120px]"
                title={metric.description}
              >
                <div>{metric.name}</div>
                {canRate && (
                  <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    (click to rate)
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeMembers.map((member) => (
            <tr
              key={member.id}
              className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                !member.visibleInGraph ? 'opacity-50' : ''
              }`}
            >
              {showVisibilityToggle && (
                <td className="py-3 px-2 text-center">
                  <button
                    onClick={() => onToggleVisibility?.(member.id, !member.visibleInGraph)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      member.visibleInGraph
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                    }`}
                    title={member.visibleInGraph ? 'Hide from graph' : 'Show in graph'}
                  >
                    {member.visibleInGraph ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </td>
              )}
              <td className="py-3 px-4 sticky left-0 bg-white dark:bg-gray-900 z-10">
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
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/groups/${groupId}/members/${member.id}`}
                      className="flex items-center gap-3 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      onClick={(e) => {
                        if (onMemberClick) {
                          e.preventDefault();
                          onMemberClick(member);
                        }
                      }}
                    >
                      <Avatar
                        src={member.imageUrl || member.placeholderImageUrl}
                        alt={member.name}
                        size="sm"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                          {member.name}
                          {member.isCreator && (
                            <span title="Group Creator">
                              <Crown className="w-3.5 h-3.5 text-yellow-500" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {member.isCreator ? 'Creator' : member.status === 'placeholder' ? 'Pending' : 'Active'}
                        </div>
                      </div>
                    </Link>
                    {canEditMember(member) && (
                      <button
                        onClick={() => handleStartEditMember(member)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Edit member"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
                    className="py-3 px-4 text-center"
                  >
                    {isEditing ? (
                      <div className="flex flex-col items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={editValue}
                          onChange={(e) => setEditValue(Number(e.target.value))}
                          className="w-full h-2 accent-blue-500"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{editValue}</span>
                          <button
                            onClick={handleSaveRating}
                            disabled={saving}
                            className="p-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`${canRate && onSubmitRating ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-2 -m-2 transition-colors' : ''}`}
                        onClick={() => canRate && onSubmitRating && handleStartEdit(member.id, metric.id)}
                      >
                        <div className={`font-semibold ${getScoreColor(score)}`}>
                          {score.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {count} rating{count !== 1 ? 's' : ''}
                        </div>
                        {userRating !== null && (
                          <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                            Your: {userRating}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {activeMembers.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No members to display
        </div>
      )}
    </div>
  );
}
