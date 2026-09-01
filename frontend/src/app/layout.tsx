import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "PackSure | Legal Metrology Review",
  description:
    "Evidence-backed package declaration analysis for the SIH 2026 prototype.",
  openGraph: {
    title: "PackSure | Legal Metrology Review",
    description: "Evidence-backed package declaration analysis for the SIH 2026 prototype.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "PackSure compliance review" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PackSure | Legal Metrology Review",
    description: "Evidence-backed package declaration analysis for the SIH 2026 prototype.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
