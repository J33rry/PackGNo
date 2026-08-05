import type { Metadata } from 'next';
import { Almarai, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

const almarai = Almarai({
  subsets: ['arabic'],
  weight: ['300', '400', '700', '800'],
  variable: '--font-almarai',
  display: 'swap',
});

const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PackNGo — one live board for the whole trip',
  description:
    'Shared map, group expenses with UPI settle-up, activity voting, live location, and SOS — realtime for the whole group.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark h-full antialiased ${almarai.variable} ${instrument.variable}`}>
      <body className="min-h-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
