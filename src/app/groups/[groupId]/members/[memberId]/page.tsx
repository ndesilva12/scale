'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { ArrowLeft, Mail, Calendar, TrendingUp, AlertCircle, Hand } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import { Group, GroupMember, AggregatedScore, Rating } from '@/types';
import {
  getGroup,
  getMember,
  getGroupMembers,
  getRatings,
  calculateAggregatedScores,
  createClaimRequest,
} from '@/lib/firestore';

export default function MemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const groupId = params.groupId as string;
  const memberId = params.memberId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [member, setMember] = useState<GroupMember | null>(null);
  const [scores, setScores] = useState<AggregatedScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, [groupId, memberId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupData, memberData, membersData, ratingsData] = await Promise.all([
        getGroup(groupId),
        getMember(memberId),
        getGroupMembers(groupId),
        getRatings(groupId),
      ]);

      setGroup(groupData);
      setMember(memberData);

      if (groupData && membersData.length > 0) {
        const calculatedScores = calculateAggregatedScores(
          membersData,
          groupData.metrics,
          ratingsData,
          groupData.captainId
        );
        // Filter to just this member's scores
        setScores(calculatedScores.filter((s) => s.memberId === memberId));
      }
    } catch (error) {
      console.error('Failed to load member data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimMembership = async () => {
    if (!user || !member) return;

    setClaiming(true);
    setClaimError(null);

    try {
      await createClaimRequest(groupId, memberId, user.id);
      setClaimSuccess(true);
    } catch (error) {
      setClaimError('Failed to submit claim request. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  const canClaim =
    member?.status === 'placeholder' &&
    member?.clerkId === null &&
    user &&
    !claimSuccess;

  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-lime-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!group || !member) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-lime-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Member Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This member may have been removed from the group.
            </p>
            <Link href={`/groups/${groupId}`}>
              <Button>Back to Group</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const getScoreForMetric = (metricId: string): number => {
    const score = scores.find((s) => s.metricId === metricId);
    return score?.averageValue ?? 0;
  };

  const getRatingCountForMetric = (metricId: string): number => {
    const score = scores.find((s) => s.metricId === metricId);
    return score?.totalRatings ?? 0;
  };

  const getScoreColor = (value: number) => {
    if (value >= 75) return 'text-green-600 dark:text-green-400';
    if (value >= 50) return 'text-lime-600 dark:text-lime-400';
    if (value >= 25) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-lime-500 dark:text-lime-400';
  };

  const getScoreBgColor = (value: number) => {
    if (value >= 75) return 'bg-green-100 dark:bg-green-900/30';
    if (value >= 50) return 'bg-lime-100 dark:bg-lime-700/30';
    if (value >= 25) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-lime-100 dark:bg-lime-700/30';
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href={`/groups/${groupId}`}
          className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to {group.name}
        </Link>

        {/* Profile header */}
        <Card className="p-6 md:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Avatar
              src={member.imageUrl || member.placeholderImageUrl}
              alt={member.name}
              size="xl"
              className="w-24 h-24"
            />

            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {member.name}
              </h1>

              {member.description && (
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  {member.description}
                </p>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                {member.email && (
                  <>
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {member.email}
                    </span>
                    <span className="hidden sm:inline">•</span>
                  </>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Joined {member.invitedAt.toLocaleDateString()}
                </span>
              </div>

            </div>

            {/* Claim button */}
            {canClaim && (
              <div className="flex flex-col items-center gap-2">
                <Button onClick={handleClaimMembership} loading={claiming}>
                  <Hand className="w-4 h-4 mr-2" />
                  Claim This Item
                </Button>
                {claimError && (
                  <p className="text-sm text-lime-500">{claimError}</p>
                )}
              </div>
            )}

            {claimSuccess && (
              <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-lg text-sm">
                Claim request submitted! Waiting for approval.
              </div>
            )}
          </div>
        </Card>

        {/* Scores */}
        <Card className="p-6 md:p-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Metric Scores
          </h2>

          {group.metrics.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No metrics have been defined for this group yet.
            </p>
          ) : (
            <div className="space-y-4">
              {group.metrics.map((metric) => {
                const score = getScoreForMetric(metric.id);
                const ratingCount = getRatingCountForMetric(metric.id);

                return (
                  <div key={metric.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {metric.name}
                        </span>
                        {metric.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {metric.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
                          {score.toFixed(1)}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {ratingCount} rating{ratingCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getScoreBgColor(score).replace('bg-', 'bg-').replace('/30', '')}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </Card>
      </main>
    </div>
  );
}
