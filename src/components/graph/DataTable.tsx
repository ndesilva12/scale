'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { GroupMember, Metric, AggregatedScore } from '@/types';
import Avatar from '@/components/ui/Avatar';

interface DataTableProps {
  members: GroupMember[];
  metrics: Metric[];
  scores: AggregatedScore[];
  groupId: string;
  onMemberClick?: (member: GroupMember) => void;
}

export default function DataTable({
  members,
  metrics,
  scores,
  groupId,
  onMemberClick,
}: DataTableProps) {
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">
              Member
            </th>
            {metrics.map((metric) => (
              <th
                key={metric.id}
                className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white min-w-[100px]"
                title={metric.description}
              >
                {metric.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeMembers.map((member) => (
            <tr
              key={member.id}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <td className="py-3 px-4 sticky left-0 bg-white dark:bg-gray-900 z-10">
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
                    <div className="font-medium text-gray-900 dark:text-white">
                      {member.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {member.status === 'placeholder' ? 'Pending' : 'Active'}
                    </div>
                  </div>
                </Link>
              </td>
              {metrics.map((metric) => {
                const score = getScore(member.id, metric.id);
                const count = getRatingCount(member.id, metric.id);

                // Color coding based on score
                const getScoreColor = (value: number) => {
                  if (value >= 75) return 'text-green-600 dark:text-green-400';
                  if (value >= 50) return 'text-blue-600 dark:text-blue-400';
                  if (value >= 25) return 'text-yellow-600 dark:text-yellow-400';
                  return 'text-red-600 dark:text-red-400';
                };

                return (
                  <td
                    key={metric.id}
                    className="py-3 px-4 text-center"
                  >
                    <div className={`font-semibold ${getScoreColor(score)}`}>
                      {score.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {count} rating{count !== 1 ? 's' : ''}
                    </div>
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
