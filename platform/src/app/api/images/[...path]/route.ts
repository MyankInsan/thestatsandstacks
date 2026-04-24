import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Serves generated images from the output folder
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path;
  const imagePath = path.join(process.cwd(), '..', 'output', ...segments);

  if (!fs.existsSync(imagePath)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  const imageBuffer = fs.readFileSync(imagePath);

  return new NextResponse(imageBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
