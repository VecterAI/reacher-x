"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  MenuOption,
  MenuTextMatch,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  TextNode,
} from "lexical";
import { createPortal } from "react-dom";
import {
  useActiveUseCaseLabels,
  useMentionEntitySearch,
  useWorkspace,
} from "@/shared/hooks";
import type {
  MentionEntityKind,
  MentionEntitySearchResult,
} from "@/shared/lib/mentions/mentionEntities";
import {
  MentionEntityMenu,
  type MentionEntityFilter,
} from "@/shared/ui/components/mentions/MentionEntityMenu";
import { buildComposerMentionInsertionText } from "@/features/composer/lib/entityMentions";
import type { ComposerEntityMentionsConfig } from "@/features/composer/types";
import { $createMentionNode } from "./MentionNode";

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
const VALID_CHARS = "[^" + TRIGGERS + PUNC + "\\s]";
const VALID_JOINS = "(?:" + "\\.[ |$]|" + " |" + "[" + PUNC + "]|" + ")";
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

const ALIAS_LENGTH_LIMIT = 50;
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

const SUGGESTION_LIST_LENGTH_LIMIT = 8;
const MENTION_ENTITY_KIND_ORDER: MentionEntityKind[] = [
  "prospect",
  "post",
  "plan",
  "task",
  "attachment",
];

