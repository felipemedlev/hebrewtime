import { NextRequest, NextResponse } from "next/server";
import { buildProxiedAudioUrl, isAllowedAudioProxyUrl } from "@/lib/allowedAudioHosts";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  if (!isAllowedAudioProxyUrl(url)) {
    return new NextResponse("URL not allowed", { status: 403 });
  }

  const fetchUrl = buildProxiedAudioUrl(url);
  if (!fetchUrl) {
    return new NextResponse("URL not allowed", { status: 403 });
  }

  try {
    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch from ${fetchUrl}:`, response.status);
      return new NextResponse("Failed to fetch audio stream", { status: response.status });
    }

    const headers = new Headers();
    headers.set("Content-Type", response.headers.get("content-type") || "audio/mpeg");
    headers.set("Accept-Ranges", "bytes");

    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(response.body, { headers });
  } catch (error) {
    console.error("Error proxying audio:", error);
    return new NextResponse("Error proxying audio", { status: 500 });
  }
}
