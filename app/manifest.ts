import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CHAT',
    short_name: 'CHAT',
    description:
      'A mobile-first PWA messenger built as a reusable messaging-core and active product shell.',
    start_url: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    lang: 'en',
    categories: ['social', 'communication'],
    background_color: '#f7f8fa',
    theme_color: '#f7f8fa',
    icons: [
      {
        src: '/icon?size=192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon?size=512',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
