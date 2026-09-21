import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clerq",
  description: "Receipt ingestion and bank reconciliation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-AU"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
