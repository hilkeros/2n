import { getDb } from "@/lib/db";

export const ACTIVE_WINDOW_MS = 120_000;

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export interface NearbyUser {
  did: string;
  distanceMeters: number;
}

export async function upsertUserLocation(
  did: string,
  location: LocationUpdate,
): Promise<void> {
  const now = Date.now();
  const db = getDb();

  await db
    .insertInto("user_location")
    .values({
      did,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy_meters: location.accuracyMeters,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.column("did").doUpdateSet({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy_meters: location.accuracyMeters,
        updated_at: now,
      }),
    )
    .execute();
}

export async function clearUserLocation(did: string): Promise<void> {
  const db = getDb();
  await db.deleteFrom("user_location").where("did", "=", did).execute();
}

export async function getNearbyCount(
  did: string,
  radiusMeters: number,
): Promise<number> {
  const nearbyUsers = await getNearbyUsers(did, radiusMeters);
  return nearbyUsers.length;
}

export async function getNearbyUsers(
  did: string,
  radiusMeters: number,
): Promise<NearbyUser[]> {
  const now = Date.now();
  const activeCutoff = now - ACTIVE_WINDOW_MS;
  const db = getDb();

  await db
    .deleteFrom("user_location")
    .where("updated_at", "<", activeCutoff)
    .execute();

  const me = await db
    .selectFrom("user_location")
    .select(["latitude", "longitude"])
    .where("did", "=", did)
    .executeTakeFirst();

  if (!me) return [];

  const others = await db
    .selectFrom("user_location")
    .select(["did", "latitude", "longitude"])
    .where("did", "!=", did)
    .where("updated_at", ">=", activeCutoff)
    .execute();

  return others
    .map((other) => ({
      did: other.did,
      distanceMeters: Math.round(
        haversineMeters(
          me.latitude,
          me.longitude,
          other.latitude,
          other.longitude,
        ),
      ),
    }))
    .filter((other) => other.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) *
      Math.cos(radLat2) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6_371_000 * c;
}
