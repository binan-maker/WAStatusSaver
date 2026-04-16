---
name: website-cloning
<<<<<<< HEAD
description: Clone any website as a pixel-perfect React + Vite app using Playwright extraction.
---

# Clone Website — Pixel-Perfect Methodology

Reverse-engineer and rebuild a target website as an exact replica React + Vite clone. Every font, color, icon, image, section, background, transition, and interaction must match the original. Zero guessing, zero placeholders.

## Cardinal Rules

1. **Raw HTML is the source of truth.** Before building ANY section, read the corresponding portion of `raw.html`. Never build from memory, screenshots alone, or guessed structure.
2. **One component per visual pattern.** Never reuse a component designed for one layout (e.g., product cards with prices) for a structurally different layout (e.g., category cards with just names). If two sections look different, they get different components or distinct CSS classes.

3. **All assets downloaded before building starts.** Every image, font, SVG, and video must be local in `public/` before any component code is written. No mid-build downloads.
4. **Build all sections, then verify the full page.** Building and screenshotting section-by-section is too slow. Build all components from raw HTML, assemble in App.tsx, then take a full-page screenshot and fix any discrepancies. This is 3-5x faster than per-section verification loops.

5. **No fabricated content.** Every heading, subtitle, button label, badge, price, and link must come from the source HTML. Never invent text that doesn't exist on the original page.
6. **Replace the scaffolded CSS entirely.** The `createArtifact`scaffold includes Tailwind/shadcn boilerplate. Replace`index.css` completely with plain CSS — a Google Font import, CSS reset, CSS variables for design tokens, and nothing else. Clone pages don't use component libraries.

## Anti-Patterns (Common Mistakes to Avoid)

| Mistake | Correct Approach |

|---------|-----------------|

| Outlined/bordered buttons when original uses filled/solid | Check `raw.html`for button classes and extract`background-color`, not`border` |

| Center-aligned text when original is left-aligned | Extract `text-align` from computed styles |

| Adding badges/labels that don't exist in original | Only add elements that exist in `raw.html` |

| Skipping sections or changing their order | Follow the section inventory checklist exactly |

| Using placeholder images | Download all images in Phase 1 before building |

| Reusing `ProductCard` for category grids | Each visually distinct card type gets its own component |

| Guessing font sizes, colors, spacing | Extract exact computed values; never approximate |

| Building from screenshot interpretation alone | Always cross-reference `raw.html` for structure and content |

| Using an SVG `<text>`element for the logo | Extract the real SVG logo paths from`raw.html` |

| Running per-section screenshot QA loops | Build all sections, then do one full-page verify pass |

| Keeping Tailwind/shadcn/Radix in a clone | Replace index.css with plain CSS; remove unused deps |

| Translating/anglicizing text from a non-English page | Clone must use the EXACT language shown on the target page |

| Guessing the announcement bar color | Extract computed `background-color` from the banner element |

| Centering the logo when it's left-aligned | Take a header screenshot and compare logo position |

| Omitting the account/rewards bar text | Extract ALL header elements including loyalty/rewards UI |
=======
description: Reverse-engineer and clone any website as a pixel-perfect React + Vite app. Use when the user asks to clone, replicate, copy, rebuild, reverse-engineer, or pixel-perfect match any website. Also triggers on "make a copy of this site", "rebuild this page", "clone this URL". Provide the target URL. Uses Playwright for extraction and design subagents for parallel building.
---

# Clone Website

Reverse-engineer and rebuild a target website as a pixel-perfect React + Vite clone using Playwright for extraction and design subagents for parallel construction.
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

## Legitimate Use Policy

Before cloning, confirm the user's intent is legitimate. Ask:

1. "Is this your own website or your client's website?"
2. "What is this clone for?"

Acceptable: rebuilding your own site, design reference/learning, staging copy, platform migration.

**Refuse** if: impersonation, phishing, traffic theft, trademark infringement, or deception.

For non-owned sites (design inspiration), remind the user to replace logos, brand names, trademarks, product data, and contact info with their own.

## Prerequisites

<<<<<<< HEAD
```bash

pip install playwright

CHROMIUM_PATH=$(find /nix/store -maxdepth 4 -name "chromium" -type f 2>/dev/null | head -1)

echo "Chromium at: $CHROMIUM_PATH"

```

### Critical Playwright settings

- Always use `--no-sandbox` args
- Use `wait_until="domcontentloaded"`(not`"networkidle"`)

- Add `page.wait_for_timeout(5000)` after navigation
- Set `timeout=60000`on all`page.goto()` calls

---

## Phase 1: Reconnaissance & Extraction

All extraction happens before any building. See `extraction.md` for complete Python scripts.

### 1.1 Save Raw HTML (THE SOURCE OF TRUTH)

```python

raw_html = page.content()

with open(f"{OUT_DIR}/raw.html", "w", encoding="utf-8") as f:

f.write(raw_html)

```

This file is the authoritative reference for ALL section structure, content, class names, element ordering, and text content. Computed styles supplement it but never replace it.

### 1.2 Language & Locale Detection (CRITICAL)

If the target URL contains a locale path (e.g., `/es-do`,`/fr`,`/de`,`/ja`), the clone MUST be in that language. However, server-side rendering may return English even for locale URLs — the localization often happens via client-side JavaScript after page load.

#### Detection steps

1. After `page.wait_for_timeout(8000)` (extra wait for JS locale loading), extract all visible text from key areas:

```python

locale_info = page.evaluate("""

() => ({

bannerText: document.querySelector('[class*="banner"], [class*="announcement"]')?.innerText?.trim(),

navLinks: [...document.querySelectorAll('nav a, .main-nav a')].map(a => a.innerText.trim()).filter(t => t).slice(0, 8),

loyaltyText: document.querySelector('[class*="loyalty"], [class*="rewards"]')?.innerText?.trim(),

headerText: document.querySelector('header')?.innerText?.trim()?.slice(0, 500),

htmlLang: document.documentElement.lang,

url: window.location.href

})

""")

```

1. If the URL locale doesn't match the extracted text language, the page probably needs more time for JS to run, or the locale is cookie-based.
2. **When in doubt, use the language implied by the URL locale.** If `/es-do` shows English text in the raw HTML, translate all user-facing text to Spanish when building. The URL locale is the user's intent.

**Brand terms stay in the original language.** Product names (e.g., "ALO Runner"), color names (e.g., "SUNSHINE"), brand names (e.g., "ALO Wellness Club") should NOT be translated — the real site keeps these in English even on localized pages.

### 1.3 Screenshots (Desktop only for initial build)

