import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
// Self-hosted fonts: Geist ships with next/font/local, Source Serif 4 from @fontsource. No font CDN at runtime.
import "@fontsource-variable/source-serif-4/opsz.css";
import "@copilotkit/react-core/v2/styles.css"; // the chat's styles: import them explicitly, the bundler won't pull them in
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Harvey · Contract review",
  description: "Workshop starter: a contract-review copilot for a legal team, built with CopilotKit and AG-UI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
