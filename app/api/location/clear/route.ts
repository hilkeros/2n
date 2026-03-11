import { NextResponse } from "next/server";
import { getDid } from "@/lib/auth/session";
import { clearUserLocation } from "@/lib/proximity";

export async function POST() {
  const did = await getDid();
  if (!did) {
    return NextResponse.json({ success: true });
  }

  await clearUserLocation(did);
  return NextResponse.json({ success: true });
}
