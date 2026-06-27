import { internalEdges, internalEdgesByType, externalEdges, countLoops, countLegs, countLegsByType, connectedComponents, isVertexNode, isExternalNode } from './graph.js';

export function analyseGraph(graph, theory) {
  const vertices = graph.nodes.filter(isVertexNode);
  const V = vertices.length;
  const I = internalEdges(graph).length;
  const E = externalEdges(graph).length;
  const L = countLoops(graph);

  let I_fermion = 0, I_photon = 0;
  let E_fermion = 0, E_positron = 0, E_photon = 0;
  // externalLegOrder: sorted by node id, matching routeMomenta's p₁, p₂, … assignment.
  let externalLegOrder = [];
  if (theory.supportsEdgeTypes) {
    const byType = internalEdgesByType(graph);
    I_fermion = byType.fermion.length;
    I_photon  = byType.photon.length;
    const extNodes = graph.nodes.filter(isExternalNode).sort((a, b) => a.id - b.id);
    E_fermion  = extNodes.filter(n => n.type === 'fermion-ext').length;
    E_positron = extNodes.filter(n => n.type === 'positron-ext').length;
    E_photon   = extNodes.filter(n => n.type === 'photon-ext').length;
    for (const [i, n] of extNodes.entries()) {
      const sym  = `p_{${i + 1}}`;
      const edge = graph.edges.find(e => e.from === n.id || e.to === n.id);
      let spinorType = null;
      if (edge) {
        const fromExt = edge.from === n.id;
        // Electrons: arrow from ext→vertex = incoming (u). Positrons: arrow convention is
        // reversed — arrow from vertex→ext = incoming positron (v̄). Photons: same as electrons.
        if      (n.type === 'fermion-ext')  spinorType = fromExt ? 'u'      : 'ubar';
        else if (n.type === 'positron-ext') spinorType = fromExt ? 'v'      : 'vbar';
        else if (n.type === 'photon-ext')   spinorType = fromExt ? 'eps'    : 'epsstar';
      }
      externalLegOrder.push({ nodeType: n.type, symbol: sym, spinorType });
    }
  }

  const warnings = [];

  if (V === 0 && graph.nodes.length === 0) {
    return { V, E, I, I_fermion, I_photon, E_fermion, E_positron, E_photon,
             externalLegOrder, L, valid: false, warnings };
  }

  for (const v of vertices) {
    if (typeof theory.legsPerVertex === 'number') {
      const legs = countLegs(graph, v.id);
      if (legs !== theory.legsPerVertex) {
        warnings.push(
          `Vertex #${v.id} has ${legs} leg${legs !== 1 ? 's' : ''} — expected ${theory.legsPerVertex}.`
        );
      }
    } else {
      const byType = countLegsByType(graph, v.id);
      const required = theory.legsPerVertex.byType;
      const wrong = Object.entries(required).filter(([t, n]) => byType[t] !== n);
      if (wrong.length > 0) {
        const legs = countLegs(graph, v.id);
        const reqStr = Object.entries(required).map(([t, n]) => `${n} ${t}`).join(' + ');
        warnings.push(
          `Vertex #${v.id} has ${legs} leg${legs !== 1 ? 's' : ''} — expected ${reqStr}.`
        );
      }
    }
  }

  for (const n of graph.nodes) {
    if (countLegs(graph, n.id) === 0) {
      warnings.push(`Node #${n.id} (${n.type}) is not connected to anything.`);
    }
  }

  const piecesWithEdges = connectedComponents(graph)
    .filter(component => component.some(id => countLegs(graph, id) > 0));
  if (piecesWithEdges.length > 1) {
    warnings.push(
      `This diagram has ${piecesWithEdges.length} disconnected pieces. Feynman rules (vertex factors, propagators, symmetry factor) assume one connected diagram — evaluate each piece separately and add the results, rather than drawing them together.`
    );
  }

  const valid = warnings.length === 0;
  return { V, E, I, I_fermion, I_photon, E_fermion, E_positron, E_photon,
           externalLegOrder, L, valid, warnings };
}

export function buildContributions(analysis, symmetryFactor, theory) {
  return theory.supportsEdgeTypes
    ? buildQEDContributions(analysis, symmetryFactor, theory)
    : buildScalarContributions(analysis, symmetryFactor, theory);
}

function buildScalarContributions(analysis, symmetryFactor, theory) {
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

  appendCommonContributions(contributions, symmetryFactor);
  return contributions;
}

