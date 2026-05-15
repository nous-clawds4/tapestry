/*
 * Mock data for Slice 0.
 *
 * Shape is designed to mirror the eventual REST API response from Slice 2,
 * so that Slice 3 can swap these direct imports for a `fetch('/api/...')`
 * with minimal consumer changes. Field names match PLAN.md §3 (community
 * record schema) and the eventual GR-Community scoring API.
 *
 * NOTE on `mirrors`: this field is retained for forward compatibility with
 * v1.1 mirror tooling, but is NOT surfaced anywhere in the v1 UI per the
 * locked deferral decision. Hiding lives at the component layer, not here.
 */

export const tags = [
  { id: 'independent-sound', label: 'Independent Sound' },
  { id: 'sovereign-tech', label: 'Sovereign Tech' },
  { id: 'rooted-living', label: 'Rooted Living' },
  { id: 'flavor-craft', label: 'Flavor & Craft' },
  { id: 'beautiful-game', label: 'The Beautiful Game' },
  { id: 'open-protocol', label: 'Open Protocol' },
  { id: 'sound-money', label: 'Sound Money' },
  { id: 'creative-spark', label: 'Creative Spark' },
  { id: 'mesh-signal', label: 'Mesh & Signal' },
  { id: 'deep-think', label: 'Deep Think' },
  { id: 'wellness', label: 'Wellness & Vitality' },
  { id: 'freedom', label: 'Freedom Builders' },
]

export const members = [
  { id: 'm1', name: 'Sarah Chen', handle: 'sarahc', trust: 0.94, vouchedBy: 12 },
  { id: 'm2', name: 'Marcus Williams', handle: 'marcus', trust: 0.89, vouchedBy: 8 },
  { id: 'm3', name: 'Elena Rodriguez', handle: 'elena', trust: 0.76, vouchedBy: 5 },
  { id: 'm4', name: 'David Kim', handle: 'dkim', trust: 0.91, vouchedBy: 10 },
  { id: 'm5', name: 'Amara Okafor', handle: 'amara', trust: 0.72, vouchedBy: 4 },
  { id: 'm6', name: 'Jake Morrison', handle: 'jakem', trust: 0.88, vouchedBy: 7 },
  { id: 'm7', name: 'Luna Patel', handle: 'lunap', trust: 0.65, vouchedBy: 3 },
  { id: 'm8', name: 'Omar Hassan', handle: 'omar', trust: 0.93, vouchedBy: 11 },
  { id: 'm9', name: 'Mika Tanaka', handle: 'mika', trust: 0.70, vouchedBy: 4 },
  { id: 'm10', name: 'Rosa Flores', handle: 'rosa', trust: 0.86, vouchedBy: 6 },
  { id: 'm11', name: 'Alex Rivera', handle: 'alexr', trust: 0.74, vouchedBy: 3 },
  { id: 'm12', name: 'Priya Sharma', handle: 'priya', trust: 0.92, vouchedBy: 9 },
  { id: 'm13', name: 'Ben Thompson', handle: 'bent', trust: 0.55, vouchedBy: 2 },
  { id: 'm14', name: 'Chloe Davis', handle: 'chloe', trust: 0.68, vouchedBy: 3 },
  { id: 'm15', name: 'Nico Alvarez', handle: 'nico', trust: 0.85, vouchedBy: 6 },
]

