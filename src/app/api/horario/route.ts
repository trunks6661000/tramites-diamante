export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import { getScheduleStatus } from '@/lib/schedule';

export const GET = async () => {
  const status = await getScheduleStatus();
  return NextResponse.json(status);
};
