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
  GroupObject,
  GroupMember,
  Rating,
  AggregatedScore,
  Invitation,
  ClaimRequest,
  ClaimToken,
  Metric,
  PendingObject,
  ObjectType,
  ObjectRatingMode,
  MemberRole,
  createDefaultMetric,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Collection references
const groupsCollection = collection(db, 'groups');
const objectsCollection = collection(db, 'objects'); // Things to rate in groups
const membersCollection = collection(db, 'members'); // Users who belong to groups
const ratingsCollection = collection(db, 'ratings');
const invitationsCollection = collection(db, 'invitations');
const claimRequestsCollection = collection(db, 'claimRequests');
const claimTokensCollection = collection(db, 'claimTokens');
const pendingObjectsCollection = collection(db, 'pendingObjects');

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
    applicableCategories: m.applicableCategories ?? [],
  }));

  const group: Group = {
    id: groupId,
    name,
    description,
    captainId,
    coCaptainIds: [],
    metrics: metricsWithIds,
    itemCategories: [], // Default to no categories
    defaultYMetricId: metricsWithIds.length > 1 ? metricsWithIds[1].id : (metricsWithIds[0]?.id || null),
    defaultXMetricId: metricsWithIds[0]?.id || null,
    lockedYMetricId: null,
    lockedXMetricId: null,
    captainControlEnabled: false,
    isPublic: true, // Default to public
    isOpen: false, // Default to closed (only members can rate)
    isFeatured: false, // Default to not featured
    viewCount: 0,
    ratingCount: 0,
    shareCount: 0,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(groupsCollection, groupId), {
    ...group,
    lastActivityAt: Timestamp.fromDate(now),
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
    applicableCategories: m.applicableCategories ?? [],
  }));

  return {
    ...data,
    id: docSnap.id,
    captainId,
    coCaptainIds: data.coCaptainIds ?? [],
    metrics,
    itemCategories: data.itemCategories ?? [],
    defaultYMetricId: data.defaultYMetricId ?? null,
    defaultXMetricId: data.defaultXMetricId ?? null,
    lockedYMetricId: data.lockedYMetricId ?? null,
    lockedXMetricId: data.lockedXMetricId ?? null,
    captainControlEnabled: data.captainControlEnabled ?? false,
    isPublic: data.isPublic ?? true,
    isOpen: data.isOpen ?? false,
    isFeatured: data.isFeatured ?? false,
    viewCount: data.viewCount ?? 0,
    ratingCount: data.ratingCount ?? 0,
    shareCount: data.shareCount ?? 0,
    lastActivityAt: convertTimestamp(data.lastActivityAt ?? data.updatedAt ?? data.createdAt),
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
      applicableCategories: m.applicableCategories ?? [],
    }));

    groupMap.set(docSnap.id, {
      ...data,
      id: docSnap.id,
      captainId,
      coCaptainIds: data.coCaptainIds ?? [],
      metrics,
      itemCategories: data.itemCategories ?? [],
      defaultYMetricId: data.defaultYMetricId ?? null,
      defaultXMetricId: data.defaultXMetricId ?? null,
      lockedYMetricId: data.lockedYMetricId ?? null,
      lockedXMetricId: data.lockedXMetricId ?? null,
      captainControlEnabled: data.captainControlEnabled ?? false,
      isPublic: data.isPublic ?? true,
      isOpen: data.isOpen ?? false,
      isFeatured: data.isFeatured ?? false,
      viewCount: data.viewCount ?? 0,
      ratingCount: data.ratingCount ?? 0,
      shareCount: data.shareCount ?? 0,
      lastActivityAt: convertTimestamp(data.lastActivityAt ?? data.updatedAt ?? data.createdAt),
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
  updates: Partial<Pick<Group, 'name' | 'description' | 'metrics' | 'itemCategories' | 'defaultYMetricId' | 'defaultXMetricId' | 'lockedYMetricId' | 'lockedXMetricId' | 'captainControlEnabled' | 'coCaptainIds' | 'isPublic' | 'isOpen' | 'isFeatured' | 'lastActivityAt'>>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...updates, updatedAt: Timestamp.fromDate(new Date()) };

  // Convert lastActivityAt Date to Timestamp if provided
  if (updates.lastActivityAt) {
    updateData.lastActivityAt = Timestamp.fromDate(updates.lastActivityAt);
  }

  await updateDoc(doc(groupsCollection, groupId), updateData);
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

// ============ OBJECT OPERATIONS (things to rate) ============

export async function addObject(
  groupId: string,
  name: string,
  description: string | null = null,
  imageUrl: string | null = null,
  objectType: ObjectType = 'text',
  linkUrl: string | null = null,
  category: string | null = null,
  ratingMode: ObjectRatingMode = 'group'
): Promise<GroupObject> {
  const objectId = uuidv4();
  const now = new Date();

  const obj: GroupObject = {
    id: objectId,
    groupId,
    name,
    description,
    imageUrl,
    objectType,
    linkUrl,
    category,
    disabledMetricIds: [],
    enabledMetricIds: [],
    visibleInGraph: true,
    ratingMode,
    claimedByClerkId: null,
    claimedByName: null,
    claimedByImageUrl: null,
    claimStatus: 'unclaimed',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(objectsCollection, objectId), {
    ...obj,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });

  return obj;
}

export async function getGroupObjects(groupId: string): Promise<GroupObject[]> {
  const q = query(objectsCollection, where('groupId', '==', groupId));
  const docs = await getDocs(q);

  return docs.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      groupId: data.groupId,
      name: data.name,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      objectType: data.objectType ?? 'text',
      linkUrl: data.linkUrl ?? null,
      category: data.category ?? null,
      disabledMetricIds: data.disabledMetricIds ?? [],
      enabledMetricIds: data.enabledMetricIds ?? [],
      visibleInGraph: data.visibleInGraph ?? true,
      ratingMode: data.ratingMode ?? 'group',
      claimedByClerkId: data.claimedByClerkId ?? null,
      claimedByName: data.claimedByName ?? null,
      claimedByImageUrl: data.claimedByImageUrl ?? null,
      claimStatus: data.claimStatus ?? 'unclaimed',
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    } as GroupObject;
  });
}

