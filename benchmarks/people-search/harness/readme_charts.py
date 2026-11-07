"""Draw the README charts as static SVG files (light and dark), from the scored results.

    uv run python -m harness.readme_charts --judge final   # writes docs/*.svg

The charts hold only scores and counts, no people data, so they are committed with the README.
Tool colors match the results dashboard.
"""

from __future__ import annotations

import argparse
import sys
from html import escape

from .core import BENCH_DIR, CONFIG, load_queries, read_json
from .dashboard_data import LABELS
from .report import build as build_report

OUT = BENCH_DIR / "docs"
TOOLS = ["reacherx", "exa", "treg", "apollo", "clay", "context_dev", "firecrawl"]
NAMES = {"reacherx": "ReacherX", "exa": "Exa", "treg": "Treg", "apollo": "Apollo", "clay": "Clay", "context_dev": "context.dev", "firecrawl": "Firecrawl"}
COLORS = {  # categorical palette, fixed order, light / dark
    "reacherx": ("#2a78d6", "#3987e5"),
    "exa": ("#eb6834", "#d95926"),
    "treg": ("#1baf7a", "#199e70"),
    "apollo": ("#eda100", "#c98500"),
    "clay": ("#e87ba4", "#d55181"),
    "context_dev": ("#008300", "#008300"),
    "firecrawl": ("#6250d6", "#9085e9"),
}
THEMES = {
    "light": {"bg": "#ffffff", "fg": "#1f2328", "muted": "#59636e", "grid": "#d1d9e0", "track": "#f0f2f4", "i": 0},
    "dark": {"bg": "#0d1117", "fg": "#e6edf3", "muted": "#9198a1", "grid": "#3d444d", "track": "#161b22", "i": 1},
}
FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"


def svg(width: int, height: int, body: list[str], t: dict) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
        f'font-family="{FONT}" role="img">\n<rect width="100%" height="100%" fill="{t["bg"]}" rx="8"/>\n' + "\n".join(body) + "\n</svg>\n"
    )


def text(x: float, y: float, s: str, t: dict, *, size: int = 13, color: str | None = None, anchor: str = "start", weight: int = 400) -> str:
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{color or t["fg"]}" text-anchor="{anchor}" font-weight="{weight}" dominant-baseline="middle">{escape(s)}</text>'


def scores_chart(summary: dict, t: dict) -> str:
    """Two panels: score on 'asking for help' and on 'job or company lookup', one bar per tool."""
    order = sorted(TOOLS, key=lambda k: -(summary["intent"].get(k, {}).get("overall") or -1))
    panels = [("intent", "Asking for help"), ("public", "Job or company lookup")]
    label_w, panel_w, gap, row_h, top = 96, 300, 40, 30, 62
    W = 20 + 2 * (label_w + panel_w) + gap + 30
    H = top + row_h * len(order) + 34
    body = [text(20, 24, "Score by tool, out of 100", t, size=15, weight=600)]
    for p, (track, title) in enumerate(panels):
        x0 = 20 + label_w + p * (panel_w + gap + label_w)
        body.append(text(x0, top - 18, title, t, size=13, color=t["muted"], weight=600))
        for tick in (0, 50, 100):
            x = x0 + panel_w * tick / 100
            body.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{top - 6}" y2="{top + row_h * len(order)}" stroke="{t["grid"]}" stroke-width="1"/>')
            body.append(text(x, top + row_h * len(order) + 14, str(tick), t, size=11, color=t["muted"], anchor="middle"))
        for i, k in enumerate(order):
            y = top + i * row_h
            body.append(text(x0 - 10, y + row_h / 2, NAMES[k], t, size=13, anchor="end", weight=600 if k == "reacherx" else 400))
            s = summary[track].get(k)
            if not s or not s.get("queries_scored"):
                body.append(text(x0 + 6, y + row_h / 2, "not run", t, size=12, color=t["muted"]))
                continue
            v = s["overall"]
            w = max(panel_w * v / 100, 2)
            body.append(f'<rect x="{x0:.1f}" y="{y + 6}" width="{w:.1f}" height="{row_h - 12}" rx="3" fill="{COLORS[k][t["i"]]}"/>')
            body.append(text(x0 + w + 6, y + row_h / 2, f"{v:.0f}", t, size=12, color=t["muted"]))
    return svg(W, H, body, t)


