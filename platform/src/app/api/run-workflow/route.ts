import { NextResponse } from 'next/server';
import { runDailyWorkflow } from '@/lib/queue/workflow';

export const maxDuration = 300; // Allow up to 5 minutes for image generation

export async function POST() {
  try {
    const result = await runDailyWorkflow();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Workflow failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
