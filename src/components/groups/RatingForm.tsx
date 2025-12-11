'use client';

import { useState, useEffect } from 'react';
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
        memberRatings[metric.id] = existing?.value ?? 50;
      });
      setRatings(memberRatings);
    }
  }, [selectedMember, existingRatings, metrics, currentUserId]);

  const handleRatingChange = (metricId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [metricId]: value }));
  };

  const handleSaveRating = async (metricId: string) => {
    if (!selectedMember) return;

    setSaving(metricId);
    try {
      await onSubmitRating(metricId, selectedMember.id, ratings[metricId]);
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAllRatings = async () => {
    if (!selectedMember) return;

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
      {/* Member selector */}
      <div>
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
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
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
                <span className="text-xs text-blue-600 dark:text-blue-400">(You)</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Rating sliders */}
      {selectedMember && (
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
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
                  ? 'Self-rating'
                  : `Adjust the sliders to rate this member`}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {metrics.map((metric) => (
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSaveRating(metric.id)}
                    loading={saving === metric.id}
                    disabled={saving !== null}
                  >
                    Save
                  </Button>
                </div>
                <Slider
                  value={ratings[metric.id] ?? 50}
                  onChange={(e) => handleRatingChange(metric.id, Number(e.target.value))}
                  min={0}
                  max={100}
                />
              </div>
            ))}
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
