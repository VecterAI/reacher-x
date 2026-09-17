export function prefersMarkdown(accept: string): boolean {
  const formats = accept
    .toLowerCase()
    .split(",")
    .map((part, index) => {
      const [type, ...parameters] = part.trim().split(";");
      const quality = parameters.find((parameter) =>
        parameter.trim().startsWith("q=")
      );
      const q = quality ? Number(quality.trim().slice(2)) : 1;
      return {
        type: type.trim(),
        q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0,
        index,
      };
    });
  function preference(type: string) {
    // A specific exclusion (q=0) takes precedence over a permissive wildcard.
    for (const range of [type, "text/*", "*/*"]) {
      const matches = formats.filter((format) => format.type === range);
      if (matches.length)
        return matches.reduce((best, item) => (item.q > best.q ? item : best));
    }
    return { q: 0, index: Number.POSITIVE_INFINITY };
  }
  const markdown = preference("text/markdown");
  const html = preference("text/html");
  return (
    markdown.q > 0 &&
    (markdown.q > html.q ||
      (markdown.q === html.q && markdown.index < html.index))
  );
}
