export const CATEGORIES = [
  { value: "bedroom", label: "Bedroom", token: "matcha" },
  { value: "kitchen", label: "Kitchen", token: "tangerine" },
  { value: "living_room", label: "Living Room", token: "lilac" },
  { value: "bathroom", label: "Bathroom", token: "sky" },
  { value: "decor", label: "Decor", token: "blush" },
  { value: "wardrobe", label: "Wardrobe", token: "butter" },
  { value: "other", label: "Other", token: "matcha" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export const categoryLabel = (v: string) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? v;
export const categoryToken = (v: string) =>
  CATEGORIES.find((c) => c.value === v)?.token ?? "matcha";
