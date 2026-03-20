"use client";

import { usePathname } from "next/navigation";

const FOOTER_BG = "#001F2D";
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
          position: "fixed",
          bottom: 0,
          width: "100%",
          textAlign: "right",
          zIndex: 10,
          pointerEvents: "none",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            display: "inline-block",
            pointerEvents: "auto",
            backgroundColor: FOOTER_BG,
            padding: "10px 24px 10px 52px",
            clipPath: "polygon(32px 0, 100% 0, 100% 100%, 0 100%)",
            filter: "drop-shadow(-3px 0 6px rgba(0,0,0,0.10))",
            fontSize: "14px",
            color: FOOTER_TEXT,
            fontWeight: 500,
            letterSpacing: "0.3px",
          }}
        >
          {content(year)}
        </span>
      </footer>
    );
  }

  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        width: "100%",
        backgroundColor: FOOTER_BG,
        padding: "10px 24px",
        textAlign: "center",
        fontSize: "14px",
        color: FOOTER_TEXT,
        fontWeight: 500,
        letterSpacing: "0.3px",
        zIndex: 10,
        boxSizing: "border-box",
      }}
    >
      {content(year)}
    </footer>
  );
}
