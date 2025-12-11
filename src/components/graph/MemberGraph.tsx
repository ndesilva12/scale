'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { User, ExternalLink, X } from 'lucide-react';
import { GroupMember, Metric, AggregatedScore, Rating } from '@/types';
import Button from '@/components/ui/Button';
import Slider from '@/components/ui/Slider';

interface MemberGraphProps {
  members: GroupMember[];
  metrics: Metric[];
  scores: AggregatedScore[];
  xMetricId: string;
  yMetricId: string;
  onMemberClick: (member: GroupMember) => void;
  currentUserId?: string | null;
  existingRatings?: Rating[];
  onSubmitRating?: (metricId: string, targetMemberId: string, value: number) => Promise<void>;
  canRate?: boolean;
  isCreator?: boolean;
}

interface PopupData {
  member: GroupMember;
  xValue: number;
  yValue: number;
  x: number;
  y: number;
  isPinned: boolean;
}

export default function MemberGraph({
  members,
  metrics,
  scores,
  xMetricId,
  yMetricId,
  onMemberClick,
  currentUserId,
  existingRatings = [],
  onSubmitRating,
  canRate = false,
  isCreator = false,
}: MemberGraphProps) {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Load existing ratings when popup member changes
  useEffect(() => {
    if (popup?.member && currentUserId) {
      const memberRatings: Record<string, number> = {};
      metrics.forEach((metric) => {
        const existing = existingRatings.find(
          (r) =>
            r.targetMemberId === popup.member.id &&
            r.metricId === metric.id &&
            r.raterId === currentUserId
        );
        memberRatings[metric.id] = existing?.value ?? 50;
      });
      setRatings(memberRatings);
    }
  }, [popup?.member?.id, existingRatings, metrics, currentUserId]);

  // Handle click outside to close pinned popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popup?.isPinned && popupRef.current && !popupRef.current.contains(event.target as Node)) {
        // Check if click was on a member avatar
        const target = event.target as HTMLElement;
        if (!target.closest('[data-member-avatar]')) {
          setPopup(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popup?.isPinned]);

  const handleMouseEnter = useCallback(
    (data: typeof plottedMembers[0], event: React.MouseEvent) => {
      // Don't override pinned popup on hover
      if (popup?.isPinned) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      setPopup({
        member: data.member,
        xValue: data.xValue,
        yValue: data.yValue,
        x: rect.left + rect.width / 2 - (containerRect?.left || 0),
        y: rect.top - (containerRect?.top || 0),
        isPinned: false,
      });
    },
    [popup?.isPinned]
  );

  const handleMouseLeave = useCallback(() => {
    // Don't close pinned popup on mouse leave
    if (popup?.isPinned) return;
    setPopup(null);
  }, [popup?.isPinned]);

  const handleClick = useCallback(
    (data: typeof plottedMembers[0], event: React.MouseEvent) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      setPopup({
        member: data.member,
        xValue: data.xValue,
        yValue: data.yValue,
        x: rect.left + rect.width / 2 - (containerRect?.left || 0),
        y: rect.top - (containerRect?.top || 0),
        isPinned: true,
      });
    },
    []
  );

  const handleRatingChange = (metricId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [metricId]: value }));
  };

  const handleSaveRating = async (metricId: string) => {
    if (!popup?.member || !onSubmitRating) return;

    setSaving(metricId);
    try {
      await onSubmitRating(metricId, popup.member.id, ratings[metricId]);
    } finally {
      setSaving(null);
    }
  };

  const handleViewProfile = () => {
    if (popup?.member) {
      onMemberClick(popup.member);
    }
  };

  const handleClosePopup = () => {
    setPopup(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[400px] bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700"
    >
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
              data-member-avatar
              className="absolute transform -translate-x-1/2 translate-y-1/2 cursor-pointer transition-transform duration-300 ease-out hover:scale-125 hover:z-10"
              style={{
                left: `${data.xValue}%`,
                bottom: `${data.yValue}%`,
              }}
              onMouseEnter={(e) => handleMouseEnter(data, e)}
              onMouseLeave={handleMouseLeave}
              onClick={(e) => handleClick(data, e)}
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

      {/* Enhanced Popup */}
      {popup && (
        <div
          ref={popupRef}
          className={`absolute z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 transform -translate-x-1/2 ${
            popup.isPinned ? 'min-w-[280px]' : 'min-w-[200px]'
          }`}
          style={{
            left: popup.x,
            top: Math.max(10, popup.y - (popup.isPinned ? 320 : 100)),
          }}
        >
          {/* Close button for pinned popup */}
          {popup.isPinned && (
            <button
              onClick={handleClosePopup}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}

          <div className="p-4">
            {/* Member info header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                {popup.member.imageUrl || popup.member.placeholderImageUrl ? (
                  <Image
                    src={popup.member.imageUrl || popup.member.placeholderImageUrl || ''}
                    alt={popup.member.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white truncate">
                  {popup.member.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {popup.member.status === 'placeholder' ? 'Pending' : 'Active'}
                </div>
              </div>
            </div>

            {/* Current scores */}
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex justify-between">
                <span>{yMetric?.name}:</span>
                <span className="font-medium text-gray-900 dark:text-white">{popup.yValue.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span>{xMetric?.name}:</span>
                <span className="font-medium text-gray-900 dark:text-white">{popup.xValue.toFixed(1)}</span>
              </div>
            </div>

            {/* Rating inputs - only show when pinned and user can rate */}
            {popup.isPinned && canRate && onSubmitRating && (
              <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Your Ratings:
                </div>
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {metrics.map((metric) => (
                    <div key={metric.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300">{metric.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white w-8 text-right">
                            {ratings[metric.id] ?? 50}
                          </span>
                          <button
                            onClick={() => handleSaveRating(metric.id)}
                            disabled={saving !== null}
                            className="text-xs px-2 py-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
                          >
                            {saving === metric.id ? '...' : 'Save'}
                          </button>
                        </div>
                      </div>
                      <Slider
                        value={ratings[metric.id] ?? 50}
                        onChange={(e) => handleRatingChange(metric.id, Number(e.target.value))}
                        min={0}
                        max={100}
                        className="h-1.5"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View Profile button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleViewProfile}
              className="w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Profile
            </Button>
          </div>

          {/* Arrow pointer */}
          <div
            className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full"
            style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }}
          >
            <div className="border-8 border-transparent border-t-white dark:border-t-gray-800" />
          </div>
        </div>
      )}
    </div>
  );
}
