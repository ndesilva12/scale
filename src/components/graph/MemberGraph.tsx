'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { User, ExternalLink, X } from 'lucide-react';
import { GroupMember, Metric, AggregatedScore, Rating, getMemberDisplayName, getMemberDisplayImage } from '@/types';
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
  isCaptain?: boolean;
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
  isCaptain = false,
}: MemberGraphProps) {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOverPopupRef = useRef(false);

  const xMetric = xMetricId ? metrics.find((m) => m.id === xMetricId) : null;
  const yMetric = yMetricId ? metrics.find((m) => m.id === yMetricId) : null;

  // Helper to format metric value with prefix/suffix
  const formatValue = (value: number, metric: Metric | undefined | null): string => {
    if (!metric) return value.toFixed(1);
    return `${metric.prefix}${value.toFixed(1)}${metric.suffix}`;
  };

  // Calculate positions for each member
  const plottedMembers = useMemo(() => {
    const activeMembers = members.filter((m) => m.status === 'accepted' || m.status === 'placeholder');
    const totalMembers = activeMembers.length;

    return activeMembers.map((member, index) => {
      // When axis is "none" (empty string), spread members evenly
      let xValue: number;
      let yValue: number;
      let xRaw: number;
      let yRaw: number;

      if (!xMetricId) {
        // No X axis - spread horizontally
        xValue = totalMembers > 1 ? (index / (totalMembers - 1)) * 80 + 10 : 50;
        xRaw = 0;
      } else {
        const xScore = scores.find(
          (s) => s.memberId === member.id && s.metricId === xMetricId
        );
        xRaw = xScore?.averageValue ?? 50;
        const xMin = xMetric?.minValue ?? 0;
        const xMax = xMetric?.maxValue ?? 100;
        xValue = xMax > xMin ? ((xRaw - xMin) / (xMax - xMin)) * 100 : 50;
      }

      if (!yMetricId) {
        // No Y axis - spread vertically
        yValue = totalMembers > 1 ? (index / (totalMembers - 1)) * 80 + 10 : 50;
        yRaw = 0;
      } else {
        const yScore = scores.find(
          (s) => s.memberId === member.id && s.metricId === yMetricId
        );
        yRaw = yScore?.averageValue ?? 50;
        const yMin = yMetric?.minValue ?? 0;
        const yMax = yMetric?.maxValue ?? 100;
        yValue = yMax > yMin ? ((yRaw - yMin) / (yMax - yMin)) * 100 : 50;
      }

      return {
        member,
        xValue,
        yValue,
        xRaw,
        yRaw,
      };
    });
  }, [members, scores, xMetricId, yMetricId, xMetric, yMetric]);

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
        // Use metric midpoint as default
        const defaultValue = Math.round((metric.minValue + metric.maxValue) / 2);
        memberRatings[metric.id] = existing?.value ?? defaultValue;
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

      // Clear any pending close timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }

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

    // Use a small delay to allow mouse to move to popup
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isOverPopupRef.current) {
        setPopup(null);
      }
    }, 100);
  }, [popup?.isPinned]);

  const handlePopupMouseEnter = useCallback(() => {
    isOverPopupRef.current = true;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handlePopupMouseLeave = useCallback(() => {
    isOverPopupRef.current = false;
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

  // Auto-save rating with debounce
  const autoSaveRating = useCallback(async (metricId: string, memberId: string, value: number) => {
    if (!onSubmitRating) return;

    setSaving(metricId);
    try {
      await onSubmitRating(metricId, memberId, value);
    } finally {
      setSaving(null);
    }
  }, [onSubmitRating]);

  const handleRatingChange = (metricId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [metricId]: value }));

    // Clear any existing timeout for this metric
    if (saveTimeoutRef.current[metricId]) {
      clearTimeout(saveTimeoutRef.current[metricId]);
    }

    // Set new timeout for auto-save (500ms debounce)
    if (popup?.member) {
      saveTimeoutRef.current[metricId] = setTimeout(() => {
        autoSaveRating(metricId, popup.member.id, value);
      }, 500);
    }
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimeoutRef.current).forEach(clearTimeout);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

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
      {/* Y-axis label - hidden on mobile, shown on larger screens */}
      <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 md:pr-4">
        <div className="transform -rotate-90 whitespace-nowrap">
          <span className={`px-3 py-1.5 rounded-full text-sm md:text-base font-semibold border ${
            yMetricId
              ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-400/20 dark:to-cyan-400/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700'
          }`}>
            {yMetric?.name || (yMetricId ? 'Y Axis' : 'None')}
          </span>
        </div>
      </div>

      {/* X-axis label - hidden on mobile, shown on larger screens */}
      <div className="hidden md:block absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-2 md:pt-4">
        <span className={`px-3 py-1.5 rounded-full text-sm md:text-base font-semibold border ${
          xMetricId
            ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-400/20 dark:to-teal-400/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700'
        }`}>
          {xMetric?.name || (xMetricId ? 'X Axis' : 'None')}
        </span>
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

      {/* Y-axis scale with inline label on mobile */}
      <div className="absolute left-1 md:left-2 top-0 bottom-0 flex flex-col justify-between py-2 text-xs text-gray-500 dark:text-gray-400">
        {/* Mobile Y-axis label inline */}
        <span className={`md:hidden text-[10px] font-semibold truncate max-w-[3rem] ${yMetricId ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
          {yMetric?.name || (yMetricId ? 'Y' : '-')}
        </span>
        {yMetricId && (() => {
          const min = yMetric?.minValue ?? 0;
          const max = yMetric?.maxValue ?? 100;
          const range = max - min;
          const prefix = yMetric?.prefix ?? '';
          const suffix = yMetric?.suffix ?? '';
          // Show fewer values on mobile (top, middle, bottom)
          return [100, 50, 0].map((pct) => (
            <span key={pct} className="md:hidden">{prefix}{Math.round(min + (range * pct / 100))}{suffix}</span>
          ));
        })()}
        {yMetricId && (() => {
          const min = yMetric?.minValue ?? 0;
          const max = yMetric?.maxValue ?? 100;
          const range = max - min;
          const prefix = yMetric?.prefix ?? '';
          const suffix = yMetric?.suffix ?? '';
          // Show all values on desktop
          return [100, 75, 50, 25, 0].map((pct) => (
            <span key={pct} className="hidden md:block">{prefix}{Math.round(min + (range * pct / 100))}{suffix}</span>
          ));
        })()}
      </div>

      {/* X-axis scale with inline label on mobile */}
      <div className="absolute left-0 right-0 bottom-1 md:bottom-2 flex justify-between items-center px-2 text-xs text-gray-500 dark:text-gray-400">
        {xMetricId && (() => {
          const min = xMetric?.minValue ?? 0;
          const max = xMetric?.maxValue ?? 100;
          const range = max - min;
          const prefix = xMetric?.prefix ?? '';
          const suffix = xMetric?.suffix ?? '';
          // Show fewer values on mobile
          return [0, 50, 100].map((pct) => (
            <span key={pct} className="md:hidden">{prefix}{Math.round(min + (range * pct / 100))}{suffix}</span>
          ));
        })()}
        {xMetricId && (() => {
          const min = xMetric?.minValue ?? 0;
          const max = xMetric?.maxValue ?? 100;
          const range = max - min;
          const prefix = xMetric?.prefix ?? '';
          const suffix = xMetric?.suffix ?? '';
          // Show all values on desktop
          return [0, 25, 50, 75, 100].map((pct) => (
            <span key={pct} className="hidden md:block">{prefix}{Math.round(min + (range * pct / 100))}{suffix}</span>
          ));
        })()}
        {/* Mobile X-axis label inline */}
        <span className={`md:hidden text-[10px] font-semibold truncate max-w-[3rem] ${xMetricId ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
          {xMetric?.name || (xMetricId ? 'X' : '-')}
        </span>
      </div>

      {/* Plotted members */}
      <div className="absolute inset-6 md:inset-8">
        {plottedMembers.map((data) => {
          const displayImage = getMemberDisplayImage(data.member);
          const displayName = getMemberDisplayName(data.member);

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
                {displayImage ? (
                  <Image
                    src={displayImage}
                    alt={displayName}
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
          className={`absolute z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 ${
            popup.isPinned ? 'min-w-[280px] max-w-[90vw]' : 'min-w-[200px] max-w-[85vw]'
          }`}
          style={{
            // Calculate left position, clamping to stay within screen bounds
            left: Math.min(
              Math.max(popup.isPinned ? 140 : 100, popup.x),
              (containerRef.current?.clientWidth || 300) - (popup.isPinned ? 140 : 100)
            ),
            transform: 'translateX(-50%)',
            // Position popup above the avatar so it doesn't cover the icon
            top: Math.max(10, popup.y - (popup.isPinned ? 340 : (typeof window !== 'undefined' && window.innerWidth >= 768 ? 160 : 120))),
          }}
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
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
                {getMemberDisplayImage(popup.member) ? (
                  <Image
                    src={getMemberDisplayImage(popup.member) || ''}
                    alt={getMemberDisplayName(popup.member)}
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
                  {getMemberDisplayName(popup.member)}
                </div>
                {popup.member.description && (
                  <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                    {popup.member.description}
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {popup.member.status === 'placeholder' ? 'Pending' : 'Active'}
                </div>
              </div>
            </div>

            {/* Current scores - show raw values with formatting */}
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex justify-between">
                <span>{yMetric?.name}:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatValue(plottedMembers.find(p => p.member.id === popup.member.id)?.yRaw ?? 0, yMetric)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{xMetric?.name}:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatValue(plottedMembers.find(p => p.member.id === popup.member.id)?.xRaw ?? 0, xMetric)}
                </span>
              </div>
            </div>

            {/* Rating inputs - only show when pinned and user can rate */}
            {popup.isPinned && canRate && onSubmitRating && (
              <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Your Ratings (auto-saves):
                </div>
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {metrics.map((metric) => (
                    <div key={metric.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300">{metric.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {metric.prefix}{ratings[metric.id] ?? Math.round((metric.minValue + metric.maxValue) / 2)}{metric.suffix}
                          </span>
                          {saving === metric.id && (
                            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                      </div>
                      <Slider
                        value={ratings[metric.id] ?? Math.round((metric.minValue + metric.maxValue) / 2)}
                        onChange={(e) => handleRatingChange(metric.id, Number(e.target.value))}
                        min={metric.minValue}
                        max={metric.maxValue}
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
