/**
 * Tiny English singular/plural helper for the create-list UX.
 *
 * The DList NIP requires the `names` tag to carry BOTH singular and plural
 * forms ("widget", "widgets"). Non-technical users naturally name lists in
 * the plural ("Movies", "Restaurants"), so we accept the plural input and
 * auto-derive the singular. The user can override.
 *
 * Coverage is intentionally narrow — common English rules + a small
 * irregular table. Anything we can't confidently singularize, we leave
 * unchanged and let the user edit.
 */

const IRREGULAR: Record<string, string> = {
  // Plural -> singular
  people: "person",
  men: "man",
  women: "woman",
  children: "child",
  mice: "mouse",
  geese: "goose",
  feet: "foot",
  teeth: "tooth",
  oxen: "ox",
  data: "datum",
  criteria: "criterion",
};

/** Best-effort singularize. Returns the input unchanged when uncertain. */
export function singularize(input: string): string {
  if (!input) return input;
  const trimmed = input.trim();
  if (!trimmed) return input;

  const lower = trimmed.toLowerCase();
  if (IRREGULAR[lower]) {
    return preserveCase(trimmed, IRREGULAR[lower]);
  }

  // Common patterns
  if (/ies$/i.test(trimmed) && trimmed.length > 3) {
    return trimmed.slice(0, -3) + "y"; // categories -> category
  }
  if (/(ches|shes|sses|xes|zzes)$/i.test(trimmed)) {
    return trimmed.slice(0, -2); // boxes -> box, dishes -> dish
  }
  if (/ves$/i.test(trimmed) && trimmed.length > 3) {
    return trimmed.slice(0, -3) + "f"; // wolves -> wolf (approximation)
  }
  if (/s$/i.test(trimmed) && !/(ss|us|is)$/i.test(trimmed)) {
    return trimmed.slice(0, -1); // movies -> movie
  }
  return trimmed;
}

/** Best-effort pluralize. Inverse direction; less commonly needed. */
export function pluralize(input: string): string {
  if (!input) return input;
  const trimmed = input.trim();
  if (!trimmed) return input;

  const lower = trimmed.toLowerCase();
  for (const [plural, singular] of Object.entries(IRREGULAR)) {
    if (singular === lower) {
      return preserveCase(trimmed, plural);
    }
  }

  if (/(s|x|z|ch|sh)$/i.test(trimmed)) return trimmed + "es";
  if (/[^aeiou]y$/i.test(trimmed)) return trimmed.slice(0, -1) + "ies";
  return trimmed + "s";
}

function preserveCase(reference: string, target: string): string {
  if (reference === reference.toUpperCase()) return target.toUpperCase();
  if (reference[0] === reference[0]?.toUpperCase()) {
    return target[0].toUpperCase() + target.slice(1);
  }
  return target;
}
