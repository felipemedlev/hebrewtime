import { NextResponse } from "next/server";
import { getLevels } from "@/lib/episodes";

export const revalidate = 3600;

export async function GET() {
  const levels = await getLevels();
  return NextResponse.json(levels);
}