export async function getObject(objectId: string): Promise<GroupObject | null> {
  const docSnap = await getDoc(doc(objectsCollection, objectId));
  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    groupId: data.groupId,
    name: data.name,
    description: data.description ?? null,
    imageUrl: data.imageUrl ?? null,
    objectType: data.objectType ?? 'text',
    linkUrl: data.linkUrl ?? null,
    category: data.category ?? null,
    disabledMetricIds: data.disabledMetricIds ?? [],
      enabledMetricIds: data.enabledMetricIds ?? [],
    visibleInGraph: data.visibleInGraph ?? true,
    ratingMode: data.ratingMode ?? 'group',
    claimedByClerkId: data.claimedByClerkId ?? null,
    claimedByName: data.claimedByName ?? null,
    claimedByImageUrl: data.claimedByImageUrl ?? null,
    claimStatus: data.claimStatus ?? 'unclaimed',
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt),
  } as GroupObject;
}

export async function updateObject(
  objectId: string,
  updates: Partial<GroupObject>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...updates };
  updateData.updatedAt = Timestamp.fromDate(new Date());
  await updateDoc(doc(objectsCollection, objectId), updateData);
}

export async function updateObjectVisibility(
  objectId: string,
  visibleInGraph: boolean
): Promise<void> {
  await updateDoc(doc(objectsCollection, objectId), {
    visibleInGraph,
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

export async function removeObject(objectId: string): Promise<void> {
  const batch = writeBatch(db);

  // Delete ratings for this object
  const ratingsQuery = query(ratingsCollection, where('targetObjectId', '==', objectId));
  const ratingDocs = await getDocs(ratingsQuery);
  ratingDocs.docs.forEach((docRef) => batch.delete(docRef.ref));

  // Delete the object
  batch.delete(doc(objectsCollection, objectId));

  await batch.commit();
}

export function subscribeToObjects(
  groupId: string,
  callback: (objects: GroupObject[]) => void
): () => void {
  const q = query(objectsCollection, where('groupId', '==', groupId));
  return onSnapshot(q, (snapshot) => {
    const objects = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        groupId: data.groupId,
        name: data.name,
        description: data.description ?? null,
        imageUrl: data.imageUrl ?? null,
        objectType: data.objectType ?? 'text',
        linkUrl: data.linkUrl ?? null,
        category: data.category ?? null,
        disabledMetricIds: data.disabledMetricIds ?? [],
      enabledMetricIds: data.enabledMetricIds ?? [],
        visibleInGraph: data.visibleInGraph ?? true,
        ratingMode: data.ratingMode ?? 'group',
        claimedByClerkId: data.claimedByClerkId ?? null,
        claimedByName: data.claimedByName ?? null,
        claimedByImageUrl: data.claimedByImageUrl ?? null,
        claimStatus: data.claimStatus ?? 'unclaimed',
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
      } as GroupObject;
    });
    callback(objects);
  });
}

