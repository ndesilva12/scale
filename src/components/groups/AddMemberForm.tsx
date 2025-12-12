'use client';

import { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, X, Copy, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type ImageSourceType = 'url' | 'upload';

interface AddMemberFormProps {
  onSubmit: (data: { email: string | null; name: string; placeholderImageUrl: string; description: string | null }) => Promise<void>;
  onCancel: () => void;
  onUploadImage?: (file: File) => Promise<string>;
  existingEmails?: string[];
  groupId: string;
}

export default function AddMemberForm({ onSubmit, onCancel, onUploadImage, existingEmails = [], groupId }: AddMemberFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [placeholderImageUrl, setPlaceholderImageUrl] = useState('');
  const [imageSourceType, setImageSourceType] = useState<ImageSourceType>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUser, setIsUser] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyInviteLink = async () => {
    const inviteLink = `${window.location.origin}/join/${groupId}`;
    await navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Email validation only if isUser is checked and email is provided
    const trimmedEmail = email.trim();
    if (isUser && trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setError('Please enter a valid email address');
        return;
      }
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
          setError('Image upload failed (CORS issue). Item will be added without custom image. You can configure Firebase Storage CORS settings to enable uploads.');
          // Don't return - allow item to be added without image
          finalImageUrl = '';
        }
      } else if (imageSourceType === 'url') {
        finalImageUrl = placeholderImageUrl.trim();
      }

      await onSubmit({
        email: isUser && trimmedEmail ? trimmedEmail.toLowerCase() : null,
        name: name.trim(),
        placeholderImageUrl: finalImageUrl,
        description: description.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
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

      {/* Copy Invite Link Section */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Share this link to let people join your group:
        </p>
        <button
          type="button"
          onClick={handleCopyInviteLink}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
        >
          {linkCopied ? (
            <>
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400">Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Invite Link</span>
            </>
          )}
        </button>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Or add an item directly:</p>
      </div>

      <Input
        label="Name"
        id="item-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter name"
        required
      />

      <div>
        <label htmlFor="item-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description (optional)
        </label>
        <input
          id="item-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description"
          maxLength={100}
          className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      {/* Image source type selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Image (optional)
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
            id="item-image-url"
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

      {/* User checkbox */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isUser}
            onChange={(e) => setIsUser(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            This item represents a user
          </span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">
          Check this to send an invite email to let someone claim this item
        </p>
      </div>

      {/* Email input - only shown when isUser is checked */}
      {isUser && (
        <div className="ml-7">
          <Input
            label="Email Address"
            id="item-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            An invitation will be sent to this email. Leave blank to send invite link manually.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          Add
        </Button>
      </div>
    </form>
  );
}
