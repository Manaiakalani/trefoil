# Security

This is a static front-end app. There is no server, account system, or stored user data. Marks you drop are read in the browser and never uploaded.

## Report a vulnerability

Please use [GitHub Security Advisories](https://github.com/Manaiakalani/trefoil/security/advisories/new). Do not open a public issue for a security report.

We aim to acknowledge reports within a week.

## What this app trusts

| Surface | Handling |
| --- | --- |
| Word field | Length-capped text, drawn to a canvas, then extruded. Not inserted as HTML. |
| Mark upload / drop | PNG, JPEG, WebP, SVG, or GIF, max 8 MB. Drawn to a canvas. |
| URL query | Time, hue, speed, subject, and text. No remote fetches. |

## Headers

The page sets a Content-Security-Policy meta tag. Hosts that support response headers can also send:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Frame-Options: DENY
```

GitHub Pages does not let you set those headers. The meta CSP still applies.