function buildQEDContributions(analysis, symmetryFactor, theory) {
  const { V, I_fermion, I_photon, E_fermion, E_positron, E_photon,
          externalLegOrder, L } = analysis;
  const contributions = [];

  if (V > 0) {
    contributions.push({
      id: 'vertices',
      label: 'QED vertices',
      colour: '#7c3aed',
      latex: `(${theory.coupling.vertexFactor})^{${V}}`,
      description: `${theory.coupling.description} You have ${V} ${V === 1 ? 'vertex' : 'vertices'}.`,
      count: V,
    });
  }

  if (I_fermion > 0) {
    contributions.push({
      id: 'fermion-propagators',
      label: 'Fermion propagators',
      colour: '#059669',
      latex: `\\left(${theory.fermionPropagator.latex}\\right)^{${I_fermion}}`,
      description: `${theory.fermionPropagator.description} You have ${I_fermion} internal fermion ${I_fermion === 1 ? 'line' : 'lines'}.`,
      count: I_fermion,
    });
  }

  if (I_photon > 0) {
    contributions.push({
      id: 'photon-propagators',
      label: 'Photon propagators',
      colour: '#2563eb',
      latex: `\\left(${theory.photonPropagator.latex}\\right)^{${I_photon}}`,
      description: `${theory.photonPropagator.description} You have ${I_photon} internal photon ${I_photon === 1 ? 'line' : 'lines'}.`,
      count: I_photon,
    });
  }

  // External leg cards use externalLegOrder so indices match the canvas labels (p₁, p₂, …).
  const fermionLegs   = externalLegOrder.filter(l => l.nodeType === 'fermion-ext');
  const positronLegs  = externalLegOrder.filter(l => l.nodeType === 'positron-ext');
  const photonLegs    = externalLegOrder.filter(l => l.nodeType === 'photon-ext');

  if (E_fermion > 0) {
    const nIn  = fermionLegs.filter(l => l.spinorType === 'u').length;
    const nOut = fermionLegs.filter(l => l.spinorType === 'ubar').length;
    contributions.push({
      id: 'external-fermions',
      label: 'External fermion legs',
      colour: '#059669',
      latex: fermionLegs.map(l => spinorLatex(l)).join('\\,') || 'u(p)',
      description: `${theory.externalFermion.description} You have ${nIn} incoming (u) and ${nOut} outgoing (ū).`,
      count: E_fermion,
    });
  }

  if (E_positron > 0) {
    const nIn  = positronLegs.filter(l => l.spinorType === 'vbar').length;
    const nOut = positronLegs.filter(l => l.spinorType === 'v').length;
    contributions.push({
      id: 'external-positrons',
      label: 'External positron legs',
      colour: '#f97316',
      latex: positronLegs.map(l => spinorLatex(l)).join('\\,') || '\\bar{v}(p)',
      description: `${theory.positronExt?.description ?? 'Incoming/outgoing positron spinors.'} You have ${nIn} incoming (v̄) and ${nOut} outgoing (v).`,
      count: E_positron,
    });
  }

  if (E_photon > 0) {
    const nIn  = photonLegs.filter(l => l.spinorType === 'eps').length;
    const nOut = photonLegs.filter(l => l.spinorType === 'epsstar').length;
    contributions.push({
      id: 'external-photons',
      label: 'External photon legs',
      colour: '#0284c7',
      latex: photonLegs.map(l => spinorLatex(l)).join('\\,') || '\\varepsilon_{\\mu}(p)',
      description: `${theory.externalPhoton.description} You have ${nIn} incoming (ε_μ) and ${nOut} outgoing (ε*_μ).`,
      count: E_photon,
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

  appendCommonContributions(contributions, symmetryFactor);

  contributions.push({
    id: 'dirac-note',
    label: 'Dirac algebra note',
    colour: '#6b7280',
    noCover: true,
    latex: '\\not{p},\\;\\gamma^\\mu,\\;\\text{traces}',
    description: 'Numerator factors (p̸+m) in fermion propagators and the vertex Lorentz structure (γᵘ) require Dirac algebra. This tool lists each Feynman factor; index contractions and Dirac traces are left to the student.',
  });

  return contributions;
}

// Converts a single externalLegOrder entry to its LaTeX spinor/polarisation factor.
function spinorLatex({ spinorType, symbol: s }) {
  switch (spinorType) {
    case 'u':       return `u(${s})`;
    case 'ubar':    return `\\bar{u}(${s})`;
    case 'v':       return `v(${s})`;
    case 'vbar':    return `\\bar{v}(${s})`;
    case 'eps':     return `\\varepsilon_{\\mu}(${s})`;
    case 'epsstar': return `\\varepsilon^{*}_{\\mu}(${s})`;
    default:        return `?(${s})`;
  }
}

function appendCommonContributions(contributions, symmetryFactor) {
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
}
