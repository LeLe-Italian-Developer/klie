"use client";

import React, { useMemo } from "react";

export type SearchItem = {
  id: string;
  label: string;
  colSpan?: number;
  shape?: "rounded" | "pill" | "circle";
};

const baseNames = [
  "Orion","Lumen","Nova","Rift","Ember","Vega","Solace","Quill","Zephyr","Nyx","Atlas","Echo",
  "Morrow","Kairo","Jade","Mistral","Aster","Rune","Volt","Cirrus","Drift","Nadir","Mica","Fable",
  "Onyx","Sable","Kestrel","Rowan","Indigo","Sora","Aquila","Vesper","Hallow","Flint","Lyra","Cinder",
  "Arden","Kova","Talon","Breeze","Sable","Glint","Cypress","Rune","Vale","Miro","Seren","Caelum","Voss",
];
const uniqueBaseNames = Array.from(new Set(baseNames));

function uniqueCreatorName(i: number): string {
  const name = uniqueBaseNames[i % uniqueBaseNames.length];
  const suffix = Math.floor(i / uniqueBaseNames.length) + 1;
  return `${name} ${suffix.toString().padStart(2, "0")}`;
}

function buildRandomGrid(count = 200): SearchItem[] {
  const items: SearchItem[] = [];
  const rng = () => Math.random();

  for (let i = 0; i < count; i++) {
    const creator = uniqueCreatorName(i);
    // Creator circle
    items.push({
      id: `creator-${i}`,
      label: `${creator} Profile`,
      colSpan: 1,
      shape: "circle",
    });
    // Pinned chatbot square
    items.push({
      id: `char-${i}-pin`,
      label: `${creator}'s Chatbot`,
      colSpan: 1,
      shape: "rounded",
    });

    // Randomly decide to show an ad. If not, add two extra character cubes.
    const showAd = rng() < 0.35;
    if (showAd) {
      items.push({
        id: `ad-${i}`,
        label: "AD (only for free users)",
        colSpan: 2,
        shape: "pill",
      });
    } else {
      items.push({
        id: `char-${i}-extra-a`,
        label: "Char Image",
        colSpan: 1,
        shape: "rounded",
      });
      items.push({
        id: `char-${i}-extra-b`,
        label: "Char Image",
        colSpan: 1,
        shape: "rounded",
      });
    }

    // After the ad/two-cube branch, always append five more random character cubes.
    for (let j = 0; j < 5; j++) {
      items.push({
        id: `char-${i}-tail-${j}`,
        label: "Char Image",
        colSpan: 1,
        shape: "rounded",
      });
    }
  }
  return items;
}

type SearchGridProps = {
  items?: SearchItem[];
  itemCount?: number;
  columns?: number;
  cellSize?: number;
  className?: string;
  tileClassName?: string;
};

export default function SearchGrid({
  items,
  itemCount = 100,
  columns = 5,
  cellSize = 170,
  className,
  tileClassName,
}: SearchGridProps) {
  const data = useMemo(() => items ?? buildRandomGrid(itemCount), [items, itemCount]);
  return (
    <div
      className={`mx-auto grid w-max items-start gap-4 ${className ?? ""}`}
      style={{
        gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
        gridAutoRows: `${cellSize}px`,
      }}
    >
      {data.map((item) => {
        const base =
          "flex h-full w-full items-center justify-center text-center text-sm font-medium text-text-high bg-surface-100/20 ring-1 ring-border-subtle/25 backdrop-blur-md shadow-inner";
        const col = item.colSpan ?? 1;
        const shape =
          item.shape === "circle"
            ? "rounded-full"
            : item.shape === "pill"
              ? "rounded-[30px]"
              : "rounded-[22px]";

        return (
          <div
            key={item.id}
            className={`${base} ${shape} ${tileClassName ?? ""}`}
            style={{ gridColumn: `span ${col}` }}
          >
            {item.label}
          </div>
        );
      })}
    </div>
  );
}
