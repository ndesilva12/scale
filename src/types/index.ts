// Core data types for the Loyalty application

export type MetricPrefix = '' | '#' | '$' | '€' | '£';
export type MetricSuffix = '' | '%' | 'K' | 'M' | 'B' | 'T' | ' thousand' | ' million' | ' billion' | ' trillion';

export interface User {
  id: string;
  clerkId: string | null; // null if placeholder user
  email: string;
  name: string;
  imageUrl: string | null;
  placeholderImageUrl: string | null; // Set by group captain for unregistered users
  bio: string | null; // User's personal bio/description
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  captainId: string; // Clerk user ID of the group captain
  coCaptainIds: string[]; // Clerk user IDs of co-captains (have same permissions as captain)
  metrics: Metric[];
  itemCategories: string[]; // Available categories for items (e.g., ["Player", "Team"] or ["Actor", "Movie"])
  defaultYMetricId: string | null; // Default Y-axis metric (can be changed by viewer)
  defaultXMetricId: string | null; // Default X-axis metric (can be changed by viewer)
  lockedYMetricId: string | null; // If set, this metric is locked as the Y-axis (cannot be changed)
  lockedXMetricId: string | null; // If set, this metric is locked as the X-axis (cannot be changed)
  captainControlEnabled: boolean; // If true, captain can always edit member display (name/image) even after claimed
  isPublic: boolean; // If true, anyone can view the group; if false, only members can view
  isOpen: boolean; // If true, anyone can rate; if false, only members can rate (and Rate tab is hidden)
  isFeatured: boolean; // If true, can appear in Popular/Trending sections
  // Popularity tracking
  viewCount: number;
  ratingCount: number;
  shareCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Metric {
  id: string;
  name: string;
  description: string;
  order: number; // For display ordering
  minValue: number; // Default 0
  maxValue: number; // Default 100, max 1,000,000
  prefix: MetricPrefix; // e.g., '$', '#'
  suffix: MetricSuffix; // e.g., '%', 'K', 'M'
  applicableCategories: string[]; // Which item categories this metric applies to (empty = all items)
}

export type MemberDisplayMode = 'user' | 'custom';
export type MemberRatingMode = 'captain' | 'group'; // 'captain' = only captain's rating counts, 'group' = average of all ratings
export type ItemType = 'text' | 'link' | 'user'; // Type of item in the group

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string; // Can be a placeholder user ID or actual user ID
  clerkId: string | null; // null if placeholder
  email: string | null; // Optional - not every member needs to be a real user
  name: string;
  imageUrl: string | null;
  placeholderImageUrl: string | null;
  description: string | null; // Short description set by captain
  status: 'pending' | 'accepted' | 'declined' | 'placeholder';
  visibleInGraph: boolean; // Whether to show this member in the graph visualization
  isCaptain: boolean; // Whether this member is the group captain
  invitedAt: Date;
  respondedAt: Date | null;
  // Item type - determines what kind of item this is
  itemType: ItemType; // 'text' = simple item, 'link' = has URL, 'user' = claimable by a user
  linkUrl: string | null; // URL for link-type items
  // Item category - determines which metrics apply to this item
  itemCategory: string | null; // e.g., "Player", "Team", "Actor", "Movie" (null = all metrics apply)
  // Captain-controlled display settings
  displayMode: MemberDisplayMode; // 'user' = show actual profile, 'custom' = show captain-set values
  customName: string | null; // Captain-set display name (used when displayMode is 'custom')
  customImageUrl: string | null; // Captain-set display image (used when displayMode is 'custom')
  // Rating mode - determines how scores are calculated for this member
  ratingMode: MemberRatingMode; // 'captain' = only captain's rating, 'group' = average of all ratings
}

export interface Rating {
  id: string;
  groupId: string;
  metricId: string;
  raterId: string; // Who is giving the rating (Clerk ID)
  targetMemberId: string; // Who is being rated (GroupMember ID)
  value: number; // Between metric's minValue and maxValue
  createdAt: Date;
  updatedAt: Date;
}

export interface AggregatedScore {
  memberId: string;
  metricId: string;
  averageValue: number;
  totalRatings: number;
}

export interface ClaimRequest {
  id: string;
  groupId: string;
  placeholderMemberId: string; // The placeholder they want to claim
  claimantClerkId: string; // Who is trying to claim
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  respondedAt: Date | null;
}

export interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  email: string;
  memberId: string; // The member record created for this invite
  invitedBy: string; // Clerk ID of inviter
  invitedByName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  respondedAt: Date | null;
}

export interface ClaimToken {
  id: string;
  groupId: string;
  memberId: string; // The placeholder member to claim
  email: string | null; // Target email (null if shareable link)
  token: string; // Unique token for the claim link
  createdBy: string; // Captain's clerk ID
  status: 'pending' | 'claimed' | 'expired';
  createdAt: Date;
  claimedAt: Date | null;
  claimedBy: string | null; // Clerk ID of who claimed it
}

// Pending item submitted by non-captain, awaiting approval
export interface PendingItem {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  submittedBy: string; // Clerk ID of who submitted it
  submittedByName: string; // Name of submitter for display
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  respondedAt: Date | null;
  respondedBy: string | null; // Clerk ID of captain who responded
}

// Graph visualization types
export interface PlottedMember {
  member: GroupMember;
  xValue: number;
  yValue: number;
  xMetric: Metric;
  yMetric: Metric;
}

export interface GraphConfig {
  xMetricId: string;
  yMetricId: string;
}

// Form types
export interface CreateGroupForm {
  name: string;
  description: string;
  metrics: Omit<Metric, 'id'>[];
}

export interface AddMemberForm {
  email: string;
  name: string;
  placeholderImageUrl?: string;
}

export interface RatingForm {
  metricId: string;
  targetMemberId: string;
  value: number;
}

// Helper function to create default metric values
export const createDefaultMetric = (name: string, description: string, order: number, applicableCategories: string[] = []): Omit<Metric, 'id'> => ({
  name,
  description,
  order,
  minValue: 0,
  maxValue: 100,
  prefix: '',
  suffix: '',
  applicableCategories,
});

// Helper to check if a metric applies to an item based on its category
export const metricAppliesToItem = (metric: Metric, item: GroupMember): boolean => {
  // If metric has no category restrictions, it applies to all items
  if (!metric.applicableCategories || metric.applicableCategories.length === 0) {
    return true;
  }
  // If item has no category, all metrics apply
  if (!item.itemCategory) {
    return true;
  }
  // Check if item's category is in the metric's applicable categories
  return metric.applicableCategories.includes(item.itemCategory);
};

// Helper to format metric value with prefix/suffix
export const formatMetricValue = (value: number, metric: Metric): string => {
  return `${metric.prefix}${value}${metric.suffix}`;
};

// Helper to get display name for a member (respects displayMode)
export const getMemberDisplayName = (member: GroupMember): string => {
  if (member.displayMode === 'custom' && member.customName) {
    return member.customName;
  }
  return member.name;
};

// Helper to get display image for a member (respects displayMode)
export const getMemberDisplayImage = (member: GroupMember): string | null => {
  if (member.displayMode === 'custom' && member.customImageUrl) {
    return member.customImageUrl;
  }
  return member.imageUrl || member.placeholderImageUrl;
};
