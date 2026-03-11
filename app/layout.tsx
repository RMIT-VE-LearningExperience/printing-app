import type { Metadata } from "next";
import type { ReactNode } from "react";

import Providers from "./providers";

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
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh", margin: 0 }}>
        <div style={{ flex: 1 }}>
          <Providers>{children}</Providers>
        </div>
        <footer
          style={{
            padding: "20px 24px",
            textAlign: "center",
            fontSize: "14px",
            color: "#ffffff",
            backgroundColor: "#000000",
            fontWeight: 500,
            letterSpacing: "0.3px",
          }}
        >
          © {currentYear} Designed by the Digital Design & Media Team · Learning & Teaching Innovation · RMIT College of Vocational Education
        </footer>
      </body>
    </html>
  );
}
