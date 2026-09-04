process.env.EXPO_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "mock-key";

jest.mock("@react-native-async-storage/async-storage", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  return require("@react-native-async-storage/async-storage/jest/async-storage-mock");
  /* eslint-enable @typescript-eslint/no-require-imports */
});

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
    },
  })),
  processLock: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  clearSubscription,
  getCurrentSubscription,
  getSubscriptionState,
  isCurrentUserPremium,
} = require("../../store/subscriptionStore");
/* eslint-enable @typescript-eslint/no-require-imports */

describe("subscriptionStore", () => {
  beforeEach(() => {
    clearSubscription();
    jest.clearAllMocks();
  });

  it("returns the initial subscription state", () => {
    const state = getSubscriptionState();

    expect(state).toBeDefined();
    expect(state.subscription).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("clears the subscription state", () => {
    clearSubscription();

    const state = getSubscriptionState();

    expect(state.subscription).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("returns null when there is no current subscription", () => {
    expect(getCurrentSubscription()).toBeNull();
  });

  it("returns false when the current user is not premium", () => {
    expect(isCurrentUserPremium()).toBe(false);
  });
});