Take a full-page screenshot at 1440px. This becomes the primary visual reference. Tablet and mobile screenshots are only needed if the user specifically requests responsive behavior.

**Take a separate header-only screenshot** at this stage — crop to just the top 150px. This will be your reference for logo placement, nav layout, banner color, and account/rewards UI. Header issues are the most common mistakes.

### 1.4 Section Inventory

Parse the raw HTML to produce a complete ordered checklist. For each section, record:

- Section index and DOM selector (tag, id, classes)
- Exact heading text and subheading text

- Button labels
- Image count

- Background color (if non-transparent)

Save as `clone-data/inventory.json`. This becomes the build checklist.

### 1.5 Design Tokens

Extract CSS custom properties, body font-family, heading font-family, primary colors. Save to `clone-data/tokens.json`.

### 1.6 Font Handling

#### Priority order

1. **Download actual font files** — Check `@font-face`rules for`.woff2`/`.woff`URLs. Download to`public/fonts/`and declare`@font-face`in`index.css`.
2. **Use Google Fonts if available** — If the site uses Google Fonts, add the `@import`or`<link>` tag.

3. **Map to closest equivalent** — Only as a last resort:

| Proprietary Font | Google Fonts Equivalent |

|-----------------|----------------------|

| Proxima Nova | DM Sans |

| Geograph | DM Sans |

| Self Modern | DM Serif Text |

| Graphik | Inter |

| Circular | DM Sans |

| GT Walsheim | Plus Jakarta Sans |

| Tiempos | Playfair Display |

| Apercu | Source Sans Pro |

| Founders Grotesk | Space Grotesk |

| National | DM Sans |

| Futura | Jost |

| Avenir | Nunito Sans |

| Gotham | Montserrat |

| Brandon Grotesque | Raleway |

### 1.7 SVG Logo Extraction (CRITICAL)

The site's logo is almost always an inline SVG in the `raw.html`, NOT just text. Search for it:

```bash

# Search raw HTML for SVG near logo references

python3 -c "

with open('clone-data/raw.html') as f:

html = f.read()

# Search around 'logo' class references

import re

for m in re.finditer(r'logo', html[:15000], re.IGNORECASE):

idx = m.start()

# Look for SVG nearby

svg_start = html.find('<svg', max(0, idx-200))

if svg_start != -1 and svg_start < idx + 500:

svg_end = html.find('</svg>', svg_start) + 6

print(html[svg_start:svg_end])

break

"

```

**Never use an SVG `<text>`element as a logo substitute.** Extract the real SVG`<path>` elements from the source HTML. The logo is the most recognizable element on the page — getting it wrong immediately signals "fake."

### 1.8 Asset Download (ALL assets, ALL at once)

Download every image, video, SVG, background image, and font file before building starts. See `extraction.md` for the complete download script.

**CDN URL upscaling** (increase resolution before downloading):

- **Shopify `_small`suffix**:`_small.jpg`→`_1200x.jpg` (very common pattern)
- **Shopify query params**: `?width=X`→`?width=1200`

- **Sanity**: `?w=X`→`?w=1200`
- **Cloudinary**: `w_X`→`w_1200`

- **Contentful**: `?w=X`→`?w=1200`

**Verification:** After downloading, verify every file exists and is >100 bytes. The download script includes automatic retry with fallback User-Agent strings.

### 1.9 Header Deep Extraction (CRITICAL)

The header is the most error-prone section. Extract detailed information beyond the basic inventory:

```python

header_info = page.evaluate("""

() => {

const header = document.querySelector('header');

if (!header) return null;

// Banner/announcement bar

const banner = document.querySelector('[class*="banner"], [class*="announcement"], [class*="uni-banner"]');

const bannerBg = banner ? getComputedStyle(banner.querySelector('[class*="col"], div') || banner).backgroundColor : null;

// Logo position

const logo = header.querySelector('svg, [class*="logo"] img, [class*="logo"] svg');

const logoRect = logo?.getBoundingClientRect();

const headerRect = header.getBoundingClientRect();

// Nav links

const navLinks = [...header.querySelectorAll('nav a, [class*="nav"] a')].map(a => a.innerText.trim()).filter(t => t && t.length < 30);

// Right-side elements (account, rewards, search, cart, wishlist)

const rightElements = [...header.querySelectorAll('[class*="loyalty"], [class*="rewards"], [class*="account"], [class*="cart"], [class*="wishlist"]')];

return {

bannerText: banner?.innerText?.trim(),

bannerBgColor: bannerBg,

bannerTextColor: banner ? getComputedStyle(banner).color : null,

logoPosition: logoRect ? (logoRect.left < headerRect.width / 3 ? 'left' : logoRect.left < headerRect.width * 2/3 ? 'center' : 'right') : 'unknown',

navLinks: navLinks.slice(0, 10),

rightSideText: rightElements.map(el => el.innerText?.trim()).filter(t => t),

rightSideHTML: rightElements.map(el => el.innerHTML?.slice(0, 300)),

};

}

""")

```

This prevents the three most common header mistakes: wrong banner color, wrong logo position, missing account/rewards text.

### 1.10 Footer Link Extraction

Extract all footer links separately — they're needed for the footer component:

```python

footer_data = page.evaluate("""

() => {

const footer = document.querySelector('footer');

if (!footer) return null;

return {

text: footer.innerText,

bgColor: getComputedStyle(footer).backgroundColor,

links: [...footer.querySelectorAll('a')].map(a => ({

text: a.innerText.trim(), href: a.getAttribute('href')

})).filter(l => l.text)

};

}

""")

```

---

## Phase 2: Foundation Build

Sequential — do this yourself, not delegated.

1. **Create artifact** via `createArtifact()`with type`react-vite`
2. **Replace `index.css` entirely** — Remove ALL Tailwind/shadcn boilerplate. Write plain CSS:

- Google Fonts `@import`(or`@font-face` for self-hosted)
- Universal reset (`*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }`)

- CSS variables for design tokens (font families, colors)
- Basic body styles (font-family, color, background, antialiasing)

- Reset styles for `a`,`button`,`img`,`ul/ol`

1. **Replace `App.tsx`** — Remove all router/query/toast boilerplate. A clone is a single static page.
2. **Organize assets** in `public/images/`

---

## Phase 3: Build All Sections

Build all components from the section inventory, referencing `raw.html` for exact content. Use inline styles or CSS modules — not Tailwind.

### For EACH section in the inventory

**Step 1: Read the raw HTML** for that section's exact structure, text, and element hierarchy.

**Step 2: Build the component** using:

- Exact text content from raw HTML (copy-paste headings, button labels)
- Local image paths from `public/images/`

