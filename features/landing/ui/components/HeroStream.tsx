import "./heroStream.css";

/**
 * Inline vertical text stream for the hero headline, adapted from the
 * TextStream block: a fixed-height window with a continuously drifting
 * track of items, faded at the edges. Pure CSS animation (linear, constant
 * velocity) so it is smooth by construction and runs without JavaScript.
 * The first item is exposed to screen readers; the stream itself is
 * decorative. All items remain in the SSR HTML.
 */
export function HeroStream({ items }: { items: readonly string[] }) {
  return (
    <>
      <span className="sr-only">{items[0]}</span>
      <span aria-hidden="true" className="hero-stream">
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
