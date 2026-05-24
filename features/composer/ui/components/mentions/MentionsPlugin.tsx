"use client";

import * as React from "react";
import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  MenuOption,
  MenuTextMatch,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { TextNode } from "lexical";
import { CircleUserRoundIcon } from "lucide-react";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import { createPortal } from "react-dom";

import { $createMentionNode } from "./MentionNode";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Skeleton } from "@/shared/ui/components/Skeleton";

const LexicalTypeaheadMenuPlugin = dynamic(
  () =>
    import("@lexical/react/LexicalTypeaheadMenuPlugin").then(
      (mod) => mod.LexicalTypeaheadMenuPlugin
    ),
  { ssr: false }
);

const PUNCTUATION =
  "\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%'\"~=<>_:;";
const NAME = "\\b[A-Z][^\\s" + PUNCTUATION + "]";

const DocumentMentionsRegex = {
  NAME,
  PUNCTUATION,
};

const PUNC = DocumentMentionsRegex.PUNCTUATION;

const TRIGGERS = ["@"].join("");

// Chars we expect to see in a mention (non-space, non-punctuation).
const VALID_CHARS = "[^" + TRIGGERS + PUNC + "\\s]";

// Non-standard series of chars. Each series must be preceded and followed by
// a valid char.
const VALID_JOINS =
  "(?:" +
  "\\.[ |$]|" + // E.g. "r. " in "Mr. Smith"
  " |" + // E.g. " " in "Josh Duck"
  "[" +
  PUNC +
  "]|" + // E.g. "-' in "Salier-Hellendag"
  ")";

const LENGTH_LIMIT = 75;

const AtSignMentionsRegex = new RegExp(
  "(^|\\s|\\()(" +
    "[" +
    TRIGGERS +
    "]" +
    "((?:" +
    VALID_CHARS +
    VALID_JOINS +
    "){0," +
    LENGTH_LIMIT +
    "})" +
    ")$"
);

// 50 is the longest alias length limit.
const ALIAS_LENGTH_LIMIT = 50;

// Regex used to match alias.
const AtSignMentionsRegexAliasRegex = new RegExp(
  "(^|\\s|\\()(" +
    "[" +
    TRIGGERS +
    "]" +
    "((?:" +
    VALID_CHARS +
    "){0," +
    ALIAS_LENGTH_LIMIT +
    "})" +
    ")$"
);

// At most, 5 suggestions are shown in the popup.
const SUGGESTION_LIST_LENGTH_LIMIT = 5;

const mentionsCache = new Map();

const MOCK_USERS = [
  {
    id: "1",
    handle: "sundar",
    name: "Sundar Pichai",
    profile_image_url_https:
      "https://pbs.twimg.com/profile_images/864282616597405701/MdE8-pVU_400x400.jpg",
    verified: true,
  },
  {
    id: "2",
    handle: "elonmusk",
    name: "Elon Musk",
    profile_image_url_https:
      "https://pbs.twimg.com/profile_images/1683325380/Elon_Musk_400x400.jpg",
    verified: true,
  },
  {
    id: "3",
    handle: "pmarca",
    name: "Marc Andreessen",
    profile_image_url_https:
      "https://pbs.twimg.com/profile_images/1649501489794199553/5V2XDFY-_400x400.jpg",
    verified: true,
  },
  {
    id: "4",
    handle: "naval",
    name: "Naval Ravikant",
    profile_image_url_https:
      "https://pbs.twimg.com/profile_images/1256841238298292226/ycqwaMd2_400x400.jpg",
    verified: true,
  },
  {
    id: "5",
    handle: "balajis",
    name: "Balaji Srinivasan",
    profile_image_url_https:
      "https://pbs.twimg.com/profile_images/1478801676322824193/qPyFbTdS_400x400.jpg",
    verified: true,
  },
];

const dummyLookupService = {
  search(
    string: string,
    callback: (
      results: Array<{
        id: string;
        handle: string;
        name: string;
        profile_image_url_https: string;
        verified: boolean;
      }>
    ) => void
  ): void {
    setTimeout(() => {
      const results = MOCK_USERS.filter(
        (mention) =>
          mention.handle.toLowerCase().includes(string.toLowerCase()) ||
          mention.name.toLowerCase().includes(string.toLowerCase())
      );
      callback(results);
    }, 1000); // Increased delay to better demonstrate loading state
  },
};

