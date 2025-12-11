import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { Users, BarChart3, Eye, Share2 } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Visualize Your Team&apos;s{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Strengths
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Create groups, define custom metrics, and see your team members plotted on an
            interactive 2D graph based on crowdsourced ratings.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignedOut>
              <Link href="/sign-up">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Try Demo
                </Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button size="lg" className="w-full sm:w-auto">
                  Go to Dashboard
                </Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            How It Works
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Create Groups
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Set up groups for your team, club, or community with custom metrics.
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Define Metrics
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Create up to 10 custom metrics that matter to your group.
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <Share2 className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Rate Each Other
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Everyone rates everyone (including themselves) on each metric.
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                <Eye className="w-7 h-7 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Visualize Results
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                See aggregated scores plotted on an interactive 2D graph.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Create your first group and start mapping your team&apos;s strengths today.
          </p>
          <SignedOut>
            <Link href="/sign-up">
              <Button size="lg">Create Your First Group</Button>
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <Button size="lg">Go to Dashboard</Button>
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>&copy; {new Date().getFullYear()} Loyalty. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
