import { useEffect, useRef, useState } from 'react';

const EXIT_DURATION_MS = 220;

/**
 * Keeps a modal mounted long enough to play its exit animation before
 * telling the parent to actually close it. Also hands back ready-to-use
 * class names for the overlay and the panel so every modal animates in
 * and out the same way.
 *
 * @param {boolean} isOpen - whether the parent wants this modal open
 * @param {() => void} onClose - the parent's real close handler
 * @returns {{
 *   shouldRender: boolean,
 *   isClosing: boolean,
 *   requestClose: (afterClose?: () => void) => void,
 *   overlayClassName: string,
 *   panelClassName: string,
 * }}
 */
export default function useModalAnimation(isOpen, onClose) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Cancel any exit animation in progress and mount immediately
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      setIsClosing(false);
      setShouldRender(true);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
      }
    };
  }, []);

  // Lock body scroll while the modal is mounted, compensating for the
  // scrollbar-width layout shift. Restores the previous values on unlock.
  useEffect(() => {
    if (!shouldRender) return;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [shouldRender]);

  /**
   * Starts the exit animation (backdrop fades, panel scales/slides down).
   * The parent's onClose only fires once that animation has actually
   * finished playing — and `afterClose` fires right after it. That makes
   * it the right place to chain a *new* modal opening (e.g. Login ->
   * Update Password): the first modal fully animates away before the next
   * one mounts, instead of the two flashing on top of each other.
   */
  const requestClose = (afterClose) => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimer.current = setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      onClose();
      if (typeof afterClose === 'function') afterClose();
    }, EXIT_DURATION_MS);
  };

  return {
    shouldRender,
    isClosing,
    requestClose,
    overlayClassName: isClosing ? 'animate-fade-out' : 'animate-fade-in',
    panelClassName: isClosing ? 'animate-modal-out' : 'animate-modal-in',
  };
}

export { EXIT_DURATION_MS };