import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, version, input, predictionId } = body;

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'Replicate API token not configured' },
        { status: 500 }
      );
    }

    // Handle creating a new prediction
    if (action === 'create') {
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ version, input }),
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          { error: `Failed to create prediction: ${error}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    // Handle getting prediction status
    if (action === 'get') {
      if (!predictionId) {
        return NextResponse.json(
          { error: 'Prediction ID is required' },
          { status: 400 }
        );
      }

      const response = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          { error: `Failed to get prediction: ${error}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "create" or "get"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Replicate API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
