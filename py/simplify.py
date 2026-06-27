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

    # Open chains are written right-to-left in amplitude convention,
    # i.e. opposite to the arrow-traversal order stored in `steps`.
    ordered = list(reversed(steps)) if chain['type'] == 'open' else steps

    step_parts = []
    for step in ordered:
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

    if chain['type'] == 'open':
        left  = _spinor_latex(chain['leftSpinor'])
        right = _spinor_latex(chain['rightSpinor'])
        return rf'\left[{left}\,{inner}\,{right}\right]'
    else:
        return rf'(-1)\,\mathrm{{Tr}}\left[{inner}\right]'


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
