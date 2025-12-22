'use client';

import { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, X, Copy, Check, Type, Globe, User } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ItemType } from '@/types';

type ImageSourceType = 'url' | 'upload';

interface AddMemberFormProps {
  onSubmit: (data: {
    email: string | null;
    name: string;
    placeholderImageUrl: string;
    description: string | null;
    itemType: ItemType;
    linkUrl: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  onUploadImage?: (file: File) => Promise<string>;
  existingEmails?: string[];
  groupId: string;
}

export default function AddMemberForm({ onSubmit, onCancel, onUploadImage, existingEmails = [], groupId }: AddMemberFormProps) {
  const [itemType, setItemType] = useState<ItemType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [placeholderImageUrl, setPlaceholderImageUrl] = useState('');
  const [imageSourceType, setImageSourceType] = useState<ImageSourceType>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
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

    if (!itemType) {
      setError('Please select an item type');
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Link URL validation for link type
    if (itemType === 'link' && linkUrl.trim()) {
      try {
        new URL(linkUrl.trim());
      } catch {
        setError('Please enter a valid URL');
        return;
      }
    }

    // Email validation for user type
    const trimmedEmail = email.trim();
    if (itemType === 'user' && trimmedEmail) {
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
          finalImageUrl = await onUploadImage(selectedFile);
        } catch (uploadErr) {
          console.error('Image upload failed:', uploadErr);
          setError('Image upload failed. Item will be added without custom image.');
          finalImageUrl = '';
        }
      } else if (imageSourceType === 'url') {
        finalImageUrl = placeholderImageUrl.trim();
      }

      await onSubmit({
        email: itemType === 'user' && trimmedEmail ? trimmedEmail.toLowerCase() : null,
        name: name.trim(),
        placeholderImageUrl: finalImageUrl,
        description: description.trim() || null,
        itemType,
        linkUrl: itemType === 'link' ? linkUrl.trim() : null,
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
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Item Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          What type of item is this?
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setItemType('text')}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all backdrop-blur-sm ${
              itemType === 'text'
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <Type className="w-6 h-6" />
            <span className="text-sm font-medium">Text</span>
          </button>
          <button
            type="button"
            onClick={() => setItemType('link')}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all backdrop-blur-sm ${
              itemType === 'link'
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <Globe className="w-6 h-6" />
            <span className="text-sm font-medium">Link</span>
          </button>
          <button
            type="button"
            onClick={() => setItemType('user')}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all backdrop-blur-sm ${
              itemType === 'user'
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <User className="w-6 h-6" />
            <span className="text-sm font-medium">User</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {itemType === 'text' && 'A simple text item with name, description, and image.'}
          {itemType === 'link' && 'An item with a URL link that can be clicked.'}
          {itemType === 'user' && 'A user that can be invited to claim this item.'}
          {!itemType && 'Select the type of item you want to add.'}
        </p>
      </div>

      {/* Form fields - only show after type is selected */}
      {itemType && (
        <>
          <div className="border-t border-white/10 pt-4" />

          <Input
            label="Name"
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter name"
            required
          />

          {/* Link URL - only for link type */}
          {itemType === 'link' && (
            <Input
              label="Link URL"
              id="item-link"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
            />
          )}

          <div>
            <label htmlFor="item-description" className="block text-sm font-medium text-gray-300 mb-1">
              Description (optional)
            </label>
            <input
              id="item-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              maxLength={100}
              className="w-full px-3 py-2 border rounded-xl text-white bg-white/5 border-white/20 focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500/50 placeholder:text-gray-500 backdrop-blur-sm"
            />
          </div>

          {/* Image source type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Image (optional)
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setImageSourceType('url')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-xl border transition-all backdrop-blur-sm ${
                  imageSourceType === 'url'
                    ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                    : 'border-white/20 text-gray-400 hover:bg-white/10'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                URL
              </button>
              <button
                type="button"
                onClick={() => setImageSourceType('upload')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-xl border transition-all backdrop-blur-sm ${
                  imageSourceType === 'upload'
                    ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                    : 'border-white/20 text-gray-400 hover:bg-white/10'
                }`}
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
            </div>

            {imageSourceType === 'url' && (
              <Input
                id="item-image-url"
                type="url"
                value={placeholderImageUrl}
                onChange={(e) => setPlaceholderImageUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
              />
            )}

            {imageSourceType === 'upload' && (
              <div>
                {!selectedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-lime-500/50 transition-colors backdrop-blur-sm"
                  >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400">
                      Click to upload an image
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG, GIF up to 5MB
                    </p>
                  </div>
                ) : (
                  <div className="relative inline-block">
                    <img
                      src={previewUrl || ''}
                      alt="Preview"
                      className="w-24 h-24 rounded-full object-cover border-2 border-white/20"
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
              </div>
            )}
          </div>

          {/* Email input - only for user type */}
          {itemType === 'user' && (
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
              <Input
                label="Email Address (optional)"
                id="item-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
              <p className="text-xs text-gray-500 mt-2">
                An invitation will be sent to this email. Leave blank to send invite link manually.
              </p>
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-gray-300 hover:bg-white/10 transition-colors"
              >
                {linkCopied ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Invite Link</span>
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" loading={loading} disabled={!itemType} className="flex-1">
          Add Item
        </Button>
      </div>
    </form>
  );
}
