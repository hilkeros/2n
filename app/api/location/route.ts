import { NextResponse } from "next/server";
import { getDid } from "@/lib/auth/session";
import { upsertUserLocation, clearUserLocation } from "@/lib/proximity";

interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export async function POST(request: Request) {
  const did = await getDid();
  if (!did) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: LocationPayload;
  try {
    payload = (await request.json()) as LocationPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const validationError = validateLocationPayload(payload);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  await upsertUserLocation(did, {
    latitude: payload.latitude,
    longitude: payload.longitude,
    accuracyMeters: payload.accuracyMeters ?? 25,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const did = await getDid();
  if (!did) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await clearUserLocation(did);
  return NextResponse.json({ success: true });
}

function validateLocationPayload(payload: LocationPayload): string | null {
  const { latitude, longitude, accuracyMeters } = payload;

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return "Invalid latitude";
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return "Invalid longitude";
  }

  if (
    accuracyMeters !== undefined &&
    (!Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 5000)
  ) {
    return "Invalid accuracy";
  }

  return null;
}
