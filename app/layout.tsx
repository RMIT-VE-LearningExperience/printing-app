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
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
