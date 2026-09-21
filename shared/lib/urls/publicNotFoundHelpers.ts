// Fixed content only: no route or user input is inserted into this document.
export function publicNotFoundHtml(kind: "blog" | "marketing") {
  const { title, description, href, label } =
    kind === "blog"
      ? {
          title: "Post not found",
          description: "This post may have moved or hasn’t been published yet.",
          href: "/blog",
          label: "Back to blog",
        }
      : {
          title: "Page not found",
          description:
            "This page does not exist. Start from the home page to see what ReacherX does.",
          href: "/home",
          label: "Back to home",
        };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} | ReacherX</title><style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;background:light-dark(#fff,#000);color:light-dark(#171717,#fafafa);font:16px/1.6 system-ui,sans-serif}header{padding:24px;border-bottom:1px solid light-dark(#e5e5e5,#333)}header a{color:inherit;text-decoration:none;font-weight:600}main{max-width:768px;margin:0 auto;padding:96px 24px}small,p{color:light-dark(#666,#aaa)}h1{font-size:clamp(32px,6vw,48px);line-height:1.2;font-weight:500}main a{display:inline-block;margin-top:24px;padding:10px 18px;border:1px solid light-dark(#ccc,#444);border-radius:8px;color:inherit;text-decoration:none}a:focus-visible{outline:2px solid currentColor;outline-offset:4px}</style></head><body><header><a href="/home">🆁 ReacherX</a></header><main><small>404</small><h1>${title}</h1><p>${description}</p><a href="${href}">${label}</a></main></body></html>`;
}