// ============ MEMBER OPERATIONS (users in groups) ============

export async function addMember(
  groupId: string,
  clerkId: string,
  email: string,
  name: string,
  imageUrl: string | null = null,
  role: MemberRole = 'follower',
  status: 'pending' | 'accepted' = 'pending'
): Promise<GroupMember> {
  const memberId = uuidv4();
  const now = new Date();

  const member: GroupMember = {
    id: memberId,
    groupId,
    clerkId,
    email,
    name,
    imageUrl,
    role,
    status,
    invitedAt: now,
    respondedAt: status === 'accepted' ? now : null,
  };

  await setDoc(doc(membersCollection, memberId), {
    ...member,
    invitedAt: Timestamp.fromDate(now),
    respondedAt: status === 'accepted' ? Timestamp.fromDate(now) : null,
  });

  return member;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const q = query(membersCollection, where('groupId', '==', groupId));
  const docs = await getDocs(q);

  const members = docs.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      groupId: data.groupId,
      clerkId: data.clerkId,
      email: data.email,
      name: data.name,
      imageUrl: data.imageUrl ?? null,
      role: data.role ?? (data.isCaptain ? 'captain' : 'follower'),
      status: data.status === 'placeholder' ? 'accepted' : (data.status ?? 'accepted'),
      invitedAt: convertTimestamp(data.invitedAt),
      respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
    } as GroupMember;
  });

  // Sort: captain first, then co-captains, then followers
  const roleOrder: Record<string, number> = { captain: 0, 'co-captain': 1, follower: 2 };
  return members.sort((a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3));
}

export async function getMember(memberId: string): Promise<GroupMember | null> {
  const docSnap = await getDoc(doc(membersCollection, memberId));
  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    groupId: data.groupId,
    clerkId: data.clerkId,
    email: data.email,
    name: data.name,
    imageUrl: data.imageUrl ?? null,
    role: data.role ?? (data.isCaptain ? 'captain' : 'follower'),
    status: data.status === 'placeholder' ? 'accepted' : (data.status ?? 'accepted'),
    invitedAt: convertTimestamp(data.invitedAt),
    respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
  } as GroupMember;
}

