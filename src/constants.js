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
    examples: [
      { label: 'φ³ — 2→2 scattering (tree level, s-channel)', path: 'examples/phi3-tree-2to2.json' },
      { label: 'φ³ — Self-energy (1-loop)', path: 'examples/phi3-self-energy.json' },
    ],
  },
};

export const DEFAULT_THEORY_ID = 'phi4';

export const NODE_RADIUS = {
  vertex: 14,
  external: 9,
};
