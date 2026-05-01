import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Serves generated media from the output folder
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path;
  const imagePath = path.join(process.cwd(), '..', 'output', ...segments);

  if (!fs.existsSync(imagePath)) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const contentType = getContentType(imagePath);

  return new NextResponse(imageBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

function getContentType(filePath: string): string {
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.mp4')) return 'video/mp4';
  if (filePath.endsWith('.mov')) return 'video/quicktime';
  return 'image/png';
}
