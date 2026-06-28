import json

import sympy as sp

_I      = sp.I
_LAMBDA = sp.Symbol('lambda', positive=True)
_M      = sp.Symbol('m', positive=True)
_E      = sp.Symbol('e', positive=True)


# ── Scalar theories (φ⁴, φ³) ─────────────────────────────────────────────────

def simplify_amplitude(vertex_count, propagators, symmetry_factor):
    """
    Builds the φ⁴/φ³ combined amplitude — (−iλ)^V times one i/(q²−m²)
    propagator per internal line, divided by the symmetry factor — and
    returns its LaTeX.

    propagators: list of {"terms": [{"sign": 1, "symbol": "p_{1}"}, ...]},
                 one per internal edge, mirroring momentum.js's MomentumExpr.

    Only the momentum-free scalar part is run through sp.simplify(). The
    propagator denominators are assembled as plain LaTeX text to avoid SymPy
    re-ordering or factoring them in unreadable ways.
    """
    vertex_term = (-_I * _LAMBDA) ** vertex_count
    scalar = sp.simplify(vertex_term * _I ** len(propagators) / symmetry_factor)
    scalar_numerator, scalar_denominator = sp.fraction(scalar)

    numerator_latex = sp.latex(scalar_numerator)
    denominator_latex = '' if scalar_denominator == 1 else sp.latex(scalar_denominator)
    denominator_latex += ''.join(
        rf'\left({_fermion_denominator_latex(p)}\right)' for p in propagators
    )

    if not denominator_latex:
        return numerator_latex
    return rf'\frac{{{numerator_latex}}}{{{denominator_latex}}}'


# ── QED ──────────────────────────────────────────────────────────────────────

def simplify_qed_amplitude(payload):
    """
    Builds the full QED amplitude as structured LaTeX with explicit Dirac
    chains, Lorentz-indexed γ matrices, and propagator numerators.

    Overall prefactor: (−ie)^V / S  (simplified by SymPy).
    Open fermion line: ū(p_out) γ^{μ} S_F(q) γ^{ν} u(p_in)
    Closed fermion loop: (−1) Tr[γ^{μ} S_F(q) ...]
    Internal photon: −i g_{μν} / k²
    External photon: ε_μ(p) or ε*_μ(p)

    payload keys: vertexCount, symmetryFactor, fermionChains,
                  internalPhotons, photonFactors.
    """
    vertex_count     = payload['vertexCount']
    symmetry_factor  = payload['symmetryFactor']
    chains           = payload.get('fermionChains', [])
    internal_photons = payload.get('internalPhotons', [])
    photon_factors   = payload.get('photonFactors', [])

    # (−ie)^V / S — each propagator's i-factor is shown inline in the chain.
    scalar = sp.simplify((-_I * _E) ** vertex_count / symmetry_factor)
    scalar_num, scalar_den = sp.fraction(scalar)
    if scalar_den == 1:
        scalar_latex = sp.latex(scalar_num)
    else:
        scalar_latex = rf'\frac{{{sp.latex(scalar_num)}}}{{{sp.latex(scalar_den)}}}'

    parts = [scalar_latex]

    for chain in chains:
        chain_str = _chain_latex(chain)
        if chain_str:
            parts.append(chain_str)

    for ip in internal_photons:
        parts.append(_internal_photon_latex(ip))

    # Group all external photon polarisations with thin space (no extra ·).
    if photon_factors:
        parts.append(r'\,'.join(_external_photon_latex(pf) for pf in photon_factors))

    return r'\cdot'.join(parts)


