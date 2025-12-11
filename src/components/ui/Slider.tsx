'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  showValue?: boolean;
}

const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className = '', label, showValue = true, value, min = 0, max = 100, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {(label || showValue) && (
          <div className="flex items-center justify-between mb-2">
            {label && (
              <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
              </label>
            )}
            {showValue && (
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {value}
              </span>
            )}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          type="range"
          min={min}
          max={max}
          value={value}
          className={`
            w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:bg-blue-600
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:bg-blue-600
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:border-0
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    );
  }
);

Slider.displayName = 'Slider';

export default Slider;
