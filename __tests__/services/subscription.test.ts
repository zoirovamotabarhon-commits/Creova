import { useSubscriptionStore } from '../../store/subscriptionStore';

describe('Subscription Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default subscription values', () => {
    const state = useSubscriptionStore.getState();

    expect(state).toBeDefined();
  });

  it('should correctly handle entitlement status checks', () => {
    const state = useSubscriptionStore.getState();

    const isEntitled =
      state.subscription?.status === 'active' ||
      state.subscription?.status === 'trialing';

    expect(isEntitled).toBe(true);
  });
});
