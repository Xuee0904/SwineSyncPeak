import { useCallback, useEffect, useRef, useState } from 'react';

const EXIT_DURATION_MS = 200; // Matches CSS duration
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function isVisibleFocusable(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
}

export default function useModalAnimation(isOpen, onClose, options = {}) {
  const { canClose = true, initialFocusRef = null } = options;
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimer = useRef(null);
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const isClosingRef = useRef(isClosing);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    setIsClosing(false);
    setShouldRender(isOpen);
  }

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    isClosingRef.current = isClosing;
  }, [isClosing]);

  useEffect(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    isClosingRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Handle body scroll lock
  useEffect(() => {
    if (!shouldRender) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalOverflow; };
  }, [shouldRender]);

  const requestClose = useCallback((afterClose) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);

    // The (+10) is a tiny buffer to let the CSS finish before unmounting
    closeTimer.current = setTimeout(() => {
      setShouldRender(false);
      isClosingRef.current = false;
      setIsClosing(false);
      onCloseRef.current?.();
      if (typeof afterClose === 'function') afterClose();
    }, EXIT_DURATION_MS + 10);
  }, []);

  // Manage initial focus, Escape dismissal, Tab focus trap, and focus restoration
  useEffect(() => {
    if (!shouldRender) return;

    const activeEl = document.activeElement;
    previousFocusRef.current = activeEl instanceof HTMLElement ? activeEl : null;

    const rafId = requestAnimationFrame(() => {
      const preferred = initialFocusRef?.current;
      if (preferred && isVisibleFocusable(preferred)) {
        preferred.focus();
        return;
      }

      const panel = panelRef.current;
      if (!panel) return;

      const firstInput = Array.from(panel.querySelectorAll('input:not([disabled])')).find(
        isVisibleFocusable
      );
      if (firstInput) {
        firstInput.focus();
        return;
      }

      const firstFocusable = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).find(
        isVisibleFocusable
      );
      if (firstFocusable) {
        firstFocusable.focus();
      }
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (canClose) {
          e.preventDefault();
          requestClose();
        }
        return;
      }

      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;

        const focusables = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
          isVisibleFocusable
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = document.activeElement;

        if (e.shiftKey) {
          if (current === first || !panel.contains(current)) {
            e.preventDefault();
            last.focus();
          }
        } else if (current === last || !panel.contains(current)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);

      const restoreTarget = previousFocusRef.current;
      if (restoreTarget && restoreTarget.isConnected && typeof restoreTarget.focus === 'function') {
        restoreTarget.focus();
      }
    };
  }, [shouldRender, canClose, initialFocusRef, requestClose]);

  return {
    shouldRender,
    isClosing,
    requestClose,
    panelRef,
    overlayClassName: isClosing ? 'animate-overlay-out' : 'animate-overlay-in',
    panelClassName: isClosing ? 'animate-panel-out' : 'animate-panel-in',
  };
}
