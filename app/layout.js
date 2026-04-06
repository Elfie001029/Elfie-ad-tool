import './globals.css';

export const metadata = {
  title: 'Ad Library Intelligence',
  description: 'Pull and analyze Facebook ads',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
