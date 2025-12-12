import { Group, GroupMember, Rating, Metric, AggregatedScore } from '@/types';

// Mock metrics for a team
export const mockMetrics: Metric[] = [
  { id: 'metric-1', name: 'Leadership', description: 'Ability to guide and inspire others', order: 0, minValue: 0, maxValue: 100, prefix: '', suffix: '' },
  { id: 'metric-2', name: 'Creativity', description: 'Innovative thinking and problem solving', order: 1, minValue: 0, maxValue: 100, prefix: '', suffix: '' },
  { id: 'metric-3', name: 'Communication', description: 'Clear and effective communication skills', order: 2, minValue: 0, maxValue: 100, prefix: '', suffix: '' },
  { id: 'metric-4', name: 'Reliability', description: 'Dependable and consistent performance', order: 3, minValue: 0, maxValue: 100, prefix: '', suffix: '' },
  { id: 'metric-5', name: 'Technical Skill', description: 'Domain expertise and technical abilities', order: 4, minValue: 0, maxValue: 100, prefix: '', suffix: '' },
];

// Mock group
export const mockGroup: Group = {
  id: 'demo-group-1',
  name: 'Product Team Alpha',
  description: 'Our core product development team for the flagship application',
  captainId: 'demo-user-1',
  metrics: mockMetrics,
  defaultYMetricId: 'metric-2',
  defaultXMetricId: 'metric-1',
  lockedYMetricId: null,
  lockedXMetricId: null,
  captainControlEnabled: false,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-03-01'),
};

// Mock members with profile images from a placeholder service
export const mockMembers: GroupMember[] = [
  {
    id: 'member-1',
    groupId: 'demo-group-1',
    userId: 'member-1',
    clerkId: 'demo-user-1',
    email: 'alex.chen@example.com',
    name: 'Alex Chen',
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&backgroundColor=b6e3f4',
    placeholderImageUrl: null,
    description: 'Team Lead',
    status: 'accepted',
    visibleInGraph: true,
    isCaptain: true,
    invitedAt: new Date('2024-01-15'),
    respondedAt: new Date('2024-01-15'),
    displayMode: 'user',
    customName: null,
    customImageUrl: null,
    ratingMode: 'group',
  },
  {
    id: 'member-2',
    groupId: 'demo-group-1',
    userId: 'member-2',
    clerkId: 'demo-user-2',
    email: 'sarah.johnson@example.com',
    name: 'Sarah Johnson',
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&backgroundColor=ffdfbf',
    placeholderImageUrl: null,
    description: 'UX Designer',
    status: 'accepted',
    visibleInGraph: true,
    isCaptain: false,
    invitedAt: new Date('2024-01-16'),
    respondedAt: new Date('2024-01-17'),
    displayMode: 'user',
    customName: null,
    customImageUrl: null,
    ratingMode: 'group',
  },
  {
    id: 'member-3',
    groupId: 'demo-group-1',
    userId: 'member-3',
    clerkId: 'demo-user-3',
    email: 'marcus.williams@example.com',
    name: 'Marcus Williams',
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&backgroundColor=c0aede',
    placeholderImageUrl: null,
    description: 'Senior Engineer',
    status: 'accepted',
    visibleInGraph: true,
    isCaptain: false,
    invitedAt: new Date('2024-01-16'),
    respondedAt: new Date('2024-01-18'),
    displayMode: 'user',
    customName: null,
    customImageUrl: null,
    ratingMode: 'group',
  },
  {
    id: 'member-4',
    groupId: 'demo-group-1',
    userId: 'member-4',
    clerkId: 'demo-user-4',
    email: 'emily.davis@example.com',
    name: 'Emily Davis',
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily&backgroundColor=d1f4d1',
    placeholderImageUrl: null,
    description: 'Product Manager',
    status: 'accepted',
    visibleInGraph: true,
    isCaptain: false,
    invitedAt: new Date('2024-01-17'),
    respondedAt: new Date('2024-01-19'),
    displayMode: 'user',
    customName: null,
    customImageUrl: null,
    ratingMode: 'group',
  },
  {
    id: 'member-5',
    groupId: 'demo-group-1',
    userId: 'member-5',
    clerkId: 'demo-user-5',
    email: 'james.taylor@example.com',
    name: 'James Taylor',
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James&backgroundColor=ffd5dc',
    placeholderImageUrl: null,
    description: 'QA Engineer',
    status: 'accepted',
    visibleInGraph: true,
    isCaptain: false,
    invitedAt: new Date('2024-01-18'),
    respondedAt: new Date('2024-01-20'),
    displayMode: 'user',
    customName: null,
    customImageUrl: null,
    ratingMode: 'group',
  },
  {
    id: 'member-6',
    groupId: 'demo-group-1',
    userId: 'member-6',
    clerkId: 'demo-user-6',
    email: 'olivia.martinez@example.com',
    name: 'Olivia Martinez',
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Olivia&backgroundColor=fff4c0',
    placeholderImageUrl: null,
    description: 'Frontend Developer',
    status: 'accepted',
    visibleInGraph: true,
    isCaptain: false,
    invitedAt: new Date('2024-01-19'),
    respondedAt: new Date('2024-01-21'),
    displayMode: 'user',
    customName: null,
    customImageUrl: null,
    ratingMode: 'group',
  },
  {
    id: 'member-7',
    groupId: 'demo-group-1',
    userId: 'member-7',
    clerkId: null,
    email: 'pending.user@example.com',
    name: 'Pending User',
    imageUrl: null,
    placeholderImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pending&backgroundColor=e0e0e0',
    description: null,
    status: 'placeholder',
    visibleInGraph: true,
    isCaptain: false,
    invitedAt: new Date('2024-02-01'),
    respondedAt: null,
    displayMode: 'user',
    customName: null,
    customImageUrl: null,
    ratingMode: 'group',
  },
];

