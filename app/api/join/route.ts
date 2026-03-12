import { NextResponse } from "next/server";
import { Client, type AtIdentifierString } from "@atproto/lex";
import { getDid } from "@/lib/auth/session";
import { getOAuthClient } from "@/lib/auth/client";
import * as ch from "@/src/lexicons/ch";

const SOCIAL_SONG_URI =
  "at://did:plc:giaakn4axmr5dhfnvha6r6wn/ch.indiemusi.social.song/3mgvh5h5sfk2f";

async function getJoinStatusForSong(did: string): Promise<{ joined: boolean; joinUri: string | null }> {
  const client = await getOAuthClient();
  const oauthSession = await client.restore(did);
  const lexClient = new Client(oauthSession);

  const records = await lexClient.list(ch.indiemusi.social.join, {
    repo: did as AtIdentifierString,
    limit: 100,
  });

  const matchingRecord = records.records.find((record) => {
    const value = record.value as { song?: unknown } | undefined;
    return typeof value?.song === "string" && value.song === SOCIAL_SONG_URI;
  });

  return {
    joined: !!matchingRecord,
    joinUri: matchingRecord?.uri ?? null,
  };
}

export async function GET() {
  const did = await getDid();
  if (!did) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getJoinStatusForSong(did);
    return NextResponse.json({
      joined: status.joined,
      joinUri: status.joinUri,
      songUri: SOCIAL_SONG_URI,
    });
  } catch (error) {
    console.error("Failed to fetch join status:", error);
    return NextResponse.json(
      { error: "Failed to fetch join status" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const did = await getDid();
  if (!did) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = await getJoinStatusForSong(did);
    if (existing.joined) {
      return NextResponse.json({
        success: true,
        joined: true,
        joinUri: existing.joinUri,
        songUri: SOCIAL_SONG_URI,
      });
    }

    const client = await getOAuthClient();
    const oauthSession = await client.restore(did);
    const lexClient = new Client(oauthSession);

    const created = await lexClient.create(ch.indiemusi.social.join, {
      song: SOCIAL_SONG_URI,
    });

    return NextResponse.json({
      success: true,
      joined: true,
      joinUri: created.uri,
      songUri: SOCIAL_SONG_URI,
    });
  } catch (error) {
    console.error("Failed to create join record:", error);
    return NextResponse.json(
      { error: "Failed to create join record" },
      { status: 500 },
    );
  }
}
