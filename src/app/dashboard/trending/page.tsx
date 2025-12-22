'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, Eye, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import { Group } from '@/types';
import { getTrendingGroups } from '@/lib/firestore';

export default function TrendingGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const trending = await getTrendingGroups(50);
        setGroups(trending);
      } catch (error) {
        console.error('Failed to load trending groups:', error);
      } finally {
        setLoading(false);
      }
    };
    loadGroups();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-500" />
            <h1 className="text-lg sm:text-xl font-bold text-white">Trending Groups</h1>
          </div>
        </div>

        {groups.length > 0 ? (
          <div className="space-y-2.5 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                {/* Mobile: Compact row */}
                <div className="sm:hidden flex items-center gap-3 p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-600 to-lime-600 flex items-center justify-center flex-shrink-0">
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
                {/* Desktop: Card */}
                <Card className="hidden sm:block overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer h-full border border-white/10 bg-white/5">
                  <div className="h-1 bg-gradient-to-r from-yellow-600 to-lime-600" />
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
          <div className="p-8 text-center text-gray-500 bg-white/5 rounded-2xl border border-white/10">
            No trending groups yet
          </div>
        )}
      </main>
    </div>
  );
}