- Real SVG paths for logos/icons extracted from raw HTML
- Inline styles for layout (position, display, flex, grid, padding, colors, fonts)

- Hover interactions via `onMouseEnter`/`onMouseLeave` inline handlers
- For carousels: `useRef`+`scrollBy`with`overflow-x: auto; scrollbar-width: none`

**Step 3: Use `import.meta.env.BASE_URL`prefix** for all image`src` attributes so they resolve correctly under the artifact's preview path.

### Build tips

- **Build ALL sections before verifying.** Don't stop to screenshot after each one.
- **Use inline styles** — Simpler than CSS files for clones, and avoids naming/scoping issues.

- **Reusable components are okay when the visual pattern is truly identical** (e.g., two hero banners that differ only in image/button text can share a `HeroBanner` component with props).
- **`href="#"` is fine** — For a visual clone, real link targets are a nice-to-have, not a requirement.

- **Remove unused scaffolded dependencies** — The `package.json`from`createArtifact` includes 40+ shadcn/Radix packages. These are dead weight for a clone.

---

## Phase 4: Page Assembly & Verification

1. Import all components into `App.tsx` in exact DOM order from the inventory
2. Start the dev server and take a full-page screenshot at 1280px

3. Compare against the original screenshot from Phase 1
4. Fix discrepancies section by section

5. Run e2e test to verify all sections render (use `runTest()`)

### Verification checklist

- [ ] All sections present in correct order
- [ ] Logo is the real SVG (not text substitute)

- [ ] Logo position matches (left/center/right)
- [ ] All images load (no broken images in console)

- [ ] Heading text matches exactly
- [ ] All text is in the correct language (match URL locale)

- [ ] Button styles match (filled vs outlined, correct colors)
- [ ] Background colors match for sections with colored backgrounds

- [ ] Announcement bar has correct background color AND text
- [ ] Account/rewards/loyalty text is present in header (if original has it)

- [ ] Carousels scroll properly
- [ ] Hover states work on interactive elements

- [ ] Footer has correct columns and content

---

## Component Specification Format

For complex sections dispatched to subagents, write specs at `docs/research/components/<name>.md`:

```markdown

# <ComponentName> Specification

## Overview

- Target file: `src/components/<ComponentName>.tsx`
- Interaction model: <static | click | scroll | time>

## DOM Structure (from raw.html)

<Exact element hierarchy with tag names, classes, nesting>

## Computed Styles (exact values)

### Container

- display: flex; flex-direction: row; gap: 24px; padding: 60px 80px;

### Heading

- font-size: 48px; font-weight: 400; color: \#230d0d;

### Button

- background-color: \#f195a7; border-radius: 999px; padding: 12px 32px;

## Text Content (verbatim from raw.html)

<Every heading, paragraph, button label — copy-pasted exactly>

## Assets (local paths)

- /images/products/charm-1.webp

## States & Behaviors

### Hover on card

- transform: none → scale(1.02)
- transition: transform 0.3s ease

```

---
=======
Before starting, set up the tools:

```bash
pip install playwright

CHROMIUM_PATH=$(find /nix/store -maxdepth 4 -name "chromium" -type f 2>/dev/null | head -1)
echo "Chromium at: $CHROMIUM_PATH"
```

**Critical Playwright settings** (learned from production use):

- Always use `--no-sandbox` args: `browser = p.chromium.launch(headless=True, executable_path=CHROMIUM_PATH, args=["--no-sandbox", "--disable-setuid-sandbox"])`
- Prefer `wait_until="domcontentloaded"` over `"networkidle"` — many modern sites never reach networkidle due to analytics/websockets
- Add a generous `page.wait_for_timeout(5000)` after navigation to let lazy content and JS frameworks hydrate
- Set `timeout=60000` on all `page.goto()` calls

## Guiding Principles

1. **Completeness beats speed** — Every builder must receive everything it needs. If a builder has to guess a color, font size, or padding value, extraction failed.
2. **Small tasks, perfect results** — Break complex sections into sub-components. One agent per card variant, not one agent per "entire features section."
3. **Real content, real assets** — Extract actual text, images, videos from the live site. No placeholders. Download all assets locally — CDN URLs expire or get blocked.
4. **Foundation first** — Global CSS tokens, fonts, and assets must exist before any component building starts.
5. **Extract appearance AND behavior** — Static CSS plus interactions (hover, scroll-triggered, click-driven, animations).
6. **Spec files are the source of truth** — Every component gets a spec file in `docs/research/components/` BEFORE any builder is dispatched.
7. **Mobile navigation is mandatory** — Always extract and implement the mobile hamburger menu / drawer. This is the #1 missed feature in website clones.
8. **Download images locally** — Never rely on external CDN URLs in the final build. Download everything to `public/images/` and reference with local paths.

## Phase 1: Reconnaissance

Create a Python script to do the initial extraction.

### 1.1 Setup & Screenshot

```python
from playwright.sync_api import sync_playwright
import json, os

CHROMIUM_PATH = "FILL_IN"  # from prerequisite step
TARGET_URL = "FILL_IN"
OUT_DIR = "clone-data"
os.makedirs(f"{OUT_DIR}/screenshots", exist_ok=True)
os.makedirs(f"{OUT_DIR}/components", exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path=CHROMIUM_PATH,
        args=["--no-sandbox", "--disable-setuid-sandbox"]
    )
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(5000)

    # Scroll full page to trigger lazy loading
    for _ in range(15):
        page.evaluate("window.scrollBy(0, 600)")
        page.wait_for_timeout(600)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(1500)

    # Desktop screenshot
    page.screenshot(path=f"{OUT_DIR}/screenshots/desktop-full.png", full_page=True)

    # Tablet screenshot
    page.set_viewport_size({"width": 768, "height": 1024})
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{OUT_DIR}/screenshots/tablet-full.png", full_page=True)

    # Mobile screenshot
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{OUT_DIR}/screenshots/mobile-full.png", full_page=True)

    # Reset to desktop
    page.set_viewport_size({"width": 1440, "height": 900})
    page.wait_for_timeout(500)
```

### 1.2 Extract Design Tokens

Run the design token extraction JS via `page.evaluate()`. Key extractions:

- All CSS custom properties from `:root`
- Body background/text colors and font families
- All Google Fonts / self-hosted font URLs
- Heading font families (often different from body)
- Favicon and meta image URLs

