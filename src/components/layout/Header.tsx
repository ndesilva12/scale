'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useUser, SignedIn, SignedOut, useClerk } from '@clerk/nextjs';
import { Menu, X, LayoutDashboard, LogOut, User, Settings } from 'lucide-react';
import { useState } from 'react';
import Button from '@/components/ui/Button';

export default function Header() {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 py-2">
            <Image
              src="/scalem.png"
              alt="Scale"
              width={225}
              height={60}
              className="h-[50px] w-auto"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            <SignedIn>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <div className="relative group">
                <button className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition-colors">
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt="" className="w-9 h-9 rounded-full" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-white/10 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all py-2">
                  <div className="px-4 py-2 border-b border-white/10">
                    <p className="text-sm font-medium text-white truncate">{user?.fullName || user?.firstName}</p>
                    <p className="text-xs text-gray-400 truncate">{user?.emailAddresses[0]?.emailAddress}</p>
                  </div>
                  <button
                    onClick={() => openUserProfile()}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </SignedIn>
            <SignedOut>
              <Link href="/sign-in">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link href="/sign-up">
                <Button variant="secondary">Get Started</Button>
              </Link>
            </SignedOut>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation - Flat menu, no nesting */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-gray-900">
          <div className="px-4 py-4 space-y-1">
            <SignedIn>
              {/* User info at top */}
              <div className="flex items-center gap-3 px-3 py-3 mb-2 border-b border-white/10">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{user?.fullName || user?.firstName}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.emailAddresses[0]?.emailAddress}</p>
                </div>
              </div>

              {/* All menu items flat */}
              <Link
                href="/dashboard"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </Link>
              <button
                onClick={() => {
                  openUserProfile();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Settings className="w-5 h-5" />
                Settings
              </button>
              <button
                onClick={() => {
                  signOut();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </SignedIn>
            <SignedOut>
              <Link
                href="/sign-in"
                className="block"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="outline" className="w-full">Sign In</Button>
              </Link>
              <Link
                href="/sign-up"
                className="block"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="secondary" className="w-full">Get Started</Button>
              </Link>
            </SignedOut>
          </div>
        </div>
      )}
    </header>
  );
}
