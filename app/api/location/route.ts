import { NextResponse } from "next/server";
import { Client, type AtIdentifierString } from "@atproto/lex";
import { getDid } from "@/lib/auth/session";
import { getOAuthClient } from "@/lib/auth/client";
import { upsertUserLocation, clearUserLocation } from "@/lib/proximity";
import * as ch from "@/src/lexicons/ch";

const SOCIAL_SONG_URI =
  "at://did:plc:giaakn4axmr5dhfnvha6r6wn/ch.indiemusi.social.song/3mgvh5h5sfk2f";

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

  const joined = await hasJoinedSong(did);
  if (!joined) {
    return NextResponse.json(
      { error: "Join record required before participating" },
      { status: 403 },
    );
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

async function hasJoinedSong(did: string): Promise<boolean> {
  const client = await getOAuthClient();
  const oauthSession = await client.restore(did);
  const lexClient = new Client(oauthSession);

  const records = await lexClient.list(ch.indiemusi.social.join, {
    repo: did as AtIdentifierString,
    limit: 100,
  });

  return records.records.some((record) => {
    const value = record.value as { song?: unknown } | undefined;
    return typeof value?.song === "string" && value.song === SOCIAL_SONG_URI;
  });
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
