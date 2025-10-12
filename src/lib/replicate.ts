export interface ReplicateInput {
  prompt: string;
  image: string;
  [key: string]: any;
}

export interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: any;
  error?: any;
  logs?: string;
}

/**
 * Creates a new prediction on Replicate (via API route)
 */
export async function createPrediction(
  version: string,
  input: ReplicateInput,
  token?: string // Token is now optional since API route handles it
): Promise<ReplicatePrediction> {
  const response = await fetch('/api/replicate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'create', version, input }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create prediction');
  }

  return response.json();
}

/**
 * Gets the status of a prediction (via API route)
 */
export async function getPrediction(
  id: string,
  token?: string // Token is now optional since API route handles it
): Promise<ReplicatePrediction> {
  const response = await fetch('/api/replicate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'get', predictionId: id }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to get prediction');
  }

  return response.json();
}

/**
 * Polls a prediction until it completes (succeeded, failed, or canceled)
 */
export async function pollPrediction(
  id: string,
  token?: string, // Token is now optional
  interval: number = 1500,
  maxAttempts: number = 120
): Promise<ReplicatePrediction> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const prediction = await getPrediction(id);

    if (
      prediction.status === 'succeeded' ||
      prediction.status === 'failed' ||
      prediction.status === 'canceled'
    ) {
      return prediction;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
    attempts++;
  }

  throw new Error('Prediction polling timed out');
}

/**
 * Runs a complete Replicate prediction from start to finish
 */
export async function runReplicate(
  version: string,
  input: ReplicateInput,
  token?: string, // Token is now optional
  onProgress?: (status: string) => void
): Promise<any> {
  // Create the prediction
  const prediction = await createPrediction(version, input);
  onProgress?.(prediction.status);

  // Poll until completion
  let attempts = 0;
  const maxAttempts = 120;
  const interval = 1500;

  while (attempts < maxAttempts) {
    const result = await getPrediction(prediction.id);
    onProgress?.(result.status);

    if (result.status === 'succeeded') {
      return result.output;
    }

    if (result.status === 'failed' || result.status === 'canceled') {
      throw new Error(
        `Replicate prediction ${result.status}: ${result.error || 'Unknown error'}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
    attempts++;
  }

  throw new Error('Prediction polling timed out');
}
