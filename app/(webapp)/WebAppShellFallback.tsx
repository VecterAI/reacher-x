/**
 * Static shell shown while the webapp layout resolves dynamic data (e.g. cookies).
 * Mirrors Header (h-12, z-20), icon sidebar (3rem), and main column so the swap to the real UI is subtle.
 */
export function WebAppShellFallback() {
  return (
    <div className="bg-background min-h-dvh w-full" aria-hidden>
      <header className="border-border bg-background fixed top-0 right-0 left-0 z-20 flex h-12 items-center justify-between border-b pr-4 pl-2 md:pr-2">
        <div className="flex items-center gap-2">
          <div className="bg-muted/45 size-8 shrink-0 rounded-md" />
          <div className="bg-muted/45 h-7 w-12 shrink-0 rounded-md" />
        </div>
        <div className="bg-muted/45 size-8 shrink-0 rounded-full" />
      </header>

      <div className="w-full pt-12">
        <div className="flex h-[calc(100dvh-3rem)] min-h-0 overflow-hidden">
          <aside
            className="border-sidebar-border bg-sidebar flex w-12 shrink-0 flex-col border-r py-3"
            style={{ width: "var(--sidebar-width-icon, 3rem)" }}
          >
            <div className="mx-auto flex w-full flex-col items-center gap-3 px-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-sidebar-accent/35 size-8 shrink-0 rounded-md"
                />
              ))}
            </div>
          </aside>

          <div className="bg-background flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="border-border/50 bg-muted/6 m-3 min-h-0 flex-1 rounded-lg border md:m-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
