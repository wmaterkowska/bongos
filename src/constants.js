// Theory registry. Add a new entry here to make a theory appear in the
// selector — rules.js, canvas.js, and app.js all read from the active theory.
export const THEORIES = {
  phi4: {
    id: 'phi4',
    name: 'φ⁴ theory',
    vertexNodeLabel: 'λ',
    coupling: {
      vertexFactor: '-i\\lambda',
      displaySymbol: '−iλ',
      description: 'One factor of −iλ per vertex.',
    },
    propagator: {
      latex: '\\frac{i}{p^2 - m^2 + i\\varepsilon}',
      description: 'One propagator per internal line.',
    },
    externalLeg: {
      latex: '1',
      description: 'Scalar external legs each contribute factor 1.',
    },
    legsPerVertex: 4,
    supportsEdgeTypes: false,
    validationHint: 'Each vertex needs exactly 4 legs (amber border = warning).',
    paletteItems: [
      { type: 'vertex', label: 'Vertex', factorKey: 'coupling.displaySymbol' },
      { type: 'external', label: 'External leg', factorText: 'factor 1' },
    ],
    examples: [
      { label: 'φ⁴ — 2→2 scattering (tree level)', path: 'examples/phi4-tree-2to2.json' },
      { label: 'φ⁴ — Bubble correction to 2→2 (1-loop)', path: 'examples/phi4-bubble.json' },
      { label: 'φ⁴ — Tadpole (1-loop)', path: 'examples/phi4-tadpole.json' },
      { label: 'φ⁴ — Sunset / sunrise (2-loop)', path: 'examples/phi4-sunset.json' },
    ],
  },

  phi3: {
    id: 'phi3',
    name: 'φ³ theory',
    vertexNodeLabel: 'g',
    coupling: {
      vertexFactor: '-ig',
      displaySymbol: '−ig',
      description: 'One factor of −ig per vertex.',
    },
    propagator: {
      latex: '\\frac{i}{p^2 - m^2 + i\\varepsilon}',
      description: 'One propagator per internal line.',
    },
    externalLeg: {
      latex: '1',
      description: 'Scalar external legs each contribute factor 1.',
    },
    legsPerVertex: 3,
    supportsEdgeTypes: false,
    validationHint: 'Each vertex needs exactly 3 legs (amber border = warning).',
    paletteItems: [
      { type: 'vertex', label: 'Vertex', factorKey: 'coupling.displaySymbol' },
      { type: 'external', label: 'External leg', factorText: 'factor 1' },
    ],
    examples: [
      { label: 'φ³ — 2→2 scattering (tree level, s-channel)', path: 'examples/phi3-tree-2to2.json' },
      { label: 'φ³ — Self-energy (1-loop)', path: 'examples/phi3-self-energy.json' },
    ],
  },

  qed: {
    id: 'qed',
    name: 'QED',
    vertexNodeLabel: 'e',
    coupling: {
      vertexFactor: '-ie\\gamma^\\mu',
      displaySymbol: '−ieγᵘ',
      description: 'One factor of −ieγᵘ per QED vertex.',
    },
    fermionPropagator: {
      latex: '\\frac{i(\\not{p}+m)}{p^2-m^2+i\\varepsilon}',
      description: 'One fermion propagator per internal fermion line.',
    },
    photonPropagator: {
      latex: '\\frac{-ig_{\\mu\\nu}}{k^2+i\\varepsilon}',
      description: 'One photon propagator per internal photon line.',
    },
    externalFermion: {
      inLatex: 'u(p)',
      outLatex: '\\bar{u}(p)',
      description: 'Incoming/outgoing electron spinors.',
    },
    externalPhoton: {
      inLatex: '\\varepsilon_{\\mu}(p)',
      outLatex: '\\varepsilon^*_{\\mu}(p)',
      description: 'Incoming/outgoing photon polarisation vectors.',
    },
    legsPerVertex: { total: 3, byType: { fermion: 2, photon: 1 } },
    supportsEdgeTypes: true,
    defaultDrawEdgeType: 'fermion',
    validationHint: 'Each QED vertex needs exactly 2 fermion legs + 1 photon leg (amber = wrong).',
    positronExt: {
      inLatex:     '\\bar{v}(p)',
      outLatex:    'v(p)',
      description: 'Incoming/outgoing positron spinors.',
    },
    paletteItems: [
      { type: 'qed-vertex',   label: 'QED vertex',       factorKey: 'coupling.displaySymbol' },
      { type: 'fermion-ext',  label: 'External fermion',  factorText: 'u(p) / ū(p)' },
      { type: 'positron-ext', label: 'External positron', factorText: 'v̄(p) / v(p)' },
      { type: 'photon-ext',   label: 'External photon',   factorText: 'ε_μ(p)' },
    ],
    examples: [
      { label: 'QED — Compton scattering (tree level)',    path: 'examples/qed-compton.json' },
      { label: 'QED — Vacuum polarisation (1-loop)',       path: 'examples/qed-vacuum-pol.json' },
      { label: 'QED — Møller scattering (t-channel)',      path: 'examples/qed-moller.json' },
      { label: 'QED — Bhabha scattering (t-channel)',      path: 'examples/qed-bhabha.json' },
      { label: 'QED — e⁺e⁻ annihilation (s-channel)',     path: 'examples/qed-annihilation.json' },
    ],
  },
};

export const DEFAULT_THEORY_ID = 'phi4';

export const NODE_RADIUS = {
  vertex: 14,
  'qed-vertex': 14,
  external: 9,
  'fermion-ext': 9,
  'positron-ext': 9,
  'photon-ext': 9,
};
