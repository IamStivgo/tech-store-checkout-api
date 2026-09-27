const VISIBLE_TRAILING_CHARACTERS = 4;

/** `3001234567` → `******4567`: only the last four characters stay visible. */
export const maskAllButLastFour = (value: string): string =>
  `${'*'.repeat(Math.max(value.length - VISIBLE_TRAILING_CHARACTERS, 0))}${value.slice(-VISIBLE_TRAILING_CHARACTERS)}`;
