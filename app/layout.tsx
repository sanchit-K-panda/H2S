import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Domino Sky — Flight Disruption Cascade & Recovery Simulator",
  description:
    "Interactive single-day flight network disruption simulator and AI recovery dispatcher.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-skybg text-skytext antialiased selection:bg-blue-100 selection:text-blue-900">
        <Toaster position="top-right" richColors />
        {children}
      </body>
    </html>
  );
}
