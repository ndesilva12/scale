import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Group,
  GroupMember,
  Rating,
  AggregatedScore,
  Invitation,
  ClaimRequest,
  Metric,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Collection references
const groupsCollection = collection(db, 'groups');
const membersCollection = collection(db, 'members');
const ratingsCollection = collection(db, 'ratings');
const invitationsCollection = collection(db, 'invitations');
const claimRequestsCollection = collection(db, 'claimRequests');

// Helper to convert Firestore timestamps
const convertTimestamp = (timestamp: Timestamp | Date | null): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  return timestamp || new Date();
};

// ============ GROUP OPERATIONS ============

export async function createGroup(
  creatorId: string,
  name: string,
  description: string,
  metrics: Omit<Metric, 'id'>[]
): Promise<Group> {
  const groupId = uuidv4();
  const now = new Date();

  const metricsWithIds: Metric[] = metrics.map((m, index) => ({
    ...m,
    id: uuidv4(),
    order: index,
  }));

  const group: Group = {
    id: groupId,
    name,
    description,
    creatorId,
    metrics: metricsWithIds,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(groupsCollection, groupId), {
    ...group,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });

  return group;
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const docSnap = await getDoc(doc(groupsCollection, groupId));
  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    ...data,
    id: docSnap.id,
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt),
  } as Group;
}

export async function getUserGroups(clerkId: string): Promise<Group[]> {
  // Get groups where user is creator
  const creatorQuery = query(groupsCollection, where('creatorId', '==', clerkId));
  const creatorDocs = await getDocs(creatorQuery);

  const groups: Group[] = creatorDocs.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    } as Group;
  });

  // Also get groups where user is a member
  const memberQuery = query(membersCollection, where('clerkId', '==', clerkId), where('status', '==', 'accepted'));
  const memberDocs = await getDocs(memberQuery);

  for (const memberDoc of memberDocs.docs) {
    const memberData = memberDoc.data();
    const groupId = memberData.groupId;

    // Check if we already have this group
    if (!groups.find((g) => g.id === groupId)) {
      const group = await getGroup(groupId);
      if (group) {
        groups.push(group);
      }
    }
  }

  return groups;
}

export async function updateGroup(
  groupId: string,
  updates: Partial<Pick<Group, 'name' | 'description' | 'metrics'>>
): Promise<void> {
  await updateDoc(doc(groupsCollection, groupId), {
    ...updates,
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

export async function deleteGroup(groupId: string): Promise<void> {
  // Delete all related data
  const batch = writeBatch(db);

  // Delete members
  const membersQuery = query(membersCollection, where('groupId', '==', groupId));
  const memberDocs = await getDocs(membersQuery);
  memberDocs.docs.forEach((doc) => batch.delete(doc.ref));

  // Delete ratings
  const ratingsQuery = query(ratingsCollection, where('groupId', '==', groupId));
  const ratingDocs = await getDocs(ratingsQuery);
  ratingDocs.docs.forEach((doc) => batch.delete(doc.ref));

  // Delete invitations
  const invitationsQuery = query(invitationsCollection, where('groupId', '==', groupId));
  const invitationDocs = await getDocs(invitationsQuery);
  invitationDocs.docs.forEach((doc) => batch.delete(doc.ref));

  // Delete group
  batch.delete(doc(groupsCollection, groupId));

  await batch.commit();
}

// ============ MEMBER OPERATIONS ============

export async function addMember(
  groupId: string,
  email: string,
  name: string,
  placeholderImageUrl: string | null = null,
  clerkId: string | null = null,
  status: GroupMember['status'] = 'placeholder'
): Promise<GroupMember> {
  const memberId = uuidv4();
  const now = new Date();

  const member: GroupMember = {
    id: memberId,
    groupId,
    userId: memberId, // For now, same as member ID
    clerkId,
    email,
    name,
    imageUrl: null,
    placeholderImageUrl,
    status,
    invitedAt: now,
    respondedAt: null,
  };

  await setDoc(doc(membersCollection, memberId), {
    ...member,
    invitedAt: Timestamp.fromDate(now),
    respondedAt: null,
  });

  return member;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const q = query(membersCollection, where('groupId', '==', groupId));
  const docs = await getDocs(q);

  return docs.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      invitedAt: convertTimestamp(data.invitedAt),
      respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
    } as GroupMember;
  });
}

