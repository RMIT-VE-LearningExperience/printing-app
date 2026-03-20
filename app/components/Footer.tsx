"use client";

import { usePathname } from "next/navigation";

export default function Footer({ year }: { year: number }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        width: "100%",
        padding: "60px 24px 16px",
        textAlign: isAdmin ? "right" : "center",
        fontSize: "14px",
        color: "#333333",
        fontWeight: 500,
        letterSpacing: "0.3px",
        zIndex: 10,
        boxSizing: "border-box",
        pointerEvents: "none",
      }}
    >
      <span style={{ pointerEvents: "auto" }}>
        © {year} Designed by the{" "}
        <a
          href="mailto:dmd.cove@rmit.edu.au"
          style={{ color: "#333333", textDecoration: "underline" }}
        >
          Digital Design &amp; Media Team
        </a>
        {" "}· Learning &amp; Teaching Innovation · RMIT College of Vocational Education
      </span>
    </footer>
  );
}
