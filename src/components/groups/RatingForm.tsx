'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { GroupMember, GroupObject, Metric, Rating, metricAppliesToObject, getObjectDisplayName, getObjectDisplayImage } from '@/types';
import Slider from '@/components/ui/Slider';
import Avatar from '@/components/ui/Avatar';

interface RatingFormProps {
  objects: GroupObject[];
  members: GroupMember[];
  metrics: Metric[];
  currentUserId: string;
  existingRatings: Rating[];
  onSubmitRating: (metricId: string, targetObjectId: string, value: number) => Promise<void>;
  isCaptain?: boolean;
  isGroupOpen?: boolean;
}

export default function RatingForm({
  objects,
  members,
  metrics,
  currentUserId,
  existingRatings,
  onSubmitRating,
  isCaptain = false,
  isGroupOpen = false,
}: RatingFormProps) {
  const [selectedObject, setSelectedObject] = useState<GroupObject | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Filter to only visible objects
  // If not captain, also exclude objects with ratingMode === 'captain' (captain-only input)
  const rateableObjects = objects.filter(
    (obj) => obj.visibleInGraph &&
      (isCaptain || obj.ratingMode !== 'captain')
  );

  // Get current user's member record to check if they can rate
  const currentMember = members.find((m) => m.clerkId === currentUserId);

  // Filter metrics based on selected object's category
  const applicableMetrics = useMemo(() => {
    if (!selectedObject) return metrics;
    return metrics.filter((metric) => metricAppliesToObject(metric, selectedObject));
  }, [selectedObject, metrics]);

  useEffect(() => {
    if (selectedObject) {
      // Load existing ratings for this object (only for applicable metrics)
      const objectRatings: Record<string, number> = {};
      applicableMetrics.forEach((metric) => {
        const existing = existingRatings.find(
          (r) =>
            r.targetObjectId === selectedObject.id &&
            r.metricId === metric.id &&
            r.raterId === currentUserId
        );
        // Use metric midpoint as default
        const defaultValue = Math.round((metric.minValue + metric.maxValue) / 2);
        objectRatings[metric.id] = existing?.value ?? defaultValue;
      });
      setRatings(objectRatings);
    }
  }, [selectedObject, existingRatings, applicableMetrics, currentUserId]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  // Auto-save rating with debounce
  const autoSaveRating = useCallback(async (metricId: string, objectId: string, value: number) => {
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
    if (selectedObject) {
      saveTimeoutRef.current[metricId] = setTimeout(() => {
        autoSaveRating(metricId, selectedObject.id, value);
      }, 500);
    }
  };

  const handleSaveAllRatings = async () => {
    if (!selectedObject) return;

    // Clear all pending auto-saves
    Object.values(saveTimeoutRef.current).forEach(clearTimeout);
    saveTimeoutRef.current = {};

    setSaving('all');
    try {
      for (const metric of applicableMetrics) {
        await onSubmitRating(metric.id, selectedObject.id, ratings[metric.id]);
      }
    } finally {
      setSaving(null);
    }
  };

  // Check if current user can rate (accepted member OR open group with logged in user)
  const canRate = currentMember?.status === 'accepted' || (isGroupOpen && !!currentUserId);

  if (!canRate) {
    return (
      <div className="p-6 text-center bg-gray-700 rounded-lg">
        <p className="text-gray-400">
          {isGroupOpen
            ? 'You must be signed in to submit ratings.'
            : 'You must be an accepted member of this group to submit ratings.'}
        </p>
      </div>
    );
  }

  // Check if this object is claimed by the current user (for self-rating message)
  const isOwnObject = selectedObject?.claimedByClerkId === currentUserId;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Mobile: Show back button and rating header when object selected */}
      {selectedObject && (
        <div className="sm:hidden">
          <button
            onClick={() => setSelectedObject(null)}
            className="flex items-center gap-1 text-gray-400 hover:text-white mb-3"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          <div className="flex items-center gap-3 mb-3">
            <Avatar
              src={getObjectDisplayImage(selectedObject)}
              alt={getObjectDisplayName(selectedObject)}
              size="md"
            />
            <div>
              <h3 className="text-base font-semibold text-white">
                Rating {getObjectDisplayName(selectedObject)}
              </h3>
              <p className="text-xs text-gray-400">
                Auto-saves as you adjust
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Object selector - hidden on mobile when object selected */}
      <div className={selectedObject ? 'hidden sm:block' : ''}>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Select Item to Rate
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
          {rateableObjects.map((obj) => (
            <button
              key={obj.id}
              onClick={() => setSelectedObject(obj)}
              className={`
                p-2 sm:p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 sm:gap-2
                ${
                  selectedObject?.id === obj.id
                    ? 'border-lime-500 bg-lime-900/30'
                    : 'border-gray-700 hover:border-gray-600'
                }
              `}
            >
              <Avatar
                src={getObjectDisplayImage(obj)}
                alt={getObjectDisplayName(obj)}
                size="md"
              />
              <span className="text-xs sm:text-sm font-medium text-white truncate w-full text-center">
                {getObjectDisplayName(obj)}
              </span>
              {obj.category && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">
                  {obj.category}
                </span>
              )}
              {obj.claimedByClerkId === currentUserId && (
                <span className="text-[10px] sm:text-xs text-lime-400">(You)</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Rating sliders */}
      {selectedObject && (
        <div className="bg-gray-800/50 rounded-lg p-3 sm:p-6 border border-gray-700/50">
          {/* Desktop header - hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4 mb-6 pb-4 border-b border-gray-600">
            <Avatar
              src={getObjectDisplayImage(selectedObject)}
              alt={getObjectDisplayName(selectedObject)}
              size="lg"
            />
            <div>
              <h3 className="text-lg font-semibold text-white">
                Rating {getObjectDisplayName(selectedObject)}
              </h3>
              <p className="text-sm text-gray-400">
                {isOwnObject
                  ? 'Self-rating - ratings auto-save as you adjust'
                  : 'Adjust the sliders to rate - auto-saves as you drag'}
              </p>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {applicableMetrics.length === 0 ? (
              <p className="text-gray-400 text-center py-4">
                No metrics apply to this item.
              </p>
            ) : null}
            {applicableMetrics.map((metric) => {
              const defaultValue = Math.round((metric.minValue + metric.maxValue) / 2);
              return (
                <div key={metric.id} className="space-y-1 sm:space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white text-sm sm:text-base">
                        {metric.name}
                      </div>
                      {metric.description && (
                        <div className="text-xs sm:text-sm text-gray-400 truncate hidden sm:block">
                          {metric.description}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-medium text-white text-sm sm:text-base">
                        {metric.prefix}{ratings[metric.id] ?? defaultValue}{metric.suffix}
                      </span>
                      {saving === metric.id && (
                        <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 hidden sm:block">{metric.prefix}{metric.minValue}{metric.suffix}</span>
                    <Slider
                      value={ratings[metric.id] ?? defaultValue}
                      onChange={(e) => handleRatingChange(metric.id, Number(e.target.value))}
                      min={metric.minValue}
                      max={metric.maxValue}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 hidden sm:block">{metric.prefix}{metric.maxValue}{metric.suffix}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
