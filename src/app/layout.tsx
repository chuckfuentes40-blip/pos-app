import './globals.css';
import SyncManager from '@/components/SyncManager';

export const metadata = {
  title: 'Peddlr POS',
  description: 'POS, Inventory, and Load Application',
  manifest: '/manifest.json', // Add this line
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