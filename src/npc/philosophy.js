/**
 * Philosophical lines for NPCs — unsolicited, earnest, slightly absurd midnight philosophy.
 */

export const PHILOSOPHY_LINES = [
  'Free will is just the universe hesitating before it repeats itself.',
  'Every neon sign is a prayer that forgot who it was praying to.',
  'If time is a flat circle, why do my shoes keep wearing down?',
  'Consciousness is the glitch that noticed itself noticing.',
  'The city does not sleep. It only pretends, so we feel less alone.',
  'Rain remembers every rooftop it has kissed and none of the people.',
  'Maybe loneliness is just honesty with better lighting.',
  'I asked the void what it wanted. It asked me for change for the metro.',
  'Destiny is a rumor the future tells to keep us walking forward.',
  'Your shadow is the only thing that never asks where you are going.',
  'Midnight is when the sky admits it has been lying about the day.',
  'We are all unfinished sentences waiting for a better verb.',
  'Hope is a streetlamp that refuses to burn out on principle.',
  'If the soul has a barcode, mine keeps getting scanned as someone else.',
  'Silence is not empty. It is crowded with everything we almost said.',
  'The moon clocks in late and still gets paid in silver.',
  'I do not fear death. I fear becoming a habit that outlives me.',
  'Truth wears sneakers so it can leave before you finish arguing.',
  'Every stranger is a novel with the first chapter torn out.',
  'Gravity is just the planet asking us to stay a little longer.',
  'Dreams are unpaid overtime for the imagination.',
  'I keep my regrets in a jar labeled "spices" so guests feel welcome.',
  'The future arrives already tired and asks if we have coffee.',
  'Morality is a crosswalk that only appears when headlights hit it.',
  'Somewhere a vending machine is meditating on the nature of choice.',
  'Love is two people agreeing to mispronounce forever the same way.',
  'The sidewalk knows more secrets than the skyline will ever admit.',
  'I am not lost. I am conducting a survey of wrong turns.',
  'Stars are just distant neon that never learned to advertise.',
  'Forgiveness is deleting a file you still keep in the trash.',
  'The night is a mirror that only reflects what you refuse to name.',
  'Entropy is patient. Fashion is not.',
  'If God is watching, She is also doomscrolling.',
  'My reflection waved first. I am still deciding whether to trust it.',
  'Meaning is a street performer who packs up when the rain starts.',
  'We invent clocks so time has someone to blame.',
];

/** Quirky night-city NPC identities with personal line subsets. */
export const NPC_PROFILES = [
  {
    name: 'Vex Pulse',
    color: 0x00e5ff,
    lines: [
      PHILOSOPHY_LINES[0],
      PHILOSOPHY_LINES[3],
      PHILOSOPHY_LINES[8],
      PHILOSOPHY_LINES[14],
      PHILOSOPHY_LINES[24],
    ],
  },
  {
    name: 'Mira Static',
    color: 0xff2d95,
    lines: [
      PHILOSOPHY_LINES[1],
      PHILOSOPHY_LINES[6],
      PHILOSOPHY_LINES[11],
      PHILOSOPHY_LINES[18],
      PHILOSOPHY_LINES[25],
    ],
  },
  {
    name: 'Cobalt Wren',
    color: 0x4d7cff,
    lines: [
      PHILOSOPHY_LINES[2],
      PHILOSOPHY_LINES[9],
      PHILOSOPHY_LINES[15],
      PHILOSOPHY_LINES[22],
      PHILOSOPHY_LINES[28],
    ],
  },
  {
    name: 'Amber Quill',
    color: 0xffb020,
    lines: [
      PHILOSOPHY_LINES[4],
      PHILOSOPHY_LINES[7],
      PHILOSOPHY_LINES[12],
      PHILOSOPHY_LINES[19],
      PHILOSOPHY_LINES[29],
    ],
  },
  {
    name: 'Lime Cipher',
    color: 0x9dff2e,
    lines: [
      PHILOSOPHY_LINES[5],
      PHILOSOPHY_LINES[10],
      PHILOSOPHY_LINES[16],
      PHILOSOPHY_LINES[23],
      PHILOSOPHY_LINES[30],
    ],
  },
  {
    name: 'Nyx Solvent',
    color: 0xc44dff,
    lines: [
      PHILOSOPHY_LINES[13],
      PHILOSOPHY_LINES[17],
      PHILOSOPHY_LINES[20],
      PHILOSOPHY_LINES[26],
      PHILOSOPHY_LINES[31],
    ],
  },
  {
    name: 'Juno Drift',
    color: 0xff5c5c,
    lines: [
      PHILOSOPHY_LINES[21],
      PHILOSOPHY_LINES[27],
      PHILOSOPHY_LINES[32],
      PHILOSOPHY_LINES[33],
      PHILOSOPHY_LINES[1],
    ],
  },
  {
    name: 'Echo Ravel',
    color: 0x2ef0c8,
    lines: [
      PHILOSOPHY_LINES[34],
      PHILOSOPHY_LINES[35],
      PHILOSOPHY_LINES[0],
      PHILOSOPHY_LINES[6],
      PHILOSOPHY_LINES[18],
    ],
  },
];
