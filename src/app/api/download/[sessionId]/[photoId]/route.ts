import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; photoId: string }> }
) {
  try {
    const { sessionId, photoId } = await params;

    // Get the photo document from Firestore
    const photoDoc = doc(db, `sessions/${sessionId}/photos`, photoId);
    const photoSnapshot = await getDoc(photoDoc);

    if (!photoSnapshot.exists()) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    const photoData = photoSnapshot.data();
    const aiOutputUrl = photoData?.aiOutputUrl;

    if (!aiOutputUrl) {
      return NextResponse.json(
        { error: 'AI output not available for this photo' },
        { status: 404 }
      );
    }

    // Redirect to the Firebase Storage URL
    return NextResponse.redirect(aiOutputUrl);
  } catch (error) {
    console.error('Download redirect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
