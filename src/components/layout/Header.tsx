'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useUser, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import Button from '@/components/ui/Button';

export default function Header() {
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
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
          <nav className="hidden md:flex items-center gap-6">
            <SignedIn>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-9 h-9',
                    userButtonPopoverCard: 'bg-gray-900 border border-white/20 shadow-2xl backdrop-blur-xl',
                    userButtonPopoverActionButton: 'text-gray-300 hover:text-white hover:bg-white/10',
                    userButtonPopoverActionButtonText: 'text-gray-300',
                    userButtonPopoverActionButtonIcon: 'text-gray-400',
                    userButtonPopoverFooter: 'hidden',
                    userPreviewMainIdentifier: 'text-white',
                    userPreviewSecondaryIdentifier: 'text-gray-400',
                  },
                }}
              />
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
            className="md:hidden p-2 text-gray-600 dark:text-gray-300"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="px-4 py-4 space-y-3">
            <SignedIn>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </Link>
              <div className="px-3 py-2 flex items-center gap-3">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: 'w-9 h-9',
                      userButtonPopoverCard: 'bg-gray-900 border border-white/20 shadow-2xl backdrop-blur-xl',
                      userButtonPopoverActionButton: 'text-gray-300 hover:text-white hover:bg-white/10',
                      userButtonPopoverActionButtonText: 'text-gray-300',
                      userButtonPopoverActionButtonIcon: 'text-gray-400',
                      userButtonPopoverFooter: 'hidden',
                      userPreviewMainIdentifier: 'text-white',
                      userPreviewSecondaryIdentifier: 'text-gray-400',
                    },
                  }}
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {user?.firstName || user?.emailAddresses[0]?.emailAddress}
                </span>
              </div>
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
