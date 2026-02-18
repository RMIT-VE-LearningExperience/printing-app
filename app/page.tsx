import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px" }}>
      <h1>Printing App</h1>
      <p>Go to the tutorial admin area to build printer tutorial content.</p>
      <p>
        <Link href="/admin">Open Tutorial Admin</Link>
      </p>
    </main>
  );
}