export async function getMember(memberId: string): Promise<GroupMember | null> {
  const docSnap = await getDoc(doc(membersCollection, memberId));
  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    ...data,
    id: docSnap.id,
    invitedAt: convertTimestamp(data.invitedAt),
    respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
  } as GroupMember;
}

export async function updateMember(
  memberId: string,
  updates: Partial<GroupMember>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...updates };
  if (updates.respondedAt) {
    updateData.respondedAt = Timestamp.fromDate(updates.respondedAt);
  }
  await updateDoc(doc(membersCollection, memberId), updateData);
}

export async function removeMember(memberId: string): Promise<void> {
  // Delete member and their ratings
  const batch = writeBatch(db);

  // Delete ratings where this member is the target
  const targetRatingsQuery = query(ratingsCollection, where('targetMemberId', '==', memberId));
  const targetRatingDocs = await getDocs(targetRatingsQuery);
  targetRatingDocs.docs.forEach((doc) => batch.delete(doc.ref));

  // Delete the member
  batch.delete(doc(membersCollection, memberId));

  await batch.commit();
}

// ============ RATING OPERATIONS ============

export async function submitRating(
  groupId: string,
  metricId: string,
  raterId: string,
  targetMemberId: string,
  value: number
): Promise<Rating> {
  // Check if rating already exists
  const existingQuery = query(
    ratingsCollection,
    where('groupId', '==', groupId),
    where('metricId', '==', metricId),
    where('raterId', '==', raterId),
    where('targetMemberId', '==', targetMemberId)
  );
  const existingDocs = await getDocs(existingQuery);

  const now = new Date();
  let rating: Rating;

  if (existingDocs.docs.length > 0) {
    // Update existing rating
    const existingDoc = existingDocs.docs[0];
    rating = {
      ...existingDoc.data(),
      id: existingDoc.id,
      value,
      updatedAt: now,
      createdAt: convertTimestamp(existingDoc.data().createdAt),
    } as Rating;

    await updateDoc(existingDoc.ref, {
      value,
      updatedAt: Timestamp.fromDate(now),
    });
  } else {
    // Create new rating
    const ratingId = uuidv4();
    rating = {
      id: ratingId,
      groupId,
      metricId,
      raterId,
      targetMemberId,
      value,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(ratingsCollection, ratingId), {
      ...rating,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    });
  }

  return rating;
}

export async function getRatings(groupId: string): Promise<Rating[]> {
  const q = query(ratingsCollection, where('groupId', '==', groupId));
  const docs = await getDocs(q);

  return docs.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    } as Rating;
  });
}

export async function getUserRatingsForGroup(
  groupId: string,
  raterId: string
): Promise<Rating[]> {
  const q = query(
    ratingsCollection,
    where('groupId', '==', groupId),
    where('raterId', '==', raterId)
  );
  const docs = await getDocs(q);

  return docs.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    } as Rating;
  });
}

export function calculateAggregatedScores(
  members: GroupMember[],
  metrics: Metric[],
  ratings: Rating[]
): AggregatedScore[] {
  const scores: AggregatedScore[] = [];

  for (const member of members) {
    for (const metric of metrics) {
      const memberRatings = ratings.filter(
        (r) => r.targetMemberId === member.id && r.metricId === metric.id
      );

      const totalRatings = memberRatings.length;
      const averageValue =
        totalRatings > 0
          ? memberRatings.reduce((sum, r) => sum + r.value, 0) / totalRatings
          : 0;

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

// ============ INVITATION OPERATIONS ============

export async function createInvitation(
  groupId: string,
  groupName: string,
  email: string,
  memberId: string,
  invitedBy: string,
  invitedByName: string
): Promise<Invitation> {
  const invitationId = uuidv4();
  const now = new Date();

  const invitation: Invitation = {
    id: invitationId,
    groupId,
    groupName,
    email,
    memberId,
    invitedBy,
    invitedByName,
    status: 'pending',
    createdAt: now,
    respondedAt: null,
  };

  await setDoc(doc(invitationsCollection, invitationId), {
    ...invitation,
    createdAt: Timestamp.fromDate(now),
    respondedAt: null,
  });

  return invitation;
}

export async function getUserInvitations(email: string): Promise<Invitation[]> {
  const q = query(
    invitationsCollection,
    where('email', '==', email),
    where('status', '==', 'pending')
  );
  const docs = await getDocs(q);

  return docs.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: convertTimestamp(data.createdAt),
      respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
    } as Invitation;
  });
}

