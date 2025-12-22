import { NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const objectsCollection = collection(db, 'objects');
const membersCollection = collection(db, 'members');
const ratingsCollection = collection(db, 'ratings');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    // Get all objects
    const objectsQuery = groupId
      ? query(objectsCollection, where('groupId', '==', groupId))
      : objectsCollection;
    const objectDocs = await getDocs(objectsQuery);
    const objectIds = new Set(objectDocs.docs.map(d => d.id));
    const objects = objectDocs.docs.map(d => ({ id: d.id, name: d.data().name, groupId: d.data().groupId }));

    // Get all ratings
    const ratingsQuery = groupId
      ? query(ratingsCollection, where('groupId', '==', groupId))
      : ratingsCollection;
    const ratingDocs = await getDocs(ratingsQuery);
    const ratings = ratingDocs.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        groupId: data.groupId,
        targetObjectId: data.targetObjectId,
        targetMemberId: data.targetMemberId,
        metricId: data.metricId,
        value: data.value,
      };
    });

    // Get all placeholder members (old system)
    const placeholderQuery = groupId
      ? query(membersCollection, where('groupId', '==', groupId), where('status', '==', 'placeholder'))
      : query(membersCollection, where('status', '==', 'placeholder'));
    const placeholderDocs = await getDocs(placeholderQuery);
    const placeholderIds = new Set(placeholderDocs.docs.map(d => d.id));
    const placeholders = placeholderDocs.docs.map(d => ({ id: d.id, name: d.data().name, groupId: d.data().groupId }));

    // Analyze ratings
    const orphanedRatings: typeof ratings = [];
    const validRatings: typeof ratings = [];
    const ratingsPointingToPlaceholders: typeof ratings = [];

    for (const rating of ratings) {
      const targetId = rating.targetObjectId || rating.targetMemberId;
      if (objectIds.has(targetId)) {
        validRatings.push(rating);
      } else if (placeholderIds.has(targetId)) {
        ratingsPointingToPlaceholders.push(rating);
      } else {
        orphanedRatings.push(rating);
      }
    }

    return NextResponse.json({
      summary: {
        totalObjects: objects.length,
        totalPlaceholders: placeholders.length,
        totalRatings: ratings.length,
        validRatings: validRatings.length,
        orphanedRatings: orphanedRatings.length,
        ratingsPointingToPlaceholders: ratingsPointingToPlaceholders.length,
      },
      objects: objects.slice(0, 20),
      placeholders: placeholders.slice(0, 20),
      orphanedRatingSamples: orphanedRatings.slice(0, 10),
      ratingsPointingToPlaceholdersSamples: ratingsPointingToPlaceholders.slice(0, 10),
      message: orphanedRatings.length > 0 || ratingsPointingToPlaceholders.length > 0
        ? 'Found ratings that do not match current objects. Run POST /api/fix-ratings to repair.'
        : 'All ratings are properly linked to objects.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Diagnosis failed', details: String(error) },
      { status: 500 }
    );
  }
}
