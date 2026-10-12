import type { ReactNode } from "react";
import type { TFunction } from "i18next";

export function toDoListDescriptionText(
  t: TFunction,
  base: string,
  todoHandLabel: string | null,
): string {
  return `${base} — ${t("jokers.currently")} ${
    todoHandLabel ?? t("jokers.todoUnset")
  }`;
}

export function toDoListDescriptionNode(
  t: TFunction,
  base: string,
  todoHandLabel: string | null,
): ReactNode {
  return (
    <>
      {base} — {t("jokers.currently")}{" "}
      <strong>{todoHandLabel ?? t("jokers.todoUnset")}</strong>
    </>
  );
}