def grid_chart(rows: list[dict], queries: list[dict], t: dict) -> str:
    """Score of each tool on each question; darker blue means a higher score."""
    score = {(r["tool"], r["query_id"]): r["overall"] for r in rows}
    groups = [("intent", "People asking for help"), ("public", "Job or company lookup")]
    label_w, cell_w, cell_h, head_h = 270, 74, 30, 64
    n_rows = sum(1 for q in queries if q["track"] in dict(groups))
    W = 20 + label_w + cell_w * len(TOOLS) + 20
    H = head_h + n_rows * cell_h + len(groups) * 28 + 40
    body = [text(20, 24, "Score of each tool on each question, out of 100", t, size=15, weight=600)]
    for j, k in enumerate(TOOLS):
        body.append(text(20 + label_w + j * cell_w + cell_w / 2, head_h - 12, NAMES[k], t, size=12, anchor="middle", weight=600 if k == "reacherx" else 400))
    y = head_h
    blue = (42, 120, 214)
    for track, title in groups:
        qs = [q for q in queries if q["track"] == track]
        if not qs:
            continue
        body.append(text(20, y + 16, title.upper(), t, size=11, color=t["muted"], weight=600))
        y += 28
        for q in qs:
            body.append(text(20, y + cell_h / 2, LABELS.get(q["query_id"], q["query_id"]), t, size=12))
            for j, k in enumerate(TOOLS):
                x = 20 + label_w + j * cell_w
                v = score.get((k, q["query_id"]))
                if v is None:
                    body.append(f'<rect x="{x + 3}" y="{y + 3}" width="{cell_w - 6}" height="{cell_h - 6}" rx="3" fill="none" stroke="{t["grid"]}" stroke-dasharray="3 3"/>')
                    body.append(text(x + cell_w / 2, y + cell_h / 2, "not run", t, size=10, color=t["muted"], anchor="middle"))
                    continue
                a = 0.07 + 0.88 * v / 100
                body.append(f'<rect x="{x + 3}" y="{y + 3}" width="{cell_w - 6}" height="{cell_h - 6}" rx="3" fill="rgb{blue}" fill-opacity="{a:.2f}"/>')
                ink = "#ffffff" if v >= 55 else t["fg"]
                body.append(text(x + cell_w / 2, y + cell_h / 2, f"{v:.0f}", t, size=12, color=ink, anchor="middle", weight=600 if k == "reacherx" else 400))
            y += cell_h
    body.append(text(20, H - 16, "Dashed cells: not run on that question. The Current state and Limits sections say why.", t, size=11, color=t["muted"]))
    return svg(W, H, body, t)


def funnel_chart(found: int, shown: int, real: int, t: dict) -> str:
    steps = [("People ReacherX found", found, False), ("Shown to the user", shown, True), ("Shown with a real post", real, True)]
    W, label_w, bar_w, row_h, top = 820, 190, 540, 40, 46
    H = top + row_h * len(steps) + 16
    body = [text(20, 24, "ReacherX on the 6 questions about people asking for help", t, size=15, weight=600)]
    for i, (label, v, accent) in enumerate(steps):
        y = top + i * row_h
        w = max(bar_w * v / max(found, 1), 3)
        color = COLORS["reacherx"][t["i"]] if accent else t["grid"]
        body.append(text(20 + label_w - 10, y + row_h / 2, label, t, size=13, anchor="end"))
        body.append(f'<rect x="{20 + label_w}" y="{y + 8}" width="{w:.1f}" height="{row_h - 16}" rx="3" fill="{color}"/>')
        body.append(text(20 + label_w + w + 8, y + row_h / 2, f"{v:,}", t, size=13, weight=600))
    return svg(W, H, body, t)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--judge", choices=["trial", "final"], default="final")
    args = ap.parse_args()
    res = build_report(args.judge, CONFIG["top_k"])
    if res["missing_verdicts"]:
        raise SystemExit("verdicts missing; run harness.score first")
    queries = [q for q in load_queries() if any((BENCH_DIR / "data" / "raw").glob(f"*/{q['query_id']}.json"))]
    help_q = [q["query_id"] for q in queries if q["track"] == "intent"]
    found = shown = 0
    for qid in help_q:
        run = BENCH_DIR / "data" / "reacherx_exports" / f"{qid}.json"
        if run.exists():
            counts = read_json(run).get("counts") or {}
            found += counts.get("discovered") or 0
            shown += counts.get("qualified") or 0
    real = (res["summary"].get("intent", {}).get("reacherx") or {}).get("intent_verified") or 0
    OUT.mkdir(exist_ok=True)
    for name, t in THEMES.items():
        (OUT / f"scores-{name}.svg").write_text(scores_chart(res["summary"], t))
        (OUT / f"questions-{name}.svg").write_text(grid_chart(res["rows"], queries, t))
        (OUT / f"funnel-{name}.svg").write_text(funnel_chart(found, shown, real, t))
    print(f"wrote {len(THEMES) * 3} charts to {OUT} (found {found}, shown {shown}, real {real})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
