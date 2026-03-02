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
            padding: "16px",
            textAlign: "right",
            fontSize: "14px",
            color: "#666",
            paddingRight: "24px",
            paddingBottom: "24px",
            marginTop: "auto",
          }}
        >
          © {currentYear} Designed by the Digital Design & Media Team · Learning & Teaching Innovation · RMIT College of Vocational Education
        </footer>
      </body>
    </html>
  );
}
