import type { ThemeRegistrationRaw } from "shiki";

// Monochrome Shiki themes matching the app's neutral design language (pure
// grays, no hue, same ramp as --foreground/--muted-foreground in
// app/globals.css). Hierarchy is expressed through brightness and weight
// instead of color: comments are dim and italic, strings recede, keywords and
// entity names read strongest.
const palette = {
  light: {
    background: "#ffffff",
    keywords: "#000000",
    entities: "#000000",
    constants: "#262626",
    base: "#171717",
    operators: "#525252",
    strings: "#737373",
    comments: "#a3a3a3",
  },
  dark: {
    background: "#000000",
    keywords: "#fafafa",
    entities: "#fafafa",
    constants: "#e5e5e5",
    base: "#d4d4d4",
    operators: "#8c8c8c",
    strings: "#a3a3a3",
    comments: "#737373",
  },
} as const;

type Palette = (typeof palette)[keyof typeof palette];
type TokenColor = Exclude<keyof Palette, "background">;

// Scope to role table shared by both variants. Order only breaks ties; TextMate
// scoring picks the most specific scope, so `keyword.operator` still wins over
// the bare `keyword` prefix.
const tokenStyles: {
  scopes: string[];
  color: TokenColor;
  fontStyle?: "italic" | "bold" | "italic bold" | "underline";
}[] = [
  {
    scopes: ["comment", "punctuation.definition.comment"],
    color: "comments",
    fontStyle: "italic",
  },
  {
    scopes: [
      "string",
      "string.regexp",
      "string.template",
      "string.interpolated",
      "string.unquoted",
      "markup.inline",
      "markup.fenced_code",
    ],
    color: "strings",
  },
  {
    scopes: [
      "constant.numeric",
      "constant.language",
      "constant.character",
      "constant.other",
      "support.constant",
      "variable.language",
      "keyword.other.unit",
    ],
    color: "constants",
  },
  { scopes: ["keyword", "storage"], color: "keywords", fontStyle: "bold" },
  {
    scopes: [
      "entity.name",
      "entity.other.inherited-class",
      "entity.other.attribute-name",
      "support.function",
      "support.class",
      "variable.function",
    ],
    color: "entities",
  },
  { scopes: ["keyword.operator", "punctuation"], color: "operators" },
  {
    scopes: ["entity.name.tag.yaml", "support.type.property-name"],
    color: "base",
  },
  { scopes: ["variable", "support.variable"], color: "base" },
  {
    scopes: ["strong", "markup.bold", "markup.heading", "entity.name.section"],
    color: "keywords",
    fontStyle: "bold",
  },
  { scopes: ["emphasis", "markup.italic"], color: "base", fontStyle: "italic" },
  { scopes: ["markup.underline"], color: "base", fontStyle: "underline" },
  { scopes: ["invalid"], color: "keywords", fontStyle: "bold" },
];

function createNeutralTheme(
  name: string,
  type: "light" | "dark"
): ThemeRegistrationRaw {
  const colors = palette[type];
  return {
    name,
    type,
    colors: {
      "editor.background": colors.background,
      "editor.foreground": colors.base,
    },
    settings: tokenStyles.map(({ scopes, color, fontStyle }) => ({
      scope: scopes,
      settings: {
        foreground: colors[color],
        ...(fontStyle ? { fontStyle } : {}),
      },
    })),
  };
}

export const neutralShikiThemes = {
  light: createNeutralTheme("neutral-light", "light"),
  dark: createNeutralTheme("neutral-dark", "dark"),
} as const;
