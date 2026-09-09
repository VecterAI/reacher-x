/** Preserve an optional filename from a fenced block: ```ts title="example.ts" */
export default function remarkBlogCode() {
  return function transform(tree) {
    function visit(node) {
      if (node.type === "code" && node.meta) {
        const filename = /(?:^|\s)title="([^"]+)"/.exec(node.meta)?.[1];
        if (filename) {
          node.data ??= {};
          node.data.hProperties ??= {};
          node.data.hProperties["data-filename"] = filename;
        }
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
