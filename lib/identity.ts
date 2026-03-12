const SUCCESS_TTL_MS = 5 * 60 * 1000;
const MISS_TTL_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

type CacheEntry = {
  handle: string | null;
  expiresAt: number;
};

const globalIdentityCache = globalThis as typeof globalThis & {
  __n2DidHandleCache?: Map<string, CacheEntry>;
};

globalIdentityCache.__n2DidHandleCache ??= new Map<string, CacheEntry>();

export async function resolveDidToHandle(did: string): Promise<string | null> {
  const now = Date.now();
  const cached = globalIdentityCache.__n2DidHandleCache?.get(did);
  if (cached && cached.expiresAt > now) {
    return cached.handle;
  }

  const handle = await fetchHandleFromDidDocument(did);
  globalIdentityCache.__n2DidHandleCache?.set(did, {
    handle,
    expiresAt: now + (handle ? SUCCESS_TTL_MS : MISS_TTL_MS),
  });
  return handle;
}

async function fetchHandleFromDidDocument(did: string): Promise<string | null> {
  const url = getDidDocumentUrl(did);
  if (!url) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const doc = (await response.json()) as { alsoKnownAs?: unknown };
    const aliases = Array.isArray(doc.alsoKnownAs) ? doc.alsoKnownAs : [];

    const atUri = aliases.find(
      (value): value is string => typeof value === "string" && value.startsWith("at://"),
    );
    if (!atUri) return null;

    const handle = atUri.slice("at://".length).trim();
    return handle.length > 0 ? handle : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getDidDocumentUrl(did: string): string | null {
  if (did.startsWith("did:plc:")) {
    return `https://plc.directory/${did}`;
  }

  if (did.startsWith("did:web:")) {
    const domain = did.slice("did:web:".length);
    if (!domain) return null;
    return `https://${domain}/.well-known/did.json`;
  }

  return null;
}