function useMentionLookupService(mentionString: string | null) {
  const [results, setResults] = useState<
    Array<{
      id: string;
      handle: string;
      name: string;
      profile_image_url_https: string;
      verified: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Early exit for null - schedule state update via microtask to avoid sync setState
    if (mentionString == null) {
      const timeoutId = setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    const cachedResults = mentionsCache.get(mentionString);

    if (cachedResults === null) {
      // Search is in progress - schedule loading state update
      const timeoutId = setTimeout(() => setLoading(true), 0);
      return () => clearTimeout(timeoutId);
    }

    if (cachedResults !== undefined) {
      // Cached results exist - schedule update to avoid sync setState
      const timeoutId = setTimeout(() => {
        setResults(cachedResults);
        setLoading(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    // No cached results - start search
    mentionsCache.set(mentionString, null);
    const timeoutId = setTimeout(() => setLoading(true), 0);

    dummyLookupService.search(mentionString, (newResults) => {
      mentionsCache.set(mentionString, newResults);
      setResults(newResults);
      setLoading(false);
    });

    return () => clearTimeout(timeoutId);
  }, [mentionString]);

  return { results, loading };
}

function checkForAtSignMentions(
  text: string,
  minMatchLength: number
): MenuTextMatch | null {
  let match = AtSignMentionsRegex.exec(text);

  if (match === null) {
    match = AtSignMentionsRegexAliasRegex.exec(text);
  }
  if (match !== null) {
    // The strategy ignores leading whitespace but we need to know it's
    // length to add it to the leadOffset

    const maybeLeadingWhitespace = match[1];

    const matchingString = match[3];
    if (matchingString.length >= minMatchLength) {
      return {
        leadOffset: match.index + maybeLeadingWhitespace.length,
        matchingString,
        replaceableString: match[2],
      };
    }
  }
  return null;
}

function getPossibleQueryMatch(text: string): MenuTextMatch | null {
  return checkForAtSignMentions(text, 1);
}

class MentionTypeaheadOption extends MenuOption {
  name: string;
  handle: string;
  id: string;
  picture: JSX.Element;
  profile_image_url_https: string;
  verified: boolean;

  constructor(
    name: string,
    handle: string,
    id: string,
    picture: JSX.Element,
    profile_image_url_https: string,
    verified: boolean
  ) {
    super(name);
    this.name = name;
    this.handle = handle;
    this.id = id;
    this.picture = picture;
    this.profile_image_url_https = profile_image_url_https;
    this.verified = verified;
  }
}

export function MentionsPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  const [queryString, setQueryString] = useState<string | null>(null);

  const { results, loading } = useMentionLookupService(queryString);

  const checkForSlashTriggerMatch = useBasicTypeaheadTriggerMatch("/", {
    minLength: 0,
  });

  const options = useMemo(
    () =>
      results
        .map(
          (result) =>
            new MentionTypeaheadOption(
              result.name,
              result.handle,
              result.id,
              <CircleUserRoundIcon key={result.id} className="size-4" />,
              result.profile_image_url_https,
              result.verified
            )
        )
        .slice(0, SUGGESTION_LIST_LENGTH_LIMIT),
    [results]
  );

  const onSelectOption = useCallback(
    (
      selectedOption: MentionTypeaheadOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void
    ) => {
      editor.update(() => {
        const mentionNode = $createMentionNode(
          selectedOption.handle,
          selectedOption.id
        );
        if (nodeToReplace) {
          nodeToReplace.replace(mentionNode);
        }
        mentionNode.selectNext();
        closeMenu();
      });
    },
    [editor]
  );

  const checkForMentionMatch = useCallback(
    (text: string) => {
      const slashMatch = checkForSlashTriggerMatch(text, editor);
      if (slashMatch !== null) {
        return null;
      }
      return getPossibleQueryMatch(text);
    },
    [checkForSlashTriggerMatch, editor]
  );

  return (
    // @ts-expect-error - LexicalTypeaheadMenuPlugin types are complex
    <LexicalTypeaheadMenuPlugin<MentionTypeaheadOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForMentionMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
      ) => {
        return anchorElementRef.current && (results.length > 0 || loading)
          ? createPortal(
              <div className="bg-background absolute z-50 w-64 rounded-md border shadow-lg">
                <div className="scroll-fade-effect-y max-h-64 overflow-auto p-1">
                  {loading
                    ? // Loading state with skeleton components
                      Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={`loading-${index}`}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5"
                        >
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="flex flex-col gap-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                      ))
                    : // Actual mention suggestions
                      options.map((option, index) => (
                        <div
                          key={option.key}
                          className={`hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors ${
                            selectedIndex === index ? "bg-muted" : ""
                          }`}
                          onClick={() => {
                            selectOptionAndCleanUp(option);
                          }}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          <Avatar className="ring-border h-8 w-8 ring-1">
                            <AvatarImage
                              src={option.profile_image_url_https}
                              alt={`Avatar of ${option.name}`}
                            />
                            <AvatarFallback>
                              {option.name?.charAt(0).toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <span className="text-foreground text-sm font-medium">
                                {option.name}
                              </span>
                              {option.verified && (
                                <NewReleasesIcon
                                  className="h-3 w-3 fill-current"
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                            <span className="text-muted-foreground font-mono text-sm">
                              @{option.handle}
                            </span>
                          </div>
                        </div>
                      ))}
                </div>
              </div>,
              anchorElementRef.current
            )
          : null;
      }}
    />
  );
}
