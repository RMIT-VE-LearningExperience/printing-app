import type { Metadata } from "next";
import type { ReactNode } from "react";

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

  return (
    <html lang="en">
      <body style={{ margin: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <GoogleAnalytics />
        <div style={{ flex: 1 }}>
          <Providers>{children}</Providers>
        </div>
        <Footer year={currentYear} />
      </body>
    </html>
  );
}