export async function getMemberByClerkId(groupId: string, clerkId: string): Promise<GroupMember | null> {
  const q = query(
    membersCollection,
    where('groupId', '==', groupId),
    where('clerkId', '==', clerkId)
  );
  const docs = await getDocs(q);
  if (docs.empty) return null;

  const docSnap = docs.docs[0];
  const data = docSnap.data();
  return {
    id: docSnap.id,
    groupId: data.groupId,
    clerkId: data.clerkId,
    email: data.email,
    name: data.name,
    imageUrl: data.imageUrl ?? null,
    role: data.role ?? (data.isCaptain ? 'captain' : 'follower'),
    status: data.status === 'placeholder' ? 'accepted' : (data.status ?? 'accepted'),
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
  await deleteDoc(doc(membersCollection, memberId));
}

// Follow a public group (adds to My Groups without becoming a member)
export async function followGroup(
  groupId: string,
  clerkId: string,
  email: string,
  name: string,
  imageUrl: string | null = null
): Promise<GroupMember> {
  // Check if already following or member
  const existing = await getMemberByClerkId(groupId, clerkId);
  if (existing) {
    return existing;
  }

  return addMember(groupId, clerkId, email, name, imageUrl, 'follower', 'accepted');
}

// Unfollow a public group
export async function unfollowGroup(groupId: string, clerkId: string): Promise<void> {
  const member = await getMemberByClerkId(groupId, clerkId);
  if (member && member.role === 'follower') {
    await removeMember(member.id);
  }
}

// Check if user is following a group
export async function isFollowingGroup(groupId: string, clerkId: string): Promise<boolean> {
  const member = await getMemberByClerkId(groupId, clerkId);
  return member !== null && member.role === 'follower';
}

// ============ RATING OPERATIONS ============

export async function submitRating(
  groupId: string,
  metricId: string,
  raterId: string,
  targetObjectId: string,
  value: number
): Promise<Rating> {
  // Check if rating already exists
  const existingQuery = query(
    ratingsCollection,
    where('groupId', '==', groupId),
    where('metricId', '==', metricId),
    where('raterId', '==', raterId),
    where('targetObjectId', '==', targetObjectId)
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
      targetObjectId,
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

  return docs.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      groupId: data.groupId,
      metricId: data.metricId,
      raterId: data.raterId,
      targetObjectId: data.targetObjectId ?? data.targetMemberId, // Backward compat
      value: data.value,
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

  return docs.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      groupId: data.groupId,
      metricId: data.metricId,
      raterId: data.raterId,
      targetObjectId: data.targetObjectId ?? data.targetMemberId, // Backward compat
      value: data.value,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    } as Rating;
  });
}

export function calculateAggregatedScores(
  objects: GroupObject[],
  metrics: Metric[],
  ratings: Rating[],
  captainClerkId?: string
): AggregatedScore[] {
  const scores: AggregatedScore[] = [];

  for (const obj of objects) {
    for (const metric of metrics) {
      let objectRatings = ratings.filter(
        (r) => r.targetObjectId === obj.id && r.metricId === metric.id
      );

      // If rating mode is 'captain', only use captain's rating
      if (obj.ratingMode === 'captain' && captainClerkId) {
        objectRatings = objectRatings.filter((r) => r.raterId === captainClerkId);
      }
      // Otherwise (ratingMode === 'group'), use all ratings (default behavior)

      const totalRatings = objectRatings.length;
      const averageValue =
        totalRatings > 0
          ? objectRatings.reduce((sum, r) => sum + r.value, 0) / totalRatings
          : 0;

      scores.push({
        objectId: obj.id,
        metricId: metric.id,
        averageValue,
        totalRatings,
      });
    }
  }

  return scores;
}

// ============ INVITATION OPERATIONS (for group membership) ============

export async function createInvitation(
  groupId: string,
  groupName: string,
  email: string,
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

  return docs.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      groupId: data.groupId,
      groupName: data.groupName,
      email: data.email,
      invitedBy: data.invitedBy,
      invitedByName: data.invitedByName,
      status: data.status,
      createdAt: convertTimestamp(data.createdAt),
      respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
    } as Invitation;
  });
}

