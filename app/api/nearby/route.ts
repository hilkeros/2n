import { NextResponse } from "next/server";
import { getDid } from "@/lib/auth/session";
import { getNearbyUsers } from "@/lib/proximity";
import { resolveDidToHandle } from "@/lib/identity";

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

  const nearbyUsers = await getNearbyUsers(did, radiusMeters);
  const nearbyUsersWithHandles = await Promise.all(
    nearbyUsers.map(async (user) => ({
      ...user,
      handle: await resolveDidToHandle(user.did),
    })),
  );
  const nearbyCount = nearbyUsersWithHandles.length;

  return NextResponse.json({
    nearbyCount,
    nearbyUsers: nearbyUsersWithHandles,
    mode: nearbyCount >= 1 ? "group" : "solo",
    radiusMeters,
  });
}
