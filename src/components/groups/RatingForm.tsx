'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { GroupMember, Metric, Rating } from '@/types';
import Button from '@/components/ui/Button';
import Slider from '@/components/ui/Slider';
import Avatar from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';

interface RatingFormProps {
  members: GroupMember[];
  metrics: Metric[];
  currentUserId: string;
  existingRatings: Rating[];
  onSubmitRating: (metricId: string, targetMemberId: string, value: number) => Promise<void>;
}

export default function RatingForm({
  members,
  metrics,
  currentUserId,
  existingRatings,
  onSubmitRating,
}: RatingFormProps) {
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Filter to only active members (accepted or placeholder with the current user's clerk ID)
  const activeMembers = members.filter(
    (m) => m.status === 'accepted' || m.status === 'placeholder'
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
      <Card className="p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          You must be an accepted member of this group to submit ratings.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile: Show back button and rating header when member selected */}
      {selectedMember && (
        <div className="sm:hidden">
          <button
            onClick={() => setSelectedMember(null)}
            className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          <div className="flex items-center gap-3 mb-4">
            <Avatar
              src={selectedMember.imageUrl || selectedMember.placeholderImageUrl}
              alt={selectedMember.name}
              size="lg"
            />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Rating {selectedMember.name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Auto-saves as you adjust
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Member selector - hidden on mobile when member selected */}
      <div className={selectedMember ? 'hidden sm:block' : ''}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Select Member to Rate
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {activeMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedMember(member)}
              className={`
                p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                ${
                  selectedMember?.id === member.id
                    ? 'border-lime-600 bg-lime-50 dark:bg-lime-700/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <Avatar
                src={member.imageUrl || member.placeholderImageUrl}
                alt={member.name}
                size="lg"
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate w-full text-center">
                {member.name}
              </span>
              {member.clerkId === currentUserId && (
                <span className="text-xs text-lime-600 dark:text-lime-400">(You)</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Rating sliders */}
      {selectedMember && (
        <Card className="p-4 sm:p-6">
          {/* Desktop header - hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <Avatar
              src={selectedMember.imageUrl || selectedMember.placeholderImageUrl}
              alt={selectedMember.name}
              size="lg"
            />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Rating {selectedMember.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedMember.clerkId === currentUserId
                  ? 'Self-rating - ratings auto-save as you adjust'
                  : 'Adjust the sliders to rate - auto-saves as you drag'}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {metrics.map((metric) => {
              const defaultValue = Math.round((metric.minValue + metric.maxValue) / 2);
              return (
                <div key={metric.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {metric.name}
                      </div>
                      {metric.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {metric.description}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {metric.prefix}{ratings[metric.id] ?? defaultValue}{metric.suffix}
                      </span>
                      {saving === metric.id && (
                        <div className="w-4 h-4 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{metric.prefix}{metric.minValue}{metric.suffix}</span>
                    <Slider
                      value={ratings[metric.id] ?? defaultValue}
                      onChange={(e) => handleRatingChange(metric.id, Number(e.target.value))}
                      min={metric.minValue}
                      max={metric.maxValue}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-400">{metric.prefix}{metric.maxValue}{metric.suffix}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleSaveAllRatings}
              loading={saving === 'all'}
              disabled={saving !== null}
              className="w-full"
            >
              Save All Ratings
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
