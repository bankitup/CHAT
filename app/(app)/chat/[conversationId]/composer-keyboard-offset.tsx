'use client';

import { useEffect, useRef } from 'react';

export function ComposerKeyboardOffset() {
  const restingViewportHeightRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;

    const updateOffset = () => {
      const viewport = window.visualViewport;

      if (!viewport) {
        root.style.setProperty('--chat-keyboard-offset', '0px');
        root.dataset.chatKeyboardOpen = 'false';
        return;
      }

      const viewportBottom = viewport.height + viewport.offsetTop;

      if (viewportBottom > restingViewportHeightRef.current) {
        restingViewportHeightRef.current = viewportBottom;
      }

      const rawKeyboardOffset = Math.max(
        0,
        restingViewportHeightRef.current - viewport.height - viewport.offsetTop,
      );
      const isKeyboardOpen = rawKeyboardOffset > 24;
      const keyboardOffset = isKeyboardOpen ? rawKeyboardOffset : 0;

      root.style.setProperty(
        '--chat-keyboard-offset',
        `${Math.round(keyboardOffset)}px`,
      );
      root.dataset.chatKeyboardOpen = isKeyboardOpen ? 'true' : 'false';
    };

    const handleOrientationChange = () => {
      restingViewportHeightRef.current = 0;
      updateOffset();
    };

    updateOffset();

    window.visualViewport?.addEventListener('resize', updateOffset);
    window.visualViewport?.addEventListener('scroll', updateOffset);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateOffset);
      window.visualViewport?.removeEventListener('scroll', updateOffset);
      window.removeEventListener('orientationchange', handleOrientationChange);
      root.style.setProperty('--chat-keyboard-offset', '0px');
      root.dataset.chatKeyboardOpen = 'false';
    };
  }, []);

  return null;
}
