import type { Metadata, Viewport } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { getCookieLanguage } from '@/modules/i18n/server';
import './globals.css';

export const metadata: Metadata = {
  applicationName: 'BWC Products',
  title: {
    default: 'BWC Products',
    template: '%s | BWC Products',
  },
  description:
    'A mobile-first shared entry for Build With Care products, spaces, and messaging-powered workflows.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BWC Products',
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
  interactiveWidget: 'resizes-content',
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
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
