import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px" }}>
      <h1>Printing App</h1>
      <p>Go to the admin area to add items.</p>
      <p>
        <Link href="/admin">Open Item Admin</Link>
      </p>
    </main>
  );
}
