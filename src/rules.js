import { internalEdges, externalEdges, countLoops, countLegs } from './graph.js';

export function analyseGraph(graph, theory) {
  const vertices = graph.nodes.filter(n => n.type === 'vertex');
  const V = vertices.length;
  const I = internalEdges(graph).length;
  const E = externalEdges(graph).length;
  const L = countLoops(graph);

  const warnings = [];

  if (V === 0 && graph.nodes.length === 0) {
    return { V, E, I, L, valid: false, warnings };
  }

  // Check each vertex has exactly legsPerVertex legs
  for (const v of vertices) {
    const legs = countLegs(graph, v.id);
    if (legs !== theory.legsPerVertex) {
      warnings.push(
        `Vertex #${v.id} has ${legs} leg${legs !== 1 ? 's' : ''} — expected ${theory.legsPerVertex}.`
      );
    }
  }

  // Check for isolated nodes
  for (const n of graph.nodes) {
    if (countLegs(graph, n.id) === 0) {
      warnings.push(`Node #${n.id} (${n.type}) is not connected to anything.`);
    }
  }

  const valid = warnings.length === 0;
  return { V, E, I, L, valid, warnings };
}

export function buildContributions(analysis, symmetryFactor, theory) {
  const { V, E, I, L } = analysis;
  const contributions = [];

  if (V > 0) {
    contributions.push({
      id: 'vertices',
      label: 'Vertices',
      colour: '#7c3aed',
      latex: `(${theory.coupling.vertexFactor})^{${V}}`,
      description: `${theory.coupling.description} You have ${V} ${V === 1 ? 'vertex' : 'vertices'}.`,
      count: V,
    });
  }

  if (I > 0) {
    contributions.push({
      id: 'propagators',
      label: 'Internal propagators',
      colour: '#2563eb',
      latex: `\\left(${theory.propagator.latex}\\right)^{${I}}`,
      description: `${theory.propagator.description} You have ${I} internal ${I === 1 ? 'line' : 'lines'}.`,
      count: I,
    });
  }

  if (E > 0) {
    contributions.push({
      id: 'external',
      label: 'External legs',
      colour: '#059669',
      latex: `${theory.externalLeg.latex}^{${E}} = ${theory.externalLeg.latex}`,
      description: `${theory.externalLeg.description} You have ${E}.`,
      count: E,
    });
  }

  if (L > 0) {
    const integrals = Array.from({ length: L }, (_, i) =>
      `\\int \\frac{d^4k_{${i + 1}}}{(2\\pi)^4}`
    ).join('');
    contributions.push({
      id: 'loops',
      label: 'Loop integrals',
      colour: '#db2777',
      latex: integrals,
      description: `One undetermined momentum integral per loop. You have ${L} ${L === 1 ? 'loop' : 'loops'}.`,
      count: L,
    });
  }

  const S = symmetryFactor ?? '?';
  contributions.push({
    id: 'symmetry',
    label: 'Symmetry factor',
    colour: '#d97706',
    latex: `\\frac{1}{${S}}`,
    description: `Divide by the symmetry factor S = ${S} of the diagram.`,
  });

  contributions.push({
    id: 'momentum',
    label: 'Momentum conservation',
    colour: '#64748b',
    latex: `(2\\pi)^4\\,\\delta^{(4)}\\!\\left(\\textstyle\\sum_i p_i\\right)`,
    description: 'Overall four-momentum conservation delta function.',
  });

  return contributions;
}
