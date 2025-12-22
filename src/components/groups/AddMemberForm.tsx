'use client';

import { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, X, Copy, Check, Type, Globe, User, FileText, AlertCircle, Loader2, Layers } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ObjectType } from '@/types';

type ImageSourceType = 'url' | 'upload';
type AddMode = 'single' | 'bulk';

interface ParsedItem {
  name: string;
  description?: string;
  image?: string;
  linkUrl?: string;
}

interface AddMemberFormProps {
  onSubmit: (data: {
    email: string | null;
    name: string;
    placeholderImageUrl: string;
    description: string | null;
    itemType: ObjectType;
    linkUrl: string | null;
    itemCategory: string | null;
  }) => Promise<void>;
  onBulkSubmit?: (items: Array<{
    email: string | null;
    name: string;
    placeholderImageUrl: string;
    description: string | null;
    itemType: ObjectType;
    linkUrl: string | null;
    itemCategory: string | null;
  }>) => Promise<void>;
  onCancel: () => void;
  onUploadImage?: (file: File) => Promise<string>;
  existingEmails?: string[];
  groupId: string;
}

export default function AddMemberForm({ onSubmit, onBulkSubmit, onCancel, onUploadImage, existingEmails = [], groupId }: AddMemberFormProps) {
  // Mode toggle
  const [addMode, setAddMode] = useState<AddMode>('single');

  // Common state
  const [itemType, setItemType] = useState<ObjectType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single mode state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [placeholderImageUrl, setPlaceholderImageUrl] = useState('');
  const [imageSourceType, setImageSourceType] = useState<ImageSourceType>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk mode state
  const [bulkText, setBulkText] = useState('');
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [parsePreview, setParsePreview] = useState<ParsedItem[]>([]);

  const exampleText = {
    text: `Apple, A popular fruit
Banana, Yellow tropical fruit
Orange`,
    link: `https://www.espn.com/nba/player/_/id/1966/lebron-james
https://www.espn.com/nba/player/_/id/3975/stephen-curry, Steph Curry
https://www.espn.com/nba/player/_/id/6583/kevin-durant, KD, Brooklyn Nets forward`,
    user: `John Doe, Engineering Lead
Jane Smith, Product Manager
Bob Wilson`,
  };

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

  const parseInput = (text: string, type: ObjectType): ParsedItem[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const parsed: ParsedItem[] = [];

    for (const line of lines) {
      const parts = line.split(/[,;]/).map(p => p.trim()).filter(p => p);
      if (parts.length === 0) continue;

      if (type === 'link') {
        const linkUrl = parts[0];
        const name = parts[1] || '';
        const description = parts[2] || '';
        parsed.push({ name: name || linkUrl, linkUrl, description, image: '' });
      } else {
        const name = parts[0];
        const description = parts[1] || '';
        parsed.push({ name, description });
      }
    }
    return parsed;
  };

  const handleTextChange = (text: string) => {
    setBulkText(text);
    if (itemType && text.trim()) {
      const preview = parseInput(text, itemType);
      setParsePreview(preview);
    } else {
      setParsePreview([]);
    }
  };

  const handleTypeChange = (type: ObjectType) => {
    setItemType(type);
    if (addMode === 'bulk' && bulkText.trim()) {
      const preview = parseInput(bulkText, type);
      setParsePreview(preview);
    }
  };

  const fetchLinkMetadata = async (url: string): Promise<{ title?: string; description?: string; image?: string }> => {
    try {
      const response = await fetch(`/api/fetch-metadata?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('Failed to fetch metadata for', url, err);
    }
    return {};
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
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

    if (itemType === 'link' && linkUrl.trim()) {
      try {
        new URL(linkUrl.trim());
      } catch {
        setError('Please enter a valid URL');
        return;
      }
    }

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
        itemCategory: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!itemType) {
      setError('Please select an item type');
      return;
    }

    if (!bulkText.trim()) {
      setError('Please enter at least one item');
      return;
    }

    if (!onBulkSubmit) {
      setError('Bulk add is not available');
      return;
    }

    const parsed = parseInput(bulkText, itemType);
    if (parsed.length === 0) {
      setError('No valid items found. Check your format.');
      return;
    }

    setLoading(true);

    try {
      let finalItems = parsed;

      if (itemType === 'link') {
        setFetchingMetadata(true);
        const itemsWithMetadata = await Promise.all(
          parsed.map(async (item) => {
            if (item.linkUrl) {
              const needsName = !item.name || item.name === item.linkUrl;
              const needsDescription = !item.description;
              const needsImage = !item.image;

              if (needsName || needsDescription || needsImage) {
                const metadata = await fetchLinkMetadata(item.linkUrl);
                return {
                  ...item,
                  name: needsName && metadata.title ? metadata.title : item.name,
                  description: needsDescription && metadata.description ? metadata.description : item.description,
                  image: needsImage && metadata.image ? metadata.image : item.image,
                };
              }
            }
            return item;
          })
        );
        finalItems = itemsWithMetadata;
        setFetchingMetadata(false);
      }

      const items = finalItems.map(item => ({
        email: null,
        name: item.name,
        placeholderImageUrl: item.image || '',
        description: item.description || null,
        itemType,
        linkUrl: item.linkUrl || null,
        itemCategory: null,
      }));

      await onBulkSubmit(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add items');
    } finally {
      setLoading(false);
      setFetchingMetadata(false);
    }
  };

  return (
    <form onSubmit={addMode === 'single' ? handleSingleSubmit : handleBulkSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm backdrop-blur-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Mode Toggle */}
      {onBulkSubmit && (
        <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
          <button
            type="button"
            onClick={() => setAddMode('single')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-all ${
              addMode === 'single'
                ? 'bg-lime-500/20 text-lime-300'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            <User className="w-4 h-4" />
            Single
          </button>
          <button
            type="button"
            onClick={() => setAddMode('bulk')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-all ${
              addMode === 'bulk'
                ? 'bg-lime-500/20 text-lime-300'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4" />
            Bulk
          </button>
        </div>
      )}

      {/* Item Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          {addMode === 'single' ? 'What type of item is this?' : 'Item Type'}
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleTypeChange('text')}
            className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border transition-all backdrop-blur-sm ${
              itemType === 'text'
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <Type className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium">Text</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('link')}
            className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border transition-all backdrop-blur-sm ${
              itemType === 'link'
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium">Link</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('user')}
            className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border transition-all backdrop-blur-sm ${
              itemType === 'user'
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <User className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium">User</span>
          </button>
        </div>
        {addMode === 'single' && (
          <p className="text-xs text-gray-500 mt-2">
            {itemType === 'text' && 'A simple text item with name, description, and image.'}
            {itemType === 'link' && 'An item with a URL link that can be clicked.'}
            {itemType === 'user' && 'A user that can be invited to claim this item.'}
            {!itemType && 'Select the type of item you want to add.'}
          </p>
        )}
      </div>

      {/* Single Mode Form Fields */}
      {addMode === 'single' && itemType && (
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

      {/* Bulk Mode Form Fields */}
      {addMode === 'bulk' && itemType && (
        <>
          <div className="border-t border-white/10 pt-4" />

          {/* Format Instructions */}
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-gray-400">
            <div className="flex items-center gap-2 mb-2 text-gray-300 font-medium">
              <FileText className="w-4 h-4" />
              Format: One item per line
            </div>
            {itemType === 'link' ? (
              <>
                <p>URL, Title (optional), Description (optional)</p>
                <p className="mt-1 text-lime-400/70">
                  Title, description & image are auto-fetched from links when not provided
                </p>
              </>
            ) : (
              <p>Name, Description (optional)</p>
            )}
            <p className="mt-1 text-gray-500">
              Separate fields with comma (,) or semicolon (;)
            </p>
          </div>

          {/* Textarea */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Items
              </label>
              <button
                type="button"
                onClick={() => handleTextChange(exampleText[itemType])}
                className="text-xs text-lime-400 hover:text-lime-300 transition-colors"
              >
                Load Example
              </button>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={`Enter items, one per line...\n\nExample:\n${exampleText[itemType]}`}
              rows={6}
              className="w-full px-3 py-2 border rounded-xl text-white bg-white/5 backdrop-blur-sm border-white/20 focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500/50 placeholder:text-gray-600 font-mono text-sm resize-none"
            />
          </div>

          {/* Preview */}
          {parsePreview.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-300 mb-2">
                Preview ({parsePreview.length} items)
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-white/5 border border-white/10 rounded-xl">
                {parsePreview.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-4">{i + 1}.</span>
                    <span className="text-white font-medium truncate flex-1">{item.name}</span>
                    {item.description && (
                      <span className="text-gray-500 truncate max-w-[100px]">{item.description}</span>
                    )}
                    {itemType === 'link' && item.name === item.linkUrl && (
                      <span className="text-lime-400/60 text-[10px]">auto</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          type="submit"
          loading={loading}
          disabled={!itemType || (addMode === 'bulk' && !bulkText.trim())}
          className="flex-1"
        >
          {addMode === 'bulk' ? (
            fetchingMetadata ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              `Add ${parsePreview.length > 0 ? `${parsePreview.length} Items` : 'Items'}`
            )
          ) : (
            'Add Item'
          )}
        </Button>
      </div>
    </form>
  );
}
