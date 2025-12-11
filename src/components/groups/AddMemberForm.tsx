'use client';

import { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, X, UserPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Avatar from '@/components/ui/Avatar';

type ImageSourceType = 'url' | 'upload';

// Suggested members (mock accounts for demo/testing)
const suggestedMembers = [
  {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&backgroundColor=ffdfbf',
  },
  {
    name: 'Marcus Williams',
    email: 'marcus.williams@example.com',
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&backgroundColor=c0aede',
  },
  {
    name: 'Emily Davis',
    email: 'emily.davis@example.com',
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily&backgroundColor=d1f4d1',
  },
  {
    name: 'James Taylor',
    email: 'james.taylor@example.com',
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James&backgroundColor=ffd5dc',
  },
  {
    name: 'Olivia Martinez',
    email: 'olivia.martinez@example.com',
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Olivia&backgroundColor=fff4c0',
  },
];

interface AddMemberFormProps {
  onSubmit: (data: { email: string; name: string; placeholderImageUrl: string }) => Promise<void>;
  onCancel: () => void;
  onUploadImage?: (file: File) => Promise<string>;
  existingEmails?: string[];
}

export default function AddMemberForm({ onSubmit, onCancel, onUploadImage, existingEmails = [] }: AddMemberFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [placeholderImageUrl, setPlaceholderImageUrl] = useState('');
  const [imageSourceType, setImageSourceType] = useState<ImageSourceType>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter out already added members
  const availableSuggestions = suggestedMembers.filter(
    (s) => !existingEmails.includes(s.email.toLowerCase())
  );

  const handleSelectSuggestion = (suggestion: typeof suggestedMembers[0]) => {
    setName(suggestion.name);
    setEmail(suggestion.email);
    setPlaceholderImageUrl(suggestion.imageUrl);
    setImageSourceType('url');
    // Clear any file selection
    handleClearFile();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
      let finalImageUrl = '';

      if (imageSourceType === 'upload' && selectedFile && onUploadImage) {
        try {
          // Upload the file and get the URL
          finalImageUrl = await onUploadImage(selectedFile);
        } catch (uploadErr) {
          // Handle upload error gracefully - continue without image
          console.error('Image upload failed:', uploadErr);
          setError('Image upload failed (CORS issue). Member will be added without custom image. You can configure Firebase Storage CORS settings to enable uploads.');
          // Don't return - allow member to be added without image
          finalImageUrl = '';
        }
      } else if (imageSourceType === 'url') {
        finalImageUrl = placeholderImageUrl.trim();
      }

      await onSubmit({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        placeholderImageUrl: finalImageUrl,
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

      {/* Suggestions Section */}
      {availableSuggestions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick Add (Suggestions)
          </label>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.map((suggestion) => (
              <button
                key={suggestion.email}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <Avatar
                  src={suggestion.imageUrl}
                  alt={suggestion.name}
                  size="xs"
                />
                <span className="text-gray-700 dark:text-gray-300">{suggestion.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Or enter details manually:</p>
      </div>

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

      {/* Image source type selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Placeholder Image (optional)
        </label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setImageSourceType('url')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
              imageSourceType === 'url'
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            URL
          </button>
          <button
            type="button"
            onClick={() => setImageSourceType('upload')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
              imageSourceType === 'upload'
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>

        {/* URL input */}
        {imageSourceType === 'url' && (
          <Input
            id="member-image-url"
            type="url"
            value={placeholderImageUrl}
            onChange={(e) => setPlaceholderImageUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
          />
        )}

        {/* File upload */}
        {imageSourceType === 'upload' && (
          <div>
            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Click to upload an image
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  PNG, JPG, GIF up to 5MB
                </p>
              </div>
            ) : (
              <div className="relative inline-block">
                <img
                  src={previewUrl || ''}
                  alt="Preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                />
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              Note: Image upload requires Firebase Storage CORS configuration.
            </p>
          </div>
        )}
      </div>

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
