import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getSubscriptionState,
  clearSubscription,
  getCurrentSubscription,
  isCurrentUserPremium,
} from "../../store/subscriptionStore";

describe("subscriptionStore", () => {
  it("returns the initial subscription state", () => {
    clearSubscription();

    const state = getSubscriptionState();

    expect(state.subscription).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("clears the subscription state", () => {
    clearSubscription();

    const state = getSubscriptionState();

    expect(state).toEqual({
      subscription: null,
      loading: false,
      error: null,
    });
  });

  it("returns null when there is no current subscription", () => {
    clearSubscription();

    expect(getCurrentSubscription()).toBeNull();
  });

  it("returns false when the current user is not premium", () => {
    clearSubscription();

    expect(isCurrentUserPremium()).toBe(false);
  });
});
