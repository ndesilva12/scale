'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface AddMemberFormProps {
  onSubmit: (data: { email: string; name: string; placeholderImageUrl: string }) => Promise<void>;
  onCancel: () => void;
}

export default function AddMemberForm({ onSubmit, onCancel }: AddMemberFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [placeholderImageUrl, setPlaceholderImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        placeholderImageUrl: placeholderImageUrl.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <Input
        label="Name"
        id="member-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="John Doe"
        required
      />

      <Input
        label="Email Address"
        id="member-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="john@example.com"
        required
      />

      <Input
        label="Placeholder Image URL (optional)"
        id="member-image"
        type="url"
        value={placeholderImageUrl}
        onChange={(e) => setPlaceholderImageUrl(e.target.value)}
        placeholder="https://example.com/photo.jpg"
      />

      <p className="text-sm text-gray-500 dark:text-gray-400">
        An invitation will be sent to this email address. If they don&apos;t have an account yet,
        they can sign up and claim this membership.
      </p>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          Add Member
        </Button>
      </div>
    </form>
  );
}