function checkForAtSignMentions(
  text: string,
  minMatchLength: number
): MenuTextMatch | null {
  let match = AtSignMentionsRegex.exec(text);

  if (match === null) {
    match = AtSignMentionsRegexAliasRegex.exec(text);
  }
  if (match !== null) {
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
  entity: MentionEntitySearchResult;

  constructor(entity: MentionEntitySearchResult) {
    super(entity.label);
    this.entity = entity;
  }
}

export function MentionsPlugin({
  entityMentions,
}: {
  entityMentions?: ComposerEntityMentionsConfig;
}): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const searchParams = useSearchParams();
  const prospectId =
    entityMentions?.prospectId ?? searchParams.get("prospectId");
  const { entityPlural } = useActiveUseCaseLabels();
  const { workspace } = useWorkspace();
  const [queryString, setQueryString] = React.useState<string | null>(null);
  const [activeFilter, setActiveFilter] =
    React.useState<MentionEntityFilter>("all");
  const closeSuppressionTimeoutRef = React.useRef<number | null>(null);
  const suppressQueryWhileClosingRef = React.useRef(false);
  const availableKinds = React.useMemo(() => {
    const remoteKinds = new Set(
      entityMentions?.remoteAllowedKinds ?? MENTION_ENTITY_KIND_ORDER
    );
    const localKinds = new Set(
      entityMentions?.localEntities?.map((entity) => entity.kind) ?? []
    );

    return MENTION_ENTITY_KIND_ORDER.filter(
      (kind) => remoteKinds.has(kind) || localKinds.has(kind)
    );
  }, [entityMentions?.localEntities, entityMentions?.remoteAllowedKinds]);
  const activeRemoteAllowedKinds = React.useMemo(() => {
    if (activeFilter === "all") {
      return entityMentions?.remoteAllowedKinds;
    }

    const configuredKinds = entityMentions?.remoteAllowedKinds;
    return configuredKinds === undefined ||
      configuredKinds.includes(activeFilter)
      ? [activeFilter]
      : [];
  }, [activeFilter, entityMentions?.remoteAllowedKinds]);
  const activeLocalEntities = React.useMemo(
    () =>
      activeFilter === "all"
        ? entityMentions?.localEntities
        : entityMentions?.localEntities?.filter(
            (entity) => entity.kind === activeFilter
          ),
    [activeFilter, entityMentions?.localEntities]
  );
  const { results, loading } = useMentionEntitySearch({
    enabled: queryString !== null,
    query: queryString,
    workspaceId: entityMentions?.workspaceId ?? workspace?._id ?? null,
    prospectId,
    limit: SUGGESTION_LIST_LENGTH_LIMIT,
    remoteAllowedKinds: activeRemoteAllowedKinds,
    localEntities: activeLocalEntities,
    attachmentDestination: entityMentions?.attachmentDestination,
  });
  const visibleResults = React.useMemo(() => {
    const filteredResults =
      activeFilter === "all"
        ? results
        : results.filter((result) => result.kind === activeFilter);

    return filteredResults.map((result) => {
      if (result.kind !== "attachment") {
        return result;
      }

      const localDisabledReason =
        entityMentions?.getAttachmentDisabledReason?.(result) ?? null;
      if (!localDisabledReason) {
        return result;
      }

      return {
        ...result,
        attachmentDisabled: true,
        attachmentDisabledReason: localDisabledReason,
      };
    });
  }, [activeFilter, entityMentions, results]);

  React.useEffect(
    () => () => {
      if (closeSuppressionTimeoutRef.current !== null) {
        window.clearTimeout(closeSuppressionTimeoutRef.current);
      }
    },
    []
  );

  const handleQueryChange = React.useCallback((nextQuery: string | null) => {
    if (suppressQueryWhileClosingRef.current) {
      setQueryString(null);
      return;
    }

    if (nextQuery === null) {
      setActiveFilter("all");
    }
    setQueryString(nextQuery);
  }, []);

  const checkForSlashTriggerMatch = useBasicTypeaheadTriggerMatch("/", {
    minLength: 0,
  });

  const options = React.useMemo(
    () =>
      visibleResults
        .map((result) => new MentionTypeaheadOption(result))
        .slice(0, SUGGESTION_LIST_LENGTH_LIMIT),
    [visibleResults]
  );

  const armMentionCloseSuppression = React.useCallback(() => {
    suppressQueryWhileClosingRef.current = true;
    if (closeSuppressionTimeoutRef.current !== null) {
      window.clearTimeout(closeSuppressionTimeoutRef.current);
    }
    setQueryString(null);
    closeSuppressionTimeoutRef.current = window.setTimeout(() => {
      suppressQueryWhileClosingRef.current = false;
      closeSuppressionTimeoutRef.current = null;
    }, 250);
  }, []);

  const onSelectOption = React.useCallback(
    (
      selectedOption: MentionTypeaheadOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void
    ) => {
      if (selectedOption.entity.attachmentDisabled) {
        return;
      }

      const replacementText =
        entityMentions?.buildInsertionText?.(selectedOption.entity) ??
        buildComposerMentionInsertionText({
          entity: selectedOption.entity,
          config: entityMentions,
        });

      armMentionCloseSuppression();
      closeMenu();

      editor.update(() => {
        const replacementValue = replacementText ?? "";
        const shouldUseMentionNode =
          replacementValue.startsWith("@") &&
          replacementValue.trim().length > 1;
        const replacementNodes = shouldUseMentionNode
          ? [
              $createMentionNode(
                replacementValue.trim().replace(/^@/, ""),
                selectedOption.entity.id
              ),
              ...(replacementValue.endsWith(" ") ? [$createTextNode(" ")] : []),
            ]
          : [$createTextNode(replacementValue)];

        const lastNode = replacementNodes.at(-1) ?? null;

        if (nodeToReplace) {
          nodeToReplace.replace(replacementNodes[0]);
          let previousNode = replacementNodes[0];
          for (const nextNode of replacementNodes.slice(1)) {
            previousNode.insertAfter(nextNode);
            previousNode = nextNode;
          }
        } else {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes(replacementNodes);
          }
        }
        if (lastNode instanceof TextNode) {
          lastNode.selectEnd();
        } else if (lastNode) {
          lastNode.selectNext();
        }
      });

      entityMentions?.onSelectEntity?.(selectedOption.entity);
    },
    [armMentionCloseSuppression, editor, entityMentions]
  );

  const checkForMentionMatch = React.useCallback(
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
    // @ts-expect-error Lexical plugin generics are broader than the runtime type.
    <LexicalTypeaheadMenuPlugin<MentionTypeaheadOption>
      onQueryChange={handleQueryChange}
      onSelectOption={onSelectOption}
      triggerFn={checkForMentionMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
      ) => {
        const anchorRect =
          anchorElementRef.current?.getBoundingClientRect() ?? null;
        const viewportPadding = 16;
        const spaceBelow = anchorRect
          ? window.innerHeight - anchorRect.bottom - viewportPadding
          : 288;
        const spaceAbove = anchorRect ? anchorRect.top - viewportPadding : 288;
        const renderAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
        const maxHeight = Math.max(
          120,
          Math.min(renderAbove ? spaceAbove : spaceBelow, 288)
        );

        return anchorElementRef.current && queryString !== null
          ? createPortal(
              <div
                className={
                  renderAbove
                    ? "max-w-[calc(100vw-2rem)] -translate-y-[calc(100%+0.5rem)]"
                    : "max-w-[calc(100vw-2rem)]"
                }
              >
                <MentionEntityMenu
                  results={visibleResults}
                  loading={loading}
                  selectedIndex={selectedIndex}
                  onHover={setHighlightedIndex}
                  onSelect={(item) => {
                    const option = options.find(
                      (candidate) => candidate.entity.id === item.id
                    );
                    if (option) {
                      selectOptionAndCleanUp(option);
                    }
                  }}
                  className="w-[min(20rem,calc(100vw-2rem))]"
                  bodyStyle={{ maxHeight }}
                  entityPluralLabel={entityPlural}
                  availableKinds={availableKinds}
                  activeFilter={activeFilter}
                  onActiveFilterChange={(filter) => {
                    setActiveFilter(filter);
                    setHighlightedIndex(0);
                  }}
                />
              </div>,
              anchorElementRef.current
            )
          : null;
      }}
    />
  );
}
