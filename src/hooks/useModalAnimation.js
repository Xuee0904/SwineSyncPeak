import { useEffect, useRef, useState } from 'react';

const EXIT_DURATION_MS = 200; // Matches CSS duration

export default function useModalAnimation(isOpen, onClose) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setIsClosing(false);
      setShouldRender(true);
    }
  }, [isOpen]);

  // Handle body scroll lock
  useEffect(() => {
    if (!shouldRender) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalOverflow; };
  }, [shouldRender]);

  const requestClose = (afterClose) => {
    if (isClosing) return;
    setIsClosing(true);
    
    // The (+10) is a tiny buffer to let the CSS finish before unmounting
    closeTimer.current = setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      onClose();
      if (typeof afterClose === 'function') afterClose();
    }, EXIT_DURATION_MS + 10);
  };

  return {
    shouldRender,
    isClosing,
    requestClose,
    // Use the classes defined in your CSS file
    overlayClassName: isClosing ? 'animate-overlay-out' : 'animate-overlay-in',
    panelClassName: isClosing ? 'animate-panel-out' : 'animate-panel-in',
  };
}