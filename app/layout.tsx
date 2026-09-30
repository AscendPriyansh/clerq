import type { Metadata } from "next";
import "./globals.css";
import { ThemeControl } from "@/components/theme-control";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export const metadata: Metadata = {
  title: { default: "Clerq — Receipts and reconciliation", template: "%s | Clerq" },
  icons: { icon: "/icon.svg" },
  description: "Receipt ingestion and bank reconciliation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-AU"
      className="h-full font-sans antialiased"
      suppressHydrationWarning
    >
      <head><script dangerouslySetInnerHTML={{ __html: "(function(){try{var t=localStorage.getItem('clerq-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){document.documentElement.classList.toggle('dark',matchMedia('(prefers-color-scheme: dark)').matches)}})()" }} /></head>
      <body className="min-h-full flex flex-col"><a href="#main-content" className="skip-link">Skip to content</a><NuqsAdapter>{children}</NuqsAdapter><ThemeControl /></body>
    </html>
  );
}
