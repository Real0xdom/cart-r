import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  try {
    const [{ count: acceptanceCount, error: acceptanceError }, { count: documentCount, error: documentError }, { count: publishedCount, error: publishedError }] = await Promise.all([
      supabaseAdmin
        .from('user_terms_acceptance')
        .select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('legal_documents')
        .select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('legal_documents')
        .select('*', { count: 'exact', head: true })
        .eq('is_published', true),
    ]);

    if (acceptanceError || documentError || publishedError) {
      console.error('Failed to load legal stats:', {
        acceptanceError,
        documentError,
        publishedError,
      });

      return NextResponse.json({ error: 'Failed to load legal stats' }, { status: 500 });
    }

    return NextResponse.json({
      acceptanceCount: acceptanceCount || 0,
      documentCount: documentCount || 0,
      publishedCount: publishedCount || 0,
    });
  } catch (error) {
    console.error('API legal stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
