import React from 'react';

/**
 * PigSnout Icon — Domain icon for swine livestock management.
 * Designed to seamlessly match Lucide icon aesthetics (24x24 viewBox, stroke-compatible).
 */
export default function PigSnout({
  size = 24,
  className = '',
  strokeWidth = 2,
  ...props
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Outer snout oval */}
      <ellipse cx="12" cy="12" rx="9" ry="6.5" />
      {/* Left nostril */}
      <ellipse cx="9" cy="12" rx="1.4" ry="2.2" fill="currentColor" stroke="none" />
      {/* Right nostril */}
      <ellipse cx="15" cy="12" rx="1.4" ry="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