export async function respondToInvitation(
  invitationId: string,
  accept: boolean,
  clerkId: string,
  email: string,
  name: string,
  imageUrl: string | null
): Promise<void> {
  const invitation = await getDoc(doc(invitationsCollection, invitationId));
  if (!invitation.exists()) throw new Error('Invitation not found');

  const invitationData = invitation.data();
  const now = new Date();

  // Update invitation status
  await updateDoc(doc(invitationsCollection, invitationId), {
    status: accept ? 'accepted' : 'declined',
    respondedAt: Timestamp.fromDate(now),
  });

  if (accept) {
    // Create member record for the user
    await addMember(
      invitationData.groupId,
      clerkId,
      email,
      name,
      imageUrl,
      'follower',
      'accepted'
    );
  }
}

// ============ CLAIM REQUEST OPERATIONS (for claiming user-type objects) ============

export async function createClaimRequest(
  groupId: string,
  objectId: string,
  claimantClerkId: string
): Promise<ClaimRequest> {
  const requestId = uuidv4();
  const now = new Date();

  const request: ClaimRequest = {
    id: requestId,
    groupId,
    objectId,
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

  // Update object claim status to pending
  await updateObject(objectId, { claimStatus: 'pending' });

  return request;
}

export async function getGroupClaimRequests(groupId: string): Promise<ClaimRequest[]> {
  const q = query(
    claimRequestsCollection,
    where('groupId', '==', groupId),
    where('status', '==', 'pending')
  );
  const docs = await getDocs(q);

  return docs.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      groupId: data.groupId,
      objectId: data.objectId ?? data.placeholderMemberId, // Backward compat
      claimantClerkId: data.claimantClerkId,
      status: data.status,
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

  const requestData = request.data();
  const objectId = requestData.objectId ?? requestData.placeholderMemberId;
  const now = new Date();

  // Update request status
  await updateDoc(doc(claimRequestsCollection, requestId), {
    status: approve ? 'approved' : 'rejected',
    respondedAt: Timestamp.fromDate(now),
  });

  if (approve) {
    // Update object to link with claimant
    await updateObject(objectId, {
      claimStatus: 'claimed',
      claimedByClerkId: requestData.claimantClerkId,
      claimedByName: claimantName,
      claimedByImageUrl: claimantImageUrl,
    });
  } else {
    // Reset claim status
    await updateObject(objectId, { claimStatus: 'unclaimed' });
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
      applicableCategories: m.applicableCategories ?? [],
    }));

    callback({
      ...data,
      id: docSnap.id,
      captainId,
      coCaptainIds: data.coCaptainIds ?? [],
      metrics,
      itemCategories: data.itemCategories ?? [],
      defaultYMetricId: data.defaultYMetricId ?? null,
      defaultXMetricId: data.defaultXMetricId ?? null,
      lockedYMetricId: data.lockedYMetricId ?? null,
      lockedXMetricId: data.lockedXMetricId ?? null,
      captainControlEnabled: data.captainControlEnabled ?? false,
      isPublic: data.isPublic ?? true,
      isOpen: data.isOpen ?? false,
      isFeatured: data.isFeatured ?? false,
      viewCount: data.viewCount ?? 0,
      ratingCount: data.ratingCount ?? 0,
      shareCount: data.shareCount ?? 0,
      lastActivityAt: convertTimestamp(data.lastActivityAt ?? data.updatedAt ?? data.createdAt),
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
    const members = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        groupId: data.groupId,
        clerkId: data.clerkId,
        email: data.email,
        name: data.name,
        imageUrl: data.imageUrl ?? null,
        role: data.role ?? (data.isCaptain ? 'captain' : 'follower'),
        status: data.status === 'placeholder' ? 'accepted' : (data.status ?? 'accepted'),
        invitedAt: convertTimestamp(data.invitedAt),
        respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
      } as GroupMember;
    });
    // Sort: captain first, then co-captains, then followers
    const roleOrder: Record<string, number> = { captain: 0, 'co-captain': 1, follower: 2 };
    callback(members.sort((a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3)));
  });
}