```python
def extract_tokens(page, out_dir):
    tokens = page.evaluate("""
      () => {
        const body = document.body;
        const cs = getComputedStyle(body);

        const cssVars = [];
        try {
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                if (rule.selectorText === ':root' || rule.selectorText === ':root, :host') {
                  for (const prop of rule.style) {
                    if (prop.startsWith('--')) {
                      cssVars.push([prop, rule.style.getPropertyValue(prop).trim()]);
                    }
                  }
                }
              }
            } catch(e) {}
          }
        } catch(e) {}

        const h1 = document.querySelector('h1');
        const h2 = document.querySelector('h2');
        const h3 = document.querySelector('h3');
        const btn = document.querySelector('button, [class*="btn"], a[class*="button"]');
        const nav = document.querySelector('nav, header');
        const card = document.querySelector('[class*="card"], [class*="Card"]');

        function getStyles(el) {
          if (!el) return null;
          const s = getComputedStyle(el);
          return {
            fontSize: s.fontSize, fontWeight: s.fontWeight, fontFamily: s.fontFamily,
            lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, color: s.color,
            textTransform: s.textTransform, backgroundColor: s.backgroundColor,
            padding: s.padding, borderRadius: s.borderRadius, border: s.border
          };
        }

        return {
          body: {
            bgColor: cs.backgroundColor,
            textColor: cs.color,
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            lineHeight: cs.lineHeight
          },
          h1: getStyles(h1),
          h2: getStyles(h2),
          h3: getStyles(h3),
          button: getStyles(btn),
          nav: getStyles(nav),
          card: getStyles(card),
          cssVars: cssVars,
          fonts: [...document.querySelectorAll('link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]')]
            .map(l => l.href),
          favicons: [...document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]')]
            .map(l => ({ href: l.href, rel: l.rel, sizes: l.sizes?.toString() || '' })),
          metaImages: [...document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')]
            .map(m => ({ property: m.getAttribute('property') || m.name, content: m.content })),
          title: document.title,
          metaDescription: document.querySelector('meta[name="description"]')?.content || ''
        };
      }
    """)
    with open(f"{out_dir}/tokens.json", "w") as f:
        json.dump(tokens, f, indent=2)
    return tokens
```

**Font Mapping Strategy**: Many sites use proprietary/licensed fonts. Map them to close Google Fonts equivalents:

- Proprietary sans-serif (e.g., "Geograph") → DM Sans, Inter, or Source Sans Pro
- Proprietary serif (e.g., "Self Modern") → DM Serif Text, Playfair Display, or Lora
- Load mapped fonts via `<link>` tags in `index.html`, not @import in CSS (faster loading)

### 1.3 Extract Page Topology

Map every section top-to-bottom with tag, classes, dimensions, background, text preview, images, and links.

```python
def extract_content(page, out_dir):
    data = page.evaluate("""
      () => {
        const result = {};

        const banner = document.querySelector(
          '[class*="banner"], [class*="announcement"], [class*="promo-bar"], [class*="top-bar"], [class*="topbar"]'
        );
        if (banner && banner.offsetHeight > 0 && banner.offsetHeight < 100) {
          result.banner = {
            bgColor: getComputedStyle(banner).backgroundColor,
            text: banner.innerText.trim().slice(0, 500),
            height: banner.offsetHeight
          };
        }

        const header = document.querySelector('header') || document.querySelector('nav, [class*="header"], [class*="navbar"]');
        if (header) {
          const cs = getComputedStyle(header);
          result.header = {
            height: header.offsetHeight,
            bgColor: cs.backgroundColor,
            position: cs.position,
            borderBottom: cs.borderBottom,
            boxShadow: cs.boxShadow,
            logo: header.querySelector('img')?.src || header.querySelector('svg')?.outerHTML?.slice(0, 500) || '',
            navLinks: [...header.querySelectorAll('a')].map(a => ({
              text: a.innerText.trim(),
              href: a.getAttribute('href') || ''
            })).filter(l => l.text && l.text.length < 60).slice(0, 20)
          };
        }

        const main = document.querySelector('main') || document.body;
        const children = main === document.body
          ? [...main.children].filter(c => c.tagName !== 'HEADER' && c.tagName !== 'FOOTER' && c.tagName !== 'NAV' && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE')
          : [...main.children];

        result.sections = children.map((child, idx) => {
          const rect = child.getBoundingClientRect();
          if (rect.height < 20) return null;
          const cs = getComputedStyle(child);
          if (cs.display === 'none' || cs.visibility === 'hidden') return null;
          return {
            index: idx,
            tag: child.tagName.toLowerCase(),
            id: child.id || null,
            classes: child.className?.toString().slice(0, 300) || '',
            top: Math.round(rect.top + window.scrollY),
            height: Math.round(rect.height),
            bgColor: cs.backgroundColor,
            bgImage: cs.backgroundImage !== 'none' ? cs.backgroundImage : null,
            padding: cs.padding,
            maxWidth: cs.maxWidth,
            display: cs.display,
            text: child.innerText?.slice(0, 2000) || '',
            headings: [...child.querySelectorAll('h1, h2, h3, h4')].slice(0, 10).map(h => ({
              level: h.tagName.toLowerCase(),
              text: h.innerText.trim()
            })),
            images: [...child.querySelectorAll('img')].slice(0, 30).map(img => ({
              src: img.src,
              alt: img.alt,
              w: img.offsetWidth,
              h: img.offsetHeight,
              position: getComputedStyle(img).position,
              zIndex: getComputedStyle(img).zIndex
            })).filter(i => i.src && i.w > 30),
            links: [...child.querySelectorAll('a')].slice(0, 30).map(a => ({
              text: a.innerText.trim(),
              href: a.getAttribute('href') || ''
            })).filter(l => l.text),
            buttons: [...child.querySelectorAll('button, [role="button"], a[class*="btn"], a[class*="button"]')].slice(0, 10).map(b => ({
              text: b.innerText.trim(),
              classes: b.className?.toString().slice(0, 200) || ''
            })).filter(b => b.text)
          };
        }).filter(Boolean);

        const footer = document.querySelector('footer');
        if (footer) {
          result.footer = {
            bgColor: getComputedStyle(footer).backgroundColor,
            text: footer.innerText.trim().slice(0, 2000),
            columns: [...footer.querySelectorAll('div > ul, nav > ul, [class*="col"]')].slice(0, 8).map(col => ({
              heading: col.previousElementSibling?.innerText?.trim() || col.querySelector('h3, h4, h5, strong')?.innerText?.trim() || '',
              links: [...col.querySelectorAll('a')].map(a => ({
                text: a.innerText.trim(),
                href: a.getAttribute('href') || ''
              })).filter(l => l.text)
            })),
            socialLinks: [...footer.querySelectorAll(
              'a[href*="instagram"], a[href*="tiktok"], a[href*="twitter"], a[href*="facebook"], a[href*="youtube"], a[href*="linkedin"], a[href*="github"]'
            )].map(a => ({ href: a.href, platform: a.href.match(/(instagram|tiktok|twitter|facebook|youtube|linkedin|github)/)?.[1] || '' }))
          };
        }

        return result;
      }
    """)
    with open(f"{out_dir}/content.json", "w") as f:
        json.dump(data, f, indent=2)
    return data
```

