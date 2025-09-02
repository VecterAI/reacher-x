import { JSX } from "react";
import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable";

type Props = {
  placeholder: string;
  className?: string;
  placeholderClassName?: string;
};

export function ContentEditable({
  placeholder,
  className,
  placeholderClassName,
}: Props): JSX.Element {
  return (
    <LexicalContentEditable
      className={
        className ??
        `ContentEditable__root relative block min-h-[80px] overflow-auto whitespace-pre-wrap break-words px-0 py-2 focus:outline-none`
      }
      aria-placeholder={placeholder}
      placeholder={
        <div
          className={
            placeholderClassName ??
            `pointer-events-none absolute left-0 top-0 select-none overflow-hidden text-ellipsis px-0 py-2 text-muted-foreground`
          }
        >
          {placeholder}
        </div>
      }
    />
  );
}
