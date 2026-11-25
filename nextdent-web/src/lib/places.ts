import "server-only";

// Address suggestions from Google Places Autocomplete (New), called from the server
// so the API key never reaches the browser. Every request is billed by Google, so the
// key lives only here, the route that uses it requires a signed-in user, and the field
// that calls it waits for a pause in typing and three characters before asking.
//
// Gated on GOOGLE_MAPS_API_KEY, like the calendar integration on its OAuth keys: with
// no key the address field is a plain text box and nothing calls Google.

const ENDPOINT = "https://places.googleapis.com/v1/places:autocomplete";

// The clinic is in Barishal. Suggestions are kept inside Bangladesh and leaned towards
// the city, so "Sadar Road" means Barishal's before Dhaka's.
const BARISHAL = { latitude: 22.701, longitude: 90.3535 };
const BIAS_RADIUS_M = 50_000;

export type AddressSuggestion = { placeId: string; text: string; main: string; secondary: string };

export const placesConfigured = (): boolean => Boolean(process.env.GOOGLE_MAPS_API_KEY);

type GoogleAutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
    };
  }[];
};

/**
 * Suggestions for what has been typed so far. Never throws: a failure — quota, network,
 * a revoked key — just means no suggestions, and the clinician carries on typing.
 * `sessionToken` groups one address entry's keystrokes for Google's billing.
 */
export async function suggestAddresses(input: string, sessionToken?: string): Promise<AddressSuggestion[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // ask only for what the dropdown shows; Google bills by the fields requested
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["bd"],
        locationBias: { circle: { center: BARISHAL, radius: BIAS_RADIUS_M } },
        languageCode: "en",
        ...(sessionToken ? { sessionToken } : {}),
      }),
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) {
      // the body can echo the request, so log the status only
      console.error("places autocomplete failed", res.status);
      return [];
    }
    const data = (await res.json()) as GoogleAutocompleteResponse;
    return (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId && p.text?.text))
      .map((p) => ({
        placeId: p.placeId,
        text: p.text!.text,
        main: p.structuredFormat?.mainText?.text ?? p.text!.text,
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      }));
  } catch (e) {
    console.error("places autocomplete error", e instanceof Error ? e.name : "unknown");
    return [];
  }
}
