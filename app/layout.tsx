import type { Metadata, Viewport } from 'next';
import { getCookieLanguage } from '@/modules/i18n/server';
import './globals.css';

export const metadata: Metadata = {
  applicationName: 'CHAT',
  title: {
    default: 'CHAT',
    template: '%s | CHAT',
  },
  description:
    'A mobile-first PWA messenger built as a reusable messaging-core and active product shell.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CHAT',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon?size=192', sizes: '192x192', type: 'image/png' },
      { url: '/icon?size=512', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f8fa',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getCookieLanguage();

  return (
    <html lang={language}>
      <body>{children}</body>
    </html>
  );
}
