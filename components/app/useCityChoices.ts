"use client";

import { useState } from "react";
import { CANONICAL_CITIES, MORE_CITIES, PRIMARY_CITIES, type City } from "@/lib/geo/cities";

/**
 * Which city chips to draw, and whether to offer the rest.
 *
 * The recognised list went from sixteen cities to forty-four so that a job in
 * Nagpur or Vizag could be filtered for at all. Drawing forty-four chips is
 * not a filter though, it is a paragraph of buttons, and it pushes every
 * control under it off the screen — so the large markets are shown and the
 * rest sit behind one more press.
 *
 * The one rule that matters: a city somebody has already selected is always
 * visible, even when it lives in the hidden half. Collapsing a filter that is
 * currently doing something is how a list ends up filtered by a chip the user
 * cannot find to turn off.
 */
export function useCityChoices(selected: readonly string[]) {
  const [expanded, setExpanded] = useState(false);

  const stuckOpen = MORE_CITIES.filter((c) => selected.includes(c));
  const shown: readonly City[] = expanded
    ? CANONICAL_CITIES
    : [...PRIMARY_CITIES, ...stuckOpen];

  return {
    shown,
    expanded,
    toggle: () => setExpanded((v) => !v),
    /** How many are still hidden. Zero means there is nothing to offer. */
    remaining: MORE_CITIES.length - stuckOpen.length,
  };
}
