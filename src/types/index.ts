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

// ============ OBJECTS (things to rate in a group) ============
export type ObjectType = 'text' | 'link' | 'user'; // 'user' = can be claimed by a real user
export type ObjectRatingMode = 'captain' | 'group'; // 'captain' = only captain's rating, 'group' = average of all ratings

export interface GroupObject {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  imageUrl: string | null; // Display image for the object
  objectType: ObjectType; // 'text' = simple, 'link' = has URL, 'user' = claimable profile
  linkUrl: string | null; // URL for link-type objects
  category: string | null; // e.g., "Player", "Team" - determines default metrics
  // Metric overrides - captain can turn any metric on/off for any object
  disabledMetricIds: string[]; // Metric IDs explicitly disabled (overrides category defaults)
  enabledMetricIds: string[]; // Metric IDs explicitly enabled (overrides category defaults)
  visibleInGraph: boolean; // Whether to show in graph visualization
  ratingMode: ObjectRatingMode; // How scores are calculated
  // For 'user' type objects - claim info
  claimedByClerkId: string | null; // Clerk ID of user who claimed this object
  claimedByName: string | null; // Name shown after claim
  claimedByImageUrl: string | null; // Image shown after claim
  claimStatus: 'unclaimed' | 'pending' | 'claimed'; // Claim state
  createdAt: Date;
  updatedAt: Date;
}

// ============ MEMBERS (users who belong to a group) ============
// 'follower' is for public groups - they see it in "My Groups" but aren't actual members
export type MemberRole = 'captain' | 'co-captain' | 'member' | 'follower';
export type MemberStatus = 'pending' | 'accepted' | 'declined';

export interface GroupMember {
  id: string;
  groupId: string;
  clerkId: string; // Always a real user
  email: string;
  name: string;
  imageUrl: string | null;
  role: MemberRole;
  status: MemberStatus;
  invitedAt: Date;
  respondedAt: Date | null;
}

export interface Rating {
  id: string;
  groupId: string;
  metricId: string;
  raterId: string; // Who is giving the rating (Clerk ID)
  targetObjectId: string; // The object being rated (GroupObject ID)
  value: number; // Between metric's minValue and maxValue
  createdAt: Date;
  updatedAt: Date;
}

export interface AggregatedScore {
  objectId: string;
  metricId: string;
  averageValue: number;
  totalRatings: number;
}

export interface ClaimRequest {
  id: string;
  groupId: string;
  objectId: string; // The user-type object they want to claim
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
  invitedBy: string; // Clerk ID of inviter
  invitedByName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  respondedAt: Date | null;
}

export interface ClaimToken {
  id: string;
  groupId: string;
  objectId: string; // The user-type object to claim
  email: string | null; // Target email (null if shareable link)
  token: string; // Unique token for the claim link
  createdBy: string; // Captain's clerk ID
  status: 'pending' | 'claimed' | 'expired';
  createdAt: Date;
  claimedAt: Date | null;
  claimedBy: string | null; // Clerk ID of who claimed it
}

// Pending object submitted by non-captain, awaiting approval
export interface PendingObject {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  objectType: ObjectType;
  linkUrl: string | null;
  category: string | null;
  submittedBy: string; // Clerk ID of who submitted it
  submittedByName: string; // Name of submitter for display
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  respondedAt: Date | null;
  respondedBy: string | null; // Clerk ID of captain who responded
}

// Graph visualization types
export interface PlottedObject {
  object: GroupObject;
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

export interface AddObjectForm {
  name: string;
  description?: string;
  imageUrl?: string;
  objectType: ObjectType;
  linkUrl?: string;
  category?: string;
}

export interface RatingForm {
  metricId: string;
  targetObjectId: string;
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

// Helper to check if a metric applies to an object based on its category and per-object settings
// Order of precedence: explicit disable > explicit enable > category-based default
export const metricAppliesToObject = (metric: Metric, obj: GroupObject): boolean => {
  // 1. Check if metric is explicitly disabled for this object
  if (obj.disabledMetricIds && obj.disabledMetricIds.includes(metric.id)) {
    return false;
  }
  // 2. Check if metric is explicitly enabled for this object (overrides category)
  if (obj.enabledMetricIds && obj.enabledMetricIds.includes(metric.id)) {
    return true;
  }
  // 3. Fall back to category-based defaults
  // If metric has no category restrictions, it applies to all objects
  if (!metric.applicableCategories || metric.applicableCategories.length === 0) {
    return true;
  }
  // If object has no category, all metrics apply
  if (!obj.category) {
    return true;
  }
  // Check if object's category is in the metric's applicable categories
  return metric.applicableCategories.includes(obj.category);
};

// Helper to format metric value with prefix/suffix
export const formatMetricValue = (value: number, metric: Metric): string => {
  return `${metric.prefix}${value}${metric.suffix}`;
};

// Helper to get display name for an object (uses claimed name if claimed, otherwise object name)
export const getObjectDisplayName = (obj: GroupObject): string => {
  if (obj.objectType === 'user' && obj.claimStatus === 'claimed' && obj.claimedByName) {
    return obj.claimedByName;
  }
  return obj.name;
};

// Helper to get display image for an object (uses claimed image if claimed)
export const getObjectDisplayImage = (obj: GroupObject): string | null => {
  if (obj.objectType === 'user' && obj.claimStatus === 'claimed' && obj.claimedByImageUrl) {
    return obj.claimedByImageUrl;
  }
  return obj.imageUrl;
};

// Helper to check if a user can rate in a group based on group settings and membership
export const canUserRate = (
  group: Group,
  userClerkId: string | null,
  members: GroupMember[]
): boolean => {
  // If group is open, anyone can rate (even non-logged-in users could rate if we allowed it)
  if (group.isOpen) {
    return userClerkId !== null; // Just need to be logged in
  }
  // If group is closed, must be a member
  if (!userClerkId) return false;
  // Captain and co-captains can always rate
  if (group.captainId === userClerkId || group.coCaptainIds.includes(userClerkId)) {
    return true;
  }
  // Check if user is an accepted member
  return members.some(m => m.clerkId === userClerkId && m.status === 'accepted');
};

// Helper to check if a user can view a group
export const canUserView = (
  group: Group,
  userClerkId: string | null,
  members: GroupMember[]
): boolean => {
  // Public groups can be viewed by anyone
  if (group.isPublic) {
    return true;
  }
  // Private groups require membership
  if (!userClerkId) return false;
  // Captain and co-captains can always view
  if (group.captainId === userClerkId || group.coCaptainIds.includes(userClerkId)) {
    return true;
  }
  // Check if user is an accepted member
  return members.some(m => m.clerkId === userClerkId && m.status === 'accepted');
};
