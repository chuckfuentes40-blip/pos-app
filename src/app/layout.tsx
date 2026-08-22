import './globals.css';

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}