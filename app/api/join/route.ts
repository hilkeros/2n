import { NextResponse } from "next/server";
import { Client, type AtIdentifierString } from "@atproto/lex";
import { getDid } from "@/lib/auth/session";
import { getOAuthClient } from "@/lib/auth/client";
import * as ch from "@/src/lexicons/ch";

export const SOCIAL_SONG_URI =
  "at://did:plc:giaakn4axmr5dhfnvha6r6wn/ch.indiemusi.social.song/3mgvh5h5sfk2f";

type JoinStatus = {
  joined: boolean;
  joinUri: string | null;
};

async function getLexClient(did: string): Promise<Client> {
  const client = await getOAuthClient();
  const oauthSession = await client.restore(did);
  return new Client(oauthSession);
}

async function findJoinRecordForSong(did: string): Promise<{ uri: string } | null> {
  const lexClient = await getLexClient(did);
  const records = await lexClient.list(ch.indiemusi.social.join, {
    repo: did as AtIdentifierString
  });

  const match = records.records.find((record) => {
    const value = record.value as { song?: unknown } | undefined;
    return typeof value?.song === "string" && value.song === SOCIAL_SONG_URI;
  });

  return match ? { uri: match.uri } : null;
}

export async function getJoinStatusForSong(did: string): Promise<JoinStatus> {
  const record = await findJoinRecordForSong(did);
  if (!record) {
    return {
      joined: false,
      joinUri: null,
    };
  }

  return {
    joined: true,
    joinUri: record.uri,
  };
}

export async function hasJoinedSong(did: string): Promise<boolean> {
  const status = await getJoinStatusForSong(did);
  return status.joined;
}

async function createJoinForSong(did: string): Promise<JoinStatus> {
  const existing = await getJoinStatusForSong(did);
  if (existing.joined) {
    return existing;
  }

  const lexClient = await getLexClient(did);
  const created = await lexClient.create(ch.indiemusi.social.join, {
    song: SOCIAL_SONG_URI,
  });

  return {
    joined: true,
    joinUri: created.uri,
  };
}

async function deleteJoinForSong(did: string): Promise<JoinStatus> {
  const existing = await getJoinStatusForSong(did);
  if (!existing.joined || !existing.joinUri) {
    return {
      joined: false,
      joinUri: null,
    };
  }

  const uriParts = existing.joinUri.split("/");
  const rkey = uriParts[uriParts.length - 1];

  const lexClient = await getLexClient(did);
  await lexClient.delete(ch.indiemusi.social.join, { rkey });

  return {
    joined: false,
    joinUri: null,
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
    const created = await createJoinForSong(did);

    return NextResponse.json({
      success: true,
      joined: true,
      joinUri: created.joinUri,
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

export async function DELETE() {
  const did = await getDid();
  if (!did) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await deleteJoinForSong(did);

    return NextResponse.json({
      success: true,
      joined: status.joined,
      joinUri: status.joinUri,
      songUri: SOCIAL_SONG_URI,
    });
  } catch (error) {
    console.error("Failed to delete join record:", error);
    return NextResponse.json(
      { error: "Failed to delete join record" },
      { status: 500 },
    );
  }
}
