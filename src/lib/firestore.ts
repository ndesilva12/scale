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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import {
  Group,
  GroupMember,
  Rating,
  AggregatedScore,
  Invitation,
  ClaimRequest,
  Metric,
  createDefaultMetric,
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
  captainId: string,
  name: string,
  description: string,
  metrics: Omit<Metric, 'id'>[]
): Promise<Group> {
  const groupId = uuidv4();
  const now = new Date();

  const metricsWithIds: Metric[] = metrics.map((m, index) => ({
    ...m,
    id: uuidv4(),
    order: m.order ?? index,
    minValue: m.minValue ?? 0,
    maxValue: m.maxValue ?? 100,
    prefix: m.prefix ?? '',
    suffix: m.suffix ?? '',
    displayMode: m.displayMode ?? 'scaled',
  }));

  const group: Group = {
    id: groupId,
    name,
    description,
    captainId,
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
  // Handle backward compatibility: creatorId -> captainId
  const captainId = data.captainId || data.creatorId;
  // Ensure metrics have all required fields
  const metrics = (data.metrics || []).map((m: Partial<Metric>) => ({
    ...m,
    minValue: m.minValue ?? 0,
    maxValue: m.maxValue ?? 100,
    prefix: m.prefix ?? '',
    suffix: m.suffix ?? '',
    displayMode: m.displayMode ?? 'scaled',
  }));

  return {
    ...data,
    id: docSnap.id,
    captainId,
    metrics,
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt),
  } as Group;
}

export async function getUserGroups(clerkId: string): Promise<Group[]> {
  // Get groups where user is captain (check both old and new field names for backward compatibility)
  const captainQuery = query(groupsCollection, where('captainId', '==', clerkId));
  const creatorQuery = query(groupsCollection, where('creatorId', '==', clerkId));

  const [captainDocs, creatorDocs] = await Promise.all([
    getDocs(captainQuery),
    getDocs(creatorQuery),
  ]);

  const groupMap = new Map<string, Group>();

  // Process both queries and deduplicate
  [...captainDocs.docs, ...creatorDocs.docs].forEach((docSnap) => {
    if (groupMap.has(docSnap.id)) return;

    const data = docSnap.data();
    const captainId = data.captainId || data.creatorId;
    const metrics = (data.metrics || []).map((m: Partial<Metric>) => ({
      ...m,
      minValue: m.minValue ?? 0,
      maxValue: m.maxValue ?? 100,
      prefix: m.prefix ?? '',
      suffix: m.suffix ?? '',
      displayMode: m.displayMode ?? 'scaled',
    }));

    groupMap.set(docSnap.id, {
      ...data,
      id: docSnap.id,
      captainId,
      metrics,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    } as Group);
  });

  const groups: Group[] = Array.from(groupMap.values());

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
  status: GroupMember['status'] = 'placeholder',
  imageUrl: string | null = null,
  isCaptain: boolean = false
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
    imageUrl,
    placeholderImageUrl,
    status,
    visibleInGraph: true,
    isCaptain,
    invitedAt: now,
    respondedAt: isCaptain ? now : null,
  };

  await setDoc(doc(membersCollection, memberId), {
    ...member,
    invitedAt: Timestamp.fromDate(now),
    respondedAt: isCaptain ? Timestamp.fromDate(now) : null,
  });

  return member;
}

export async function updateMemberVisibility(
  memberId: string,
  visibleInGraph: boolean
): Promise<void> {
  await updateDoc(doc(membersCollection, memberId), { visibleInGraph });
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const q = query(membersCollection, where('groupId', '==', groupId));
  const docs = await getDocs(q);

  const members = docs.docs.map((doc) => {
    const data = doc.data();
    // Handle backward compatibility: isCreator -> isCaptain
    const isCaptain = data.isCaptain ?? data.isCreator ?? false;
    return {
      ...data,
      id: doc.id,
      visibleInGraph: data.visibleInGraph ?? true,
      isCaptain,
      invitedAt: convertTimestamp(data.invitedAt),
      respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
    } as GroupMember;
  });

  // Sort so captain is first
  return members.sort((a, b) => (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0));
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
  return onSnapshot(doc(groupsCollection, groupId), (docSnap) => {
    if (!docSnap.exists()) {
      callback(null);
      return;
    }
    const data = docSnap.data();
    // Handle backward compatibility: creatorId -> captainId
    const captainId = data.captainId || data.creatorId;
    // Ensure metrics have all required fields
    const metrics = (data.metrics || []).map((m: Partial<Metric>) => ({
      ...m,
      minValue: m.minValue ?? 0,
      maxValue: m.maxValue ?? 100,
      prefix: m.prefix ?? '',
      suffix: m.suffix ?? '',
      displayMode: m.displayMode ?? 'scaled',
    }));

    callback({
      ...data,
      id: docSnap.id,
      captainId,
      metrics,
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
      // Handle backward compatibility: isCreator -> isCaptain
      const isCaptain = data.isCaptain ?? data.isCreator ?? false;
      return {
        ...data,
        id: doc.id,
        visibleInGraph: data.visibleInGraph ?? true,
        isCaptain,
        invitedAt: convertTimestamp(data.invitedAt),
        respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
      } as GroupMember;
    });
    // Sort so captain is first
    callback(members.sort((a, b) => (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0)));
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

// ============ IMAGE UPLOAD ============

export async function uploadMemberImage(
  groupId: string,
  file: File
): Promise<string> {
  const fileExtension = file.name.split('.').pop() || 'jpg';
  const fileName = `${uuidv4()}.${fileExtension}`;
  const storageRef = ref(storage, `groups/${groupId}/members/${fileName}`);

  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);

  return downloadUrl;
}
