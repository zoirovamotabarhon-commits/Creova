export type UserIntent = 'code' | 'chat' | 'vision' | 'media' | 'unknown';

export class IntentDetector {
  public static detectIntent(input: string): UserIntent {
    const text = input.toLowerCase();

    const codeKeywords = ['code', 'bug', 'fix', 'refactor', 'function', 'component', 'file', 'script'];
    const visionKeywords = ['image', 'photo', 'camera', 'see', 'analyze picture'];

    if (codeKeywords.some(keyword => text.includes(keyword))) {
      return 'code';
    }

    if (visionKeywords.some(keyword => text.includes(keyword))) {
      return 'vision';
    }

    return 'chat';
  }
}

