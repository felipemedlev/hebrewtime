"use client";

import { ListOrdered, Shuffle } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { FlashcardOrder } from "@/lib/flashcardSession";

type Props = {
  order: FlashcardOrder;
  name: string;
  onChange: (order: FlashcardOrder) => void;
};

export default function FlashcardOrderControl({ order, name, onChange }: Props) {
  const t = useT();

  return (
    <fieldset className="flashcard-order-choice">
      <legend>{t("flashcardOrder")}</legend>
      <div className="flashcard-order-options">
        {(["chronological", "shuffled"] as const).map((value) => {
          const Icon = value === "shuffled" ? Shuffle : ListOrdered;
          return (
            <label className="flashcard-order-option" key={value}>
              <input
                type="radio"
                name={name}
                value={value}
                checked={order === value}
                onChange={() => onChange(value)}
              />
              <span className="flashcard-order-option-content">
                <Icon size={16} aria-hidden="true" />
                <span>{t(value === "shuffled" ? "shuffledOrder" : "chronologicalOrder")}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
