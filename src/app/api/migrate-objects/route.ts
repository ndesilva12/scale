import { NextResponse } from 'next/server';
import { collection, doc, setDoc, getDocs, updateDoc, Timestamp, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';

// Collections
const objectsCollection = collection(db, 'objects');
const membersCollection = collection(db, 'members');
const ratingsCollection = collection(db, 'ratings');

export async function POST() {
  try {
    // Find all members with status 'placeholder' - these are the old "items to rate"
    const placeholderQuery = query(membersCollection, where('status', '==', 'placeholder'));
    const placeholderDocs = await getDocs(placeholderQuery);

    const now = Timestamp.now();
    let migratedCount = 0;
    let ratingsUpdated = 0;
    const idMapping: Record<string, string> = {}; // oldId -> newId
    const migrationResults: Array<{ name: string; groupId: string; oldId: string; newId: string }> = [];

    // Step 1: Create new objects and build ID mapping
    for (const docSnap of placeholderDocs.docs) {
      const data = docSnap.data();
      const oldId = docSnap.id;

      // Create new object in objects collection
      const newObjectId = uuidv4();
      idMapping[oldId] = newObjectId;

      const objectRef = doc(objectsCollection, newObjectId);

      await setDoc(objectRef, {
        groupId: data.groupId,
        name: data.name,
        description: data.description || null,
        imageUrl: data.placeholderImageUrl || data.imageUrl || null,
        objectType: data.objectType || 'text', // Default to text if not specified
        linkUrl: data.linkUrl || null,
        category: data.category || data.itemCategory || null,
        disabledMetricIds: data.disabledMetricIds || [],
        enabledMetricIds: data.enabledMetricIds || [],
        visibleInGraph: data.visibleInGraph !== false, // Default to true
        ratingMode: data.ratingMode || 'group',
        claimedByClerkId: data.clerkId || null,
        claimedByName: data.claimedByName || null,
        claimedByImageUrl: data.claimedByImageUrl || null,
        claimStatus: data.clerkId ? 'claimed' : 'unclaimed',
        createdAt: data.invitedAt || data.createdAt || now,
        updatedAt: now,
      });

      migrationResults.push({
        name: data.name,
        groupId: data.groupId,
        oldId,
        newId: newObjectId,
      });

      migratedCount++;
    }

    // Step 2: Update ratings to use new object IDs
    // Find all ratings that reference the old member IDs
    const allRatings = await getDocs(ratingsCollection);

    for (const ratingDoc of allRatings.docs) {
      const data = ratingDoc.data();
      const targetId = data.targetObjectId || data.targetMemberId;

      // If this rating points to an old member ID that was migrated
      if (targetId && idMapping[targetId]) {
        await updateDoc(doc(ratingsCollection, ratingDoc.id), {
          targetObjectId: idMapping[targetId],
          // Keep targetMemberId for backward compat but update it too
          targetMemberId: idMapping[targetId],
        });
        ratingsUpdated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migrated ${migratedCount} placeholder members to objects collection. Updated ${ratingsUpdated} ratings.`,
      migratedItems: migrationResults,
      idMapping,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check how many placeholder members exist (for preview)
    const placeholderQuery = query(membersCollection, where('status', '==', 'placeholder'));
    const placeholderDocs = await getDocs(placeholderQuery);

    // Group by groupId for a summary
    const groupSummary: Record<string, { count: number; items: string[] }> = {};

    placeholderDocs.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const groupId = data.groupId;
      if (!groupSummary[groupId]) {
        groupSummary[groupId] = { count: 0, items: [] };
      }
      groupSummary[groupId].count++;
      groupSummary[groupId].items.push(data.name);
    });

    return NextResponse.json({
      message: 'Preview of migration - POST to this endpoint to execute',
      totalPlaceholderMembers: placeholderDocs.size,
      byGroup: groupSummary,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to preview migration', details: String(error) },
      { status: 500 }
    );
  }
}
