import { NextResponse } from 'next/server';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const objectsCollection = collection(db, 'objects');
const membersCollection = collection(db, 'members');
const ratingsCollection = collection(db, 'ratings');

export async function POST() {
  try {
    // Get all objects indexed by groupId and name
    const objectDocs = await getDocs(objectsCollection);
    const objectsByGroupAndName: Record<string, Record<string, string>> = {};

    for (const d of objectDocs.docs) {
      const data = d.data();
      const groupId = data.groupId;
      const name = data.name?.toLowerCase().trim();
      if (!objectsByGroupAndName[groupId]) {
        objectsByGroupAndName[groupId] = {};
      }
      objectsByGroupAndName[groupId][name] = d.id;
    }

    // Get all placeholder members indexed by ID
    const placeholderDocs = await getDocs(query(membersCollection, where('status', '==', 'placeholder')));
    const placeholderById: Record<string, { name: string; groupId: string }> = {};

    for (const d of placeholderDocs.docs) {
      const data = d.data();
      placeholderById[d.id] = { name: data.name, groupId: data.groupId };
    }

    // Get all ratings
    const ratingDocs = await getDocs(ratingsCollection);
    const objectIds = new Set(objectDocs.docs.map(d => d.id));

    let fixedCount = 0;
    let unfixableCount = 0;
    const fixes: Array<{ ratingId: string; oldTargetId: string; newTargetId: string; matchedByName: string }> = [];
    const unfixable: Array<{ ratingId: string; targetId: string; reason: string }> = [];

    for (const ratingDoc of ratingDocs.docs) {
      const data = ratingDoc.data();
      const targetId = data.targetObjectId || data.targetMemberId;
      const groupId = data.groupId;

      // Skip if rating already points to a valid object
      if (objectIds.has(targetId)) {
        continue;
      }

      // Try to find the matching object by looking up the placeholder's name
      const placeholder = placeholderById[targetId];
      if (placeholder) {
        const objectName = placeholder.name?.toLowerCase().trim();
        const matchingObjectId = objectsByGroupAndName[groupId]?.[objectName];

        if (matchingObjectId) {
          // Update the rating to point to the correct object
          await updateDoc(doc(ratingsCollection, ratingDoc.id), {
            targetObjectId: matchingObjectId,
          });
          fixes.push({
            ratingId: ratingDoc.id,
            oldTargetId: targetId,
            newTargetId: matchingObjectId,
            matchedByName: placeholder.name,
          });
          fixedCount++;
        } else {
          unfixable.push({
            ratingId: ratingDoc.id,
            targetId,
            reason: `No matching object found for placeholder "${placeholder.name}" in group ${groupId}`,
          });
          unfixableCount++;
        }
      } else {
        unfixable.push({
          ratingId: ratingDoc.id,
          targetId,
          reason: `Target ID not found in objects or placeholders`,
        });
        unfixableCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} ratings. ${unfixableCount} ratings could not be automatically fixed.`,
      fixedCount,
      unfixableCount,
      fixes: fixes.slice(0, 20),
      unfixable: unfixable.slice(0, 20),
    });
  } catch (error) {
    console.error('Fix ratings error:', error);
    return NextResponse.json(
      { error: 'Fix failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to fix orphaned ratings by matching placeholder names to objects.',
  });
}
