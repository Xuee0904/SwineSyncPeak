import { useState, useRef, useLayoutEffect, useEffect } from 'react';

/**
 * useSmoothStepTransition
 * 
 * A custom hook that enables ultra-smooth container resizing (height & max-width)
 * when transitioning between different steps, views, or success screens inside a modal.
 * 
 * @param {any} stepKey - A dependency value that changes when the step/view changes (e.g., step name, boolean `Boolean(successInfo)`)
 * @param {number} durationMs - The transition duration in milliseconds (default: 300)
 * @returns {object} { containerRef, style, isTransitioning }
 */
export default function useSmoothStepTransition(stepKey, durationMs = 300) {
  const containerRef = useRef(null);
  const [height, setHeight] = useState('auto');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevHeightRef = useRef(null);
  const resizeObserverRef = useRef(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Capture initial height if not yet captured
    if (prevHeightRef.current === null) {
      prevHeightRef.current = el.offsetHeight;
      return;
    }

    const newHeight = el.scrollHeight;

    // If height changed meaningfully between steps, animate smoothly
    if (Math.abs(prevHeightRef.current - newHeight) > 2) {
      setIsTransitioning(true);

      // Start explicitly at the previous height so CSS transition activates
      setHeight(`${prevHeightRef.current}px`);

      // Force browser reflow to register starting height
      el.getBoundingClientRect();

      // Trigger transition to target height
      setHeight(`${newHeight}px`);

      const timer = setTimeout(() => {
        setHeight('auto');
        setIsTransitioning(false);
        if (containerRef.current) {
          prevHeightRef.current = containerRef.current.offsetHeight;
        }
      }, durationMs);

      return () => {
        clearTimeout(timer);
      };
    } else {
      prevHeightRef.current = newHeight;
    }
  }, [stepKey, durationMs]);

  // Keep track of auto-height updates when not actively transitioning
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isTransitioning) return;

    const observer = new ResizeObserver((entries) => {
      if (!isTransitioning && entries[0]) {
        prevHeightRef.current = entries[0].contentRect.height;
      }
    });

    observer.observe(el);
    resizeObserverRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [isTransitioning]);

  return {
    containerRef,
    style: {
      height,
      transition: `height ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1), max-width ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      willChange: 'height, max-width, transform, opacity',
    },
    isTransitioning,
  };
}
