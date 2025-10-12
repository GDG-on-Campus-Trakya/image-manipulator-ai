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
 * Creates a new prediction on Replicate
 */
export async function createPrediction(
  version: string,
  input: ReplicateInput,
  token: string
): Promise<ReplicatePrediction> {
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
    throw new Error(`Failed to create prediction: ${error}`);
  }

  return response.json();
}

/**
 * Gets the status of a prediction
 */
export async function getPrediction(
  id: string,
  token: string
): Promise<ReplicatePrediction> {
  const response = await fetch(
    `https://api.replicate.com/v1/predictions/${id}`,
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get prediction: ${error}`);
  }

  return response.json();
}

/**
 * Polls a prediction until it completes (succeeded, failed, or canceled)
 */
export async function pollPrediction(
  id: string,
  token: string,
  interval: number = 1500,
  maxAttempts: number = 120
): Promise<ReplicatePrediction> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const prediction = await getPrediction(id, token);

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
  token: string,
  onProgress?: (status: string) => void
): Promise<any> {
  // Create the prediction
  const prediction = await createPrediction(version, input, token);
  onProgress?.(prediction.status);

  // Poll until completion
  let attempts = 0;
  const maxAttempts = 120;
  const interval = 1500;

  while (attempts < maxAttempts) {
    const result = await getPrediction(prediction.id, token);
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
