export const homeCategoryMinimum = positiveInteger(
  process.env.HOME_CATEGORY_MIN_PRODUCTS,
  1,
);

export const homeCategoryLimit = 3;
export const homeFeaturedLimit = 4;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
