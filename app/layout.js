export const metadata = {
  title: "Chatter — Real-Time Chat",
  description: "Real-time chat starter with WebSocket support",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}