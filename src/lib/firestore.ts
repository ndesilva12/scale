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
  ClaimToken,
  Metric,
  PendingItem,
  createDefaultMetric,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Collection references
const groupsCollection = collection(db, 'groups');
const membersCollection = collection(db, 'members');
const ratingsCollection = collection(db, 'ratings');
const invitationsCollection = collection(db, 'invitations');
const claimRequestsCollection = collection(db, 'claimRequests');
const claimTokensCollection = collection(db, 'claimTokens');
const pendingItemsCollection = collection(db, 'pendingItems');

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
  }));

  const group: Group = {
    id: groupId,
    name,
    description,
    captainId,
    coCaptainIds: [],
    metrics: metricsWithIds,
    defaultYMetricId: metricsWithIds.length > 1 ? metricsWithIds[1].id : (metricsWithIds[0]?.id || null),
    defaultXMetricId: metricsWithIds[0]?.id || null,
    lockedYMetricId: null,
    lockedXMetricId: null,
    captainControlEnabled: false,
    isPublic: true, // Default to public
    isOpen: false, // Default to closed (only members can rate)
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
  }));

  return {
    ...data,
    id: docSnap.id,
    captainId,
    coCaptainIds: data.coCaptainIds ?? [],
    metrics,
    defaultYMetricId: data.defaultYMetricId ?? null,
    defaultXMetricId: data.defaultXMetricId ?? null,
    lockedYMetricId: data.lockedYMetricId ?? null,
    lockedXMetricId: data.lockedXMetricId ?? null,
    captainControlEnabled: data.captainControlEnabled ?? false,
    isPublic: data.isPublic ?? true, // Default to public for backward compatibility
    isOpen: data.isOpen ?? false, // Default to closed for backward compatibility
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt),
  } as Group;
}

