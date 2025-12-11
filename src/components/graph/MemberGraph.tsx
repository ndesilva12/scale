'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';
import { GroupMember, Metric, AggregatedScore } from '@/types';

interface MemberGraphProps {
  members: GroupMember[];
  metrics: Metric[];
  scores: AggregatedScore[];
  xMetricId: string;
  yMetricId: string;
  onMemberClick: (member: GroupMember) => void;
}

interface TooltipData {
  member: GroupMember;
  xValue: number;
  yValue: number;
  x: number;
  y: number;
}

export default function MemberGraph({
  members,
  metrics,
  scores,
  xMetricId,
  yMetricId,
  onMemberClick,
}: MemberGraphProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const xMetric = metrics.find((m) => m.id === xMetricId);
  const yMetric = metrics.find((m) => m.id === yMetricId);

  // Calculate positions for each member
  const plottedMembers = useMemo(() => {
    return members
      .filter((m) => m.status === 'accepted' || m.status === 'placeholder')
      .map((member) => {
        const xScore = scores.find(
          (s) => s.memberId === member.id && s.metricId === xMetricId
        );
        const yScore = scores.find(
          (s) => s.memberId === member.id && s.metricId === yMetricId
        );

        return {
          member,
          xValue: xScore?.averageValue ?? 50,
          yValue: yScore?.averageValue ?? 50,
        };
      });
  }, [members, scores, xMetricId, yMetricId]);

  const handleMouseEnter = useCallback(
    (data: typeof plottedMembers[0], event: React.MouseEvent) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltip({
        member: data.member,
        xValue: data.xValue,
        yValue: data.yValue,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
      {/* Y-axis label */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 md:pr-4">
        <div className="transform -rotate-90 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-400">
          {yMetric?.name || 'Y Axis'}
        </div>
      </div>

      {/* X-axis label */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-2 md:pt-4">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {xMetric?.name || 'X Axis'}
        </div>
      </div>

      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {/* Vertical grid lines */}
        {[0, 25, 50, 75, 100].map((value) => (
          <line
            key={`v-${value}`}
            x1={`${value}%`}
            y1="0"
            x2={`${value}%`}
            y2="100%"
            stroke="currentColor"
            strokeOpacity={value === 50 ? 0.3 : 0.1}
            className="text-gray-400 dark:text-gray-500"
          />
        ))}
        {/* Horizontal grid lines */}
        {[0, 25, 50, 75, 100].map((value) => (
          <line
            key={`h-${value}`}
            x1="0"
            y1={`${value}%`}
            x2="100%"
            y2={`${value}%`}
            stroke="currentColor"
            strokeOpacity={value === 50 ? 0.3 : 0.1}
            className="text-gray-400 dark:text-gray-500"
          />
        ))}
      </svg>

      {/* Y-axis scale */}
      <div className="absolute left-1 md:left-2 top-0 bottom-0 flex flex-col justify-between py-2 text-xs text-gray-500 dark:text-gray-400">
        <span>100</span>
        <span>75</span>
        <span>50</span>
        <span>25</span>
        <span>0</span>
      </div>

      {/* X-axis scale */}
      <div className="absolute left-0 right-0 bottom-1 md:bottom-2 flex justify-between px-2 text-xs text-gray-500 dark:text-gray-400">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>

      {/* Plotted members */}
      <div className="absolute inset-6 md:inset-8">
        {plottedMembers.map((data) => {
          const imageUrl = data.member.imageUrl || data.member.placeholderImageUrl;

          return (
            <div
              key={data.member.id}
              className="absolute transform -translate-x-1/2 translate-y-1/2 cursor-pointer transition-transform duration-300 ease-out hover:scale-125 hover:z-10"
              style={{
                left: `${data.xValue}%`,
                bottom: `${data.yValue}%`,
              }}
              onMouseEnter={(e) => handleMouseEnter(data, e)}
              onMouseLeave={handleMouseLeave}
              onClick={() => onMemberClick(data.member)}
            >
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-lg bg-gray-200 dark:bg-gray-700">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={data.member.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-5 h-5 md:w-6 md:h-6 text-gray-500 dark:text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
          }}
        >
          <div className="font-semibold">{tooltip.member.name}</div>
          <div className="text-gray-300 text-xs mt-1">
            <div>
              {xMetric?.name}: {tooltip.xValue.toFixed(1)}
            </div>
            <div>
              {yMetric?.name}: {tooltip.yValue.toFixed(1)}
            </div>
          </div>
          <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full">
            <div className="border-8 border-transparent border-t-gray-900 dark:border-t-gray-700" />
          </div>
        </div>
      )}
    </div>
  );
}
