import { NextResponse } from "next/server";
import { getDid } from "@/lib/auth/session";
import { getNearbyCount } from "@/lib/proximity";

const DEFAULT_RADIUS_METERS = 100;
const MAX_RADIUS_METERS = 1000;

export async function GET(request: Request) {
  const did = await getDid();
  if (!did) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawRadius = searchParams.get("radiusMeters");
  const radiusMeters = rawRadius ? Number(rawRadius) : DEFAULT_RADIUS_METERS;

  if (
    !Number.isFinite(radiusMeters) ||
    radiusMeters <= 0 ||
    radiusMeters > MAX_RADIUS_METERS
  ) {
    return NextResponse.json({ error: "Invalid radius" }, { status: 400 });
  }

  const nearbyCount = await getNearbyCount(did, radiusMeters);

  return NextResponse.json({
    nearbyCount,
    mode: nearbyCount >= 1 ? "group" : "solo",
    radiusMeters,
  });
}
