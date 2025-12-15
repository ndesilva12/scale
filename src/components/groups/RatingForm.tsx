'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { GroupMember, Metric, Rating } from '@/types';
import Slider from '@/components/ui/Slider';
import Avatar from '@/components/ui/Avatar';

interface RatingFormProps {
  members: GroupMember[];
  metrics: Metric[];
  currentUserId: string;
  existingRatings: Rating[];
  onSubmitRating: (metricId: string, targetMemberId: string, value: number) => Promise<void>;
  isCaptain?: boolean;
}

export default function RatingForm({
  members,
  metrics,
  currentUserId,
  existingRatings,
  onSubmitRating,
  isCaptain = false,
}: RatingFormProps) {
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Filter to only active members (accepted or placeholder)
  // If not captain, also exclude members with ratingMode === 'captain' (captain-only input)
  const activeMembers = members.filter(
    (m) => (m.status === 'accepted' || m.status === 'placeholder') &&
      (isCaptain || m.ratingMode !== 'captain')
  );

  // Get current user's member record
  const currentMember = members.find((m) => m.clerkId === currentUserId);

  useEffect(() => {
    if (selectedMember) {
      // Load existing ratings for this member
      const memberRatings: Record<string, number> = {};
      metrics.forEach((metric) => {
        const existing = existingRatings.find(
          (r) =>
            r.targetMemberId === selectedMember.id &&
            r.metricId === metric.id &&
            r.raterId === currentUserId
        );
        // Use metric midpoint as default
        const defaultValue = Math.round((metric.minValue + metric.maxValue) / 2);
        memberRatings[metric.id] = existing?.value ?? defaultValue;
      });
      setRatings(memberRatings);
    }
  }, [selectedMember, existingRatings, metrics, currentUserId]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  // Auto-save rating with debounce
  const autoSaveRating = useCallback(async (metricId: string, memberId: string, value: number) => {
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
    if (selectedMember) {
      saveTimeoutRef.current[metricId] = setTimeout(() => {
        autoSaveRating(metricId, selectedMember.id, value);
      }, 500);
    }
  };

  const handleSaveAllRatings = async () => {
    if (!selectedMember) return;

    // Clear all pending auto-saves
    Object.values(saveTimeoutRef.current).forEach(clearTimeout);
    saveTimeoutRef.current = {};

    setSaving('all');
    try {
      for (const metric of metrics) {
        await onSubmitRating(metric.id, selectedMember.id, ratings[metric.id]);
      }
    } finally {
      setSaving(null);
    }
  };

  // Check if current user can rate (must be an accepted member)
  const canRate = currentMember?.status === 'accepted';

  if (!canRate) {
    return (
      <div className="p-6 text-center bg-gray-700 rounded-lg">
        <p className="text-gray-400">
          You must be an accepted member of this group to submit ratings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Mobile: Show back button and rating header when member selected */}
      {selectedMember && (
        <div className="sm:hidden">
          <button
            onClick={() => setSelectedMember(null)}
            className="flex items-center gap-1 text-gray-400 hover:text-white mb-3"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          <div className="flex items-center gap-3 mb-3">
            <Avatar
              src={selectedMember.imageUrl || selectedMember.placeholderImageUrl}
              alt={selectedMember.name}
              size="md"
            />
            <div>
              <h3 className="text-base font-semibold text-white">
                Rating {selectedMember.name}
              </h3>
              <p className="text-xs text-gray-400">
                Auto-saves as you adjust
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Member selector - hidden on mobile when member selected */}
      <div className={selectedMember ? 'hidden sm:block' : ''}>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Select Member to Rate
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
          {activeMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedMember(member)}
              className={`
                p-2 sm:p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 sm:gap-2
                ${
                  selectedMember?.id === member.id
                    ? 'border-lime-500 bg-lime-900/30'
                    : 'border-gray-700 hover:border-gray-600'
                }
              `}
            >
              <Avatar
                src={member.imageUrl || member.placeholderImageUrl}
                alt={member.name}
                size="md"
              />
              <span className="text-xs sm:text-sm font-medium text-white truncate w-full text-center">
                {member.name}
              </span>
              {member.clerkId === currentUserId && (
                <span className="text-[10px] sm:text-xs text-lime-400">(You)</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Rating sliders */}
      {selectedMember && (
        <div className="bg-gray-700 rounded-lg p-3 sm:p-6">
          {/* Desktop header - hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4 mb-6 pb-4 border-b border-gray-600">
            <Avatar
              src={selectedMember.imageUrl || selectedMember.placeholderImageUrl}
              alt={selectedMember.name}
              size="lg"
            />
            <div>
              <h3 className="text-lg font-semibold text-white">
                Rating {selectedMember.name}
              </h3>
              <p className="text-sm text-gray-400">
                {selectedMember.clerkId === currentUserId
                  ? 'Self-rating - ratings auto-save as you adjust'
                  : 'Adjust the sliders to rate - auto-saves as you drag'}
              </p>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {metrics.map((metric) => {
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
