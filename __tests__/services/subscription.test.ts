// Supabase va Env xatolarini oldini olish uchun mock (fayl tepasida bo'lishi shart)
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "mock-key";

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  })),
  processLock: jest.fn(),
}));

import {
  clearSubscription,
  getCurrentSubscription,
  getSubscriptionState,
  isCurrentUserPremium,
} from "../../store/subscriptionStore";

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
