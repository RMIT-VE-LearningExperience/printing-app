import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";

import Providers from "./providers";
import Footer from "./components/Footer";
import GoogleAnalytics from "./components/GoogleAnalytics";

export const metadata: Metadata = {
  title: "PrinterApp",
  description: "Printing App",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  const currentYear = new Date().getFullYear();
  const pathname = headers().get("x-pathname") ?? "/";
  const isAdmin = pathname.startsWith("/admin");

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <GoogleAnalytics />
        <Providers>{children}</Providers>
        <Footer year={currentYear} isAdmin={isAdmin} />
      </body>
    </html>
  );
}
