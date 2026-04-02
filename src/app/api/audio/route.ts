import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    // We add confirm=t to bypass Google Drive's virus scan prompt for large files
    const fetchUrl = url.includes("drive.google.com") && !url.includes("confirm=t") 
      ? `${url}&confirm=t` 
      : url;

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

    // Pass along content length if available, to allow seeking
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
