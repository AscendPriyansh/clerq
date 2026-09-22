import type { Metadata } from "next";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export const metadata: Metadata = {
  title: "Clerq",
  description: "Receipt ingestion and bank reconciliation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-AU"
      className="h-full font-sans antialiased"
    >
      <body className="min-h-full flex flex-col"><NuqsAdapter>{children}</NuqsAdapter></body>
    </html>
  );
}
