// This event is written in the same database operation as an order that has
// passed supplier-side player validation. It lets the payment initializer
// trust that very recent verification without making customers wait for the
// identical supplier request twice.
export const PLAYER_VERIFIED_ORDER_EVENT_REASON = "Player verified during checkout";
export const PLAYER_VERIFICATION_REUSE_WINDOW_MS = 15 * 60 * 1000;
