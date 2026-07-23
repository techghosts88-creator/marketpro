export const TRIAL_DAYS = 7;
export const SUBSCRIPTION_PRICE = 3000; // FCFA
export const SUBSCRIPTION_DAYS = 365;

export function trialEndDate(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

export function subscriptionEndDate(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + SUBSCRIPTION_DAYS);
  return d;
}

// Determine whether an account currently has access, and why.
// - 'trial'   : within the 7-day free trial window, no payment needed yet.
// - 'active'  : a payment has been recorded and its period hasn't lapsed.
// - 'expired' : trial ran out and no valid payment covers today.
export function computeBillingStatus(profile) {
  const now = new Date();
  const paidUntil = profile.paidUntil ? new Date(profile.paidUntil) : null;

  if (paidUntil && paidUntil > now) {
    return {
      status: "active",
      trialEndsAt: profile.trialEndsAt,
      paidUntil: paidUntil.toISOString(),
      daysRemaining: Math.max(0, Math.ceil((paidUntil - now) / 86400000)),
    };
  }

  const trialEndsAt = new Date(profile.trialEndsAt);
  if (trialEndsAt > now) {
    return {
      status: "trial",
      trialEndsAt: trialEndsAt.toISOString(),
      paidUntil: paidUntil ? paidUntil.toISOString() : null,
      daysRemaining: Math.max(0, Math.ceil((trialEndsAt - now) / 86400000)),
    };
  }

  return {
    status: "expired",
    trialEndsAt: trialEndsAt.toISOString(),
    paidUntil: paidUntil ? paidUntil.toISOString() : null,
    daysRemaining: 0,
  };
}

export function hasActiveAccess(profile) {
  return computeBillingStatus(profile).status !== "expired";
}
