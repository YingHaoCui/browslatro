import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import type { Suit } from "../../cards/types";
import {
  localizedJokerDescription,
  localizedJokerPlaceholderValue,
} from "../../i18n/jokerOverrides";
import { castleDescriptionNode } from "./castleDescription";
import { idolDescriptionText } from "./idolDescription";
import { toDoListDescriptionNode } from "./toDoListDescription";

export interface DynamicJokerDescriptionArgs {
  readonly t: TFunction;
  readonly language: string;
  readonly jokerId: string;
  readonly description: string;
  readonly todoHandLabel: string | null;
  readonly castleSuit: Suit | null;
  readonly castleSuitName: string | null;
  readonly idolRankName: string | null;
  readonly idolSuitName: string | null;
}

export function dynamicJokerDescriptionNode(
  args: DynamicJokerDescriptionArgs,
): ReactNode {
  const base = localizedJokerDescription(
    args.language,
    args.jokerId,
    args.description,
  );
  if (args.jokerId === "to-do-list") {
    return toDoListDescriptionNode(args.t, base, args.todoHandLabel);
  }
  if (args.jokerId === "castle") {
    return castleDescriptionNode(
      args.t,
      base,
      args.castleSuit,
      args.castleSuitName,
    );
  }
  if (args.jokerId === "the-idol") {
    return idolDescriptionText(
      base,
      args.idolRankName,
      args.idolSuitName,
      localizedJokerPlaceholderValue(args.language, "the-idol", "rank", "[rank]"),
      localizedJokerPlaceholderValue(args.language, "the-idol", "suit", "[suit]"),
    );
  }
  return base;
}
