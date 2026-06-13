# KaTeX (vendored)

This directory should contain the KaTeX distribution so the app works offline.

**To populate it**, download the latest release from https://github.com/KaTeX/KaTeX/releases
and copy the following files here:

```
lib/katex/
├── katex.min.css
├── katex.min.js
└── fonts/          (the entire fonts/ directory from the release)
```

Until then, you can point `index.html` at the CDN instead:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js"></script>
```
