import { NextResponse } from "next/server";
import { createAppServerClient } from "@/lib/supabase/app";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createAppServerClient();
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
