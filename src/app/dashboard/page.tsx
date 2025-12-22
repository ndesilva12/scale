'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Plus, Users, ChevronRight, Bell, TrendingUp, Flame, Eye, Lock, LockOpen } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import CreateGroupForm from '@/components/groups/CreateGroupForm';
import { Group, Invitation } from '@/types';
import {
  getUserGroups,
  createGroup,
  addMember,
  getUserInvitations,
  respondToInvitation,
  getPopularGroups,
  getTrendingGroups,
} from '@/lib/firestore';

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [popularGroups, setPopularGroups] = useState<Group[]>([]);
  const [trendingGroups, setTrendingGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load popular and trending groups (doesn't require login)
  useEffect(() => {
    const loadFeaturedGroups = async () => {
      try {
        const [popular, trending] = await Promise.all([
          getPopularGroups(6),
          getTrendingGroups(6),
        ]);
        setPopularGroups(popular);
        setTrendingGroups(trending);
      } catch (error) {
        console.error('Failed to load featured groups:', error);
      }
    };
    loadFeaturedGroups();
  }, []);

  useEffect(() => {
    if (isLoaded && user) {
      loadData();
    } else if (isLoaded && !user) {
      setLoading(false);
    }
  }, [isLoaded, user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [userGroups, userInvitations] = await Promise.all([
        getUserGroups(user.id),
        getUserInvitations(user.emailAddresses[0]?.emailAddress || ''),
      ]);
      setGroups(userGroups);
      setInvitations(userInvitations);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (data: {
    name: string;
    description: string;
    metrics: { name: string; description: string; order: number; minValue?: number; maxValue?: number; prefix?: string; suffix?: string }[];
  }) => {
    if (!user) return;

    // Create the group - ensure metrics have all required fields with defaults
    const metricsWithDefaults = data.metrics.map((m) => ({
      name: m.name,
      description: m.description,
      order: m.order,
      minValue: m.minValue ?? 0,
      maxValue: m.maxValue ?? 100,
      prefix: (m.prefix ?? '') as '' | '#' | '$' | '€' | '£',
      suffix: (m.suffix ?? '') as '' | '%' | 'K' | 'M' | 'B' | 'T' | ' thousand' | ' million' | ' billion' | ' trillion',
      applicableCategories: [],
    }));
    const group = await createGroup(user.id, data.name, data.description, metricsWithDefaults);

    // Add the captain as the first member
    await addMember(
      group.id,
      user.id, // clerkId
      user.emailAddresses[0]?.emailAddress || '',
      user.fullName || user.firstName || 'Captain',
      user.imageUrl || null, // imageUrl
      'captain', // role
      'accepted' // status
    );

    setShowCreateModal(false);
    loadData();
  };

  const handleRespondToInvitation = async (invitation: Invitation, accept: boolean) => {
    if (!user) return;

    try {
      await respondToInvitation(
        invitation.id,
        accept,
        user.id,
        user.emailAddresses[0]?.emailAddress || '',
        user.fullName || user.firstName || 'Member',
        user.imageUrl || null
      );
      loadData();
    } catch (error) {
      console.error('Failed to respond to invitation:', error);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-lime-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <Card className="mb-4 p-3 sm:p-4 border-l-4 border-l-lime-600">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-lime-600" />
              <h2 className="text-sm font-semibold text-white">Invitations</h2>
            </div>
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-2 bg-gray-800 rounded-xl"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white text-sm truncate">{invitation.groupName}</p>
                    <p className="text-xs text-gray-400">from {invitation.invitedByName}</p>
                  </div>
                  <div className="flex gap-1.5 ml-2">
                    <Button size="sm" variant="ghost" onClick={() => handleRespondToInvitation(invitation, false)}>✕</Button>
                    <Button size="sm" onClick={() => handleRespondToInvitation(invitation, true)}>Join</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* My Groups Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-lime-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-white">My Groups</h1>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </div>

        {/* My Groups */}
        {user && groups.length === 0 ? (
          <Card className="p-6 text-center mb-4">
            <Users className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400 text-sm mb-3">No groups yet</p>
            <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Create Group
            </Button>
          </Card>
        ) : user && groups.length > 0 ? (
          <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 mb-4">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                {/* Mobile: Compact row - no icon */}
                <div className="sm:hidden flex items-center gap-3 p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white text-sm truncate">{group.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{group.metrics.length} metrics</span>
                      <span className={group.isOpen ? 'text-lime-400' : ''}>
                        {group.isOpen ? '• Open' : '• Closed'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                </div>
                {/* Desktop: Card - no icon */}
                <Card className="hidden sm:block overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer h-full border border-white/10 bg-white/5">
                  <div className="h-1 bg-gradient-to-r from-lime-500 to-emerald-600" />
                  <div className="p-3">
                    <h3 className="font-bold text-white text-sm truncate mb-1">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs text-gray-400 line-clamp-1 mb-1.5">{group.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="px-1.5 py-0.5 bg-gray-800 rounded-lg text-gray-400">{group.metrics.length} metrics</span>
                      <span className={`px-1.5 py-0.5 rounded-lg ${group.isOpen ? 'bg-lime-900/30 text-lime-400' : 'bg-gray-700 text-gray-400'}`}>
                        {group.isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : null}

        {/* Popular Groups */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-teal-400" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">Popular</h2>
            </div>
            {popularGroups.length > 3 && (
              <Link href="/dashboard/popular" className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1">
                Show more <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          {popularGroups.length > 0 ? (
            <div className="space-y-2.5 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3">
              {popularGroups.slice(0, 3).map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  {/* Mobile: Compact row */}
                  <div className="sm:hidden flex items-center gap-3 p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <Flame className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-white text-sm truncate">{group.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span><Eye className="w-3 h-3 inline" /> {group.viewCount || 0}</span>
                        <span>{group.ratingCount || 0} ratings</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  </div>
                </Link>
              ))}
              {popularGroups.slice(0, 6).map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  {/* Desktop: Card */}
                  <Card className="hidden sm:block overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer h-full border border-white/10 bg-white/5">
                    <div className="h-1 bg-gradient-to-r from-teal-500 to-cyan-600" />
                    <div className="p-3">
                      <h3 className="font-bold text-white text-sm truncate mb-1">{group.name}</h3>
                      {group.description && (
                        <p className="text-xs text-gray-400 line-clamp-1 mb-1.5">{group.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span><Eye className="w-3 h-3 inline" /> {group.viewCount || 0}</span>
                        <span>{group.ratingCount || 0} ratings</span>
                        <span className={`px-1.5 py-0.5 rounded-lg ${group.isOpen ? 'bg-lime-900/30 text-lime-400' : 'bg-gray-700 text-gray-400'}`}>
                          {group.isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm bg-white/5 rounded-2xl border border-white/10">
              No popular groups yet
            </div>
          )}
        </div>

        {/* Trending Groups */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-sky-400" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">Trending</h2>
            </div>
            {trendingGroups.length > 3 && (
              <Link href="/dashboard/trending" className="text-xs text-sky-400 hover:text-violet-400 flex items-center gap-1">
                Show more <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          {trendingGroups.length > 0 ? (
            <div className="space-y-2.5 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3">
              {trendingGroups.slice(0, 3).map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  {/* Mobile: Compact row */}
                  <div className="sm:hidden flex items-center gap-3 p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-violet-400 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-white text-sm truncate">{group.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span><Eye className="w-3 h-3 inline" /> {group.viewCount || 0}</span>
                        <span>{group.ratingCount || 0} ratings</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  </div>
                </Link>
              ))}
              {trendingGroups.slice(0, 6).map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  {/* Desktop: Card */}
                  <Card className="hidden sm:block overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer h-full border border-white/10 bg-white/5">
                    <div className="h-1 bg-gradient-to-r from-sky-400 to-violet-400" />
                    <div className="p-3">
                      <h3 className="font-bold text-white text-sm truncate mb-1">{group.name}</h3>
                      {group.description && (
                        <p className="text-xs text-gray-400 line-clamp-1 mb-1.5">{group.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span><Eye className="w-3 h-3 inline" /> {group.viewCount || 0}</span>
                        <span>{group.ratingCount || 0} ratings</span>
                        <span className={`px-1.5 py-0.5 rounded-lg ${group.isOpen ? 'bg-lime-900/30 text-lime-400' : 'bg-gray-700 text-gray-400'}`}>
                          {group.isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm bg-white/5 rounded-2xl border border-white/10">
              No trending groups yet
            </div>
          )}
        </div>
      </main>

      {/* Create Group Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Group"
        size="lg"
      >
        <CreateGroupForm
          onSubmit={handleCreateGroup}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </div>
  );
}