### 1.4 Interaction Sweep

Use Playwright to discover behaviors:

- **Scroll sweep**: Scroll slowly, check if header changes (sticky/blur/shadow transitions), elements animate in, tabs auto-switch
- **Hover sweep**: Hover over interactive elements, capture style changes (image zoom, button color shifts, underlines)
- **Responsive sweep**: Test at 1440px, 768px, 390px — note layout shifts, hidden elements, hamburger menu appearance
- **Mobile menu extraction**: At 390px, look for hamburger/menu buttons and click them to capture the drawer/overlay content and animation

Save findings to `clone-data/behaviors.md`.

### 1.5 Asset Discovery & Download

Enumerate all images, videos, background images, and SVGs. **Always download to local `public/images/` and `public/videos/`** — never rely on CDN URLs in the final build.

```python
def discover_assets(page):
    return page.evaluate("""
      () => {
        return {
          images: [...document.querySelectorAll('img')]
            .filter(img => img.offsetWidth > 30 && img.src)
            .map(img => ({
              src: img.src,
              srcset: img.srcset || '',
              alt: img.alt,
              w: img.offsetWidth,
              h: img.offsetHeight,
              parentClasses: img.parentElement?.className?.toString().slice(0, 100) || '',
              position: getComputedStyle(img).position,
              zIndex: getComputedStyle(img).zIndex
            })),
          videos: [...document.querySelectorAll('video')].map(v => ({
            src: v.src || v.querySelector('source')?.src,
            poster: v.poster,
            autoplay: v.autoplay,
            loop: v.loop,
            muted: v.muted
          })).filter(v => v.src),
          backgroundImages: [...document.querySelectorAll('*')].filter(el => {
            const bg = getComputedStyle(el).backgroundImage;
            return bg && bg !== 'none' && bg.includes('url(');
          }).slice(0, 50).map(el => ({
            url: getComputedStyle(el).backgroundImage,
            element: el.tagName + (el.className ? '.' + el.className.toString().split(' ')[0] : '')
          })),
          svgs: [...document.querySelectorAll('svg')].slice(0, 50).map((svg, i) => ({
            index: i,
            viewBox: svg.getAttribute('viewBox') || '',
            width: svg.getAttribute('width') || svg.offsetWidth,
            height: svg.getAttribute('height') || svg.offsetHeight,
            html: svg.outerHTML.length < 5000 ? svg.outerHTML : '[TOO_LARGE]',
            parentText: svg.parentElement?.innerText?.trim().slice(0, 50) || '',
            ariaLabel: svg.getAttribute('aria-label') || ''
          })),
          fonts: [...new Set(
            [...document.querySelectorAll('*')].slice(0, 300)
              .map(el => getComputedStyle(el).fontFamily)
          )],
          fontLinks: [...document.querySelectorAll('link[href*="fonts"]')].map(l => l.href)
        };
      }
    """)
```

```python
import urllib.request, urllib.error, re, hashlib

def download_assets(assets, out_dir="public"):
    downloaded = {}
    img_dir = f"{out_dir}/images"
    vid_dir = f"{out_dir}/videos"
    os.makedirs(img_dir, exist_ok=True)
    os.makedirs(vid_dir, exist_ok=True)

    for img in assets.get("images", []):
        url = img["src"]
        if not url or url.startswith("data:"):
            continue
        ext = re.search(r'\.(png|jpg|jpeg|webp|gif|svg|avif)', url.lower())
        ext = ext.group(0) if ext else ".webp"
        name_hash = hashlib.md5(url.encode()).hexdigest()[:10]
        alt_slug = re.sub(r'[^a-z0-9]', '-', (img.get("alt") or "img").lower())[:30]
        filename = f"{alt_slug}-{name_hash}{ext}"
        filepath = f"{img_dir}/{filename}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                with open(filepath, "wb") as f:
                    f.write(resp.read())
            downloaded[url] = f"/images/{filename}"
            print(f"OK: {filename}")
        except Exception as e:
            print(f"FAIL: {url} -> {e}")

    for vid in assets.get("videos", []):
        url = vid["src"]
        if not url:
            continue
        ext = re.search(r'\.(mp4|webm|mov)', url.lower())
        ext = ext.group(0) if ext else ".mp4"
        name_hash = hashlib.md5(url.encode()).hexdigest()[:10]
        filename = f"video-{name_hash}{ext}"
        filepath = f"{vid_dir}/{filename}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                with open(filepath, "wb") as f:
                    f.write(resp.read())
            downloaded[url] = f"/videos/{filename}"
            print(f"OK: {filename}")
        except Exception as e:
            print(f"FAIL: {url} -> {e}")

    return downloaded
```

### 1.6 Image URL Verification & Fixing

Always verify scraped image URLs before using them:

```python
import subprocess

def verify_url(url):
    r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-L', url],
                       capture_output=True, text=True, timeout=10)
    return r.stdout.strip()
```

| Problem | Fix |
|---------|-----|
| Truncated URL | Re-scrape with full `img.src` extraction |
| 403 Forbidden | Download locally with User-Agent header to `public/images/` |
| Expired signed URL | Download and serve locally |
| Low resolution | Modify CDN width/height params (e.g., `width=100` → `width=800`) |
| CORS / hotlink block | Download locally — this is the default strategy |

**CDN URL Patterns** (for upscaling resolution before downloading):

- **Shopify**: `cdn.shopify.com/...?width=X&height=Y` — increase width param
- **Sanity**: `cdn.sanity.io/...?w=X&h=Y` — increase w param
- **Cloudinary**: `res.cloudinary.com/.../w_X,h_Y/...` — increase w_ param
- **Contentful**: `images.ctfassets.net/...?w=X` — increase w param

## Phase 2: Foundation Build

This phase is sequential — do it yourself, not delegated to subagents.

1. **Create the artifact** using `createArtifact()` with type `react-vite`
2. **Update `index.html`** with font loading `<link>` tags (Google Fonts or equivalent)
3. **Update `index.css`** with:
   - Design tokens as CSS custom properties / Tailwind theme extensions
   - Scrollbar-hiding utility classes
   - Keyframe animations (slide-in for mobile menu, fade-up for scroll animations)
   - Animation utility classes
