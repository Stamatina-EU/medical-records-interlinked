import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page utilityPage">
      <h1 style={{ fontSize: "var(--text-lg)" }}>This page is not part of the history</h1>
      <p style={{ marginTop: "var(--space-3)", color: "var(--ink-muted)" }}>
        <Link href="/">Return to the Snapshot</Link>
      </p>
    </main>
  );
}
