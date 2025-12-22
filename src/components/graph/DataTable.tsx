'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Pencil, Check, X, Camera, Trash2, Link2, Settings, ChevronUp, ChevronDown, ToggleLeft, Users, Anchor } from 'lucide-react';
import { GroupObject, Metric, AggregatedScore, Rating, ObjectRatingMode, getObjectDisplayName, getObjectDisplayImage, metricAppliesToObject } from '@/types';
import Avatar from '@/components/ui/Avatar';

interface DataTableProps {
  objects: GroupObject[];
  metrics: Metric[];
  scores: AggregatedScore[];
  groupId: string;
  onObjectClick?: (object: GroupObject) => void;
  onToggleVisibility?: (objectId: string, visible: boolean) => void;
  showVisibilityToggle?: boolean;
  currentUserId?: string | null;
  existingRatings?: Rating[];
  onSubmitRating?: (metricId: string, targetObjectId: string, value: number) => Promise<void>;
  canRate?: boolean;
  isCaptain?: boolean;
  onEditObject?: (objectId: string, data: { name: string; description?: string }) => Promise<void>;
  onUploadObjectImage?: (objectId: string, file: File) => Promise<void>;
  onRemoveObject?: (objectId: string) => Promise<void>;
  onCopyClaimLink?: (objectId: string) => Promise<void>;
  onToggleRatingMode?: (objectId: string, mode: ObjectRatingMode) => Promise<void>;
  onToggleMetricForObject?: (objectId: string, metricId: string, enabled: boolean) => Promise<void>;
}