4. **Update `tailwind.config` / CSS** with custom colors, fonts, spacing from tokens
5. **Move downloaded assets** into the artifact's `public/` directory, organized by section:
   - `public/images/hero/` — hero/carousel images
   - `public/images/categories/` — category card images
   - `public/images/products/` — product images
   - `public/images/promo/` — promotional tile images
   - `public/images/features/` — feature section images
6. **Create an `icons.tsx`** file with extracted SVG icons as React components
7. **Make `vite.config.ts` resilient**:

   ```ts
   const port = Number(process.env.PORT) || 5173;
   const basePath = process.env.BASE_PATH || "/";
   ```

8. **Verify the build passes**: `pnpm --filter @workspace/<slug> run build`

### Essential CSS Foundation

```css
@keyframes slide-in {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}

.animate-fade-up {
  animation: fade-up 0.6s ease-out both;
}

@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

## Phase 3: Component Specification

For each section in the page topology, do THREE things: **extract**, **write spec**, **dispatch builder**.

### 3.1 Per-Component CSS Extraction

For each section, run a detailed `getComputedStyle()` extraction via Playwright. This walks the DOM tree (4 levels deep) and captures every relevant CSS property for each element.

```python
def extract_component_styles(page, selector):
    return page.evaluate("""
      (selector) => {
        const el = document.querySelector(selector);
        if (!el) return { error: 'Element not found: ' + selector };

        const props = [
          'fontSize','fontWeight','fontFamily','lineHeight','letterSpacing','color',
          'textTransform','textDecoration','backgroundColor','background',
          'padding','paddingTop','paddingRight','paddingBottom','paddingLeft',
          'margin','marginTop','marginRight','marginBottom','marginLeft',
          'width','height','maxWidth','minWidth','maxHeight','minHeight',
          'display','flexDirection','justifyContent','alignItems','gap',
          'gridTemplateColumns','gridTemplateRows',
          'borderRadius','border','borderTop','borderBottom','borderLeft','borderRight',
          'boxShadow','overflow','overflowX','overflowY',
          'position','top','right','bottom','left','zIndex',
          'opacity','transform','transition','cursor',
          'objectFit','objectPosition','mixBlendMode','filter','backdropFilter',
          'whiteSpace','textOverflow','WebkitLineClamp',
          'backgroundSize','backgroundPosition','backgroundRepeat'
        ];

        function extractStyles(element) {
          const cs = getComputedStyle(element);
          const styles = {};
          props.forEach(p => {
            const v = cs[p];
            if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' &&
                v !== 'rgba(0, 0, 0, 0)' && v !== 'rgb(0, 0, 0)' && v !== 'start' &&
                v !== 'stretch' && v !== 'visible' && v !== 'static' && v !== 'row' &&
                v !== 'repeat' && v !== '0% 0%') {
              styles[p] = v;
            }
          });
          return styles;
        }

        function walk(element, depth) {
          if (depth > 4) return null;
          const children = [...element.children];
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            classes: element.className?.toString().split(' ').slice(0, 5).join(' ') || '',
            id: element.id || null,
            text: element.childNodes.length === 1 && element.childNodes[0].nodeType === 3
              ? element.textContent.trim().slice(0, 300) : null,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            styles: extractStyles(element),
            images: element.tagName === 'IMG' ? {
              src: element.src,
              alt: element.alt,
              naturalWidth: element.naturalWidth,
              naturalHeight: element.naturalHeight
            } : null,
            svg: element.tagName === 'SVG' ? {
              viewBox: element.getAttribute('viewBox'),
              html: element.outerHTML.length < 3000 ? element.outerHTML : '[TOO_LARGE]'
            } : null,
            childCount: children.length,
            children: children.slice(0, 20).map(c => walk(c, depth + 1)).filter(Boolean)
          };
        }

        return walk(el, 0);
      }
    """, selector)
```

### 3.2 Multi-State Extraction

For elements with multiple states (hover, scroll-triggered, tabbed content):

1. Capture styles at State A (default)
2. Trigger the state change (scroll, click tab via Playwright)
3. Capture styles at State B
4. Record the diff: "Property X changes from VALUE_A to VALUE_B, triggered by TRIGGER, with transition: TRANSITION_CSS"

**Hover State Extraction:**

```python
def extract_hover_state(page, selector):
    before = page.evaluate("""
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          backgroundColor: cs.backgroundColor, color: cs.color,
          transform: cs.transform, boxShadow: cs.boxShadow,
          opacity: cs.opacity, borderColor: cs.borderColor,
          textDecoration: cs.textDecoration, transition: cs.transition
        };
      }
    """, selector)

    el = page.query_selector(selector)
    if el:
        el.hover()
        page.wait_for_timeout(500)

    after = page.evaluate("""
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          backgroundColor: cs.backgroundColor, color: cs.color,
          transform: cs.transform, boxShadow: cs.boxShadow,
          opacity: cs.opacity, borderColor: cs.borderColor,
          textDecoration: cs.textDecoration, transition: cs.transition
        };
      }
    """, selector)

    diff = {}
    if before and after:
        for key in before:
            if before[key] != after[key]:
                diff[key] = {"before": before[key], "after": after[key]}

    return {"before": before, "after": after, "diff": diff}
```

**Scroll-Triggered State Extraction:**

```python
def extract_scroll_state(page, selector, scroll_to=200):
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(500)

    before = page.evaluate("""
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          backgroundColor: cs.backgroundColor, boxShadow: cs.boxShadow,
          height: cs.height, padding: cs.padding, maxWidth: cs.maxWidth,
          borderRadius: cs.borderRadius, position: cs.position,
          top: cs.top, transform: cs.transform, opacity: cs.opacity,
          backdropFilter: cs.backdropFilter
        };
      }
    """, selector)

    page.evaluate(f"window.scrollTo(0, {scroll_to})")
    page.wait_for_timeout(800)

    after = page.evaluate("""
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          backgroundColor: cs.backgroundColor, boxShadow: cs.boxShadow,
          height: cs.height, padding: cs.padding, maxWidth: cs.maxWidth,
          borderRadius: cs.borderRadius, position: cs.position,
          top: cs.top, transform: cs.transform, opacity: cs.opacity,
          backdropFilter: cs.backdropFilter
        };
      }
    """, selector)

    page.evaluate("window.scrollTo(0, 0)")

    diff = {}
    if before and after:
        for key in before:
            if before[key] != after[key]:
                diff[key] = {"before": before[key], "after": after[key]}

    return {"scrollThreshold": scroll_to, "before": before, "after": after, "diff": diff}
