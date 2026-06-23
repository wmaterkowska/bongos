import sympy as sp

_I = sp.I
_LAMBDA, _M = sp.symbols('lambda m', positive=True)


def simplify_amplitude(vertex_count, propagators, symmetry_factor):
    """
    Builds the phi^4 combined amplitude -- (-i*lambda)^V times one
    i/(q^2 - m^2) propagator factor per internal line, divided by the
    symmetry factor -- and returns its LaTeX.

    propagators: list of {"terms": [{"sign": 1, "symbol": "p_{1}"}, ...]},
                 one per internal edge, mirroring momentum.js's MomentumExpr.

    External legs aren't passed in (each is a trivial factor of 1 in phi^4),
    and loop momenta are left as free symbols rather than integrated --
    evaluating loop integrals is out of scope, see the v2 plan.

    Only the momentum-free scalar part (powers of i and lambda, the 1/S) is
    run through sp.simplify(). The propagator denominators are assembled as
    plain LaTeX text instead of left to SymPy's printer: sp.simplify()/Add
    printing will happily factor q^2 - m^2 into (q-m)(q+m), or order one
    factor as m^2 - q^2 and another as q^2 - m^2 in the same product --
    algebraically fine, unreadable for a diagram with several propagators.
    """
    vertex_term = (-_I * _LAMBDA) ** vertex_count
    scalar = sp.simplify(vertex_term * _I ** len(propagators) / symmetry_factor)
    scalar_numerator, scalar_denominator = sp.fraction(scalar)

    numerator_latex = sp.latex(scalar_numerator)
    denominator_latex = '' if scalar_denominator == 1 else sp.latex(scalar_denominator)
    denominator_latex += ''.join(
        rf'\left({_propagator_denominator_latex(p)}\right)' for p in propagators
    )

    if not denominator_latex:
        return numerator_latex
    return rf'\frac{{{numerator_latex}}}{{{denominator_latex}}}'


def _propagator_denominator_latex(prop):
    momentum = sp.Integer(0)
    for term in prop['terms']:
        momentum += term['sign'] * sp.Symbol(term['symbol'])
    # q^2 == (-q)^2, but "-k_1-p_3-p_4" reads worse than "k_1+p_3+p_4" --
    # squaring erases the sign anyway, so prefer the positive-looking form.
    if momentum.could_extract_minus_sign():
        momentum = -momentum
    momentum_latex = sp.latex(momentum)
    squared_base = momentum_latex if momentum.is_Symbol else rf'\left({momentum_latex}\right)'
    return rf'{squared_base}^{{2}} - m^{{2}}'