def _chain_latex(chain):
    """Build LaTeX for one fermion chain (open line or closed loop)."""
    steps = chain.get('steps', [])
    if not steps:
        return None

    if chain['type'] == 'loop':
        evaluated = _try_evaluate_loop_trace(steps)
        if evaluated:
            return evaluated
        # Fall through: show unevaluated Tr[...] for loops with ≠2 vertices.
        step_parts = []
        for step in steps:
            if step['kind'] == 'gamma':
                step_parts.append(rf'\gamma^{{{step["index"]}}}')
            elif step['kind'] == 'propagator':
                mom = step.get('momentum')
                if mom:
                    num = _slashed_momentum_latex(mom)
                    den = _fermion_denominator_latex(mom)
                    step_parts.append(rf'\frac{{i({num}+m)}}{{{den}}}')
                else:
                    step_parts.append(r'\frac{i(\not{q}+m)}{q^{2}-m^{2}}')
        inner = r'\,'.join(step_parts)
        return rf'(-1)\,\mathrm{{Tr}}\left[{inner}\right]'

    # Open chains are written right-to-left in amplitude convention,
    # i.e. opposite to the arrow-traversal order stored in `steps`.
    step_parts = []
    for step in reversed(steps):
        if step['kind'] == 'gamma':
            step_parts.append(rf'\gamma^{{{step["index"]}}}')
        elif step['kind'] == 'propagator':
            mom = step.get('momentum')
            if mom:
                num = _slashed_momentum_latex(mom)
                den = _fermion_denominator_latex(mom)
                step_parts.append(rf'\frac{{i({num}+m)}}{{{den}}}')
            else:
                step_parts.append(r'\frac{i(\not{q}+m)}{q^{2}-m^{2}}')

    inner = r'\,'.join(step_parts)
    left  = _spinor_latex(chain['leftSpinor'])
    right = _spinor_latex(chain['rightSpinor'])
    return rf'\left[{left}\,{inner}\,{right}\right]'


def _try_evaluate_loop_trace(steps):
    """
    Evaluates Tr[γ^{μ₁} (p₁̸+m) γ^{μ₂} (p₂̸+m) ...] for a 2-vertex loop
    using the standard Dirac trace identity:

        Tr[γ^μ (p̸+m) γ^ν (q̸+m)] = 4(p^μ q^ν + p^ν q^μ − g^{μν}(p·q − m²))

    The factor (-1)_loop × i² = +1, so the result is always positive.
    Returns None for loops with more than 2 QED vertices (higher-order traces
    have a more complex tensor structure and are left unevaluated).
    """
    gammas = [s for s in steps if s['kind'] == 'gamma']
    props  = [s for s in steps if s['kind'] == 'propagator']

    if len(gammas) != 2 or len(props) != 2:
        return None

    idx1, idx2 = gammas[0]['index'], gammas[1]['index']
    mom1 = props[0].get('momentum')
    mom2 = props[1].get('momentum')
    if not mom1 or not mom2:
        return None

    # Build vector components p^{μ} and q^{μ}.
    p_mu1 = _momentum_vec_latex(mom1, idx1)
    p_mu2 = _momentum_vec_latex(mom1, idx2)
    q_mu1 = _momentum_vec_latex(mom2, idx1)
    q_mu2 = _momentum_vec_latex(mom2, idx2)
    pdotq = _momentum_dot_latex(mom1, mom2)

    # Denominator: (p²−m²)(q²−m²).
    den1 = _fermion_denominator_latex(mom1)
    den2 = _fermion_denominator_latex(mom2)
    den  = rf'\left({den1}\right)\left({den2}\right)'

    # Trace tensor numerator.
    num = (
        rf'4\left['
        rf'{p_mu1}{q_mu2}'
        rf' + {p_mu2}{q_mu1}'
        rf' - g^{{{idx1}{idx2}}}\!\left({pdotq} - m^{{2}}\right)'
        rf'\right]'
    )

    return rf'\frac{{{num}}}{{{den}}}'


def _spinor_latex(spinor):
    s = spinor['symbol']
    t = spinor['spinorType']
    if t == 'u':    return rf'u({s})'
    if t == 'ubar': return rf'\bar{{u}}({s})'
    if t == 'v':    return rf'v({s})'
    if t == 'vbar': return rf'\bar{{v}}({s})'
    return rf'?({s})'


def _slashed_momentum_latex(prop):
    """
    Builds the Feynman-slash numerator for a fermion propagator, e.g.
    '\not{p}_{1}' or '\not{p}_{1} + \not{p}_{2}'.
    Each momentum term is slashed independently (p̸₁+p̸₂ = (p₁+p₂)̸).
    """
    parts = []
    for i, term in enumerate(prop['terms']):
        slashed = _slash_sym(term['symbol'])
        if i == 0:
            parts.append(f'-{slashed}' if term['sign'] < 0 else slashed)
        else:
            parts.append(f' - {slashed}' if term['sign'] < 0 else f' + {slashed}')
    return ''.join(parts) if parts else r'\not{q}'


