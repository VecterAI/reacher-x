import "./heroStream.css";

/**
 * Inline vertical text stream for the hero headline and composer
 * placeholder: a continuously drifting track of items inside a one-line
 * window, hard-clipped at the edges. Pure CSS animation (linear, constant
 * velocity) so it is smooth by construction and runs without JavaScript.
 * All items remain in the SSR HTML.
 */
export function HeroStream({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <>
      <span className="sr-only">{items[0]}</span>
      <span aria-hidden="true" className={`hero-stream ${className ?? ""}`}>
        <span className="hero-stream__track">
          {[...items, ...items].map((item, copyIndex) => (
            <span key={copyIndex} className="hero-stream__item">
              {item}
            </span>
          ))}
        </span>
      </span>
    </>
  );
}