export async function respondToInvitation(
  invitationId: string,
  accept: boolean,
  clerkId: string,
  imageUrl: string | null
): Promise<void> {
  const invitation = await getDoc(doc(invitationsCollection, invitationId));
  if (!invitation.exists()) throw new Error('Invitation not found');

  const invitationData = invitation.data() as Invitation;
  const now = new Date();

  // Update invitation status
  await updateDoc(doc(invitationsCollection, invitationId), {
    status: accept ? 'accepted' : 'declined',
    respondedAt: Timestamp.fromDate(now),
  });

  // Update member status
  await updateDoc(doc(membersCollection, invitationData.memberId), {
    status: accept ? 'accepted' : 'declined',
    clerkId: accept ? clerkId : null,
    imageUrl: accept ? imageUrl : null,
    respondedAt: Timestamp.fromDate(now),
  });
}

// ============ CLAIM REQUEST OPERATIONS ============

export async function createClaimRequest(
  groupId: string,
  placeholderMemberId: string,
  claimantClerkId: string
): Promise<ClaimRequest> {
  const requestId = uuidv4();
  const now = new Date();

  const request: ClaimRequest = {
    id: requestId,
    groupId,
    placeholderMemberId,
    claimantClerkId,
    status: 'pending',
    createdAt: now,
    respondedAt: null,
  };

  await setDoc(doc(claimRequestsCollection, requestId), {
    ...request,
    createdAt: Timestamp.fromDate(now),
    respondedAt: null,
  });

  return request;
}

export async function getGroupClaimRequests(groupId: string): Promise<ClaimRequest[]> {
  const q = query(
    claimRequestsCollection,
    where('groupId', '==', groupId),
    where('status', '==', 'pending')
  );
  const docs = await getDocs(q);

  return docs.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: convertTimestamp(data.createdAt),
      respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
    } as ClaimRequest;
  });
}

export async function respondToClaimRequest(
  requestId: string,
  approve: boolean,
  claimantName: string,
  claimantImageUrl: string | null
): Promise<void> {
  const request = await getDoc(doc(claimRequestsCollection, requestId));
  if (!request.exists()) throw new Error('Claim request not found');

  const requestData = request.data() as ClaimRequest;
  const now = new Date();

  // Update request status
  await updateDoc(doc(claimRequestsCollection, requestId), {
    status: approve ? 'approved' : 'rejected',
    respondedAt: Timestamp.fromDate(now),
  });

  if (approve) {
    // Update member to link with claimant
    await updateDoc(doc(membersCollection, requestData.placeholderMemberId), {
      status: 'accepted',
      clerkId: requestData.claimantClerkId,
      name: claimantName,
      imageUrl: claimantImageUrl,
      respondedAt: Timestamp.fromDate(now),
    });
  }
}

// ============ REAL-TIME LISTENERS ============

export function subscribeToGroup(
  groupId: string,
  callback: (group: Group | null) => void
): () => void {
  return onSnapshot(doc(groupsCollection, groupId), (doc) => {
    if (!doc.exists()) {
      callback(null);
      return;
    }
    const data = doc.data();
    callback({
      ...data,
      id: doc.id,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    } as Group);
  });
}

export function subscribeToMembers(
  groupId: string,
  callback: (members: GroupMember[]) => void
): () => void {
  const q = query(membersCollection, where('groupId', '==', groupId));
  return onSnapshot(q, (snapshot) => {
    const members = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        invitedAt: convertTimestamp(data.invitedAt),
        respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
      } as GroupMember;
    });
    callback(members);
  });
}

export function subscribeToRatings(
  groupId: string,
  callback: (ratings: Rating[]) => void
): () => void {
  const q = query(ratingsCollection, where('groupId', '==', groupId));
  return onSnapshot(q, (snapshot) => {
    const ratings = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
      } as Rating;
    });
    callback(ratings);
  });
}
