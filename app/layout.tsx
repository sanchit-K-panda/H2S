import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Domino Sky — Flight Disruption Cascade & Recovery Simulator",
  description: "Interactive flight disruption cascade simulator with deterministic engine and AI dispatcher recovery recommendations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
