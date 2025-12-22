import { NextResponse } from 'next/server';
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Mock data for featured groups
const mockGroups = [
  {
    id: 'nba-best',
    name: "NBA's Best",
    description: 'Rating the best NBA players and teams across different metrics',
    captainId: 'user_mock_captain', // Will be updated with actual user ID
    coCaptainIds: [],
    itemCategories: ['Player', 'Team'],
    metrics: [
      {
        id: 'scoring',
        name: 'Scoring',
        description: 'Points per game and scoring efficiency',
        order: 0,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: ['Player'],
      },
      {
        id: 'defense',
        name: 'Defense',
        description: 'Defensive impact and ability',
        order: 1,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: ['Player'],
      },
      {
        id: 'playmaking',
        name: 'Playmaking',
        description: 'Assists and court vision',
        order: 2,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: ['Player'],
      },
      {
        id: 'team-chemistry',
        name: 'Team Chemistry',
        description: 'How well the team plays together',
        order: 3,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: ['Team'],
      },
      {
        id: 'championship-potential',
        name: 'Championship Potential',
        description: 'Likelihood to win it all',
        order: 4,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '%' as const,
        applicableCategories: ['Team'],
      },
    ],
    defaultYMetricId: 'scoring',
    defaultXMetricId: 'defense',
    lockedYMetricId: null,
    lockedXMetricId: null,
    captainControlEnabled: true,
    isPublic: true,
    isOpen: true,
    isFeatured: true,
    viewCount: 1250,
    ratingCount: 342,
    shareCount: 89,
  },
  {
    id: 'nfl-best',
    name: "NFL's Best",
    description: 'Rating NFL players and teams on key performance metrics',
    captainId: 'user_mock_captain',
    coCaptainIds: [],
    itemCategories: ['Player', 'Team'],
    metrics: [
      {
        id: 'athleticism',
        name: 'Athleticism',
        description: 'Speed, strength, and agility',
        order: 0,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: ['Player'],
      },
      {
        id: 'game-iq',
        name: 'Game IQ',
        description: 'Football intelligence and decision making',
        order: 1,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: ['Player'],
      },
      {
        id: 'clutch',
        name: 'Clutch Factor',
        description: 'Performance in high-pressure moments',
        order: 2,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: ['Player'],
      },
      {
        id: 'roster-depth',
        name: 'Roster Depth',
        description: 'Quality of backup players',
        order: 3,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: ['Team'],
      },
      {
        id: 'super-bowl-odds',
        name: 'Super Bowl Odds',
        description: 'Chances of winning the Super Bowl',
        order: 4,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '%' as const,
        applicableCategories: ['Team'],
      },
    ],
    defaultYMetricId: 'athleticism',
    defaultXMetricId: 'game-iq',
    lockedYMetricId: null,
    lockedXMetricId: null,
    captainControlEnabled: true,
    isPublic: true,
    isOpen: true,
    isFeatured: true,
    viewCount: 980,
    ratingCount: 275,
    shareCount: 62,
  },
  {
    id: 'presidential-2028',
    name: '2028 Presidential Candidates',
    description: 'Rate potential 2028 presidential candidates on key qualities',
    captainId: 'user_mock_captain',
    coCaptainIds: [],
    itemCategories: [],
    metrics: [
      {
        id: 'leadership',
        name: 'Leadership',
        description: 'Ability to lead and inspire',
        order: 0,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: [],
      },
      {
        id: 'experience',
        name: 'Experience',
        description: 'Political and professional experience',
        order: 1,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: [],
      },
      {
        id: 'electability',
        name: 'Electability',
        description: 'Likelihood to win the election',
        order: 2,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '%' as const,
        applicableCategories: [],
      },
      {
        id: 'policy-strength',
        name: 'Policy Strength',
        description: 'Quality and clarity of policy positions',
        order: 3,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: [],
      },
    ],
    defaultYMetricId: 'leadership',
    defaultXMetricId: 'electability',
    lockedYMetricId: null,
    lockedXMetricId: null,
    captainControlEnabled: true,
    isPublic: true,
    isOpen: true,
    isFeatured: true,
    viewCount: 2100,
    ratingCount: 567,
    shareCount: 234,
  },
  {
    id: 'oscars-2026',
    name: '2026 Oscar Nominees',
    description: 'Rate the potential 2026 Oscar nominees across categories',
    captainId: 'user_mock_captain',
    coCaptainIds: [],
    itemCategories: ['Actor', 'Movie', 'Director'],
    metrics: [
      {
        id: 'acting',
        name: 'Acting Performance',
        description: 'Quality of acting performance',
        order: 0,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: ['Actor'],
      },
      {
        id: 'box-office',
        name: 'Box Office',
        description: 'Commercial success',
        order: 1,
        minValue: 0,
        maxValue: 1000,
        prefix: '$' as const,
        suffix: 'M' as const,
        applicableCategories: ['Movie'],
      },
      {
        id: 'critical-acclaim',
        name: 'Critical Acclaim',
        description: 'Critical reception and reviews',
        order: 2,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: ['Movie', 'Actor', 'Director'],
      },
      {
        id: 'oscar-odds',
        name: 'Oscar Odds',
        description: 'Likelihood to win the Oscar',
        order: 3,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '%' as const,
        applicableCategories: ['Movie', 'Actor', 'Director'],
      },
      {
        id: 'direction',
        name: 'Direction Quality',
        description: 'Quality of directing',
        order: 4,
        minValue: 0,
        maxValue: 100,
        prefix: '' as const,
        suffix: '' as const,
        applicableCategories: ['Director', 'Movie'],
      },
    ],
    defaultYMetricId: 'critical-acclaim',
    defaultXMetricId: 'oscar-odds',
    lockedYMetricId: null,
    lockedXMetricId: null,
    captainControlEnabled: true,
    isPublic: true,
    isOpen: true,
    isFeatured: true,
    viewCount: 1567,
    ratingCount: 423,
    shareCount: 156,
  },
];

export async function POST(request: Request) {
  try {
    // Get the captain email from the request body
    const { captainEmail, captainClerkId } = await request.json();

    if (!captainEmail || !captainClerkId) {
      return NextResponse.json(
        { error: 'Captain email and clerkId are required' },
        { status: 400 }
      );
    }

    const now = Timestamp.now();
    const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    const createdGroups = [];

    for (const groupData of mockGroups) {
      const groupRef = doc(collection(db, 'groups'), groupData.id);

      await setDoc(groupRef, {
        ...groupData,
        captainId: captainClerkId,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: sevenDaysAgo, // Set to recent for trending
      });

      // Add captain as a member
      const memberRef = doc(collection(db, 'groups', groupData.id, 'members'));
      await setDoc(memberRef, {
        groupId: groupData.id,
        userId: captainClerkId,
        clerkId: captainClerkId,
        email: captainEmail,
        name: 'Captain',
        imageUrl: null,
        placeholderImageUrl: null,
        description: null,
        status: 'accepted',
        visibleInGraph: true,
        isCaptain: true,
        invitedAt: now,
        respondedAt: now,
        itemType: 'user',
        linkUrl: null,
        itemCategory: null,
        displayMode: 'user',
        customName: null,
        customImageUrl: null,
        ratingMode: 'group',
      });

      createdGroups.push({
        id: groupData.id,
        name: groupData.name,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdGroups.length} mock groups`,
      groups: createdGroups,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint with { captainEmail, captainClerkId } to seed mock groups',
  });
}
