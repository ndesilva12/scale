'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { User, ExternalLink, X } from 'lucide-react';
import { GroupObject, Metric, AggregatedScore, Rating, getObjectDisplayName, getObjectDisplayImage } from '@/types';
import Button from '@/components/ui/Button';
import Slider from '@/components/ui/Slider';

interface MemberGraphProps {
  objects: GroupObject[];
  metrics: Metric[];
  scores: AggregatedScore[];
  xMetricId: string;
  yMetricId: string;
  onObjectClick: (obj: GroupObject) => void;
  currentUserId?: string | null;
  existingRatings?: Rating[];
  onSubmitRating?: (metricId: string, targetObjectId: string, value: number) => Promise<void>;
  canRate?: boolean;
  isCaptain?: boolean;
}

interface PopupData {
  object: GroupObject;
  xValue: number;
  yValue: number;
  x: number;
  y: number;
  isPinned: boolean;
}

export default function MemberGraph({
  objects,
  metrics,
  scores,
  xMetricId,
  yMetricId,
  onObjectClick,
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

  // Calculate positions for each object
  const plottedObjects = useMemo(() => {
    const visibleObjects = objects.filter((obj) => obj.visibleInGraph);
    const totalObjects = visibleObjects.length;

    return visibleObjects.map((obj, index) => {
      // When axis is "none" (empty string), spread objects evenly
      let xValue: number;
      let yValue: number;
      let xRaw: number;
      let yRaw: number;

      if (!xMetricId) {
        // No X axis - spread horizontally
        xValue = totalObjects > 1 ? (index / (totalObjects - 1)) * 80 + 10 : 50;
        xRaw = 0;
      } else {
        const xScore = scores.find(
          (s) => s.objectId === obj.id && s.metricId === xMetricId
        );
        xRaw = xScore?.averageValue ?? 50;
        const xMin = xMetric?.minValue ?? 0;
        const xMax = xMetric?.maxValue ?? 100;
        xValue = xMax > xMin ? ((xRaw - xMin) / (xMax - xMin)) * 100 : 50;
      }

      if (!yMetricId) {
        // No Y axis - spread vertically
        yValue = totalObjects > 1 ? (index / (totalObjects - 1)) * 80 + 10 : 50;
        yRaw = 0;
      } else {
        const yScore = scores.find(
          (s) => s.objectId === obj.id && s.metricId === yMetricId
        );
        yRaw = yScore?.averageValue ?? 50;
        const yMin = yMetric?.minValue ?? 0;
        const yMax = yMetric?.maxValue ?? 100;
        yValue = yMax > yMin ? ((yRaw - yMin) / (yMax - yMin)) * 100 : 50;
      }

      return {
        object: obj,
        xValue,
        yValue,
        xRaw,
        yRaw,
      };
    });
  }, [objects, scores, xMetricId, yMetricId, xMetric, yMetric]);

  // Load existing ratings when popup object changes
  useEffect(() => {
    if (popup?.object && currentUserId) {
      const objectRatings: Record<string, number> = {};
      metrics.forEach((metric) => {
        const existing = existingRatings.find(
          (r) =>
            r.targetObjectId === popup.object.id &&
            r.metricId === metric.id &&
            r.raterId === currentUserId
        );
        // Use metric midpoint as default
        const defaultValue = Math.round((metric.minValue + metric.maxValue) / 2);
        objectRatings[metric.id] = existing?.value ?? defaultValue;
      });
      setRatings(objectRatings);
    }
  }, [popup?.object?.id, existingRatings, metrics, currentUserId]);

  // Handle click outside to close pinned popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popup?.isPinned && popupRef.current && !popupRef.current.contains(event.target as Node)) {
        // Check if click was on an object avatar
        const target = event.target as HTMLElement;
        if (!target.closest('[data-object-avatar]')) {
          setPopup(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popup?.isPinned]);

  const handleMouseEnter = useCallback(
    (data: typeof plottedObjects[0], event: React.MouseEvent) => {
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
        object: data.object,
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
    (data: typeof plottedObjects[0], event: React.MouseEvent) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      setPopup({
        object: data.object,
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
  const autoSaveRating = useCallback(async (metricId: string, objectId: string, value: number) => {
    if (!onSubmitRating) return;

    setSaving(metricId);
    try {
      await onSubmitRating(metricId, objectId, value);
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
    if (popup?.object) {
      saveTimeoutRef.current[metricId] = setTimeout(() => {
        autoSaveRating(metricId, popup.object.id, value);
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
    if (popup?.object) {
      onObjectClick(popup.object);
    }
  };

  const handleClosePopup = () => {
    setPopup(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[300px] sm:min-h-[400px] bg-gray-900 rounded-none sm:rounded-xl border border-gray-700/50"
    >
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

      {/* Y-axis scale - metric name at top, numbers below */}
      <div className="absolute left-1 md:left-2 top-0 bottom-0 flex flex-col justify-between py-2 text-xs text-gray-400">
        {yMetricId && (() => {
          const min = yMetric?.minValue ?? 0;
          const max = yMetric?.maxValue ?? 100;
          const range = max - min;
          const prefix = yMetric?.prefix ?? '';
          const suffix = yMetric?.suffix ?? '';
          // Mobile: metric name, 50, 0
          return (
            <>
              <span className="md:hidden text-gray-300 font-medium text-[10px]">{yMetric?.name}</span>
              <span className="md:hidden">{prefix}{Math.round(min + (range * 50 / 100))}{suffix}</span>
              <span className="md:hidden">{prefix}{Math.round(min)}{suffix}</span>
            </>
          );
        })()}
        {yMetricId && (() => {
          const min = yMetric?.minValue ?? 0;
          const max = yMetric?.maxValue ?? 100;
          const range = max - min;
          const prefix = yMetric?.prefix ?? '';
          const suffix = yMetric?.suffix ?? '';
          // Desktop: metric name, 75, 50, 25, 0
          return (
            <>
              <span className="hidden md:block text-gray-300 font-medium">{yMetric?.name}</span>
              <span className="hidden md:block">{prefix}{Math.round(min + (range * 75 / 100))}{suffix}</span>
              <span className="hidden md:block">{prefix}{Math.round(min + (range * 50 / 100))}{suffix}</span>
              <span className="hidden md:block">{prefix}{Math.round(min + (range * 25 / 100))}{suffix}</span>
              <span className="hidden md:block">{prefix}{Math.round(min)}{suffix}</span>
            </>
          );
        })()}
        {/* Show dashes when no Y metric */}
        {!yMetricId && (
          <>
            <span className="md:hidden">-</span>
            <span className="md:hidden">-</span>
            <span className="md:hidden">-</span>
            <span className="hidden md:block">-</span>
            <span className="hidden md:block">-</span>
            <span className="hidden md:block">-</span>
            <span className="hidden md:block">-</span>
            <span className="hidden md:block">-</span>
          </>
        )}
      </div>

      {/* X-axis scale - metric name at right, numbers before */}
      <div className="absolute left-0 right-0 bottom-0.5 md:bottom-2 flex justify-between items-center px-2 text-xs text-gray-400">
        {xMetricId && (() => {
          const min = xMetric?.minValue ?? 0;
          const max = xMetric?.maxValue ?? 100;
          const range = max - min;
          const prefix = xMetric?.prefix ?? '';
          const suffix = xMetric?.suffix ?? '';
          // Mobile: 0, 50, metric name
          return (
            <>
              <span className="md:hidden">{prefix}{Math.round(min)}{suffix}</span>
              <span className="md:hidden">{prefix}{Math.round(min + (range * 50 / 100))}{suffix}</span>
              <span className="md:hidden text-gray-300 font-medium text-[10px]">{xMetric?.name}</span>
            </>
          );
        })()}
        {xMetricId && (() => {
          const min = xMetric?.minValue ?? 0;
          const max = xMetric?.maxValue ?? 100;
          const range = max - min;
          const prefix = xMetric?.prefix ?? '';
          const suffix = xMetric?.suffix ?? '';
          // Desktop: 0, 25, 50, 75, metric name
          return (
            <>
              <span className="hidden md:block">{prefix}{Math.round(min)}{suffix}</span>
              <span className="hidden md:block">{prefix}{Math.round(min + (range * 25 / 100))}{suffix}</span>
              <span className="hidden md:block">{prefix}{Math.round(min + (range * 50 / 100))}{suffix}</span>
              <span className="hidden md:block">{prefix}{Math.round(min + (range * 75 / 100))}{suffix}</span>
              <span className="hidden md:block text-gray-300 font-medium">{xMetric?.name}</span>
            </>
          );
        })()}
        {/* Show dashes when no X metric */}
        {!xMetricId && (
          <>
            <span className="md:hidden">-</span>
            <span className="md:hidden">-</span>
            <span className="md:hidden">-</span>
            <span className="hidden md:block">-</span>
            <span className="hidden md:block">-</span>
            <span className="hidden md:block">-</span>
            <span className="hidden md:block">-</span>
            <span className="hidden md:block">-</span>
          </>
        )}
      </div>

      {/* Plotted objects */}
      <div className="absolute inset-4 sm:inset-6 md:inset-8">
        {plottedObjects.map((data) => {
          const displayImage = getObjectDisplayImage(data.object);
          const displayName = getObjectDisplayName(data.object);

          return (
            <div
              key={data.object.id}
              data-object-avatar
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
      {popup && (() => {
        const containerWidth = containerRef.current?.clientWidth || 300;
        const containerHeight = containerRef.current?.clientHeight || 300;
        const isMobile = containerWidth < 500;
        const popupWidth = isMobile ? (popup.isPinned ? 240 : 180) : (popup.isPinned ? 280 : 200);
        const popupHeight = isMobile ? (popup.isPinned ? 280 : 140) : (popup.isPinned ? 340 : 160);
        const avatarSize = isMobile ? 40 : 48;
        const padding = 10;
        const avatarClearance = avatarSize + 15; // Extra space to not cover avatar

        // Calculate position to place popup to the side of the avatar (not covering it)
        // Try to position to the right first, then left if not enough space
        let leftPos: number;
        let topPos: number;
        let arrowPosition: 'left' | 'right' | 'bottom' = 'bottom';

        const rightSpace = containerWidth - popup.x - avatarSize / 2;
        const leftSpace = popup.x - avatarSize / 2;

        if (!isMobile && rightSpace >= popupWidth + padding) {
          // Position to the right of avatar (desktop only)
          leftPos = popup.x + avatarSize / 2 + padding;
          arrowPosition = 'left';
        } else if (!isMobile && leftSpace >= popupWidth + padding) {
          // Position to the left of avatar (desktop only)
          leftPos = popup.x - avatarSize / 2 - popupWidth - padding;
          arrowPosition = 'right';
        } else {
          // Mobile or not enough horizontal space: position above/below
          leftPos = Math.min(Math.max(popupWidth / 2 + padding, popup.x), containerWidth - popupWidth / 2 - padding);
          arrowPosition = 'bottom';
        }

        // Calculate vertical position
        let showAbove = true;
        if (arrowPosition === 'bottom') {
          // Check if there's enough room above the avatar
          const spaceAbove = popup.y - avatarClearance;
          const spaceBelow = containerHeight - popup.y - avatarSize;

          if (spaceAbove >= popupHeight + padding) {
            // Position above avatar with clearance
            topPos = popup.y - popupHeight - avatarClearance;
            showAbove = true;
          } else if (spaceBelow >= popupHeight + padding) {
            // Not enough space above, position below avatar
            topPos = popup.y + avatarSize + padding;
            showAbove = false;
          } else {
            // Very constrained - position above but allow overflow
            topPos = Math.max(padding, popup.y - popupHeight - avatarClearance);
            showAbove = true;
          }
        } else {
          // Center vertically with avatar, but keep on screen
          const avatarY = popup.y;
          topPos = Math.min(
            Math.max(padding, avatarY - popupHeight / 2),
            containerHeight - popupHeight - padding
          );
        }

        // Determine arrow direction based on position
        const arrowDir = arrowPosition === 'bottom' ? (showAbove ? 'bottom' : 'top') : arrowPosition;

        return (
        <div
          ref={popupRef}
          className={`absolute z-50 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 ${
            popup.isPinned ? 'min-w-[280px] max-w-[90vw]' : 'min-w-[200px] max-w-[85vw]'
          }`}
          style={{
            left: leftPos,
            top: topPos,
            transform: arrowPosition === 'bottom' ? 'translateX(-50%)' : 'none',
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
            {/* Object info header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                {getObjectDisplayImage(popup.object) ? (
                  <Image
                    src={getObjectDisplayImage(popup.object) || ''}
                    alt={getObjectDisplayName(popup.object)}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">
                  {getObjectDisplayName(popup.object)}
                </div>
                {popup.object.description && (
                  <div className="text-xs text-gray-400 truncate">
                    {popup.object.description}
                  </div>
                )}
              </div>
            </div>

            {/* Current scores - show raw values with formatting */}
            <div className="text-sm text-gray-400 mb-3 pb-3 border-b border-gray-700">
              <div className="flex justify-between">
                <span>{yMetric?.name}:</span>
                <span className="font-medium text-white">
                  {formatValue(plottedObjects.find(p => p.object.id === popup.object.id)?.yRaw ?? 0, yMetric)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{xMetric?.name}:</span>
                <span className="font-medium text-white">
                  {formatValue(plottedObjects.find(p => p.object.id === popup.object.id)?.xRaw ?? 0, xMetric)}
                </span>
              </div>
            </div>

            {/* Rating inputs - only show when pinned and user can rate */}
            {popup.isPinned && canRate && onSubmitRating && (
              <div className="mb-3 pb-3 border-b border-gray-700">
                <div className="text-xs font-medium text-gray-400 mb-2">
                  Your Ratings (auto-saves):
                </div>
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {metrics.map((metric) => (
                    <div key={metric.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-300">{metric.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {metric.prefix}{ratings[metric.id] ?? Math.round((metric.minValue + metric.maxValue) / 2)}{metric.suffix}
                          </span>
                          {saving === metric.id && (
                            <div className="w-3 h-3 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" />
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

          {/* Arrow pointer - changes based on position */}
          {arrowDir === 'bottom' && (
            <div
              className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full"
              style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }}
            >
              <div className="border-8 border-transparent border-t-gray-800" />
            </div>
          )}
          {arrowDir === 'top' && (
            <div
              className="absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-full"
              style={{ filter: 'drop-shadow(0 -1px 1px rgba(0,0,0,0.1))' }}
            >
              <div className="border-8 border-transparent border-b-gray-800" />
            </div>
          )}
          {arrowDir === 'left' && (
            <div
              className="absolute left-0 top-1/2 transform -translate-x-full -translate-y-1/2"
              style={{ filter: 'drop-shadow(-1px 0 1px rgba(0,0,0,0.1))' }}
            >
              <div className="border-8 border-transparent border-r-gray-800" />
            </div>
          )}
          {arrowDir === 'right' && (
            <div
              className="absolute right-0 top-1/2 transform translate-x-full -translate-y-1/2"
              style={{ filter: 'drop-shadow(1px 0 1px rgba(0,0,0,0.1))' }}
            >
              <div className="border-8 border-transparent border-l-gray-800" />
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}
