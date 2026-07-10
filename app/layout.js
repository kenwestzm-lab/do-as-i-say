export const metadata = {
  title: 'DO AS I SAY',
  description: 'Real-time PDF/Word conversion and editing',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f1115', color: '#f0f0f0' }}>
        {children}
      </body>
    </html>
  );
}
