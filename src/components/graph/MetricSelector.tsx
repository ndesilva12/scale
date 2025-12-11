'use client';

import { Metric } from '@/types';
import Select from '@/components/ui/Select';

interface MetricSelectorProps {
  metrics: Metric[];
  xMetricId: string;
  yMetricId: string;
  onXMetricChange: (metricId: string) => void;
  onYMetricChange: (metricId: string) => void;
}

export default function MetricSelector({
  metrics,
  xMetricId,
  yMetricId,
  onXMetricChange,
  onYMetricChange,
}: MetricSelectorProps) {
  const options = metrics.map((m) => ({ value: m.id, label: m.name }));

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <Select
          label="X-Axis Metric"
          id="x-metric"
          options={options}
          value={xMetricId}
          onChange={(e) => onXMetricChange(e.target.value)}
        />
      </div>
      <div className="flex-1">
        <Select
          label="Y-Axis Metric"
          id="y-metric"
          options={options}
          value={yMetricId}
          onChange={(e) => onYMetricChange(e.target.value)}
        />
      </div>
    </div>
  );
}
