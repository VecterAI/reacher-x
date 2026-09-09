/** Give static GFM checkboxes a native label without including nested tasks. */
export default function rehypeBlogTaskLists() {
  return function transform(tree) {
    function visit(node) {
      if (
        node.tagName === "li" &&
        node.properties?.className?.includes("task-list-item")
      ) {
        // Loose lists put the checkbox in a paragraph; tight lists do not.
        const container =
          node.children.find((child) => child.tagName === "p") ?? node;
        const checkboxIndex = container.children.findIndex(
          (child) =>
            child.tagName === "input" &&
            child.properties?.type === "checkbox" &&
            child.properties?.disabled
        );
        if (checkboxIndex !== -1) {
          const nestedListIndex = container.children.findIndex(
            (child, index) =>
              index > checkboxIndex &&
              (child.tagName === "ul" || child.tagName === "ol")
          );
          const end =
            nestedListIndex === -1
              ? container.children.length
              : nestedListIndex;
          const children = container.children.splice(
            checkboxIndex,
            end - checkboxIndex
          );
          container.children.splice(checkboxIndex, 0, {
            type: "element",
            tagName: "label",
            properties: {},
            children,
          });
        }
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
