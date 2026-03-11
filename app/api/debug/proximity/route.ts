import { NextResponse } from "next/server";
import { getDid } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getNearbyCount } from "@/lib/proximity";

const DEBUG_RADIUS_METERS = 100;
const ACTIVE_WINDOW_MS = 30_000;

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

  return NextResponse.json({
    did,
    now: Date.now(),
    activeCutoff,
    nearbyCount,
    myLocation: myRow ?? null,
    activeRows,
  });
}
