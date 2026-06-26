import { internalEdges, externalEdges, countLoops, countLegs, connectedComponents, isVertexNode } from './graph.js';

export function analyseGraph(graph, theory) {
  const vertices = graph.nodes.filter(isVertexNode);
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

  // Check for multiple disconnected pieces (distinct from a lone isolated
  // node, already flagged above). A Feynman diagram is a single connected
  // topology -- contributions from separate diagrams are evaluated one at a
  // time and added together by hand, not drawn on the same canvas and
  // computed as one diagram. (Drawing them together isn't meaningless --
  // it's a disconnected diagram, which genuinely contributes as a *product*
  // of its pieces in the full perturbative expansion -- it's just not the
  // connected amplitude this tool, or most students, actually want.)
  const piecesWithEdges = connectedComponents(graph)
    .filter(component => component.some(id => countLegs(graph, id) > 0));
  if (piecesWithEdges.length > 1) {
    warnings.push(
      `This diagram has ${piecesWithEdges.length} disconnected pieces. Feynman rules (vertex factors, propagators, symmetry factor) assume one connected diagram — evaluate each piece separately and add the results, rather than drawing them together.`
    );
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
