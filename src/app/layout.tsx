import './globals.css';
import SyncManager from '@/components/SyncManager';

const LOGO_URL = 'https://raw.githubusercontent.com/chuckfuentes40-blip/pos-app/main/Inaki.png';

export const metadata = {
  title: 'IÑAKI SARI-SARI STORE',
  description: 'POS, Inventory',
  manifest: '/manifest.json',
  icons: {
    icon: LOGO_URL,
    shortcut: LOGO_URL,
    apple: LOGO_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="bg-slate-950 text-slate-100">
        <SyncManager />
        {children}
      </body>
    </html>
  );
}