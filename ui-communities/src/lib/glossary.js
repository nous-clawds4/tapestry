/*
 * UX-vocabulary glossary.
 *
 * The user-facing copy uses friendly verbs; the underlying protocol uses
 * formal terms. This file is the single source of truth for that mapping,
 * so that when slices 4–6 wire writes to the Endorsements DList the right
 * `type`/`role` tag values are emitted regardless of which surface (button
 * label, drawer, badge) the user touched.
 *
 * Slice 0 only consumes the friendly labels. Slice 4 wires `signalType` into
 * the actual event-publish path. Living here from day one means the
 * protocol↔UX mapping is documented in code, not in head canon.
 */

export const GLOSSARY = {
  vouch: {
    label: 'Vouch',
    protocolTerm: 'endorse',
    signalType: 'endorse',
    role: 'member',
  },
  concern: {
    label: 'Raise a concern',
    protocolTerm: 'veto',
    signalType: 'veto',
    role: 'member',
  },
  foundingVoice: {
    label: 'Founding voices',
    protocolTerm: 'seed',
  },
  trustedHere: {
    label: 'Trusted here',
    protocolTerm: 'community-GR-counted members',
  },
}
