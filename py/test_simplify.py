# Simple assertion-style tests for py/simplify.py, mirroring the style of
# the JS tests in test/*.test.js. Requires SymPy locally: pip install sympy
# Run with: python py/test_simplify.py

import json

from simplify import simplify_amplitude, simplify_amplitude_json

passed = 0
failed = 0


def term(sign, symbol):
    return {"sign": sign, "symbol": symbol}


def assert_equal(label, actual, expected):
    global passed, failed
    if actual == expected:
        print(f"  PASS {label}")
        passed += 1
    else:
        print(f"  FAIL {label}")
        print(f"    got:      {actual}")
        print(f"    expected: {expected}")
        failed += 1


# tree-2to2: V=1, S=1, no internal propagators
assert_equal(
    "tree-2to2",
    simplify_amplitude(1, [], 1),
    r"- i \lambda",
)

# bubble: V=2, S=2 -- momenta from routeMomenta(phi4-bubble.json)
assert_equal(
    "bubble",
    simplify_amplitude(2, [
        {"terms": [term(-1, "k_{1}"), term(-1, "p_{3}"), term(-1, "p_{4}")]},
        {"terms": [term(1, "k_{1}")]},
    ], 2),
    r"\frac{\lambda^{2}}{2\left(\left(k_{1} + p_{3} + p_{4}\right)^{2} - m^{2}\right)\left(k_{1}^{2} - m^{2}\right)}",
)

# tadpole: V=1, S=2 -- momenta from routeMomenta(tadpole.json)
assert_equal(
    "tadpole",
    simplify_amplitude(1, [
        {"terms": [term(1, "k_{1}")]},
    ], 2),
    r"\frac{\lambda}{2\left(k_{1}^{2} - m^{2}\right)}",
)

# sunset: V=2, S=6 -- momenta from routeMomenta(sunset.json)
assert_equal(
    "sunset",
    simplify_amplitude(2, [
        {"terms": [term(-1, "k_{1}"), term(-1, "k_{2}"), term(-1, "p_{2}")]},
        {"terms": [term(1, "k_{1}")]},
        {"terms": [term(1, "k_{2}")]},
    ], 6),
    r"\frac{i \lambda^{2}}{6\left(\left(k_{1} + k_{2} + p_{2}\right)^{2} - m^{2}\right)\left(k_{1}^{2} - m^{2}\right)\left(k_{2}^{2} - m^{2}\right)}",
)

# JSON entry point used by src/sympy-bridge.js -- same tadpole case, through
# the actual JSON-string boundary the JS side will call.
assert_equal(
    "tadpole via simplify_amplitude_json",
    simplify_amplitude_json(json.dumps({
        "vertexCount": 1,
        "propagators": [{"terms": [term(1, "k_{1}")]}],
        "symmetryFactor": 2,
    })),
    r"\frac{\lambda}{2\left(k_{1}^{2} - m^{2}\right)}",
)

print(f"\n{passed} passed, {failed} failed")
if failed:
    raise SystemExit(1)