// ============ PUBLIC GROUPS (POPULAR/TRENDING) ============

// Get all public groups
export async function getPublicGroups(): Promise<Group[]> {
  const q = query(
    groupsCollection,
    where('isPublic', '==', true)
  );
  const docs = await getDocs(q);

  const groups = docs.docs.map((docSnap) => {
    const data = docSnap.data();
    const captainId = data.captainId || data.creatorId;
    const metrics = (data.metrics || []).map((m: Partial<Metric>) => ({
      ...m,
      minValue: m.minValue ?? 0,
      maxValue: m.maxValue ?? 100,
      prefix: m.prefix ?? '',
      suffix: m.suffix ?? '',
      applicableCategories: m.applicableCategories ?? [],
    }));

    return {
      ...data,
      id: docSnap.id,
      captainId,
      coCaptainIds: data.coCaptainIds ?? [],
      metrics,
      itemCategories: data.itemCategories ?? [],
      defaultYMetricId: data.defaultYMetricId ?? null,
      defaultXMetricId: data.defaultXMetricId ?? null,
      lockedYMetricId: data.lockedYMetricId ?? null,
      lockedXMetricId: data.lockedXMetricId ?? null,
      captainControlEnabled: data.captainControlEnabled ?? false,
      isPublic: data.isPublic ?? true,
      isOpen: data.isOpen ?? false,
      isFeatured: data.isFeatured ?? false,
      viewCount: data.viewCount ?? 0,
      ratingCount: data.ratingCount ?? 0,
      shareCount: data.shareCount ?? 0,
      lastActivityAt: convertTimestamp(data.lastActivityAt ?? data.updatedAt ?? data.createdAt),
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    } as Group;
  });

  return groups;
}

// Get featured groups (subset of public groups marked as featured)
export async function getFeaturedGroups(): Promise<Group[]> {
  const groups = await getPublicGroups();
  return groups.filter((g) => g.isFeatured);
}

// Get popular groups (sorted by total engagement)
export async function getPopularGroups(limit: number = 10): Promise<Group[]> {
  const groups = await getPublicGroups();

  // Sort by total engagement (views + ratings + shares), then by creation date
  return groups
    .sort((a, b) => {
      const aScore = (a.viewCount || 0) + (a.ratingCount || 0) * 2 + (a.shareCount || 0) * 3;
      const bScore = (b.viewCount || 0) + (b.ratingCount || 0) * 2 + (b.shareCount || 0) * 3;
      // If scores are equal, sort by creation date (newest first)
      if (bScore === aScore) {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      return bScore - aScore;
    })
    .slice(0, limit);
}

// Get trending groups (recent activity weighted)
export async function getTrendingGroups(limit: number = 10): Promise<Group[]> {
  const groups = await getPublicGroups();
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Filter to groups with recent activity and sort by recency + engagement
  const recentGroups = groups.filter((g) => g.lastActivityAt >= monthAgo || g.createdAt >= monthAgo);

  // If no recent groups, return newest public groups
  if (recentGroups.length === 0) {
    return groups
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  return recentGroups
    .sort((a, b) => {
      // Weight recent activity more heavily
      const aRecency = Math.max(a.lastActivityAt.getTime(), a.createdAt.getTime());
      const bRecency = Math.max(b.lastActivityAt.getTime(), b.createdAt.getTime());
      const aScore = ((a.viewCount || 0) + (a.ratingCount || 0) * 2 + 1) * (aRecency / now.getTime());
      const bScore = ((b.viewCount || 0) + (b.ratingCount || 0) * 2 + 1) * (bRecency / now.getTime());
      return bScore - aScore;
    })
    .slice(0, limit);
}

// Increment view count for a group
export async function incrementGroupViews(groupId: string): Promise<void> {
  const groupRef = doc(groupsCollection, groupId);
  const docSnap = await getDoc(groupRef);
  if (docSnap.exists()) {
    const currentViews = docSnap.data().viewCount ?? 0;
    await updateDoc(groupRef, {
      viewCount: currentViews + 1,
      lastActivityAt: Timestamp.fromDate(new Date()),
    });
  }
}

export function subscribeToRatings(
  groupId: string,
  callback: (ratings: Rating[]) => void
): () => void {
  const q = query(ratingsCollection, where('groupId', '==', groupId));
  return onSnapshot(q, (snapshot) => {
    const ratings = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        groupId: data.groupId,
        metricId: data.metricId,
        raterId: data.raterId,
        targetObjectId: data.targetObjectId ?? data.targetMemberId, // Backward compat
        value: data.value,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
      } as Rating;
    });
    callback(ratings);
  });
}

