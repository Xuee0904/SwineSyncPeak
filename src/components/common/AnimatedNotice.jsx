import React, { useRef } from "react";

/**
 * Smoothly expands/collapses inline warnings, validation errors, and alert banners
 * using CSS Grid row height + opacity + subtle vertical slide transitions.
 */
export default function AnimatedNotice({ show, children, className = "" }) {
  const lastContentRef = useRef(null);
  if (show && children) {
    lastContentRef.current = children;
  }

  return (
    <div
      aria-hidden={!show}
      className={`grid transition-[grid-template-rows,opacity,transform] duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
        show
          ? "grid-rows-[1fr] opacity-100 translate-y-0"
          : "grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none"
      } ${className}`}
    >
      <div className="overflow-hidden min-h-0">
        {show ? children : lastContentRef.current}
      </div>
    </div>
  );
}
