import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddingsForWorkspace } from '@/lib/embeddings';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId required' },
        { status: 400 }
      );
    }

    // Start background job (don't await - return immediately)
    generateEmbeddingsForWorkspace(workspaceId).catch(error => {
      console.error('Embedding generation failed:', error);
    });

    return NextResponse.json({
      message: 'Embedding generation started',
      workspaceId
    });
  } catch (error: any) {
    console.error('Embedding API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start embedding generation' },
      { status: 500 }
    );
  }
}
