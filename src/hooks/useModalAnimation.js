import { useEffect, useRef, useState } from 'react';

const EXIT_DURATION_MS = 180;

/**
 * Keeps a modal mounted long enough to play its exit animation before
 * telling the parent to actually close it.
 *
 * @param {boolean} isOpen - whether the parent wants this modal open
 * @param {() => void} onClose - the parent's real close handler
 * @returns {{ shouldRender: boolean, isClosing: boolean, requestClose: () => void }}
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

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimer.current = setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      onClose();
    }, EXIT_DURATION_MS);
  };

  return { shouldRender, isClosing, requestClose };
}