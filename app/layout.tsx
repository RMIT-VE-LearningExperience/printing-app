import type { Metadata } from "next";
import type { ReactNode } from "react";

import Providers from "./providers";
import Footer from "./components/Footer";

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
      <body style={{ margin: 0 }}>
        <Providers>{children}</Providers>
        <Footer year={currentYear} />
      </body>
    </html>
  );
}