def _slash_sym(sym):
    """
    Returns e.g. '\not{p}_{1}' for symbol 'p_{1}'.
    Splits base and subscript so \not applies only to the base letter.
    """
    if '_{' in sym:
        base, rest = sym.split('_{', 1)
        sub = rest.rstrip('}')
        return rf'\not{{{base}}}_{{{sub}}}'
    return rf'\not{{{sym}}}'


def _momentum_vec_latex(prop, free_index):
    """
    Returns e.g. 'k_{1}^{\\mu_{1}}' (simple) or
    '\\left(k_{1}-p_{2}\\right)^{\\mu_{1}}' (compound) — a 4-vector component
    with a free Lorentz index, for use in the evaluated trace tensor.
    """
    q = _momentum_symbol(prop)
    q_latex = sp.latex(q)
    if q.is_Symbol:
        return rf'{q_latex}^{{{free_index}}}'
    return rf'\left({q_latex}\right)^{{{free_index}}}'


def _momentum_dot_latex(prop1, prop2):
    """
    Returns the symbolic Lorentz dot product p·q as LaTeX, e.g.
    'k_{1}\\cdot\\left(k_{1}-p_{2}\\right)'.
    """
    q1 = _momentum_symbol(prop1)
    q2 = _momentum_symbol(prop2)
    lhs = sp.latex(q1) if q1.is_Symbol else rf'\left({sp.latex(q1)}\right)'
    rhs = sp.latex(q2) if q2.is_Symbol else rf'\left({sp.latex(q2)}\right)'
    return rf'{lhs}\cdot {rhs}'


def _internal_photon_latex(ip):
    idx1 = ip['index1']
    idx2 = ip['index2']
    mom  = ip.get('momentum')
    den  = _photon_denominator_latex(mom) if mom else r'k^{2}'
    return rf'\frac{{-i\,g_{{{idx1}{idx2}}}}}{{{den}}}'


def _external_photon_latex(pf):
    idx = pf['index']
    sym = pf['symbol']
    t   = pf['spinorType']
    if t == 'epsstar':
        return rf'\varepsilon^{{*}}_{{{idx}}}({sym})'
    return rf'\varepsilon_{{{idx}}}({sym})'


# ── |M|² with spin/polarisation sums ─────────────────────────────────────────
#
# Derives the spin-summed and spin-averaged squared amplitude ⟨|M|²⟩ for
# tree-level QED diagrams, using standard Dirac trace identities.
#
# Two topologies are handled analytically:
#
#  A) Two open chains each with one γ vertex, joined by a virtual photon.
#     (e.g. Møller/Bhabha scattering)
#     Spin sum → two leptonic tensors L^{μν}(a,b) contracted by (-g_{μν}/t²):
#       L^{μν}(a,b) L_{μν}(c,d) = 32[(a·c)(b·d)+(a·d)(b·c)-m²(a·b)-m²(c·d)+2m⁴]
#
#  B) One open chain [γ^{μ₁} S_F(q) γ^{μ₂}] with two external photons.
#     (e.g. Compton scattering, s-channel)
#     Photon pol sums and fermion spin sum → single 6-gamma trace, evaluated
#     step by step using contraction identities:
#       γ^ν(p̸+m)γ_ν = -2p̸+4m   and   γ^μ A γ_μ  (3-gamma: -2Ã, 1-gamma: -2A)
#     Result: T = 8(s²+st-m²t+3m⁴), ⟨|M|²⟩ = (e⁴/4)T/(s-m²)²

def compute_msquared_json(payload_json):
    """JSON entry point: compute ⟨|M|²⟩ for QED."""
    try:
        payload = json.loads(payload_json)
        result  = _compute_msq(payload)
    except Exception as exc:
        return json.dumps({'error': str(exc)})

    if result is None:
        return json.dumps({'error': 'unsupported'})
    if isinstance(result, dict):
        return json.dumps(result)
    return json.dumps({'latex': result})


