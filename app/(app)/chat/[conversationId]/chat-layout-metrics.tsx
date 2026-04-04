'use client';

import { useEffect } from 'react';

export function ChatLayoutMetrics() {
  useEffect(() => {
    const chatScreen = document.querySelector<HTMLElement>('.chat-screen');
    const header = document.getElementById('chat-header-shell');
    const composer = document.getElementById('message-composer');

    if (!chatScreen) {
      return;
    }

    const updateMetrics = () => {
      const headerHeight = header
        ? Math.ceil(header.getBoundingClientRect().height)
        : 0;
      const composerHeight = composer
        ? Math.ceil(composer.getBoundingClientRect().height)
        : 0;

      chatScreen.style.setProperty(
        '--chat-header-measured-height',
        `${headerHeight}px`,
      );
      chatScreen.style.setProperty(
        '--chat-composer-measured-height',
        `${composerHeight}px`,
      );
    };

    updateMetrics();

    const resizeObserver = new ResizeObserver(() => {
      updateMetrics();
    });

    if (header) {
      resizeObserver.observe(header);
    }

    if (composer) {
      resizeObserver.observe(composer);
    }

    window.addEventListener('resize', updateMetrics);
    window.visualViewport?.addEventListener('resize', updateMetrics);
    window.visualViewport?.addEventListener('scroll', updateMetrics);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateMetrics);
      window.visualViewport?.removeEventListener('resize', updateMetrics);
      window.visualViewport?.removeEventListener('scroll', updateMetrics);
      chatScreen.style.removeProperty('--chat-header-measured-height');
      chatScreen.style.removeProperty('--chat-composer-measured-height');
    };
  }, []);

  return null;
}