```

### 3.3 Responsive Layout Extraction

```python
def extract_responsive(page, selector, breakpoints=[1440, 768, 390]):
    results = {}
    for width in breakpoints:
        page.set_viewport_size({"width": width, "height": 900})
        page.wait_for_timeout(800)

        data = page.evaluate("""
          (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const cs = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return {
              display: cs.display, flexDirection: cs.flexDirection,
              gridTemplateColumns: cs.gridTemplateColumns, gap: cs.gap,
              padding: cs.padding, width: Math.round(rect.width),
              height: Math.round(rect.height), childCount: el.children.length,
              childrenVisible: [...el.children].filter(c => {
                const s = getComputedStyle(c);
                return s.display !== 'none' && s.visibility !== 'hidden';
              }).length
            };
          }
        """, selector)

        results[f"{width}px"] = data

    page.set_viewport_size({"width": 1440, "height": 900})
    return results
```

### 3.4 Complete Per-Section Extraction Flow

```python
def extract_section_full(page, section_name, selector, out_dir="clone-data"):
    print(f"\nExtracting: {section_name} ({selector})")

    el = page.query_selector(selector)
    if el:
        el.scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        el.screenshot(path=f"{out_dir}/screenshots/{section_name}.png")

    styles = extract_component_styles(page, selector)
    with open(f"{out_dir}/components/{section_name}-styles.json", "w") as f:
        json.dump(styles, f, indent=2)

    responsive = extract_responsive(page, selector)
    with open(f"{out_dir}/components/{section_name}-responsive.json", "w") as f:
        json.dump(responsive, f, indent=2)

    text = page.evaluate("""
      (sel) => {
        const el = document.querySelector(sel);
        return el ? el.innerText : '';
      }
    """, selector)
    with open(f"{out_dir}/components/{section_name}-text.txt", "w") as f:
        f.write(text)

    return {"styles": styles, "responsive": responsive, "text": text}
```

### 3.5 Write Component Spec Files

For each section, write a spec file at `docs/research/components/<component-name>.md` using this template:

```markdown
# <ComponentName> Specification

## Overview
- **Target file:** `src/components/<ComponentName>.tsx`
- **Interaction model:** <static | click-driven | scroll-driven | time-driven>

## DOM Structure
<Element hierarchy description>

## Computed Styles (exact values from getComputedStyle)
### Container
- display: ...
- padding: ...
### <Child elements>
- fontSize: ...
- color: ...

## Typography
- Headings: <font-family>, <font-size>, <font-weight>, <color>
- Body text: <font-family>, <font-size>, <line-height>, <color>
- Buttons: <font-size>, <font-weight>, <text-transform>, <letter-spacing>

## Colors
- Background: <exact rgb/hex value>
- Text primary: <exact value>
- Text secondary: <exact value>
- Accent/CTA: <exact value>

## States & Behaviors
### <Behavior name>
- **Trigger:** <exact mechanism>
- **State A:** <property values before>
- **State B:** <property values after>
- **Transition:** <CSS transition value>

## Text Content (verbatim)
<All text, copy-pasted from the live site>

## Assets
- Images: <list with local paths in public/>
- Icons: <list from icons.tsx>

## Responsive Behavior
- **Desktop (1440px):** <layout>
- **Tablet (768px):** <changes>
- **Mobile (390px):** <changes>

## Mobile Navigation (for Header component)
- Hamburger menu button: visible below <breakpoint>
- Drawer: slide-in from <direction>, <width>, <bg color>
- Backdrop: <overlay description>
- Nav links: <styling>
- Body scroll lock: yes
- Animation: <type and duration>
```

### 3.6 Complexity Assessment

Before dispatching builders, assess each section:

- **Simple** (1-2 sub-components): One builder agent
- **Complex** (3+ sub-components): One agent per sub-component + one for the section wrapper
- **Rule of thumb**: If the spec exceeds ~150 lines, break it into smaller pieces

## Phase 4: Parallel Build with Subagents

Use Replit's design subagents to build components in parallel. Each subagent receives:

- The full component spec inline (not "go read the file")
- Path to the screenshot reference
- Which shared components to import (icons, cn(), UI primitives)
- The target file path
- Instruction to make it responsive and match the spec exactly

### Dispatch Pattern

```javascript
await startAsyncSubagent({
    task: `Build the <ComponentName> component for the website clone.

TARGET FILE: artifacts/<slug>/src/components/<ComponentName>.tsx

COMPONENT SPECIFICATION:
<paste full spec file contents here>

INSTRUCTIONS:
- Match the computed CSS values EXACTLY — do not approximate
- Use Tailwind utility classes where they match; use inline styles or custom CSS for exact values
- Import icons from '../components/icons'
- Use real text content from the spec, not placeholders
- Make it fully responsive per the spec's breakpoint notes
- Export the component as default export
- For carousels: implement with useState for active index, auto-play with useEffect interval, dot indicators, and pause on hover
- For sticky headers: use scroll listener with useState to toggle scrolled state, apply transition with cubic-bezier easing
- For mobile menu: implement slide-in drawer with backdrop overlay, body scroll lock via document.body.style.overflow, and close on backdrop click
- Images: use local paths from public/ (e.g., /images/hero/slide-1.jpg), never external CDN URLs`,
    specialization: "DESIGN",
    relevantFiles: [
        "artifacts/<slug>/src/index.css",
        "artifacts/<slug>/src/components/icons.tsx",
        "docs/research/components/<component-name>.md"
    ]
});
```

Dispatch multiple subagents in parallel for independent sections. Wait for all to complete before assembly.

## Phase 5: Page Assembly

After all components are built:

1. Import all section components into `App.tsx`
2. Arrange them in DOM order matching the original page topology
3. **Create a `FadeInSection` wrapper component** using IntersectionObserver for scroll-triggered entrance animations:

   ```tsx
   import { useRef, useEffect, useState } from 'react';

   export default function FadeInSection({ children, className = '' }) {
     const ref = useRef(null);
     const [visible, setVisible] = useState(false);

     useEffect(() => {
       const el = ref.current;
       if (!el) return;
       const observer = new IntersectionObserver(
         ([entry]) => {
           if (entry.isIntersecting) {
             setVisible(true);
             observer.unobserve(el);
           }
         },
         { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
       );
       observer.observe(el);
       return () => observer.disconnect();
     }, []);

     return (
       <div ref={ref} className={`${className} ${visible ? 'animate-fade-up' : 'opacity-0'}`}>
         {children}
       </div>
     );
   }
   ```

4. Wrap mid-page sections (not hero, not header/footer) in `<FadeInSection>` for polished scroll reveal
5. Wire up real content data to component props
6. Verify build: `pnpm --filter @workspace/<slug> run build`

### App.tsx Pattern

```tsx
import AnnouncementBar from './components/AnnouncementBar';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import SectionA from './components/SectionA';
import SectionB from './components/SectionB';
import Footer from './components/Footer';
import FadeInSection from './components/FadeInSection';

function App() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AnnouncementBar />
      <Header />
      <main>
        <HeroSection />
        <FadeInSection><SectionA /></FadeInSection>
        <FadeInSection><SectionB /></FadeInSection>
      </main>
      <Footer />
    </div>
  );
}

