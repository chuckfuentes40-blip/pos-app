import './globals.css';
import SyncManager from '@/components/SyncManager';

export const metadata = {
  title: 'Peddlr POS',
  description: 'POS, Inventory, and Load Application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <SyncManager />
        {children}
      </body>
    </html>
  );
}