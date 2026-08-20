export type FeedbackType = 'bug' | 'feature';

export interface FeedbackPayload {
  type: FeedbackType;
  message: string;
  appVersion?: string;
  contact?: string;
}

/**
 * Web build: Discord webhook is disabled so the secret is not exposed in public source.
 * Users can still use the form UI; submit explains that feedback is desktop-only / open an issue.
 */
export async function sendDiscordFeedback(
  _payload: FeedbackPayload
): Promise<{ ok: boolean; error?: string }> {
  return {
    ok: false,
    error: 'Feedback on the website is not connected. Use the desktop app or open a GitHub Issue on the D3Leaderboard repo.',
  };
}
