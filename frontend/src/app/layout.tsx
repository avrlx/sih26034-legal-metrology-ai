import type { Metadata } from "next";

import { AuthUserMenu } from "@/components/auth-user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "ComplyVision | Legal Metrology AI",
  description:
    "Evidence-backed package declaration analysis for the SIH 2026 prototype.",
  openGraph: {
    title: "ComplyVision | Legal Metrology AI",
    description: "Evidence-backed package declaration analysis for the SIH 2026 prototype.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ComplyVision compliance review" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ComplyVision | Legal Metrology AI",
    description: "Evidence-backed package declaration analysis for the SIH 2026 prototype.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  const saved = localStorage.getItem("complyvision-theme");
                  const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
                  document.documentElement.classList.toggle("dark", dark);
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="pointer-events-none fixed right-4 top-4 z-[60] flex items-center gap-2">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
          <div className="pointer-events-auto">
            <AuthUserMenu />
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
