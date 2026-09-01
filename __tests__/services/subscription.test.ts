jest.mock("../../services/payments/subscriptions", () => ({
  getSubscription: jest.fn(),
}));

jest.mock("../../services/payments/entitlements", () => ({
  getEntitlements: jest.fn(() => ({
    premium: false,
  })),
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

    expect(state.subscription).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("clears the subscription state", () => {
    const state = getSubscriptionState();

    expect(state).toEqual({
      subscription: null,
      loading: false,
      error: null,
    });
  });

  it("returns null when there is no current subscription", () => {
    expect(getCurrentSubscription()).toBeNull();
  });

  it("returns false when the current user is not premium", () => {
    expect(isCurrentUserPremium()).toBe(false);
  });
});
