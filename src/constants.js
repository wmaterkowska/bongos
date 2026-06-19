// Theory registry. v1 ships with φ⁴ only, but the shape lets v3 add QED, φ³,
// etc. by adding another entry here — rules.js, canvas.js and the toolbar
// selector all read from whichever theory is currently selected.
export const THEORIES = {
  phi4: {
    id: 'phi4',
    name: 'φ⁴ theory',
    vertexNodeLabel: 'λ', // shown inside vertex nodes on the canvas
    coupling: {
      vertexFactor: '-i\\lambda',  // LaTeX used in the amplitude
      displaySymbol: '−iλ',        // plain text used in the palette
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
  },
};

export const DEFAULT_THEORY_ID = 'phi4';

export const NODE_RADIUS = {
  vertex: 14,
  external: 9,
};
