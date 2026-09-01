import { useSubscriptionStore } from "../../store/subscriptionStore";

describe("subscriptionStore", () => {
  beforeEach(() => {
    useSubscriptionStore.setState({
      currentSubscription: null,
      loading: false,
      error: null,
    });

    jest.clearAllMocks();
  });

  it("returns the initial subscription state", () => {
    const state = useSubscriptionStore.getState();

    expect(state).toBeDefined();
    expect(state.currentSubscription).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("clears the subscription state", () => {
    const { clearSubscription } =
      useSubscriptionStore.getState();

    clearSubscription();

    const state = useSubscriptionStore.getState();

    expect(state.currentSubscription).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("returns null when there is no current subscription", () => {
    const { getCurrentSubscription } =
      useSubscriptionStore.getState();

    expect(getCurrentSubscription()).toBeNull();
  });

  it("returns false when the current user is not premium", () => {
    const { isCurrentUserPremium } =
      useSubscriptionStore.getState();

    expect(isCurrentUserPremium()).toBe(false);
  });
});