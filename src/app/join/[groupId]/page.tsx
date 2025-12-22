'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Users, ArrowLeft, LogIn, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Group, GroupMember } from '@/types';
import { getGroup, getGroupMembers, addMember, createInvitation } from '@/lib/firestore';

type JoinStatus = 'loading' | 'not-found' | 'already-member' | 'can-join' | 'joining' | 'joined';

export default function JoinGroupPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [status, setStatus] = useState<JoinStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGroup = async () => {
      try {
        const groupData = await getGroup(groupId);
        if (!groupData) {
          setStatus('not-found');
          return;
        }
        setGroup(groupData);

        const membersData = await getGroupMembers(groupId);
        setMembers(membersData);

        // Check if user is already a member
        if (isSignedIn && user) {
          const isMember = membersData.some((m) => m.clerkId === user.id);
          setStatus(isMember ? 'already-member' : 'can-join');
        } else {
          setStatus('can-join');
        }
      } catch (err) {
        console.error('Failed to load group:', err);
        setStatus('not-found');
      }
    };

    loadGroup();
  }, [groupId, isSignedIn, user]);

  const handleJoinGroup = async () => {
    if (!user || !group) return;

    setStatus('joining');
    setError(null);

    try {
      // Add the user as a member (pending status)
      await addMember(
        groupId,
        user.id, // clerkId
        user.emailAddresses[0]?.emailAddress || '',
        user.fullName || user.firstName || 'New Follower',
        user.imageUrl || null, // imageUrl
        'follower', // role
        'accepted' // status - followers are auto-accepted
      );

      // Create an invitation record for tracking
      await createInvitation(
        groupId,
        group.name,
        user.emailAddresses[0]?.emailAddress || '',
        group.captainId,
        'Group Invite Link'
      );

      setStatus('joined');
    } catch (err) {
      console.error('Failed to join group:', err);
      setError(err instanceof Error ? err.message : 'Failed to join group');
      setStatus('can-join');
    }
  };

  if (!isLoaded || status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-lime-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="p-8 text-center max-w-md">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-lime-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Group Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This group may have been deleted or the invite link is invalid.
            </p>
            <Link href="/">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full">
          {/* Group Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-lime-600 to-lime-500 rounded-xl flex items-center justify-center shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {group?.name}
            </h1>
            {group?.description && (
              <p className="text-gray-600 dark:text-gray-400">
                {group.description}
              </p>
            )}
          </div>

          {/* Group Stats */}
          <div className="flex justify-center gap-6 mb-6 py-4 border-y border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {members.filter((m) => m.status === 'accepted').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Members</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {group?.metrics.length || 0}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Metrics</div>
            </div>
          </div>

          {/* Action Section */}
          {error && (
            <div className="mb-4 p-3 bg-lime-50 dark:bg-lime-700/20 border border-lime-200 dark:border-lime-600 rounded-lg text-lime-500 dark:text-lime-400 text-sm">
              {error}
            </div>
          )}

          {status === 'already-member' && (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You&apos;re already a member of this group!
              </p>
              <Link href={`/groups/${groupId}`}>
                <Button className="w-full">
                  Go to Group
                </Button>
              </Link>
            </div>
          )}

          {status === 'joined' && (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Request Sent!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Your request to join has been sent. The group captain will review it shortly.
              </p>
              <Link href="/dashboard">
                <Button className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          )}

          {status === 'can-join' && !isSignedIn && (
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Sign in to request to join this group
              </p>
              <SignInButton mode="modal">
                <Button className="w-full">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In to Join
                </Button>
              </SignInButton>
            </div>
          )}

          {status === 'can-join' && isSignedIn && (
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Request to join this group. The captain will review your request.
              </p>
              <Button onClick={handleJoinGroup} className="w-full">
                Request to Join
              </Button>
            </div>
          )}

          {status === 'joining' && (
            <div className="text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-lime-600 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">
                Sending join request...
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
