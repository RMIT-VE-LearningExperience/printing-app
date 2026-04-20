"use client";

import { usePathname } from "next/navigation";

const FOOTER_BG = "#45443F";
const FOOTER_TEXT = "#ffffff";

const linkStyle: React.CSSProperties = { color: "#ffffff", textDecoration: "underline" };

const content = (year: number) => (
  <>
    © {year} Designed by the{" "}
    <a href="mailto:dmd.cove@rmit.edu.au" style={linkStyle}>
      Digital Design &amp; Media Team
    </a>
    {" "}· Learning &amp; Teaching Innovation · RMIT College of Vocational Education
  </>
);

export default function Footer({ year }: { year: number }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return (
      <footer
        style={{
          width: "100%",
          backgroundColor: "#3D8078",
          padding: "10px 24px",
          textAlign: "right",
          fontSize: "14px",
          color: FOOTER_TEXT,
          fontWeight: 500,
          letterSpacing: "0.3px",
          boxSizing: "border-box",
        }}
      >
        {content(year)}
      </footer>
    );
  }

  return (
    <footer
      style={{
        width: "100%",
        backgroundColor: FOOTER_BG,
        padding: "10px 24px",
        textAlign: "center",
        fontSize: "14px",
        color: FOOTER_TEXT,
        fontWeight: 500,
        letterSpacing: "0.3px",
        boxSizing: "border-box",
      }}
    >
      {content(year)}
    </footer>
  );
}
