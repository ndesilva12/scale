'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Plus, Users, ChevronRight, Bell, TrendingUp, Flame, Eye } from 'lucide-react';
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

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <Card className="mb-8 p-6 border-l-4 border-l-lime-600">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-lime-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Pending Invitations
              </h2>
            </div>
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {invitation.groupName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Invited by {invitation.invitedByName}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRespondToInvitation(invitation, false)}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleRespondToInvitation(invitation, true)}
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              My Groups
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your groups and view member ratings
            </p>
          </div>
          <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Group
          </Button>
        </div>

        {/* Groups Grid */}
        {user && groups.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No groups yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first group to start rating team members
            </p>
            <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Group
            </Button>
          </Card>
        ) : user && groups.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => {
              return (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  <Card className="overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full border border-gray-200 dark:border-gray-700">
                    {/* Lime to emerald gradient header accent */}
                    <div className="h-1.5 bg-gradient-to-r from-lime-500 to-emerald-600" />

                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-lime-600 to-green-600 flex items-center justify-center shadow-md">
                              <Users className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                              {group.name}
                            </h3>
                          </div>
                          {group.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4 ml-13">
                              {group.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
                              <span className="font-medium">{group.metrics.length}</span>
                              <span>metrics</span>
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-3" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : null}

        {/* Popular Groups Section - Always visible */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Popular Groups</h2>
              <p className="text-sm text-gray-400">Most engaged groups on Scale</p>
            </div>
          </div>
          {popularGroups.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {popularGroups.map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  <Card className="overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full border border-white/10 bg-white/5 backdrop-blur-sm">
                    <div className="h-1.5 bg-gradient-to-r from-orange-500 to-red-600" />
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {group.name}
                          </h3>
                          {group.description && (
                            <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                              {group.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 text-gray-400">
                              <Eye className="w-3.5 h-3.5" />
                              {group.viewCount || 0}
                            </span>
                            <span className="flex items-center gap-1 text-gray-400">
                              <TrendingUp className="w-3.5 h-3.5" />
                              {group.ratingCount || 0} ratings
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center border border-white/10 bg-white/5 backdrop-blur-sm">
              <Flame className="w-10 h-10 text-orange-500/50 mx-auto mb-3" />
              <p className="text-gray-400">No popular groups yet</p>
              <p className="text-sm text-gray-500 mt-1">Create a public group to get started</p>
            </Card>
          )}
        </div>

        {/* Trending Groups Section - Always visible */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Trending Now</h2>
              <p className="text-sm text-gray-400">Groups with recent activity</p>
            </div>
          </div>
          {trendingGroups.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingGroups.map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  <Card className="overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full border border-white/10 bg-white/5 backdrop-blur-sm">
                    <div className="h-1.5 bg-gradient-to-r from-blue-500 to-purple-600" />
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {group.name}
                          </h3>
                          {group.description && (
                            <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                              {group.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 text-gray-400">
                              <Eye className="w-3.5 h-3.5" />
                              {group.viewCount || 0}
                            </span>
                            <span className="flex items-center gap-1 text-gray-400">
                              <TrendingUp className="w-3.5 h-3.5" />
                              {group.ratingCount || 0} ratings
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center border border-white/10 bg-white/5 backdrop-blur-sm">
              <TrendingUp className="w-10 h-10 text-blue-500/50 mx-auto mb-3" />
              <p className="text-gray-400">No trending groups yet</p>
              <p className="text-sm text-gray-500 mt-1">Public groups with recent activity will appear here</p>
            </Card>
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
