/** Shown when data/runtime/state.json is unreadable — never silently overwritten. */
export default function StateError() {
  return (
    <main className="page utilityPage">
      <h1 style={{ fontSize: "var(--text-lg)" }}>The saved history could not be read</h1>
      <p style={{ marginTop: "var(--space-3)", color: "var(--ink-muted)" }}>
        <code>data/runtime/state.json</code> is not valid. Nothing has been changed. To restore the demo history, run{" "}
        <code>npm run demo:reset</code> and refresh this page.
      </p>
    </main>
  );
}