// ============ IMAGE UPLOAD ============

export async function uploadObjectImage(
  groupId: string,
  file: File
): Promise<string> {
  const fileExtension = file.name.split('.').pop() || 'jpg';
  const fileName = `${uuidv4()}.${fileExtension}`;
  const storageRef = ref(storage, `groups/${groupId}/objects/${fileName}`);

  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);

  return downloadUrl;
}

// ============ CLAIM TOKEN OPERATIONS (for claiming user-type objects) ============

export async function createClaimToken(
  groupId: string,
  objectId: string,
  createdBy: string,
  email: string | null = null
): Promise<ClaimToken> {
  const tokenId = uuidv4();
  const token = uuidv4(); // Generate unique claim token
  const now = new Date();

  const claimToken: ClaimToken = {
    id: tokenId,
    groupId,
    objectId,
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
    id: docSnap.id,
    groupId: data.groupId,
    objectId: data.objectId ?? data.memberId, // Backward compat
    email: data.email,
    token: data.token,
    createdBy: data.createdBy,
    status: data.status,
    createdAt: convertTimestamp(data.createdAt),
    claimedAt: data.claimedAt ? convertTimestamp(data.claimedAt) : null,
    claimedBy: data.claimedBy ?? null,
  } as ClaimToken;
}

export async function getClaimTokensForObject(objectId: string): Promise<ClaimToken[]> {
  const q = query(claimTokensCollection, where('objectId', '==', objectId));
  const docs = await getDocs(q);

  return docs.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      groupId: data.groupId,
      objectId: data.objectId ?? data.memberId,
      email: data.email,
      token: data.token,
      createdBy: data.createdBy,
      status: data.status,
      createdAt: convertTimestamp(data.createdAt),
      claimedAt: data.claimedAt ? convertTimestamp(data.claimedAt) : null,
      claimedBy: data.claimedBy ?? null,
    } as ClaimToken;
  });
}

export async function claimObject(
  token: string,
  clerkId: string,
  name: string,
  imageUrl: string | null,
  email?: string
): Promise<{ success: boolean; objectId?: string; groupId?: string; error?: string }> {
  const claimToken = await getClaimTokenByToken(token);

  if (!claimToken) {
    return { success: false, error: 'Invalid or expired claim link' };
  }

  const obj = await getObject(claimToken.objectId);
  if (!obj) {
    return { success: false, error: 'Object not found' };
  }

  if (obj.claimStatus === 'claimed') {
    return { success: false, error: 'This profile has already been claimed' };
  }

  const now = new Date();

  // Update the object to link to the claiming user
  await updateObject(claimToken.objectId, {
    claimStatus: 'claimed',
    claimedByClerkId: clerkId,
    claimedByName: name,
    claimedByImageUrl: imageUrl,
  });

  // Mark the claim token as used
  await updateDoc(doc(claimTokensCollection, claimToken.id), {
    status: 'claimed',
    claimedAt: Timestamp.fromDate(now),
    claimedBy: clerkId,
  });

  // Add the claiming user as a member if they're not already
  const existingMember = await getMemberByClerkId(claimToken.groupId, clerkId);
  if (!existingMember) {
    await addMember(
      claimToken.groupId,
      clerkId,
      email || '',
      name,
      imageUrl,
      'follower',
      'accepted'
    );
  }

  return {
    success: true,
    objectId: claimToken.objectId,
    groupId: claimToken.groupId,
  };
}