export default function DataTable({
  objects,
  metrics,
  scores,
  groupId,
  onObjectClick,
  onToggleVisibility,
  showVisibilityToggle = false,
  currentUserId,
  existingRatings = [],
  onSubmitRating,
  canRate = false,
  isCaptain = false,
  onEditObject,
  onUploadObjectImage,
  onRemoveObject,
  onCopyClaimLink,
  onToggleRatingMode,
  onToggleMetricForObject,
}: DataTableProps) {
  const [editingCell, setEditingCell] = useState<{ objectId: string; metricId: string } | null>(null);
  const [editValue, setEditValue] = useState<number>(50);
  const [saving, setSaving] = useState(false);
  const [editingObject, setEditingObject] = useState<string | null>(null);
  const [editObjectData, setEditObjectData] = useState<{ name: string; description: string }>({ name: '', description: '' });
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [showObjectActions, setShowObjectActions] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Filter and sort objects
  const displayObjects = useMemo(() => {
    const filtered = objects.filter((obj) => obj.visibleInGraph !== false);

    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      if (sortColumn === 'name') {
        const nameA = getObjectDisplayName(a).toLowerCase();
        const nameB = getObjectDisplayName(b).toLowerCase();
        return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }

      // Sort by metric score
      const scoreA = scores.find((s) => s.objectId === a.id && s.metricId === sortColumn)?.averageValue ?? 0;
      const scoreB = scores.find((s) => s.objectId === b.id && s.metricId === sortColumn)?.averageValue ?? 0;
      return sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    });
  }, [objects, sortColumn, sortDirection, scores]);

  const getScore = (objectId: string, metricId: string): number => {
    const score = scores.find((s) => s.objectId === objectId && s.metricId === metricId);
    return score?.averageValue ?? 0;
  };

  const getRatingCount = (objectId: string, metricId: string): number => {
    const score = scores.find((s) => s.objectId === objectId && s.metricId === metricId);
    return score?.totalRatings ?? 0;
  };

  const getUserRating = (objectId: string, metricId: string): number | null => {
    if (!currentUserId) return null;
    const rating = existingRatings.find(
      (r) => r.targetObjectId === objectId && r.metricId === metricId && r.raterId === currentUserId
    );
    return rating?.value ?? null;
  };

  const getScoreColor = (value: number, metric?: Metric) => {
    const min = metric?.minValue ?? 0;
    const max = metric?.maxValue ?? 100;
    const range = max - min;
    const normalizedValue = range > 0 ? ((value - min) / range) * 100 : 50;

    if (normalizedValue >= 75) return 'text-green-600 dark:text-green-400';
    if (normalizedValue >= 50) return 'text-yellow-500 dark:text-yellow-400';
    if (normalizedValue >= 25) return 'text-orange-500 dark:text-orange-400';
    return 'text-red-500 dark:text-red-400';
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleStartEdit = (objectId: string, metricId: string) => {
    const existingValue = getUserRating(objectId, metricId);
    setEditingCell({ objectId, metricId });
    setEditValue(existingValue ?? 50);
  };

  // Auto-save with debounce
  const autoSaveRating = useCallback(async (metricId: string, objectId: string, value: number) => {
    if (!onSubmitRating) return;

    setSaving(true);
    try {
      await onSubmitRating(metricId, objectId, value);
    } finally {
      setSaving(false);
    }
  }, [onSubmitRating]);

  const handleSliderChange = (value: number) => {
    setEditValue(value);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (editingCell) {
      saveTimeoutRef.current = setTimeout(() => {
        autoSaveRating(editingCell.metricId, editingCell.objectId, value);
      }, 500);
    }
  };

  const handleCancelEdit = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setEditingCell(null);
  };

  const handleStartEditObject = (obj: GroupObject) => {
    setEditingObject(obj.id);
    setEditObjectData({ name: obj.name, description: obj.description || '' });
  };

  const handleSaveObject = async () => {
    if (!editingObject || !onEditObject) return;

    setSaving(true);
    try {
      await onEditObject(editingObject, editObjectData);
      setEditingObject(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEditObject = () => {
    setEditingObject(null);
  };

  const handleImageUpload = async (objectId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadObjectImage) return;

    setUploadingImage(objectId);
    try {
      await onUploadObjectImage(objectId, file);
    } finally {
      setUploadingImage(null);
    }
  };

  const handleToggleObjectActions = (objectId: string) => {
    if (showObjectActions === objectId) {
      setShowObjectActions(null);
      setDropdownPosition(null);
    } else {
      const button = actionButtonRefs.current[objectId];
      if (button) {
        const rect = button.getBoundingClientRect();
        const dropdownWidth = 288;
        let left = rect.left;
        if (left + dropdownWidth > window.innerWidth - 16) {
          left = window.innerWidth - dropdownWidth - 16;
        }
        if (left < 16) {
          left = 16;
        }
        setDropdownPosition({
          top: rect.bottom + 4,
          left: left,
        });
      }
      setShowObjectActions(objectId);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showObjectActions) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-dropdown]') && !target.closest('[data-action-button]')) {
          setShowObjectActions(null);
          setDropdownPosition(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showObjectActions]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="overflow-x-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const objectId = fileInputRef.current?.dataset.objectId;
          if (objectId) {
            handleImageUpload(objectId, e);
          }
        }}
        className="hidden"
      />

      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-20 bg-gray-800">
          <tr className="border-b border-gray-700">
            <th
              className="text-left py-2 sm:py-3 px-2 sm:px-3 font-semibold text-white cursor-pointer hover:bg-gray-700 transition-colors sticky left-0 top-0 bg-gray-800 z-30 min-w-[80px] sm:min-w-[140px]"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs sm:text-sm">Object</span>
                {sortColumn === 'name' && (
                  sortDirection === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                )}
              </div>
            </th>
            {metrics.map((metric) => (
              <th
                key={metric.id}
                className="text-center py-2 sm:py-3 px-2 sm:px-4 font-semibold text-white min-w-[50px] sm:min-w-[100px] cursor-pointer hover:bg-gray-700 transition-colors sticky top-0 bg-gray-800"
                title={metric.description}
                onClick={() => handleSort(metric.id)}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs sm:text-sm">{metric.name}</span>
                  {sortColumn === metric.id && (
                    sortDirection === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                  )}
                </div>
              </th>
            ))}
            {isCaptain && (
              <th className="text-center py-2 sm:py-3 px-2 font-semibold text-white w-16 sm:w-20 sticky top-0 bg-gray-800">
                <Settings className="w-4 h-4 mx-auto text-gray-400" />
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {displayObjects.map((obj) => (
            <tr
              key={obj.id}
              className={`border-b border-gray-700 hover:bg-gray-700/50 transition-colors ${
                !obj.visibleInGraph ? 'opacity-50' : ''
              }`}
            >
              <td className="py-2 sm:py-3 px-2 sm:px-3 sticky left-0 bg-gray-800 z-10">
                {editingObject === obj.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editObjectData.name}
                      onChange={(e) => setEditObjectData((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                      placeholder="Name"
                    />
                    <input
                      type="text"
                      value={editObjectData.description}
                      onChange={(e) => setEditObjectData((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                      placeholder="Description"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleSaveObject}
                        disabled={saving}
                        className="p-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={handleCancelEditObject}
                        className="p-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/groups/${groupId}/objects/${obj.id}`}
                    className="flex items-center gap-2 hover:text-lime-400 transition-colors"
                    onClick={(e) => {
                      if (onObjectClick) {
                        e.preventDefault();
                        onObjectClick(obj);
                      }
                    }}
                  >
                    <div className="relative group flex-shrink-0">
                      <Avatar
                        src={getObjectDisplayImage(obj)}
                        alt={getObjectDisplayName(obj)}
                        size="sm"
                      />
                      {isCaptain && onUploadObjectImage && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (fileInputRef.current) {
                              fileInputRef.current.dataset.objectId = obj.id;
                              fileInputRef.current.click();
                            }
                          }}
                          className="absolute -bottom-1 -right-1 w-4 h-4 bg-lime-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Upload image"
                        >
                          {uploadingImage === obj.id ? (
                            <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Camera className="w-2 h-2" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white text-xs sm:text-sm flex items-center gap-1">
                        <span className="sm:hidden flex flex-col leading-tight">
                          <span className="truncate">{getObjectDisplayName(obj).split(' ')[0]}</span>
                          <span className="truncate text-gray-300">{getObjectDisplayName(obj).split(' ').slice(1).join(' ')}</span>
                        </span>
                        <span className="hidden sm:inline truncate">{getObjectDisplayName(obj)}</span>
                        {obj.claimStatus === 'claimed' && (
                          <span className="text-xs text-lime-400">claimed</span>
                        )}
                      </div>
                      {obj.category && (
                        <span className="text-[9px] sm:text-[10px] px-1 py-0.5 bg-gray-700 text-gray-400 rounded mt-0.5 inline-block">
                          {obj.category}
                        </span>
                      )}
                    </div>
                  </Link>
                )}
              </td>
              {metrics.map((metric) => {
                const isApplicable = metricAppliesToObject(metric, obj);
                const score = getScore(obj.id, metric.id);
                const count = getRatingCount(obj.id, metric.id);
                const userRating = getUserRating(obj.id, metric.id);
                const isEditing = editingCell?.objectId === obj.id && editingCell?.metricId === metric.id;

                // If metric is disabled for this object, show toggle to enable
                if (!isApplicable) {
                  return (
                    <td key={metric.id} className="py-2 sm:py-3 px-2 sm:px-4 text-center">
                      {isCaptain && onToggleMetricForObject ? (
                        <button
                          onClick={() => onToggleMetricForObject(obj.id, metric.id, true)}
                          className="text-gray-600 hover:text-lime-400 transition-colors group"
                          title="Enable this metric for this object"
                        >
                          <ToggleLeft className="w-5 h-5 mx-auto" />
                        </button>
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>
                  );
                }

                return (
                  <td key={metric.id} className="py-2 sm:py-3 px-2 sm:px-4 text-center">
                    {isEditing ? (
                      <div className="flex flex-col items-center gap-2">
                        <input
                          type="range"
                          min={metric.minValue}
                          max={metric.maxValue}
                          value={editValue}
                          onChange={(e) => handleSliderChange(Number(e.target.value))}
                          className="w-full h-2 accent-lime-500"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs">{metric.prefix}</span>
                          <input
                            type="number"
                            min={metric.minValue}
                            max={metric.maxValue}
                            value={editValue}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const clampedVal = Math.min(Math.max(val, metric.minValue), metric.maxValue);
                              handleSliderChange(clampedVal);
                            }}
                            className="w-16 px-2 py-1 text-sm font-medium text-white text-center bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-lime-500"
                          />
                          <span className="text-gray-400 text-xs">{metric.suffix}</span>
                          {saving && (
                            <div className="w-3 h-3 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
                          )}
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 bg-gray-600 text-white rounded hover:bg-gray-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative group">
                        <div
                          className={`${canRate && onSubmitRating && isApplicable ? 'cursor-pointer hover:bg-gray-700 rounded-lg p-1.5 -m-1.5 transition-colors' : ''}`}
                          onClick={() => canRate && onSubmitRating && isApplicable && handleStartEdit(obj.id, metric.id)}
                        >
                          <div className={`font-semibold text-sm ${getScoreColor(score, metric)}`}>
                            {metric.prefix}{score.toFixed(1)}{metric.suffix}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-400">
                            {count} rating{count !== 1 ? 's' : ''}
                          </div>
                          {userRating !== null && (
                            <div className="text-[10px] sm:text-xs text-lime-400 mt-0.5">
                              You: {metric.prefix}{userRating}{metric.suffix}
                            </div>
                          )}
                        </div>
                        {isCaptain && onToggleMetricForObject && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleMetricForObject(obj.id, metric.id, false);
                            }}
                            className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 bg-gray-700 rounded hover:bg-red-600"
                            title="Disable this metric for this object"
                          >
                            <X className="w-3 h-3 text-gray-400 hover:text-white" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
              {isCaptain && (
                <td className="py-2 sm:py-3 px-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {showVisibilityToggle && (
                      <button
                        onClick={() => onToggleVisibility?.(obj.id, !obj.visibleInGraph)}
                        className={`p-1.5 rounded transition-colors ${
                          obj.visibleInGraph
                            ? 'text-lime-400 hover:bg-gray-700'
                            : 'text-gray-500 hover:bg-gray-700'
                        }`}
                        title={obj.visibleInGraph ? 'Hide from graph' : 'Show in graph'}
                      >
                        {obj.visibleInGraph ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      ref={(el) => { actionButtonRefs.current[obj.id] = el; }}
                      data-action-button
                      onClick={() => handleToggleObjectActions(obj.id)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                      title="Object actions"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {displayObjects.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No objects to display
        </div>
      )}

      {/* Dropdown for object actions */}
      {showObjectActions && dropdownPosition && (
        <div
          data-dropdown
          className="fixed w-72 max-w-[calc(100vw-32px)] bg-gray-800/95 backdrop-blur-xl rounded-3xl shadow-lg border border-white/10 z-50 max-h-[70vh] overflow-y-auto"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
          }}
        >
          {(() => {
            const obj = displayObjects.find((o) => o.id === showObjectActions);
            if (!obj) return null;
            return (
              <div className="p-2 space-y-1">
                {/* Rating mode toggle */}
                {onToggleRatingMode && (
                  <div className="p-2 border-b border-gray-700">
                    <p className="text-xs font-medium text-gray-400 mb-2">Rating Source</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onToggleRatingMode(obj.id, 'captain')}
                        className={`flex-1 px-2 py-1.5 text-xs rounded-2xl backdrop-blur-sm transition-all ${
                          obj.ratingMode === 'captain'
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <Anchor className="w-3 h-3 inline mr-1" />
                        Captain Only
                      </button>
                      <button
                        onClick={() => onToggleRatingMode(obj.id, 'group')}
                        className={`flex-1 px-2 py-1.5 text-xs rounded-2xl backdrop-blur-sm transition-all ${
                          obj.ratingMode === 'group'
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <Users className="w-3 h-3 inline mr-1" />
                        Group Average
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {obj.ratingMode === 'captain'
                        ? "Only captain's rating counts"
                        : "Average of all ratings"}
                    </p>
                  </div>
                )}

                {/* Edit object */}
                {onEditObject && (
                  <button
                    onClick={() => {
                      handleStartEditObject(obj);
                      setShowObjectActions(null);
                      setDropdownPosition(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit Object
                  </button>
                )}

                {/* Upload image */}
                {onUploadObjectImage && (
                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.dataset.objectId = obj.id;
                        fileInputRef.current.click();
                      }
                      setShowObjectActions(null);
                      setDropdownPosition(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    Upload Image
                  </button>
                )}

                {/* Claim link for user-type objects */}
                {obj.objectType === 'user' && obj.claimStatus === 'unclaimed' && onCopyClaimLink && (
                  <button
                    onClick={() => {
                      onCopyClaimLink(obj.id);
                      setShowObjectActions(null);
                      setDropdownPosition(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    Copy Claim Link
                  </button>
                )}

                {/* Remove object */}
                {onRemoveObject && (
                  <button
                    onClick={() => {
                      onRemoveObject(obj.id);
                      setShowObjectActions(null);
                      setDropdownPosition(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-400 hover:bg-red-500/20 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Object
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