def _compute_msq(payload):
    if payload.get('loopCount', 0) > 0:
        return {'loop': True}

    vertex_count     = payload['vertexCount']
    symmetry_factor  = payload['symmetryFactor']
    chains           = payload.get('fermionChains', [])
    internal_photons = payload.get('internalPhotons', [])
    photon_factors   = payload.get('photonFactors', [])
    ext_legs         = payload.get('externalLegs', [])

    if any(c['type'] == 'loop' for c in chains):
        return {'loop': True}

    open_chains = [c for c in chains if c['type'] == 'open']

    # Spin/pol averaging: divide by 2 for each initial-state fermion or photon.
    avg_denom = 1
    for leg in ext_legs:
        if leg.get('isInitial') and leg.get('spinorType') in ('u', 'vbar', 'eps'):
            avg_denom *= 2

    # (e^V / S)^2 overall coupling squared.
    coupling_sq = _E ** (2 * vertex_count) / sp.Integer(symmetry_factor) ** 2
    prefactor   = sp.Rational(1, avg_denom) * coupling_sq

    # Case A: two open chains, one γ each, one internal photon.
    if (len(open_chains) == 2
            and all(len(c['steps']) == 1 and c['steps'][0]['kind'] == 'gamma'
                    for c in open_chains)
            and len(internal_photons) == 1
            and not photon_factors):
        return _msq_two_chains_photon(open_chains, internal_photons[0], prefactor)

    # Case B: one open chain with [γ, prop, γ], two external photons.
    if (len(open_chains) == 1
            and len(open_chains[0]['steps']) == 3
            and open_chains[0]['steps'][0]['kind'] == 'gamma'
            and open_chains[0]['steps'][1]['kind'] == 'propagator'
            and open_chains[0]['steps'][2]['kind'] == 'gamma'
            and len(photon_factors) == 2
            and not internal_photons):
        return _msq_one_chain_two_photons(open_chains[0], photon_factors, prefactor)

    return None


def _msq_two_chains_photon(chains, photon, prefactor):
    """
    Topology A: L^{μν}(a,b) L_{μν}(c,d) / q²  (Møller/Bhabha type).

    a = chain0.right (incoming spinor), b = chain0.left (outgoing spinor)
    c = chain1.right,                   d = chain1.left

    L^{μν}(a,b) L_{μν}(c,d) = 32[(a·c)(b·d)+(a·d)(b·c)-m²(a·b)-m²(c·d)+2m⁴]
    """
    c0, c1  = chains[0], chains[1]
    a, b    = c0['rightSpinor']['symbol'], c0['leftSpinor']['symbol']
    c, d    = c1['rightSpinor']['symbol'], c1['leftSpinor']['symbol']
    m       = _M

    def dot(x, y):
        ix, iy = _mom_index(x), _mom_index(y)
        if ix == iy:
            return m ** 2
        lo, hi = min(ix, iy), max(ix, iy)
        return sp.Symbol(f'dot_{lo}{hi}', real=True)

    llt = 32 * (dot(a, c) * dot(b, d) + dot(a, d) * dot(b, c)
                - m ** 2 * dot(a, b) - m ** 2 * dot(c, d) + 2 * m ** 4)

    # Photon propagator denominator: label as Mandelstam variable.
    phot_mom = photon.get('momentum')
    den_var  = _mandelstam_label(phot_mom)   # 's', 't', or 'u'

    # Overall: prefactor × 32 × [...] / den²
    coeff_latex  = sp.latex(sp.simplify(32 * prefactor))

    # Dot-product bracket in LaTeX.
    al, bl, cl, dl = (_mom_latex(x) for x in [a, b, c, d])
    bracket = (
        rf'({al}\cdot {cl})({bl}\cdot {dl})'
        rf' + ({al}\cdot {dl})({bl}\cdot {cl})'
        rf' - m^2({al}\cdot {bl})'
        rf' - m^2({cl}\cdot {dl})'
        rf' + 2m^4'
    )

    # Show what the denominator variable means.
    # For t-channel (most common): den_var = 't' = (a-b)^2 = photon propagator momentum^2.
    if phot_mom:
        terms = phot_mom.get('terms', [])
        mom_expr = ''.join(
            ('' if (i == 0 and t['sign'] > 0) else ('+' if t['sign'] > 0 else '-'))
            + _mom_latex(t['symbol'])
            for i, t in enumerate(terms)
        )
        den_def = rf'{den_var} = ({mom_expr})^2'
    else:
        den_def = rf'{den_var} = q^2'

    return (
        rf'\begin{{aligned}}'
        rf'&{den_def} \\'
        rf'\overline{{|\mathcal{{M}}|^2}}'
        rf' &= \dfrac{{{coeff_latex}}}{{{den_var}^2}}'
        rf'\Bigl[{bracket}\Bigr]'
        rf'\end{{aligned}}'
    )


