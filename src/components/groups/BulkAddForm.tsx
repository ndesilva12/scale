'use client';

import { useState } from 'react';
import { Type, Globe, User, FileText, AlertCircle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ObjectType } from '@/types';

interface BulkAddFormProps {
  onSubmit: (items: Array<{
    email: string | null;
    name: string;
    placeholderImageUrl: string;
    description: string | null;
    itemType: ObjectType;
    linkUrl: string | null;
    itemCategory: string | null;
  }>) => Promise<void>;
  onCancel: () => void;
}

interface ParsedItem {
  name: string;
  description?: string;
  image?: string;
  linkUrl?: string;
}

export default function BulkAddForm({ onSubmit, onCancel }: BulkAddFormProps) {
  const [itemType, setItemType] = useState<ObjectType | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const parseInput = (text: string, type: ObjectType): ParsedItem[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const parsed: ParsedItem[] = [];

    for (const line of lines) {
      // Split by comma or semicolon
      const parts = line.split(/[,;]/).map(p => p.trim()).filter(p => p);

      if (parts.length === 0) continue;

      if (type === 'link') {
        // For links: URL, name (optional), description (optional)
        const linkUrl = parts[0];
        const name = parts[1] || ''; // Will be fetched if empty
        const description = parts[2] || ''; // Will be fetched if empty
        parsed.push({ name: name || linkUrl, linkUrl, description, image: '' });
      } else {
        // For text/user: name, description (optional)
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
    if (bulkText.trim()) {
      const preview = parseInput(bulkText, type);
      setParsePreview(preview);
    }
  };

  // Fetch metadata for a single URL
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

  const handleSubmit = async (e: React.FormEvent) => {
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

    const parsed = parseInput(bulkText, itemType);
    if (parsed.length === 0) {
      setError('No valid items found. Check your format.');
      return;
    }

    setLoading(true);

    try {
      let finalItems = parsed;

      // For link type, fetch metadata for items without name/description
      if (itemType === 'link') {
        setFetchingMetadata(true);
        const itemsWithMetadata = await Promise.all(
          parsed.map(async (item) => {
            if (item.linkUrl) {
              // Check if we need to fetch metadata (no user-provided name or it's just the URL)
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

      await onSubmit(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add items');
    } finally {
      setLoading(false);
      setFetchingMetadata(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm backdrop-blur-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Item Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Item Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleTypeChange('text')}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all backdrop-blur-sm ${
              itemType === 'text'
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <Type className="w-5 h-5" />
            <span className="text-xs font-medium">Text</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('link')}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all backdrop-blur-sm ${
              itemType === 'link'
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <Globe className="w-5 h-5" />
            <span className="text-xs font-medium">Link</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('user')}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all backdrop-blur-sm ${
              itemType === 'user'
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-xs font-medium">User</span>
          </button>
        </div>
      </div>

      {/* Bulk Input */}
      {itemType && (
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
          disabled={!itemType || !bulkText.trim()}
          className="flex-1"
        >
          {fetchingMetadata ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Fetching...
            </>
          ) : (
            `Add ${parsePreview.length > 0 ? `${parsePreview.length} Items` : 'Items'}`
          )}
        </Button>
      </div>
    </form>
  );
}