export default App;
```

## Phase 6: Visual QA

1. Use the screenshot tool to capture your clone at desktop (1280px) and mobile (390px) viewports
2. Compare against the original screenshots from Phase 1
3. For each discrepancy:
   - Check the spec file — was the value extracted correctly?
   - If spec was wrong: re-extract via Playwright, update spec, fix component
   - If spec was right but build is wrong: fix the component
4. Verify all images load (no broken images)
5. Check browser console for errors
6. Test hover states and interactions
7. **Test mobile hamburger menu** — click the menu button, verify drawer slides in, links are visible, close works
8. **No placeholder links** — all `href="#"` must be replaced with real URLs from the source site or reasonable alternatives (e.g., link to the original site's help page)

Present the artifact to the user when QA passes.

## Common Pitfalls & Solutions

### Pitfall 1: Missing Mobile Navigation

**Problem**: Clones often skip the hamburger menu, making the site unusable on mobile.
**Solution**: Always extract the mobile menu at 390px viewport. Click the hamburger button during extraction to capture drawer content, animation direction, width, and link list.

### Pitfall 2: Reusing Images Across Sections

**Problem**: When a section needs unique images but the extractor pulled nothing, builders reuse hero/feature images as placeholders.
**Solution**: For each section, verify image URLs are section-specific. If extraction missed images (common with lazy-loaded promo tiles), manually navigate to those sections and download the specific images using `curl` with a User-Agent header.

### Pitfall 3: Font Loading Delays

**Problem**: Fonts flash or don't load, causing layout shift.
**Solution**: Use `<link rel="preconnect">` and `<link rel="preload">` for font files. Add `font-display: swap` to @font-face declarations.

### Pitfall 4: Playwright `networkidle` Timeout

**Problem**: `page.goto(url, wait_until="networkidle")` hangs forever on sites with persistent WebSocket/analytics connections.
**Solution**: Use `wait_until="domcontentloaded"` + `page.wait_for_timeout(5000)` instead.

### Pitfall 5: CDN Image 403 Errors

**Problem**: CDN images return 403 when fetched without proper headers.
**Solution**: Always download with `User-Agent: Mozilla/5.0` header. For Shopify CDN images, you can also try appending `?v=timestamp` to bust cache protection.

### Pitfall 6: Sticky Header Not Working

**Problem**: Header doesn't stick or doesn't show scroll-triggered styles.
**Solution**: Use a scroll event listener with `useState` for the scrolled state. Apply `position: sticky; top: 0; z-index: 50` with a CSS transition on background-color and box-shadow. Common pattern:

```tsx
const [scrolled, setScrolled] = useState(false);
useEffect(() => {
  const handler = () => setScrolled(window.scrollY > 50);
  window.addEventListener('scroll', handler, { passive: true });
  return () => window.removeEventListener('scroll', handler);
}, []);
```

### Pitfall 7: Unused Template Dependencies

**Problem**: Artifact scaffolding includes 40+ shadcn/Radix dependencies that bloat the project.
**Solution**: After building all components, audit `package.json` — grep for actual imports in `src/` and remove any unused dependencies. Run `pnpm install` to clean up.

## Data Architecture

Keep scraped content data inline in component files as typed arrays — no separate JSON fetches:

```tsx
const products: Product[] = [
  { image: "/images/products/shoe-1.webp", name: "Tree Runner", price: "$98" },
];
```
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

## Quick Reference: Full Workflow

```text
<<<<<<< HEAD

1. pip install playwright; find Chromium path
2. Navigate to target URL with Playwright

3. Save raw.html (page.content()) — THIS IS THE SOURCE OF TRUTH
4. Detect locale/language from URL path (e.g., /es-do = Spanish)

5. Take full-page desktop screenshot + header-only screenshot (top 150px)
6. Build section inventory from raw.html → clone-data/inventory.json

7. Extract design tokens → clone-data/tokens.json
8. Extract SVG logo from raw.html (search for <svg near 'logo' classes)

9. Extract header details: banner color, logo position, nav links, rewards/loyalty text
10. Extract fonts (download .woff2 files or map to Google Fonts)

11. Download ALL images/videos/SVGs to public/images/ (batch with retry)
12. Extract footer links → clone-data/footer.json

13. createArtifact("react-vite", ...)
14. Replace index.css (plain CSS reset + design tokens — NO Tailwind/shadcn)

15. Replace App.tsx (remove router/query boilerplate — single page)
16. Build ALL section components (referencing raw.html, using correct language)

17. Assemble page in App.tsx (exact DOM order from inventory)
18. Start dev server, take full-page screenshot, compare vs original

19. Fix discrepancies (check header first — most common mistake area)
20. Run e2e test to verify all sections render

21. Present artifact

```

## Reference Files

- `extraction.md` — Complete Python extraction scripts (Playwright)
- `pitfalls.md` — Detailed common pitfalls and solutions
=======
1.  pip install playwright
2.  Find Chromium path (cache it)
3.  Run recon script → screenshots + tokens + content + behaviors
4.  Download ALL assets locally to public/images/ (never use CDN URLs in build)
5.  createArtifact("react-vite", ...)
6.  Set up foundation (CSS tokens, fonts, icons, animations, vite.config resilience)
7.  For each section:
    a. Extract computed styles via Playwright getComputedStyle
    b. Extract hover/scroll/responsive states
    c. Write spec file in docs/research/components/
    d. Dispatch design subagent with full spec inline
8.  Wait for all subagents
9.  Assemble page with FadeInSection wrappers
10. Prune unused dependencies from package.json
11. Visual QA with screenshot comparison (desktop + mobile)
12. Verify mobile hamburger menu works
13. Replace all placeholder href="#" with real URLs
14. Present artifact
```

## Dependency Minimalism

The final clone should only need these core dependencies:

- `react`, `react-dom`
- `tailwindcss`, `@tailwindcss/vite`
- `vite`, `@vitejs/plugin-react`
- Replit vite plugins (`@replit/vite-plugin-cartographer`, etc.)
- `@types/react`, `@types/react-dom`, `@types/node`

Do NOT include shadcn/Radix, react-hook-form, recharts, wouter, framer-motion, or other template dependencies unless the clone actually uses them. Audit and prune after building.
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7