export const communities = [
  {
    slug: 'listening-room',
    name: 'The Listening Room',
    description: 'A gathering of music lovers who support artists directly. The audience listens; the artist gets paid.',
    tags: ['independent-sound', 'creative-spark'],
    memberCount: 342,
    trustedHere: 12,
    activity: '2h ago',
    mirrors: 4,
    accent: '#c4603a',
    members: ['m1','m2','m4','m6','m8','m10','m12','m15'],
    posts: [
      { author: 'm1', text: "Discovered a great artist this week, recommended by someone here. The circle works.", time: '2h ago' },
      { author: 'm6', text: 'Dropped a new mix today. No algorithm decides who hears it. Link in my profile.', time: '5h ago' },
      { author: 'm10', text: 'Anyone else going to the underground show this weekend? Would love to meet some of you in person.', time: '1d ago' },
    ],
  },
  {
    slug: 'sovereign-builders',
    name: 'Sovereign Builders',
    description: 'Running your own infrastructure, owning your own keys. We build the tools for a self-sovereign future.',
    tags: ['sovereign-tech', 'sound-money'],
    memberCount: 891,
    trustedHere: 24,
    activity: '15m ago',
    mirrors: 8,
    accent: '#4a6fe8',
    members: ['m1','m2','m3','m4','m5','m6','m8','m12','m15'],
    posts: [
      { author: 'm4', text: 'New guide up: how to set up your own relay in under 10 minutes. No technical background required.', time: '15m ago' },
      { author: 'm2', text: 'Spun up my own node for the first time tonight. Hard to describe what that feels like.', time: '3h ago' },
      { author: 'm12', text: "Just helped my neighbor set up his first wallet. The look on his face when it confirmed was something.", time: '8h ago' },
    ],
  },
  {
    slug: 'rooted-growing',
    name: 'Rooted & Growing',
    description: 'Homesteaders, gardeners, and anyone learning to live closer to the land. Practical knowledge, shared freely.',
    tags: ['rooted-living', 'wellness'],
    memberCount: 218,
    trustedHere: 8,
    activity: '1h ago',
    mirrors: 3,
    accent: '#5e9e4a',
    members: ['m3','m5','m7','m9','m11','m13','m14'],
    posts: [
      { author: 'm5', text: 'Spring planting is in full swing. Tomatoes, peppers, and herbs going in. The soil is finally warm enough.', time: '1h ago' },
      { author: 'm7', text: 'Does anyone have experience with rainwater collection systems? Looking for advice on filters.', time: '6h ago' },
    ],
  },
  {
    slug: 'kitchen-table',
    name: 'The Kitchen Table',
    description: 'Food is how we gather. Recipes, fermentation experiments, foraging finds, and the stories behind every meal.',
    tags: ['flavor-craft', 'rooted-living'],
    memberCount: 456,
    trustedHere: 15,
    activity: '30m ago',
    mirrors: 5,
    accent: '#c49a3a',
    members: ['m1','m3','m5','m8','m9','m10','m11','m14'],
    posts: [
      { author: 'm8', text: 'Week 3 of the sourdough experiment. The starter is finally singing. Photos incoming.', time: '30m ago' },
      { author: 'm3', text: "Made my grandmother's mole recipe for the first time. Took all day. Came out really well.", time: '4h ago' },
      { author: 'm14', text: "Foraged chanterelles in the rain this morning. A pretty good morning.", time: '1d ago' },
    ],
  },
  {
    slug: 'pitch-glory',
    name: 'Pitch & Glory',
    description: 'The beautiful game, discussed by people who live and breathe it. Tactics, stories, and the love of play.',
    tags: ['beautiful-game'],
    memberCount: 1247,
    trustedHere: 19,
    activity: '5m ago',
    mirrors: 6,
    accent: '#3ab5c4',
    members: ['m2','m4','m6','m8','m10','m12','m13','m15'],
    posts: [
      { author: 'm6', text: 'That second-half comeback was something else. Reminded me why I fell in love with the game.', time: '5m ago' },
      { author: 'm15', text: 'Sunday league update: we won 3-2 in the rain. Absolute scenes at the final whistle.', time: '2h ago' },
    ],
  },
  {
    slug: 'mesh-pioneers',
    name: 'Mesh Pioneers',
    description: 'Building communication networks that no one can shut down. Meshtastic, LoRa, ham radio, and whatever comes next.',
    tags: ['mesh-signal', 'sovereign-tech'],
    memberCount: 183,
    trustedHere: 6,
    activity: '3h ago',
    mirrors: 3,
    accent: '#7a5ec4',
    members: ['m1','m4','m6','m11','m13','m15'],
    posts: [
      { author: 'm4', text: 'Got a message through from 47km away today using the new antenna setup. The mesh is growing.', time: '3h ago' },
      { author: 'm15', text: 'Workshop this Saturday: build your own node for under $30. Everyone welcome, no experience needed.', time: '1d ago' },
    ],
  },
  {
    slug: 'protocol-dreamers',
    name: 'Protocol Dreamers',
    description: 'Imagining and building the open web. We work on the code, the philosophy, the human systems, and the future they enable.',
    tags: ['open-protocol', 'deep-think'],
    memberCount: 564,
    trustedHere: 21,
    activity: '45m ago',
    mirrors: 7,
    accent: '#c44a7a',
    members: ['m1','m2','m4','m8','m10','m12','m14','m15'],
    posts: [
      { author: 'm1', text: "The best protocols feel invisible. Nobody thinks about TCP/IP when they browse the web. We should aim for the same.", time: '45m ago' },
      { author: 'm8', text: 'Read a paper on convergent consensus last night. The math is doing something pretty elegant. Will share thoughts soon.', time: '6h ago' },
    ],
  },
  {
    slug: 'brainstorm-collective',
    name: 'Brainstorm Collective',
    description: 'The community behind Brainstorm itself. We build search engines for the people using them.',
    tags: ['open-protocol', 'sovereign-tech', 'deep-think'],
    memberCount: 327,
    trustedHere: 28,
    activity: '10m ago',
    mirrors: 9,
    accent: '#ba20ba',
    members: ['m1','m2','m3','m4','m6','m8','m10','m12'],
    posts: [
      { author: 'm2', text: 'Communities feature is taking shape. Excited to see where this goes.', time: '10m ago' },
      { author: 'm4', text: "Convergence tests are looking good. Independent nodes are landing on the same membership rosters.", time: '2h ago' },
    ],
  },
]

/* ── Selectors ──────────────────────────────────────────────────────── */

export function getCommunity(slug) {
  return communities.find(c => c.slug === slug)
}

export function getMember(id) {
  return members.find(m => m.id === id)
}

export function getCommunityMembers(slug) {
  const c = getCommunity(slug)
  if (!c) return []
  return c.members.map(getMember).filter(Boolean)
}

export function getVoucherNames(memberId, slug) {
  const c = getCommunity(slug)
  if (!c) return []
  const others = c.members.filter(id => id !== memberId)
  // Deterministic: pick the top three by trust so the list doesn't reshuffle on render.
  return others
    .map(getMember)
    .filter(Boolean)
    .sort((a, b) => b.trust - a.trust)
    .slice(0, 3)
    .map(m => m.name.split(' ')[0])
}

export function getTag(id) {
  return tags.find(t => t.id === id)
}
