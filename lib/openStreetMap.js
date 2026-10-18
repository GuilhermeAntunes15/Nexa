import "server-only";

const DEFAULT_NOMINATIM_URL = "https://nominatim.openstreetmap.org";

const PUBLIC_PLACE_CLASSES = new Set([
  "amenity",
  "building",
  "craft",
  "historic",
  "leisure",
  "office",
  "public_transport",
  "railway",
  "shop",
  "tourism",
]);

const BLOCKED_PLACE_TYPES = new Set([
  "adult_gaming_centre",
  "bar",
  "brothel",
  "casino",
  "hotel",
  "love_hotel",
  "motel",
  "nightclub",
  "pub",
  "stripclub",
]);

function providerUrl() {
  return (
    process.env.NOMINATIM_BASE_URL || DEFAULT_NOMINATIM_URL
  ).replace(/\/$/, "");
}

function requestHeaders() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    Accept: "application/json",
    "Accept-Language": "pt-BR,pt;q=0.9",
    Referer: appUrl,
    "User-Agent":
      process.env.NOMINATIM_USER_AGENT || `Nexa/0.1 (${appUrl})`,
  };
}

function placeId(place) {
  const prefix = {
    node: "N",
    way: "W",
    relation: "R",
  }[place.osm_type];

  if (!prefix || !place.osm_id) return null;
  return `${prefix}${place.osm_id}`;
}

export function isAllowedPublicPlace(place) {
  const placeClass = String(
    place?.category || place?.class || ""
  ).toLowerCase();
  const placeType = String(place?.type || "").toLowerCase();

  return (
    PUBLIC_PLACE_CLASSES.has(placeClass) &&
    !BLOCKED_PLACE_TYPES.has(placeType)
  );
}

export function normalizePlace(place) {
  const id = placeId(place);
  const latitude = Number(place?.lat);
  const longitude = Number(place?.lon);

  if (
    !id ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const displayName = String(place.display_name || "").trim();
  const name =
    place.namedetails?.name ||
    place.name ||
    displayName.split(",")[0] ||
    "Local público";

  return {
    placeId: id,
    name,
    address: displayName,
    latitude,
    longitude,
    categories: [place.category || place.class, place.type].filter(Boolean),
  };
}

export async function searchPublicPlaces(query) {
  const url = new URL(`${providerUrl()}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "8");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("extratags", "1");

  const response = await fetch(url, {
    headers: requestHeaders(),
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap search failed (${response.status})`);
  }

  const results = await response.json();

  return results
    .filter(isAllowedPublicPlace)
    .map(normalizePlace)
    .filter(Boolean)
    .slice(0, 6);
}

export async function retrievePublicPlace(id) {
  if (!/^[NWR]\d+$/.test(id)) return null;

  const url = new URL(`${providerUrl()}/lookup`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("osm_ids", id);
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("extratags", "1");

  const response = await fetch(url, {
    headers: requestHeaders(),
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap lookup failed (${response.status})`);
  }

  const results = await response.json();
  const place = results?.[0];

  if (!place || !isAllowedPublicPlace(place)) return null;
  return normalizePlace(place);
}
