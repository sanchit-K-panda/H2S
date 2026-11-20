import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Domino Sky — Flight Disruption Cascade & Recovery Simulator",
  description: "Interactive flight network disruption cascade simulator with deterministic engine and AI recovery dispatcher.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-sky-100 selection:text-sky-900">
        <a href="#main-content" className="skip-link">
          Skip to main results
        </a>
        {children}
      </body>
    </html>
  );
}
