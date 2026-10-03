"use client";

import { useEffect, useId, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalAccessibility(isOpen: boolean, onClose: () => void) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // The app scrolls inside main-content, so locking only body leaves it moving
    // behind the dialog. Preserve scrollbar space and the caller's scroll position.
    const scrollContainers: { element: HTMLElement; overflowY: string; scrollbarGutter: string }[] = [];
    // Safari does not focus buttons on tap; use the app scroller in that case.
    let ancestor = previousFocusRef.current && previousFocusRef.current !== document.body && previousFocusRef.current !== document.documentElement
      ? previousFocusRef.current.parentElement
      : document.querySelector<HTMLElement>(".main-content");
    while (ancestor && ancestor !== document.body) {
      const style = window.getComputedStyle(ancestor);
      if (/auto|scroll/.test(style.overflowY)) {
        scrollContainers.push({
          element: ancestor,
          overflowY: ancestor.style.overflowY,
          scrollbarGutter: ancestor.style.scrollbarGutter,
        });
        const scrollbarWidth = ancestor.offsetWidth - ancestor.clientWidth
          - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
        if (scrollbarWidth > 0) ancestor.style.scrollbarGutter = "stable";
        ancestor.style.overflowY = "hidden";
      }
      ancestor = ancestor.parentElement;
    }

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => element.offsetParent !== null);

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const { element, overflowY, scrollbarGutter } of scrollContainers) {
        element.style.overflowY = overflowY;
        element.style.scrollbarGutter = scrollbarGutter;
      }
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  return { dialogRef, titleId };
}