// Generate mock ratings - each member rates every other member (including self)
function generateMockRatings(): Rating[] {
  const ratings: Rating[] = [];
  let ratingId = 1;

  // Predefined score ranges for each member to create interesting distributions
  const memberScoreProfiles: Record<string, Record<string, { min: number; max: number }>> = {
    'member-1': { // Alex - Strong leader, moderate technical
      'metric-1': { min: 75, max: 95 },
      'metric-2': { min: 55, max: 75 },
      'metric-3': { min: 70, max: 85 },
      'metric-4': { min: 80, max: 95 },
      'metric-5': { min: 50, max: 70 },
    },
    'member-2': { // Sarah - Creative, great communicator
      'metric-1': { min: 45, max: 65 },
      'metric-2': { min: 80, max: 98 },
      'metric-3': { min: 85, max: 98 },
      'metric-4': { min: 60, max: 75 },
      'metric-5': { min: 55, max: 70 },
    },
    'member-3': { // Marcus - Technical expert, quieter
      'metric-1': { min: 35, max: 55 },
      'metric-2': { min: 60, max: 75 },
      'metric-3': { min: 40, max: 60 },
      'metric-4': { min: 85, max: 98 },
      'metric-5': { min: 90, max: 100 },
    },
    'member-4': { // Emily - Well-rounded
      'metric-1': { min: 60, max: 80 },
      'metric-2': { min: 65, max: 80 },
      'metric-3': { min: 70, max: 85 },
      'metric-4': { min: 70, max: 85 },
      'metric-5': { min: 65, max: 80 },
    },
    'member-5': { // James - Reliable, lower creativity
      'metric-1': { min: 50, max: 70 },
      'metric-2': { min: 30, max: 50 },
      'metric-3': { min: 55, max: 70 },
      'metric-4': { min: 90, max: 100 },
      'metric-5': { min: 70, max: 85 },
    },
    'member-6': { // Olivia - Rising star, high potential
      'metric-1': { min: 55, max: 75 },
      'metric-2': { min: 70, max: 90 },
      'metric-3': { min: 75, max: 90 },
      'metric-4': { min: 65, max: 80 },
      'metric-5': { min: 60, max: 80 },
    },
    'member-7': { // Pending - Only a few ratings from creator
      'metric-1': { min: 50, max: 60 },
      'metric-2': { min: 50, max: 60 },
      'metric-3': { min: 50, max: 60 },
      'metric-4': { min: 50, max: 60 },
      'metric-5': { min: 50, max: 60 },
    },
  };

  const activeMembers = mockMembers.filter(m => m.status === 'accepted');

  // Each active member rates everyone (including self and placeholder)
  for (const rater of activeMembers) {
    for (const target of mockMembers) {
      for (const metric of mockMetrics) {
        const profile = memberScoreProfiles[target.id]?.[metric.id] || { min: 40, max: 60 };
        const value = Math.round(profile.min + Math.random() * (profile.max - profile.min));

        ratings.push({
          id: `rating-${ratingId++}`,
          groupId: 'demo-group-1',
          metricId: metric.id,
          raterId: rater.clerkId!,
          targetMemberId: target.id,
          value,
          createdAt: new Date('2024-02-15'),
          updatedAt: new Date('2024-02-15'),
        });
      }
    }
  }

  return ratings;
}

export const mockRatings = generateMockRatings();

// Calculate aggregated scores from mock ratings
export function calculateMockScores(): AggregatedScore[] {
  const scores: AggregatedScore[] = [];

  for (const member of mockMembers) {
    for (const metric of mockMetrics) {
      const memberRatings = mockRatings.filter(
        (r) => r.targetMemberId === member.id && r.metricId === metric.id
      );

      const totalRatings = memberRatings.length;
      const averageValue =
        totalRatings > 0
          ? memberRatings.reduce((sum, r) => sum + r.value, 0) / totalRatings
          : 50;

      scores.push({
        memberId: member.id,
        metricId: metric.id,
        averageValue,
        totalRatings,
      });
    }
  }

  return scores;
}

export const mockScores = calculateMockScores();
