'use client';

import { useEffect } from 'react';

export function ComposerKeyboardOffset() {
  useEffect(() => {
    const root = document.documentElement;

    const updateOffset = () => {
      const viewport = window.visualViewport;

      if (!viewport) {
        root.style.setProperty('--chat-keyboard-offset', '0px');
        return;
      }

      const keyboardOffset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );

      root.style.setProperty(
        '--chat-keyboard-offset',
        `${Math.round(keyboardOffset)}px`,
      );
    };

    updateOffset();

    window.visualViewport?.addEventListener('resize', updateOffset);
    window.visualViewport?.addEventListener('scroll', updateOffset);
    window.addEventListener('orientationchange', updateOffset);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateOffset);
      window.visualViewport?.removeEventListener('scroll', updateOffset);
      window.removeEventListener('orientationchange', updateOffset);
      root.style.setProperty('--chat-keyboard-offset', '0px');
    };
  }, []);

  return null;
}
