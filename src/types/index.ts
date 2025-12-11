// Core data types for the Loyalty application

export interface User {
  id: string;
  clerkId: string | null; // null if placeholder user
  email: string;
  name: string;
  imageUrl: string | null;
  placeholderImageUrl: string | null; // Set by group creator for unregistered users
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  creatorId: string; // Clerk user ID
  metrics: Metric[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Metric {
  id: string;
  name: string;
  description: string;
  order: number; // For display ordering
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string; // Can be a placeholder user ID or actual user ID
  clerkId: string | null; // null if placeholder
  email: string;
  name: string;
  imageUrl: string | null;
  placeholderImageUrl: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'placeholder';
  invitedAt: Date;
  respondedAt: Date | null;
}

export interface Rating {
  id: string;
  groupId: string;
  metricId: string;
  raterId: string; // Who is giving the rating (Clerk ID)
  targetMemberId: string; // Who is being rated (GroupMember ID)
  value: number; // 0-100
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
