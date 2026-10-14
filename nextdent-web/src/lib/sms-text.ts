// Pure SMS text maths, shared by the server (which sends) and the browser (which
// previews). It lives apart from lib/sms.ts because that module is server-only —
// same split as billing-math.ts against billing.ts.

export type SmsValues = Record<string, string | number | null | undefined>;

/**
 * Billable segment count. Any non-Latin character forces UCS-2 encoding, which holds
 * 70 characters in a single message and 67 per part once concatenated — against 160
 * and 153 for GSM-7. A Bangla reminder therefore costs about twice a Latin one.
 */
export function countSegments(body: string): { segments: number; unicode: boolean; chars: number } {
  const unicode = /[^\u0000-\u007F]/.test(body);
  const chars = [...body].length;
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const segments = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi);
  return { segments, unicode, chars };
}

/** Every {placeholder} a template asks for, in order, without duplicates. */
export const placeholdersIn = (body: string): string[] => [
  ...new Set([...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1])),
];

/**
 * The placeholders a template needs that this patient has no value for. A message
 * with holes in it ("মোট খরচ  টাকা") is worse than no message, so the caller is
 * expected to show these rather than send blind.
 */
export const missingPlaceholders = (body: string, values: SmsValues): string[] =>
  placeholdersIn(body).filter((k) => {
    const v = values[k];
    return v === null || v === undefined || String(v).trim() === "";
  });

/** Fill {placeholders}. Anything with no value is dropped rather than left as "{x}". */
export function renderTemplate(body: string, values: SmsValues): string {
  return body
    .replace(/\{(\w+)\}/g, (_m, k: string) => {
      const v = values[k];
      return v === null || v === undefined ? "" : String(v);
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
