// Well-known pubkeys.
// OWNER_PUBKEY and TA_PUBKEY are now fetched dynamically — use useConfig().ownerPubkey / .taPubkey.
// DAVE_PUBKEY remains as a NosFabrica-specific cosmetic constant (pins David's pubkey with a 🧑‍💻 emoji
// in author lists). Out of scope for this cleanup; flagged in docs/PREFERENCES_AUDIT.md.

export const DAVE_PUBKEY = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f';
