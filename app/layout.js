import "./globals.css";

export const metadata = {
  title: "Zomato-lite · Ludhiana Burrito",
  description: "The fastest, most honest read on a restaurant. Beta.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