export async function getUserGroups(clerkId: string): Promise<Group[]> {
  // Get groups where user is captain (check both old and new field names for backward compatibility)
  const captainQuery = query(groupsCollection, where('captainId', '==', clerkId));
  const creatorQuery = query(groupsCollection, where('creatorId', '==', clerkId));
  // Also get groups where user is a co-captain
  const coCaptainQuery = query(groupsCollection, where('coCaptainIds', 'array-contains', clerkId));

  const [captainDocs, creatorDocs, coCaptainDocs] = await Promise.all([
    getDocs(captainQuery),
    getDocs(creatorQuery),
    getDocs(coCaptainQuery),
  ]);

  const groupMap = new Map<string, Group>();

  // Process all queries and deduplicate
  [...captainDocs.docs, ...creatorDocs.docs, ...coCaptainDocs.docs].forEach((docSnap) => {
    if (groupMap.has(docSnap.id)) return;

    const data = docSnap.data();
    const captainId = data.captainId || data.creatorId;
    const metrics = (data.metrics || []).map((m: Partial<Metric>) => ({
      ...m,
      minValue: m.minValue ?? 0,
      maxValue: m.maxValue ?? 100,
      prefix: m.prefix ?? '',
      suffix: m.suffix ?? '',
    }));

    groupMap.set(docSnap.id, {
      ...data,
      id: docSnap.id,
      captainId,
      coCaptainIds: data.coCaptainIds ?? [],
      metrics,
      defaultYMetricId: data.defaultYMetricId ?? null,
      defaultXMetricId: data.defaultXMetricId ?? null,
      lockedYMetricId: data.lockedYMetricId ?? null,
      lockedXMetricId: data.lockedXMetricId ?? null,
      captainControlEnabled: data.captainControlEnabled ?? false,
      isPublic: data.isPublic ?? true,
      isOpen: data.isOpen ?? false,
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
  updates: Partial<Pick<Group, 'name' | 'description' | 'metrics' | 'defaultYMetricId' | 'defaultXMetricId' | 'lockedYMetricId' | 'lockedXMetricId' | 'captainControlEnabled' | 'coCaptainIds' | 'isPublic' | 'isOpen'>>
): Promise<void> {
  await updateDoc(doc(groupsCollection, groupId), {
    ...updates,
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

// Add a co-captain to a group
export async function addCoCaptain(groupId: string, clerkId: string): Promise<void> {
  await updateDoc(doc(groupsCollection, groupId), {
    coCaptainIds: arrayUnion(clerkId),
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

// Remove a co-captain from a group
export async function removeCoCaptain(groupId: string, clerkId: string): Promise<void> {
  await updateDoc(doc(groupsCollection, groupId), {
    coCaptainIds: arrayRemove(clerkId),
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
  email: string | null,
  name: string,
  placeholderImageUrl: string | null = null,
  clerkId: string | null = null,
  status: GroupMember['status'] = 'placeholder',
  imageUrl: string | null = null,
  isCaptain: boolean = false,
  description: string | null = null
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
    description,
    status,
    visibleInGraph: true,
    isCaptain,
    invitedAt: now,
    respondedAt: isCaptain ? now : null,
    displayMode: 'user', // Default to showing user's actual profile
    customName: null,
    customImageUrl: null,
    ratingMode: 'group', // Default to group average ratings
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
      // Handle new display fields with defaults
      displayMode: data.displayMode ?? 'user',
      customName: data.customName ?? null,
      customImageUrl: data.customImageUrl ?? null,
      ratingMode: data.ratingMode ?? 'group', // Default to group average
    } as GroupMember;
  });

  // Sort so captain is first
  return members.sort((a, b) => (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0));
}

export async function getMember(memberId: string): Promise<GroupMember | null> {
  const docSnap = await getDoc(doc(membersCollection, memberId));
  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  const isCaptain = data.isCaptain ?? data.isCreator ?? false;
  return {
    ...data,
    id: docSnap.id,
    isCaptain,
    invitedAt: convertTimestamp(data.invitedAt),
    respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
    displayMode: data.displayMode ?? 'user',
    customName: data.customName ?? null,
    customImageUrl: data.customImageUrl ?? null,
    ratingMode: data.ratingMode ?? 'group', // Default to group average
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
  ratings: Rating[],
  captainClerkId?: string
): AggregatedScore[] {
  const scores: AggregatedScore[] = [];

  for (const member of members) {
    for (const metric of metrics) {
      let memberRatings = ratings.filter(
        (r) => r.targetMemberId === member.id && r.metricId === metric.id
      );

      // If rating mode is 'captain', only use captain's rating
      if (member.ratingMode === 'captain' && captainClerkId) {
        memberRatings = memberRatings.filter((r) => r.raterId === captainClerkId);
      }
      // Otherwise (ratingMode === 'group'), use all ratings (default behavior)

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
    }));

    callback({
      ...data,
      id: docSnap.id,
      captainId,
      coCaptainIds: data.coCaptainIds ?? [],
      metrics,
      defaultYMetricId: data.defaultYMetricId ?? null,
      defaultXMetricId: data.defaultXMetricId ?? null,
      lockedYMetricId: data.lockedYMetricId ?? null,
      lockedXMetricId: data.lockedXMetricId ?? null,
      captainControlEnabled: data.captainControlEnabled ?? false,
      isPublic: data.isPublic ?? true,
      isOpen: data.isOpen ?? false,
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
        email: data.email ?? null, // Backward compatibility for optional email
        description: data.description ?? null, // Backward compatibility
        visibleInGraph: data.visibleInGraph ?? true,
        isCaptain,
        invitedAt: convertTimestamp(data.invitedAt),
        respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
        // Handle new display fields with defaults
        displayMode: data.displayMode ?? 'user',
        customName: data.customName ?? null,
        customImageUrl: data.customImageUrl ?? null,
        ratingMode: data.ratingMode ?? 'group', // Default to group average
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

// ============ CLAIM TOKEN OPERATIONS ============

export async function createClaimToken(
  groupId: string,
  memberId: string,
  createdBy: string,
  email: string | null = null
): Promise<ClaimToken> {
  const tokenId = uuidv4();
  const token = uuidv4(); // Generate unique claim token
  const now = new Date();

  const claimToken: ClaimToken = {
    id: tokenId,
    groupId,
    memberId,
    email,
    token,
    createdBy,
    status: 'pending',
    createdAt: now,
    claimedAt: null,
    claimedBy: null,
  };

  await setDoc(doc(claimTokensCollection, tokenId), {
    ...claimToken,
    createdAt: Timestamp.fromDate(now),
  });

  return claimToken;
}

export async function getClaimTokenByToken(token: string): Promise<ClaimToken | null> {
  const q = query(claimTokensCollection, where('token', '==', token), where('status', '==', 'pending'));
  const docs = await getDocs(q);

  if (docs.empty) return null;

  const docSnap = docs.docs[0];
  const data = docSnap.data();
  return {
    ...data,
    id: docSnap.id,
    createdAt: convertTimestamp(data.createdAt),
    claimedAt: data.claimedAt ? convertTimestamp(data.claimedAt) : null,
  } as ClaimToken;
}

export async function getClaimTokensForMember(memberId: string): Promise<ClaimToken[]> {
  const q = query(claimTokensCollection, where('memberId', '==', memberId));
  const docs = await getDocs(q);

  return docs.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      createdAt: convertTimestamp(data.createdAt),
      claimedAt: data.claimedAt ? convertTimestamp(data.claimedAt) : null,
    } as ClaimToken;
  });
}

export async function claimProfile(
  token: string,
  clerkId: string,
  name: string,
  imageUrl: string | null
): Promise<{ success: boolean; memberId?: string; groupId?: string; error?: string }> {
  const claimToken = await getClaimTokenByToken(token);

  if (!claimToken) {
    return { success: false, error: 'Invalid or expired claim link' };
  }

  // Check if token is for a specific email
  if (claimToken.email) {
    // We can't verify email here since we don't have access to the user's email
    // The frontend will need to handle this check
  }

  const member = await getMember(claimToken.memberId);
  if (!member) {
    return { success: false, error: 'Member profile not found' };
  }

  if (member.clerkId) {
    return { success: false, error: 'This profile has already been claimed' };
  }

  const now = new Date();

  // Update the member to link to the claiming user
  await updateDoc(doc(membersCollection, claimToken.memberId), {
    clerkId,
    name,
    imageUrl,
    status: 'accepted',
    respondedAt: Timestamp.fromDate(now),
  });

  // Mark the claim token as used
  await updateDoc(doc(claimTokensCollection, claimToken.id), {
    status: 'claimed',
    claimedAt: Timestamp.fromDate(now),
    claimedBy: clerkId,
  });

  return {
    success: true,
    memberId: claimToken.memberId,
    groupId: claimToken.groupId,
  };
}

export async function invalidateClaimToken(tokenId: string): Promise<void> {
  await updateDoc(doc(claimTokensCollection, tokenId), {
    status: 'expired',
  });
}

// ============ PENDING ITEM OPERATIONS ============

export async function submitPendingItem(
  groupId: string,
  name: string,
  description: string | null,
  imageUrl: string | null,
  submittedBy: string,
  submittedByName: string
): Promise<PendingItem> {
  const itemId = uuidv4();
  const now = new Date();

  const pendingItem: PendingItem = {
    id: itemId,
    groupId,
    name,
    description,
    imageUrl,
    submittedBy,
    submittedByName,
    status: 'pending',
    createdAt: now,
    respondedAt: null,
    respondedBy: null,
  };

  await setDoc(doc(pendingItemsCollection, itemId), {
    ...pendingItem,
    createdAt: Timestamp.fromDate(now),
  });

  return pendingItem;
}

export async function getPendingItems(groupId: string): Promise<PendingItem[]> {
  const q = query(
    pendingItemsCollection,
    where('groupId', '==', groupId),
    where('status', '==', 'pending')
  );
  const docs = await getDocs(q);

  return docs.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      createdAt: convertTimestamp(data.createdAt),
      respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
    } as PendingItem;
  });
}

export async function respondToPendingItem(
  itemId: string,
  approve: boolean,
  respondedBy: string,
  groupId: string
): Promise<GroupMember | null> {
  const itemDoc = await getDoc(doc(pendingItemsCollection, itemId));
  if (!itemDoc.exists()) throw new Error('Pending item not found');

  const itemData = itemDoc.data() as PendingItem;
  const now = new Date();

  // Update pending item status
  await updateDoc(doc(pendingItemsCollection, itemId), {
    status: approve ? 'approved' : 'rejected',
    respondedAt: Timestamp.fromDate(now),
    respondedBy,
  });

  if (approve) {
    // Create actual member from pending item
    const member = await addMember(
      groupId,
      null, // email
      itemData.name,
      itemData.imageUrl, // placeholderImageUrl
      null, // clerkId
      'placeholder', // status
      null, // imageUrl
      false, // isCaptain
      itemData.description
    );
    return member;
  }

  return null;
}

export function subscribeToPendingItems(
  groupId: string,
  callback: (items: PendingItem[]) => void
): () => void {
  const q = query(
    pendingItemsCollection,
    where('groupId', '==', groupId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: convertTimestamp(data.createdAt),
        respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
      } as PendingItem;
    });
    callback(items);
  });
}