export async function invalidateClaimToken(tokenId: string): Promise<void> {
  await updateDoc(doc(claimTokensCollection, tokenId), {
    status: 'expired',
  });
}

// ============ PENDING OBJECT OPERATIONS ============

export async function submitPendingObject(
  groupId: string,
  name: string,
  description: string | null,
  imageUrl: string | null,
  objectType: ObjectType,
  linkUrl: string | null,
  category: string | null,
  submittedBy: string,
  submittedByName: string
): Promise<PendingObject> {
  const objectId = uuidv4();
  const now = new Date();

  const pendingObject: PendingObject = {
    id: objectId,
    groupId,
    name,
    description,
    imageUrl,
    objectType,
    linkUrl,
    category,
    submittedBy,
    submittedByName,
    status: 'pending',
    createdAt: now,
    respondedAt: null,
    respondedBy: null,
  };

  await setDoc(doc(pendingObjectsCollection, objectId), {
    ...pendingObject,
    createdAt: Timestamp.fromDate(now),
  });

  return pendingObject;
}

export async function getPendingObjects(groupId: string): Promise<PendingObject[]> {
  const q = query(
    pendingObjectsCollection,
    where('groupId', '==', groupId),
    where('status', '==', 'pending')
  );
  const docs = await getDocs(q);

  return docs.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      groupId: data.groupId,
      name: data.name,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      objectType: data.objectType ?? 'text',
      linkUrl: data.linkUrl ?? null,
      category: data.category ?? null,
      submittedBy: data.submittedBy,
      submittedByName: data.submittedByName,
      status: data.status,
      createdAt: convertTimestamp(data.createdAt),
      respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
      respondedBy: data.respondedBy ?? null,
    } as PendingObject;
  });
}

export async function respondToPendingObject(
  pendingObjectId: string,
  approve: boolean,
  respondedBy: string,
  groupId: string
): Promise<GroupObject | null> {
  const pendingDoc = await getDoc(doc(pendingObjectsCollection, pendingObjectId));
  if (!pendingDoc.exists()) throw new Error('Pending object not found');

  const pendingData = pendingDoc.data() as PendingObject;
  const now = new Date();

  // Update pending object status
  await updateDoc(doc(pendingObjectsCollection, pendingObjectId), {
    status: approve ? 'approved' : 'rejected',
    respondedAt: Timestamp.fromDate(now),
    respondedBy,
  });

  if (approve) {
    // Create actual object from pending object
    const obj = await addObject(
      groupId,
      pendingData.name,
      pendingData.description,
      pendingData.imageUrl,
      pendingData.objectType,
      pendingData.linkUrl,
      pendingData.category
    );
    return obj;
  }

  return null;
}

export function subscribeToPendingObjects(
  groupId: string,
  callback: (objects: PendingObject[]) => void
): () => void {
  const q = query(
    pendingObjectsCollection,
    where('groupId', '==', groupId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snapshot) => {
    const objects = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        groupId: data.groupId,
        name: data.name,
        description: data.description ?? null,
        imageUrl: data.imageUrl ?? null,
        objectType: data.objectType ?? 'text',
        linkUrl: data.linkUrl ?? null,
        category: data.category ?? null,
        submittedBy: data.submittedBy,
        submittedByName: data.submittedByName,
        status: data.status,
        createdAt: convertTimestamp(data.createdAt),
        respondedAt: data.respondedAt ? convertTimestamp(data.respondedAt) : null,
        respondedBy: data.respondedBy ?? null,
      } as PendingObject;
    });
    callback(objects);
  });
}
