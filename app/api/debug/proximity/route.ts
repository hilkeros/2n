import { NextResponse } from "next/server";
import { getDid } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ACTIVE_WINDOW_MS, getNearbyCount, haversineMeters } from "@/lib/proximity";

const DEBUG_RADIUS_METERS = 100;

export async function GET() {
  const did = await getDid();
  if (!did) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const activeCutoff = Date.now() - ACTIVE_WINDOW_MS;

  const myRow = await db
    .selectFrom("user_location")
    .selectAll()
    .where("did", "=", did)
    .executeTakeFirst();

  const activeRows = await db
    .selectFrom("user_location")
    .selectAll()
    .where("updated_at", ">=", activeCutoff)
    .orderBy("updated_at", "desc")
    .execute();

  const nearbyCount = await getNearbyCount(did, DEBUG_RADIUS_METERS);

  const pairwiseDistances = buildPairwiseDistances(activeRows);

  return NextResponse.json({
    did,
    now: Date.now(),
    activeWindowMs: ACTIVE_WINDOW_MS,
    activeCutoff,
    nearbyCount,
    myLocation: myRow ?? null,
    activeRows,
    pairwiseDistances,
  });
}

interface ActiveRow {
  did: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  updated_at: number;
}

function buildPairwiseDistances(rows: ActiveRow[]) {
  const distances: Array<{ fromDid: string; toDid: string; meters: number }> = [];

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const from = rows[i];
      const to = rows[j];
      distances.push({
        fromDid: from.did,
        toDid: to.did,
        meters: Math.round(
          haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude),
        ),
      });
    }
  }

  return distances;
}
