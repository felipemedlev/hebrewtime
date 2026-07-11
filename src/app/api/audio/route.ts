import { NextRequest, NextResponse } from "next/server";
import {
  buildProxiedAudioUrl,
  isAllowedAudioContentType,
  isAllowedAudioProxyUrl,
  isAllowedAudioRedirectUrl,
} from "@/lib/allowedAudioHosts";

const MAX_REDIRECTS = 3;
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
};

async function fetchAllowedAudio(initialUrl: string): Promise<Response> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: FETCH_HEADERS,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return new NextResponse("Invalid redirect response", { status: 502 });
      }

      const nextUrl = new URL(location, currentUrl).href;
      if (!isAllowedAudioRedirectUrl(nextUrl)) {
        return new NextResponse("Redirect target not allowed", { status: 403 });
      }

      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) {
      return response;
    }

    if (!isAllowedAudioContentType(response.headers.get("content-type"))) {
      return new NextResponse("Invalid content type", { status: 415 });
    }

    return response;
  }

  return new NextResponse("Too many redirects", { status: 502 });
}

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
    const response = await fetchAllowedAudio(fetchUrl);

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
