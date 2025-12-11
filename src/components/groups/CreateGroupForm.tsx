'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { Metric } from '@/types';

interface MetricInput {
  id: string;
  name: string;
  description: string;
}

interface CreateGroupFormProps {
  onSubmit: (data: { name: string; description: string; metrics: Omit<Metric, 'id'>[] }) => Promise<void>;
  onCancel: () => void;
}

export default function CreateGroupForm({ onSubmit, onCancel }: CreateGroupFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [metrics, setMetrics] = useState<MetricInput[]>([
    { id: '1', name: '', description: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMetric = () => {
    if (metrics.length >= 10) {
      setError('Maximum 10 metrics allowed');
      return;
    }
    setMetrics([
      ...metrics,
      { id: Date.now().toString(), name: '', description: '' },
    ]);
  };

  const removeMetric = (id: string) => {
    if (metrics.length <= 1) {
      setError('At least one metric is required');
      return;
    }
    setMetrics(metrics.filter((m) => m.id !== id));
  };

  const updateMetric = (id: string, field: 'name' | 'description', value: string) => {
    setMetrics(
      metrics.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    const validMetrics = metrics.filter((m) => m.name.trim());
    if (validMetrics.length === 0) {
      setError('At least one metric with a name is required');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        metrics: validMetrics.map((m, index) => ({
          name: m.name.trim(),
          description: m.description.trim(),
          order: index,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <Input
        label="Group Name"
        id="group-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="My Team"
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this group is for..."
          rows={3}
          className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Metrics ({metrics.length}/10)
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addMetric}
            disabled={metrics.length >= 10}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Metric
          </Button>
        </div>

        <div className="space-y-3">
          {metrics.map((metric, index) => (
            <Card key={metric.id} variant="bordered" className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center text-gray-400 mt-2">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-sm ml-1">{index + 1}</span>
                </div>
                <div className="flex-1 space-y-3">
                  <Input
                    placeholder="Metric name (e.g., Creativity)"
                    value={metric.name}
                    onChange={(e) => updateMetric(metric.id, 'name', e.target.value)}
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={metric.description}
                    onChange={(e) => updateMetric(metric.id, 'description', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeMetric(metric.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove metric"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          Create Group
        </Button>
      </div>
    </form>
  );
}
