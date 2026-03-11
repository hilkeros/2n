import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOAuthClient } from "@/lib/auth/client";
import { clearUserLocation } from "@/lib/proximity";

export async function POST() {
  const cookieStore = await cookies();
  const did = cookieStore.get("did")?.value;

  if (did) {
    try {
      await clearUserLocation(did);
    } catch (error) {
      console.error("Logout location clear (pre-revoke) failed:", error);
    }

    try {
      const client = await getOAuthClient();
      await client.revoke(did);
    } catch (error) {
      console.error("Logout revoke failed:", error);
    }

    try {
      // Run a second clear after revoke to reduce races with in-flight writes.
      await clearUserLocation(did);
    } catch (error) {
      console.error("Logout location clear (post-revoke) failed:", error);
    }
  }

  cookieStore.delete("did");
  return NextResponse.json({ success: true });
}