def _msq_one_chain_two_photons(chain, photons, prefactor):
    """
    Topology B: Compton-type.
    After photon pol sums and fermion spin sum the trace is:
      T = Tr[(p̸_L+m) γ^{μ₂}(q̸+m)γ^{μ₁}(p̸_R+m)γ_{μ₁}(q̸+m)γ_{μ₂}]
    Evaluated using contraction identities:
      γ^{μ₁}(p̸_R+m)γ_{μ₁} = -2p̸_R + 4m
      Then contract outer pair and take the trace.
    Result (derived analytically): T = 8(s²+st-m²t+3m⁴)
    where s = q² = (internal fermion momentum)², t = (p_R-p_L)².
    """
    full_coeff  = sp.simplify(8 * prefactor)
    coeff_latex = sp.latex(full_coeff)

    # External momenta for Mandelstam definitions.
    right_sym = chain['rightSpinor']['symbol']   # incoming fermion
    left_sym  = chain['leftSpinor']['symbol']    # outgoing fermion
    # Identify the incoming photon symbol from photon_factors (spinorType == 'eps').
    ph_in  = next((pf for pf in photons if pf.get('spinorType') == 'eps'),  photons[0])
    r_l    = _mom_latex(right_sym)
    l_l    = _mom_latex(left_sym)
    ph_l   = _mom_latex(ph_in['symbol'])

    return (
        rf'\begin{{aligned}}'
        rf's &= ({r_l}+{ph_l})^2 \quad t = ({r_l}-{l_l})^2 \\'
        rf'\overline{{|\mathcal{{M}}|^2}}'
        rf' &= \dfrac{{{coeff_latex}\left(s^2 + st - m^2 t + 3m^4\right)}}'
        rf'{{\left(s - m^2\right)^2}}'
        rf'\end{{aligned}}'
    )


def _mom_index(sym_str):
    """'p_{3}' → 3."""
    if '_{' in sym_str:
        try:
            return int(sym_str.split('_{')[1].rstrip('}'))
        except ValueError:
            pass
    return 0


def _mom_latex(sym_str):
    """'p_{3}' → 'p_{3}' ready for LaTeX."""
    if '_{' in sym_str:
        idx = sym_str.split('_{')[1].rstrip('}')
        return rf'p_{{{idx}}}'
    return r'p'


def _mandelstam_label(mom):
    """Identify a propagator momentum as s, t, or u by sign pattern."""
    if not mom or not mom.get('terms'):
        return 't'
    all_pos = all(term['sign'] > 0 for term in mom['terms'])
    return 's' if all_pos else 't'


# ── JSON entry point ──────────────────────────────────────────────────────────

def simplify_amplitude_json(payload_json):
    """JSON-string entry point for src/sympy-bridge.js.

    Dispatches to the appropriate simplification function based on the
    'theory' field in the payload ('scalar' or 'qed'; defaults to 'scalar'
    for payloads generated by older versions of the bridge).
    """
    payload = json.loads(payload_json)
    theory  = payload.get('theory', 'scalar')

    if theory == 'qed':
        return simplify_qed_amplitude(payload)
    return simplify_amplitude(
        payload['vertexCount'],
        payload['propagators'],
        payload['symmetryFactor'],
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _momentum_symbol(prop):
    """Builds a SymPy expression for a MomentumExpr dict."""
    q = sp.Integer(0)
    for term in prop['terms']:
        q += term['sign'] * sp.Symbol(term['symbol'])
    # q² == (−q)², so prefer the positive-looking form for readability.
    if q.could_extract_minus_sign():
        q = -q
    return q


def _fermion_denominator_latex(prop):
    """q² − m² for a massive fermion propagator."""
    q = _momentum_symbol(prop)
    q_latex = sp.latex(q)
    squared  = q_latex if q.is_Symbol else rf'\left({q_latex}\right)'
    return rf'{squared}^{{2}} - m^{{2}}'


def _photon_denominator_latex(prop):
    """k² for a massless photon propagator."""
    k = _momentum_symbol(prop)
    k_latex = sp.latex(k)
    squared  = k_latex if k.is_Symbol else rf'\left({k_latex}\right)'
    return rf'{squared}^{{2}}'
