// φ⁴ scalar field theory constants
export const THEORY = {
  name: 'φ⁴',
  coupling: {
    symbol: '\\lambda',
    vertexFactor: '-i\\lambda',
  },
  propagator: {
    latex: '\\frac{i}{p^2 - m^2 + i\\varepsilon}',
  },
  externalLeg: {
    latex: '1',
    description: 'Scalar external legs each contribute factor 1.',
  },
  legsPerVertex: 4,
};

export const NODE_RADIUS = {
  vertex: 14,
  external: 9,
};
