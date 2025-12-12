'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useSignUp, SignUp } from '@clerk/nextjs';
import { UserPlus, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { ClaimToken, GroupMember } from '@/types';
import { getClaimTokenByToken, getMember, getGroup, claimProfile } from '@/lib/firestore';

interface ClaimPageProps {
  params: Promise<{ token: string }>;
}

export default function ClaimPage({ params }: ClaimPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [claimToken, setClaimToken] = useState<ClaimToken | null>(null);
  const [member, setMember] = useState<GroupMember | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  useEffect(() => {
    loadClaimToken();
  }, [resolvedParams.token]);

  useEffect(() => {
    // If user is logged in and we have a valid claim token, process the claim
    if (isUserLoaded && user && claimToken && claimToken.status === 'pending') {
      handleClaim();
    }
  }, [isUserLoaded, user, claimToken]);

  const loadClaimToken = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getClaimTokenByToken(resolvedParams.token);

      if (!token) {
        setError('Invalid or expired claim link');
        setLoading(false);
        return;
      }

      if (token.status === 'claimed') {
        setError('This item has already been claimed');
        setLoading(false);
        return;
      }

      if (token.status === 'expired') {
        setError('This claim link has expired');
        setLoading(false);
        return;
      }

      setClaimToken(token);

      // Fetch member details
      const memberData = await getMember(token.memberId);
      if (memberData) {
        setMember(memberData);
      }

      // Fetch group name
      const group = await getGroup(token.groupId);
      if (group) {
        setGroupName(group.name);
      }
    } catch (err) {
      console.error('Error loading claim token:', err);
      setError('Failed to load claim information');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!user || !claimToken) return;

    setClaiming(true);
    try {
      const result = await claimProfile(
        claimToken.token,
        user.id,
        user.fullName || user.firstName || member?.name || 'Member',
        user.imageUrl
      );

      if (result.success && result.groupId) {
        router.push(`/groups/${result.groupId}`);
      } else {
        setError(result.error || 'Failed to claim item');
      }
    } catch (err) {
      console.error('Error claiming item:', err);
      setError('Failed to claim item');
    } finally {
      setClaiming(false);
    }
  };

  const handleSignUpClick = () => {
    // Store the claim token in localStorage for after sign-up
    localStorage.setItem('pendingClaimToken', resolvedParams.token);
    setShowSignUp(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Unable to Process Claim
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error}
            </p>
            <Button onClick={() => router.push('/')}>
              Go Home
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  if (showSignUp) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <SignUp
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'shadow-xl',
              },
            }}
            fallbackRedirectUrl={`/claim/${resolvedParams.token}`}
            signInUrl={`/sign-in?redirect_url=/claim/${resolvedParams.token}`}
          />
        </main>
      </div>
    );
  }

  if (claiming || (isUserLoaded && user && claimToken?.status === 'pending')) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Claiming Your Profile
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we link your account...
            </p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Claim Your Profile
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              You&apos;ve been invited to join a group
            </p>
          </div>

          {member && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-4">
                {(member.placeholderImageUrl || member.imageUrl) && (
                  <img
                    src={member.placeholderImageUrl || member.imageUrl || ''}
                    alt={member.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {member.name}
                  </p>
                  {groupName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      in {groupName}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button className="w-full" onClick={handleSignUpClick}>
              <UserPlus className="w-4 h-4 mr-2" />
              Sign Up to Claim
            </Button>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{' '}
              <a
                href={`/sign-in?redirect_url=/claim/${resolvedParams.token}`}
                className="text-blue-600 hover:underline"
              >
                Sign in
              </a>
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
