---
name: ad-creative
description: Design static ad creatives for social media and display advertising campaigns.
---

# Ad Creative Maker

Design static ad creatives for social media ads, display banners, and digital advertising campaigns. Build production-ready ads via the design subagent and present them as iframes on the canvas.

## When to Use

- User needs ad creatives for Facebook, Instagram, LinkedIn, Google Display, or TikTok
- User wants banner ads or display advertising assets
<<<<<<< HEAD

- User needs multiple ad variants for A/B testing
- User wants ad copy and visual design together

- User wants to iterate on ad creative based on performance data
- User asks for carousel ads (Instagram, Facebook, X/Twitter)

- User wants retargeting/remarketing ad creatives
- User provides their own product photos or brand images and wants ads built around them

- User needs ads in multiple sizes/formats (square + portrait + landscape)
- User wants a product launch or teaser campaign

- User wants seasonal or holiday-themed ads
- User needs app install ad creatives

- User wants to refresh or update existing ads without performance data
- User asks to make ads that match their website's look and feel
=======
- User needs multiple ad variants for A/B testing
- User wants ad copy and visual design together
- User wants to iterate on ad creative based on performance data
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

## When NOT to Use

- Organic social media content (use content-machine skill)
- Video ads or animated content (use storyboard skill for planning)
<<<<<<< HEAD

- Full landing pages (use the artifacts skill)

## Golden Rules (check before every ad)

1. **<20 words total on the image** — everything else goes in primary text / description fields
2. **Only 4 elements per ad**: Logo, Hero, Benefit line, CTA button

3. **Flat solid background colors only** — no gradients, no patterns, no textures (exception: awareness/launch ads may use a hero image as the background)
4. **Real brand logo, always** — never substitute plain text for a logo (see Logo Extraction below)

5. **Left-align content** — logo top-left, text left-aligned, CTA left-aligned. Centered layouts look generic.
=======
- Full landing pages (use the `artifacts` skill)

## Image-First Design Philosophy

**Every ad should be built around a striking, full-bleed generated image.** The image IS the ad — text is overlaid on top, not placed in a separate zone. This produces the punchy, scroll-stopping aesthetic that performs on modern social feeds.

**Always generate images** using `generateImage` from the media-generation skill unless:

- The user uploads/attaches their own product photos or brand imagery
- The ad is purely typographic by explicit request
- The platform is text-only (e.g., Google RSAs)

**Image style direction:** Photorealistic, editorial, dramatic. Think fashion magazine meets Apple product launch. Single striking subjects, dramatic studio lighting, dark/moody backgrounds, high contrast. Avoid: abstract digital art, generic stock photo aesthetic, flat illustrations, busy compositions. Each image should have one clear focal point that makes someone stop scrolling.

**Prompt strategy for generated images:**

- Lead with a specific, tangible subject (object, scene, or person)
- Specify lighting style (studio, dramatic, golden hour, Rembrandt)
- Specify camera quality ("shot on Hasselblad," "editorial photography," "fine art")
- Add negative prompts: "text, words, letters, logos, watermark, blurry, low quality, cartoon, illustration"
- Each ad in a set should use a *different* visual metaphor — same brand, different visual world

## Default Format

**Default to square (1:1)** for ad creatives. Use portrait/iPhone format (9:16, iframe size 608×1080) when:

- User asks for Instagram Stories or Reels ads
- User asks for TikTok ads
- User mentions "mobile ads," "iPhone," "portrait," or "stories format"
- User asks for 9:16 or vertical format
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

## Methodology

### Step 1: Creative Brief

<<<<<<< HEAD
Gather: Platform and Format, Objective, Target audience, Key message, CTA, Brand assets, Performance data (if iterating).

**Brand research (mandatory before building):** Always use web search to look up the brand's actual visual identity before designing. Search for `[brand] brand font typeface typography`and`[brand] brand colors hex`. Use the brand's real fonts, colors, and visual language — never guess or substitute generic alternatives. If the official fonts are commercial/licensed, find the closest Google Fonts alternatives used in the brand's own guidelines. Common pairings: a sans-serif for headlines (e.g., Poppins) and a serif for body text (e.g., Lora). Include these in the subagent task instructions so every angle uses the correct brand identity.

**Font loading (mandatory in every ad HTML):** After identifying the brand's fonts (or closest Google Fonts alternatives), include them in the head of every ad HTML file:

```html

<head>

<link rel="preconnect" href="https://fonts.googleapis.com">

<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;900&family=Lora:wght@400;700&display=swap" rel="stylesheet">

<style>

.headline { font-family: 'Poppins', sans-serif; }

.benefit { font-family: 'Lora', serif; }

</style>

</head>

```

Always specify the exact weights needed (400, 700, 900). Never rely on browser defaults or system fonts — every ad must load its fonts explicitly.

**Extract real brand colors from the site (mandatory).** Do not trust web search results for colors — they are frequently wrong. Instead, fetch the actual CSS from the brand's website:

```bash

curl -s -L "https://brand.com" | grep -iE '(theme-color|TileColor|mask-icon.*color)' | head -5

curl -s -L "https://brand.com" | tr -d '\n' | grep -oP 'href="[^"]*\\css[^"]*"' | head -3

curl -s "https://brand.com/path/to/style.css" | grep -oP '#[0-9a-fA-F]{3,8}' | sort -u

```

### Step 2: Platform Specifications (2025-2026)

#### Meta (Facebook/Instagram) — Visual

| Placement | Dimensions | Safe zone |

|---|---|---|

| Feed (square) | 1080x1080 | ~100px margin all edges |

| Feed (portrait) — **preferred** | 1080x1350 (4:5) | 4:5 outperforms 1:1 on CTR |

| Stories | 1080x1920 | Top 14% + bottom 20% = dead zones |

| Reels | 1080x1920 | Top 14% + bottom 35% = dead zones |

| **Universal safe core**|**1010x1280 centered** | Works across all placements |

Upload at 2x pixel density for Retina sharpness. JPG/PNG, 30MB max.
=======
Gather these inputs:

- **Platform & Format**: Which platform? (Google Ads, Meta, LinkedIn, TikTok, X/Twitter) Which format? (Search RSAs, feed, stories, display)
- **Objective**: Awareness, consideration, or conversion?
- **Target audience**: Who will see this ad? What stage of awareness? (Problem-aware, solution-aware, product-aware)
- **Key message**: Single most important thing to communicate
- **CTA**: What action should the viewer take?
- **Brand assets**: Logo, colors, fonts, product images. If the user hasn't provided their actual logo, note this and ask at the end.
- **Performance data** (if iterating): Which headlines/descriptions are performing best/worst? What angles have been tested?

**Brand research (mandatory before building):** Always use web search to look up the brand's actual visual identity before designing. Search for `[brand] brand font typeface typography` and `[brand] brand colors hex`. Use the brand's real fonts, colors, and visual language — never guess or substitute generic alternatives. If the official fonts are commercial/licensed, find the closest Google Fonts alternatives used in the brand's own guidelines. Common pairings: a sans-serif for headlines (e.g., Poppins) and a serif for body text (e.g., Lora). Include these in the subagent task instructions so every angle uses the correct brand identity.

### Step 2: Platform Specifications (2025-2026)

**Enforce these programmatically.** Count characters in code, don't eyeball.

#### Meta (Facebook/Instagram) — Visual

| Placement | Dimensions | Safe zone (keep critical elements inside) |
|---|---|---|
| Feed (square) | 1080×1080 | ~100px margin all edges |
| Feed (portrait) — **preferred** | 1080×1350 (4:5) | 4:5 outperforms 1:1 on CTR; mobile-first |
| Stories | 1080×1920 | Top 14% (270px) + bottom 20% (380px) = dead zones |
| Reels | 1080×1920 | Top 14% + **bottom 35% (670px)** — like/comment/share UI is taller |
| **Universal safe core** | **1010×1280 centered** | Design inside this box → works everywhere |

Upload at 2x pixel density (2160×2160 for a 1080 slot) for Retina sharpness. JPG/PNG, 30MB max.

**20% text rule: officially removed** — Meta no longer rejects text-heavy images, but the delivery algorithm still quietly throttles them. Keep text minimal; move details to primary text.
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

#### Meta — Text

| Element | Limit | Notes |
<<<<<<< HEAD

|---|---|---|

| Primary text | ~72 chars visible in Reels / 125 in Feed | Write for 72 |

| Headline | 40 chars rec | Below image |

=======
|---|---|---|
| Primary text | 125 chars visible feed / **~72 chars visible in Reels** | Write for 72 |
| Headline | 40 chars rec | Below image |
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7
| Description | 30 chars rec | Often hidden on mobile |

#### Google Ads

<<<<<<< HEAD
**RSA:** Headlines 30 chars (each must work standalone — Google mixes randomly), Descriptions 90 chars, up to 15 headlines / 4 descriptions. Pin sparingly — pinning drops Ad Strength.

**RDA:** Landscape 1200x628 (1.91:1), Square 1200x1200 (required), Portrait 1200x1500 (4:5, optional). Short headline 30 chars, Long headline 90 chars, Description 90 chars. All images 5MB or less, keep under 150KB for fast load.

**Highest-inventory static sizes** (if uploading fixed banners): 300x250, 728x90, 320x50, 300x600, 336x280.

**Performance Max:** Same asset pool serves across Search/Display/YouTube/Gmail/Maps/Discover. Upload all 3 image ratios + a YouTube video — don't let Google auto-generate one.

#### LinkedIn Ads

Intro text 150 chars rec (600 max), Headline 70 chars rec (200 max), Image 1200x627 or 1200x1200.

#### TikTok Ads

1080x1920 (9:16), Ad text 100 chars max (~80 visible). Spark Ads (boosting organic creator posts) outperform In-Feed Ads on engagement.

#### X / Twitter Ads

| Placement | Dimensions |

|---|---|

| Single image | 1200x675 (1.91:1) or 1080x1080 (1:1) |

| Carousel cards | 1080x1080 (1:1), 2-6 cards |

| Portrait | 1080x1350 (4:5) |

Tweet text 280 chars (~100 visible with media). Card headline 70 chars.

### Step 3: Determine Campaign Mode

Before defining angles, determine whether this is **direct-response**or**awareness/launch**.

#### Direct-Response (default)

Use for conversion, lead generation, app installs, purchases. This is the default — most ad requests are direct-response.

#### Awareness / Launch Campaigns

Use for product launches, brand announcements, event teasers, top-of-funnel awareness. Prioritize mood and brand impression over clicks.

##### Key differences from direct-response

- **No CTA button on the image.** The CTA lives in the post text or link, not the visual.
- **Even less text: ~10-15 words max** — typically brand name, one positioning line, and a date/tagline.

- **Visual metaphor over product shots.** Use evocative imagery that communicates feeling or aspiration.
- **Multiple visual worlds per campaign.** For carousels or multi-asset campaigns, create 3-5 distinct aesthetic treatments — different palettes, subjects, moods — while keeping typography and logo placement consistent.

- **Layout pattern:** Logo (top corner) then Hero visual (fills most of the frame) then Brand name/headline (bottom, large, bold) then Subtitle + date (smaller, below headline).
- **Hero images allowed.** Unlike direct-response, awareness ads may use a full-bleed generated image as the background (see Image Guidance below).

**When to use awareness mode:** Pre-launch teasers, brand-building campaigns, event promotion, or when the user says "announce," "tease," "launch," or asks for something "premium" without conversion goals.

### Step 3b: Define Angles
=======
**Responsive Search Ads (RSA):**

| Element | Limit | Qty | Rule |
|---|---|---|---|
| Headlines | 30 chars | up to 15, min 3 | Each must work standalone — Google combines randomly |
| Descriptions | 90 chars | up to 4, min 2 | Complement, don't repeat headlines |
| Display path | 15 chars × 2 | — | |

Pin sparingly — pinning drops Ad Strength and limits ML optimization. Supply ≥5 headlines + ≥5 descriptions for ~10% more conversions at same CPA.

**Responsive Display Ads (RDA) — default Display format:**

| Asset | Spec | Qty |
|---|---|---|
| Landscape image | 1200×628 (1.91:1) | up to 15 total |
| Square image | 1200×1200 (1:1) | required |
| Portrait image | 1200×1500 (4:5) | optional, expands inventory |
| Logo square | 1200×1200 (128 min) | up to 5 |
| Logo wide | 1200×300 (4:1) | optional |
| Short headline | 30 chars | up to 5 |
| Long headline | 90 chars | 1 |
| Description | 90 chars | up to 5 |

All images ≤5MB, JPG/PNG only (no GIF in RDA). Keep file size <150KB for fast load.

**Highest-inventory static sizes** (if uploading fixed banners): 300×250 (medium rectangle — most served, works desktop+mobile), 728×90 (leaderboard), 320×50 (mobile banner), 300×600 (half-page — premium CPM, high CTR), 336×280.

**Performance Max:** same asset pool serves across Search/Display/YouTube/Gmail/Maps/Discover. Upload all 3 image ratios + a YouTube video (≤30s) or Google auto-generates one — don't let it.

#### LinkedIn Ads

| Element | Limit |
|---|---|
| Intro text | 150 chars rec (600 max) |
| Headline | 70 chars rec (200 max) |
| Image | 1200×627 (1.91:1) or 1200×1200 |

#### TikTok Ads

1080×1920, 9:16. Ad text: 100 char max (~80 visible). For Spark Ads (boosting organic creator posts), get the authorization code from the creator — Spark Ads outperform In-Feed Ads on engagement because they retain organic engagement metrics.

#### X / Twitter Ads

| Placement | Dimensions | Notes |
|---|---|---|
| Single image | 1200×675 (1.91:1) or 1080×1080 (1:1) | 1:1 gets more real estate in feed |
| Carousel cards | 1080×1080 (1:1) or 800×800 min | 2-6 cards; each card gets its own image + optional headline/URL |
| Portrait (organic or promoted) | 1080×1350 (4:5) | Taller images dominate mobile feed; 4:5 works for organic posts promoted via Amplify/Quick Promote |

| Element | Limit | Notes |
|---|---|---|
| Tweet text | 280 chars | ~100 chars visible before "Show more" on mobile when media is attached |
| Card headline | 70 chars | Below image on website cards; not present on carousel image cards |

**Carousel strategy:** Each card should be a self-contained visual — assume viewers swipe through quickly. Use carousels to show multiple visual worlds, product angles, or sequential narrative. High-performing carousels often use a **consistent structural layout** (same typography placement, same logo position) with **varying visual treatments** per card, so the brand stays recognizable while each card feels fresh. This creates a "same but different" effect that rewards swiping.

### Step 3: Determine Campaign Mode

Before defining angles, determine whether this is a **direct-response** or **awareness/launch** campaign. The approach differs significantly.

#### Awareness / Launch Campaigns

Use for product launches, brand announcements, event teasers, or top-of-funnel awareness. These prioritize mood, intrigue, and brand impression over clicks.

**Key differences from direct-response:**

- **No CTA button on the image.** The ad is a statement, not a prompt. The CTA lives in the post text or link, not the visual.
- **Even less text: ~10-15 words max** on the image — typically just brand name, one positioning line, and a date or tagline.
- **Visual metaphor over product shots.** Don't show the product. Use evocative imagery that communicates the brand's feeling or aspiration (e.g., a person in nature for "freedom," a glowing device for "future," a flower for "beauty/craft"). The imagery should make someone stop scrolling because it's beautiful or intriguing, not because it promises a specific outcome.
- **Multiple visual worlds per campaign.** For carousels or multi-asset campaigns, create 3-5 distinct aesthetic treatments — different color palettes, different photographic subjects, different moods — while keeping typography layout and logo placement consistent. This "same structure, different world" pattern rewards swiping and creates brand depth.
- **Layout pattern:** Logo (top corner) → Hero visual (fills most of the frame) → Brand name / headline (bottom, large, bold) → Subtitle + date (smaller, below headline).

**When to use awareness mode:**

- Pre-launch teasers and announcements
- Brand-building campaigns where the goal is recall, not clicks
- Event promotion (dates, countdowns)
- When the user says "announce," "tease," "launch," or asks for something that "looks premium" without conversion goals

#### Direct-Response Campaigns

Use for conversion, lead generation, app installs, purchases. This is the default mode — most ad requests are direct-response.

### Step 3b: Define Angles (Direct-Response)
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

Before writing individual copy, establish 3-5 distinct angles — different reasons someone would click:

| Category | Example |
<<<<<<< HEAD

|----------|---------|

| Pain point | "Stop wasting time on X" |

| Outcome | "Achieve Y in Z days" |

| Social proof | "Join 10,000+ teams who..." |

| Curiosity | "The X secret top companies use" |

| Identity | "Built for [specific role/type]" |

| Urgency | "Limited time: get X free" |

| Contrarian | "Why [common practice] doesn't work" |

**For retargeting ads**, adjust angles for warm audiences who already know the brand:

- Reminder: "Still thinking about X?"
- Incentive: "Come back for 15% off"

- Social proof: "See why 10,000 others chose us"
- Scarcity: "Only 3 left in your size"

- Objection handling: "Free returns, no risk"

### Step 4: Design Principles

- **Under 20 words total on the image** — this is the most important rule. Icons, stats rows, feature grids, and badges all violate this. If it doesn't fit in Logo + Hero + Benefit + CTA, it belongs in the primary text.
- Visual hierarchy: Logo (top-left) then Hero element then Benefit then CTA

- WCAG 4.5:1 contrast minimum
- CTA: contrasting color, rounded corners, verb-first, left-aligned

- **No gradients** — flat solid colors only. Use different solid colors across ads for variety. Exception: awareness/launch ads may use a bottom readability gradient over a hero image.

### Steps 5-6: Generate and Validate Copy

Vary word choice, specificity, tone, and structure across angles. Always validate character counts before delivering. Include counts in your output.
=======
|----------|---------|
| Pain point | "Stop wasting time on X" |
| Outcome | "Achieve Y in Z days" |
| Social proof | "Join 10,000+ teams who..." |
| Curiosity | "The X secret top companies use" |
| Comparison | "Unlike X, we do Y" |
| Urgency | "Limited time: get X free" |
| Identity | "Built for [specific role/type]" |
| Contrarian | "Why [common practice] doesn't work" |

### Step 4: Design Principles

#### Direct-Response Visual Hierarchy

**Read order:** 1) Hero element → 2) Benefit/offer → 3) CTA → 4) Logo (corner, small).

**Rules:**

- <20 words total on the image — move everything else to primary text
- One focal point. If the eye doesn't know where to land in 0.5s, it's too busy.
- High contrast text/background — verify WCAG 4.5:1 minimum (use `chroma.contrast()` if building programmatically)
- CTA button: contrasting color, rounded corners, verb-first ("Get the guide" not "Learn more")
- Faces looking *toward* the CTA increase click-through (gaze cueing)
- Keep file <150KB for display; Meta accepts up to 30MB but slow loads hurt auction performance

#### Awareness / Launch Visual Hierarchy

**Read order:** 1) Hero visual (dominates the frame) → 2) Brand name / headline (large, bold, bottom or mid-frame) → 3) Positioning line (smaller, beneath headline) → 4) Logo (top corner, subtle).

**Rules:**

- ~10-15 words max on the image. The visual does the heavy lifting.
- No CTA button. The image is a brand impression, not a click prompt.
- Use photography, 3D renders, or AI-generated imagery — not stock graphics, icons, or wireframes. The hero should feel editorial or art-directed.
- Visual metaphor over literal representation. Show a feeling, not a feature. A glowing screen = innovation. A person with outstretched arms = freedom. A flower = craft/beauty. The viewer should feel something before they read anything.
- Logo adapts to background: white logo on dark backgrounds, dark logo on light backgrounds. Keep it small and corner-positioned — it brands without competing with the hero.
- For carousel/multi-card: maintain identical text layout and logo position across cards. Vary only the hero visual and color palette. This "same frame, different world" structure creates visual rhythm that rewards swiping.
- Typography should be bold and confident — large headlines that anchor the bottom of the frame. Lowercase or sentence-case can feel more modern and approachable than ALL CAPS.

### Step 5: Generate Variations

For each angle, generate multiple variations. Vary:

- **Word choice** — synonyms, active vs. passive
- **Specificity** — numbers vs. general claims ("Cut reporting time 75%" beats "Save time")
- **Tone** — direct vs. question vs. command
- **Structure** — short punch vs. full benefit statement

**Strong headlines:** Specific over vague. Benefits over features. Active voice. Include numbers when possible ("3x faster," "in 5 minutes").

**Strong descriptions:** Complement headlines, don't repeat them. Add proof points, handle objections ("No credit card required"), reinforce CTAs.

### Step 6: Validate and Deliver

Before presenting, check every piece against character limits. Flag anything over and provide a trimmed alternative. Include character counts.
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

```text

## Angle: [Pain Point — Manual Reporting]

### Headlines (30 char max)

1. "Stop Building Reports by Hand" (29)
2. "Automate Your Weekly Reports" (28)
<<<<<<< HEAD

=======
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7
3. "Reports in 5 Min, Not 5 Hrs" (27)

### Descriptions (90 char max)

1. "Marketing teams save 10+ hours/week with automated reporting. Start free." (73)
2. "Connect your data sources once. Get automated reports forever. No code required." (80)

```

<<<<<<< HEAD
### Step 7: Build Ad Creatives

#### File Setup

Place all ad HTML files in `artifacts/mockup-sandbox/public/ads/`— served by the mockup-sandbox Vite dev server at`/__mockup/ads/filename.html`.
=======
### Step 7: Build Ad Creatives — Design Subagents + Canvas

**Launch a separate design subagent for each variation in parallel** using `startAsyncSubagent`. Each subagent builds one ad variation as a standalone HTML page. This is much faster than building them sequentially.

#### Canvas Layout

**Square (1:1) — default:** Use 1080×1080 iframes. Group by angle in rows, with a landing page iframe alongside:

```text
x=0,    y=0:    [Iframe: angle1-ad]              (1080x1080)
x=1200, y=0:    [Iframe: angle1-landing]         (1280x720)
x=0,    y=1180: [Iframe: angle2-ad]              (1080x1080)
x=1200, y=1180: [Iframe: angle2-landing]         (1280x720)
```

**Portrait (9:16) — for stories/mobile/Instagram/TikTok:** Use 608×1080 iframes. Arrange in rows of 5 with 50px gutters:

```text
Row 1: x=0, x=658, x=1316, x=1974, x=2632  (y=0,    each 608x1080)
Row 2: x=0, x=658, x=1316, x=1974, x=2632  (y=1130, each 608x1080)
```

#### Parallel design subagent delegation

**Launch all variations simultaneously.** Each subagent gets one ad + its landing page. Use `startAsyncSubagent` for each, then `waitForBackgroundTasks` to collect results.

**Before launching subagents**, generate all hero images first using `generateImage`. Each ad needs its own unique, photorealistic hero image. Save them to `artifacts/mockup-sandbox/public/images/` and reference them in the component via `/__mockup/images/[filename].png`.

```javascript
// Step 1: Generate all hero images BEFORE launching design subagents
// Use generateImage from the media-generation skill
// Save to artifacts/mockup-sandbox/public/images/ad-[name].png
// Each image should be a different visual metaphor — same brand, different world

// Step 2: Launch design subagents in parallel — each builds one ad component
await startAsyncSubagent({
    task: `Create a production-ready ad creative component for the following angle.

Brand: [name]
Colors: Primary [hex], Secondary [hex], Accent [hex]
Fonts: [display font] (load from Google Fonts or use Inter)
Logo: [SVG description or path to uploaded logo]
User's stated style preferences: [include any specific preferences]

**Angle: [Pain Point]**
- Hero image: \`/__mockup/images/ad-[name].png\` (already generated — use this exact path)
- Headline: "[headline text]"
- Subtext: "[optional short line]"

Build this file: [ComponentName].tsx in artifacts/mockup-sandbox/src/components/mockups/[folder]/

**CRITICAL — Image-first full-bleed layout:**
The generated photo IS the ad. The component must use this exact structure:

\`\`\`
Outermost div: width: 100vw, height: 100vh, overflow: hidden, position: relative
Hero image: <img> with position: absolute, inset: 0, object-fit: cover, width: 100%, height: 100%
Bottom gradient overlay: position: absolute, bottom: 0, width: 100%, linear-gradient(transparent, rgba(0,0,0,0.7))
Text on top of gradient: position: absolute, bottom section
All font sizes in vw units (8-12vw for headlines in square, 8-20vw in portrait)
\`\`\`

Design rules:
- The hero image fills the ENTIRE frame — no margins, no panels, no colored backgrounds
- Text overlaid directly on the image with gradient for readability
- Headlines: HUGE, bold (font-weight 900), vw units
- Minimal text: brand name + one headline + one short subtext max
- Logo: small, top corner, SVG
- Use text-shadow for extra readability on busy backgrounds
- The vibe: if you saw this in your Instagram feed, you'd stop scrolling`,
    specialization: "DESIGN",
    relevantFiles: ["artifacts/mockup-sandbox/src/components/mockups/[folder]/[Component].tsx"]
});

// Repeat for each angle — all launch simultaneously
// Wait for all to complete
await waitForBackgroundTasks();
```

After all subagents finish, embed each page as an iframe on the canvas using `apply_canvas_actions`. Then call `presentArtifact({ artifactId, shapeIds: [...] })` with the IDs of the new iframe shapes. Do not ask the user if they want to focus — just present.

#### File Setup

Place all ad HTML files in `artifacts/mockup-sandbox/public/ads/` — served by the mockup-sandbox Vite dev server at `/__mockup/ads/filename.html`.
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

After copying image assets from `attached_assets/`, always fix permissions:

```bash
<<<<<<< HEAD

chmod 644 artifacts/mockup-sandbox/public/ads/*.png artifacts/mockup-sandbox/public/ads/*.jpg

```

Files copied from `attached_assets/`default to`rw-------` (unreadable by the server).

#### Cache Busting

Canvas iframes cache aggressively. After editing any ad file, increment `?v=N` on the iframe URL:

```text

https://your-domain.dev/__mockup/ads/angle1.html?v=2

```

#### Parallel Subagents — Full Task Template

Launch one design subagent per angle simultaneously. Each subagent gets a complete, self-contained task with all brand details, the HTML structure, and styling rules baked in. **Do not assume the subagent knows any of the golden rules — repeat them explicitly.**

```javascript

await startAsyncSubagent({

task: `Create a production-ready ad creative as a standalone HTML file.

**Brand:**

- Name: [Brand Name]
- Primary color: [hex] | Secondary: [hex] | Accent: [hex]

- Headline font: [Font Name] (Google Fonts — load via link tag in head)
- Body font: [Font Name] (Google Fonts — load via link tag in head)

- Logo: [inline SVG code or path to logo file]

**Ad Details:**

- Platform: [Meta Feed / Google Display / LinkedIn / TikTok / X]
- Angle: [Pain Point / Outcome / Social Proof / etc.]

- Headline: "[exact headline text]"
- Benefit: "[one short benefit line]"

- CTA: "[verb-first CTA text]"
- Background color: [hex — flat solid, NO gradients]

**File:** Write to artifacts/mockup-sandbox/public/ads/[filename].html

**MANDATORY HTML STRUCTURE — follow exactly:**

The ad must use this structure:

- html/body: width 100vw, height 100vh, overflow hidden, margin 0, padding 0
- .ad container: width 100vw, height 100vh, solid background color (NO gradients), flex column, justify-content space-between, padding 6vh 7vw

- .logo: top-left, inline SVG at height 5vh
- .middle: flex column, gap 3vh, containing headline, benefit, and CTA

- .headline: brand headline font, font-size 8vw, font-weight 900, line-height 1.1
- .benefit: brand body font, font-size 3vw, slightly transparent white

- .cta: inline-block, padding 2vh 5vw, accent color background, border-radius 1vw, font-weight 700, align-self flex-start (LEFT-ALIGNED)
- .footer: font-size 1.8vw, subtle color, brand URL

**RULES — do not violate:**

- Only 4 elements: Logo, Headline, Benefit, CTA. No icons, stats, badges, feature grids, or dividers.
- Under 20 words total visible on the ad.

- Flat solid background color — NO gradients, NO patterns.
- All sizing in vw/vh — NO fixed pixel dimensions.

- Left-align everything — logo top-left, text left-aligned, CTA left-aligned. Do NOT center.
- Load fonts from Google Fonts in the head. Do NOT use system fonts or Inter.

- The CTA button must use a contrasting accent color and be verb-first.`,

specialization: "DESIGN",

relevantFiles: ["artifacts/mockup-sandbox/public/ads/[filename].html"]

});

// Repeat for each angle — all launch simultaneously

// Wait for all to complete

await waitForBackgroundTasks();

```

After all subagents finish, embed each ad as an iframe on the canvas using `apply_canvas_actions`. Then call`presentArtifact({ artifactId, shapeIds: [...] })` with the IDs of the new iframe shapes.

#### Viewport-Relative Sizing (mandatory)

```css

html, body {

margin: 0; padding: 0;

width: 100vw; height: 100vh;

overflow: hidden;

}

```

All internal sizing must use vw/vh. No fixed pixel dimensions on containers.

#### Ad HTML Structure (mandatory pattern)

Every ad must follow this exact structure — 4 elements, no more:

```html

<div class="ad">

<div class="logo"><!-- SVG or img --></div>

<div class="middle">

<div class="headline">Hero text here</div>

<div class="benefit">One short benefit line.</div>

<div class="cta">Verb-first CTA</div>

</div>

<span class="footer">brand.com</span>

</div>

```

```css

.ad {

width: 100vw;

height: 100vh;

background: \#SOLID_COLOR;

display: flex;

flex-direction: column;

justify-content: space-between;

padding: 6vh 7vw;

box-sizing: border-box;

}

.middle {

display: flex;

flex-direction: column;

gap: 3vh;

}

```

Do not add icons, stats rows, feature grids, badges, dividers, or any decorative elements. If you are tempted to add a 5th element, move that information to the primary text instead.

#### Image Guidance

##### When to use generated images

- Awareness/launch campaigns — the hero image IS the ad, with text overlaid on a bottom gradient
- When the user explicitly requests photo-based or image-heavy ads

###### When NOT to use images (default for direct-response)

- Standard direct-response ads use flat solid color backgrounds with bold typography
- The 4-element rule (Logo, Hero text, Benefit, CTA) works best without competing with a background image

###### If using a hero image (awareness/launch mode only)

Generate images using `generateImage`from the media-generation skill. Save to`artifacts/mockup-sandbox/public/images/`and reference via`/__mockup/images/[filename].png`.

Image prompt strategy:

- Lead with a specific, tangible subject (object, scene, or person)
- Specify lighting (studio, dramatic, golden hour, Rembrandt)

- Specify camera quality ("shot on Hasselblad," "editorial photography")
- Add negative prompts: "text, words, letters, logos, watermark, blurry, low quality, cartoon, illustration"

- Each ad should use a different visual metaphor — same brand, different visual world

Image-first HTML structure (awareness/launch only):

```css

.ad {

width: 100vw; height: 100vh;

position: relative; overflow: hidden;

}

.hero-img {

position: absolute; inset: 0;

width: 100%; height: 100%;

object-fit: cover;

}

.gradient-overlay {

position: absolute; bottom: 0; width: 100%;

height: 50vh;

background: linear-gradient(transparent, rgba(0,0,0,0.8));

}

.content {

position: absolute; bottom: 0; left: 0;

padding: 6vh 7vw;

}

```

**If the user provides their own images:** Use the user's images instead of generating new ones. Copy from `attached_assets/`to`artifacts/mockup-sandbox/public/images/`, fix permissions with`chmod 644`, and reference via`/__mockup/images/[filename]`. Use the awareness/launch image-first layout structure above.

#### Brand Logo Extraction

Always use the brand's actual logo — never substitute plain text for a logo.

**Step 1: Extract the SVG directly from the brand's website.** This is the most reliable method — the actual logo is already embedded in their HTML:

```bash

curl -s -L "https://brand.com" | tr -d '\n' | grep -oP '<svg viewBox="[^"]*"[^>]*>.*?</svg>' | head -1 > /tmp/brand-logo.svg

wc -c /tmp/brand-logo.svg

```

Should be over 1KB for a real logo.

**Step 2: Verify the extracted SVG path data is complete.** SVG path data can be silently truncated during shell extraction. Always verify the max coordinates fit within the viewBox:

```bash

node -e "

const fs = require('fs');

const svg = fs.readFileSync('/tmp/brand-logo.svg', 'utf8');

const dMatch = svg.match(/d=\([^\\]+)\\/);

if (dMatch) {

const d = dMatch[1];

console.log('Path data length:', d.length);

console.log('Last 80 chars:', d.slice(-80));

const nums = d.match(/[\d.]+/g).map(Number);

const maxX = Math.max(...nums.filter((_, i) => i % 2 === 0));

console.log('Max X:', maxX);

}

"

```

If path data length is under ~2000 characters for a wordmark logo, the data was likely truncated. Re-extract with a larger buffer.

**Step 3: Embed inline.** Embedding the SVG directly in the HTML avoids file permission issues, eliminates loading delays, and scales perfectly:

```html

<svg viewBox="0 0 100 32" fill="none" xmlns="http://www.w3.org/2000/svg"

style="height:5vh;width:auto;">

<path fill-rule="evenodd" clip-rule="evenodd" d="..." fill="white"/>

</svg>

```

Use `fill="white"`on dark backgrounds,`fill="#BrandDarkColor"` on light backgrounds.

**Step 4: Position the logo top-left, not centered.** The logo should sit in the top-left corner as part of the visual hierarchy. Do not center-align logos — centered layouts look generic and reduce brand recognition.

**Fallback: If the website doesn't have an inline SVG**, search for `[brand] logo SVG site:wikimedia.org OR site:brandfetch.com`. As a last resort, use a logo + wordmark pattern with the brand's font.

**If using an image file for the logo**, always use both max-width and max-height together:

```css

.logo-img {

max-width: 38vw;

max-height: 12vh;

width: auto;

height: auto;

object-fit: contain;

}

```

Never use `width: Xvw; height: auto` alone on a square logo — at width 38vw, a square image is also 38vh tall and will overflow its container into content below.

Logo images have built-in padding. The visible logo mark may only occupy 50-70% of the image dimensions. Size the image larger than you'd expect.

##### Logos without transparent backgrounds

| Scenario | Strategy |

|---|---|

| Ad bg color matches logo bg exactly | Use that logo version — backgrounds blend seamlessly |

| White ad background | Use white-background logo + mix-blend-mode: multiply |

```css

.logo-img { mix-blend-mode: multiply; }

```

#### Canvas Layout

Place ad iframes side-by-side in a row for easy comparison. Use square iframes (600x600) so they fit on the canvas without clipping. Space them with ~50px gutters:

```text

x=0, y=0: [Iframe: Angle 1] (600x600)

x=650, y=0: [Iframe: Angle 2] (600x600)

x=1300, y=0: [Iframe: Angle 3] (600x600)

```

**For portrait/stories ads (9:16):** Use 608x1080 iframes:

```text

x=0, y=0: [Iframe: Story 1] (608x1080)

x=658, y=0: [Iframe: Story 2] (608x1080)

x=1316, y=0: [Iframe: Story 3] (608x1080)

```

**For multi-format output** (same angle in multiple sizes): Stack formats vertically per angle:

```text

x=0, y=0: [Iframe: Angle 1 — Square] (600x600)

x=0, y=650: [Iframe: Angle 1 — Portrait] (450x600)

x=650, y=0: [Iframe: Angle 2 — Square] (600x600)

x=650, y=650: [Iframe: Angle 2 — Portrait] (450x600)

```

**For carousel ads:** Place cards in sequence left-to-right:

```text

x=0, y=0: [Iframe: Card 1] (600x600)

x=650, y=0: [Iframe: Card 2] (600x600)

x=1300, y=0: [Iframe: Card 3] (600x600)

x=1950, y=0: [Iframe: Card 4] (600x600)

```

Do not add text labels above iframe shapes — iframes already display their componentName in the title bar. Set componentName to something descriptive like "Angle 1: Outcome — Think deeper. Get further."

**With landing page mock-ups** (optional — include when the user wants to see the full click-through experience): Place the landing page iframe next to each ad:

```text

x=0, y=0: [Iframe: Angle 1 Ad] (600x600)

x=650, y=0: [Iframe: Angle 1 Landing] (1280x720)

x=0, y=650: [Iframe: Angle 2 Ad] (600x600)

x=650, y=650: [Iframe: Angle 2 Landing] (1280x720)

```

The landing page should look like where the ad actually leads — hero section echoing the ad's message, value props, social proof, and a CTA. Not a wireframe.

#### Export

Ads use vw/vh sizing so they adapt to any viewport. For export at specific pixel dimensions:

```bash

npx playwright screenshot artifacts/mockup-sandbox/public/ads/angle1.html --viewport-size=1080,1080 -o angle1-1080.png

npx playwright screenshot artifacts/mockup-sandbox/public/ads/angle1.html --viewport-size=1080,1350 -o angle1-portrait.png

npx playwright screenshot artifacts/mockup-sandbox/public/ads/story1.html --viewport-size=1080,1920 -o story1.png

```

The user can also screenshot each iframe directly from the canvas, or open the HTML files in a browser at the desired size.

## Prompt-Specific Workflows

### Carousel Ads

When the user asks for carousel ads (Instagram, Facebook, X/Twitter):

1. Each card should be a self-contained visual — assume viewers swipe quickly.
2. Use a **consistent structural layout**across cards (same typography placement, same logo position) with**varying content/colors** per card. This "same but different" effect rewards swiping.

3. For Instagram/Facebook carousels: 1080x1080 per card, 2-10 cards.
4. For X/Twitter carousels: 1080x1080 per card, 2-6 cards with optional headline/URL per card.

5. Launch one subagent per card in parallel. Include the card number and total count so the subagent can create a coherent sequence.
6. Arrange cards left-to-right on the canvas so the user can see the swipe flow.

### Retargeting / Remarketing Ads

When the user asks for retargeting ads:

1. Adjust copy for **warm audiences** who already know the brand — don't introduce the brand, remind them.
2. Use retargeting-specific angles: Reminder, Incentive, Social Proof, Scarcity, Objection Handling (see Step 3b).

3. Consider dynamic elements: "Still interested in [product]?", "Your cart is waiting", etc.
4. Shorter, more direct copy — they already know you.

### User-Provided Images

When the user uploads their own product photos or brand images:

1. Copy from `attached_assets/`to`artifacts/mockup-sandbox/public/images/`.
2. Run `chmod 644` on all copied files.

3. Use the awareness/launch image-first layout (full-bleed image with gradient overlay and text on top).
4. Do NOT generate new images — use the user's images as-is.

5. Adapt the text overlay colors to work with the specific image's brightness/contrast.

### Multi-Format Output

When the user needs the same ad in multiple sizes:

1. Create one HTML file per size variant (e.g., `angle1-square.html`,`angle1-portrait.html`,`angle1-landscape.html`).
2. The HTML structure stays the same — vw/vh sizing handles the adaptation. But adjust font sizes and padding for extreme aspect ratios (landscape needs smaller headline vw, portrait can go bigger).

3. Stack formats vertically per angle on the canvas for easy comparison.
4. Test each format at its target pixel dimensions to verify nothing clips or overflows.

### Awareness / Launch Campaigns (2)

When the user asks for a launch, teaser, or brand awareness campaign:

1. Switch to awareness mode (see Step 3 above).
2. Generate hero images using `generateImage` — each ad should use a different visual metaphor.

3. Use image-first layout with gradient overlay.
4. No CTA button on the image. ~10-15 words max.

5. For multi-card campaigns, maintain identical text layout and logo placement across cards while varying the hero visual and color palette.

### Seasonal / Holiday Ads

When the user asks for holiday or seasonal ads:

1. Use the standard methodology but adjust angles for urgency and timeliness.
2. Incorporate seasonal colors subtly — don't overwhelm the brand identity. The brand's colors should still dominate; seasonal colors are accents.

3. Include time-bound CTAs: "Order by Dec 15 for guaranteed delivery", "48-hour flash sale".
4. Consider the platform's ad approval timeline — submit 3-5 days before the holiday.

### App Install Ads

When the user asks for app install ad creatives:

1. CTA should be app-specific: "Download Free", "Get the App", "Try It Free".
2. Consider showing a device mockup or screenshot (if the user provides one).

3. For Google App Campaigns: supply landscape (1200x628), portrait (1200x1500), and square (1200x1200) images.
4. Keep the value proposition ultra-clear — users decide in 1-2 seconds whether to install.

### Refreshing Existing Ads

When the user wants to update or refresh existing ads without performance data:

1. Review the existing ads (ask the user to share them or describe them).
2. Keep the same brand identity and overall strategy.

3. Freshen: new headline variations, new background colors, new angles that weren't tested.
4. Do NOT change what's working — if the user says "these are doing fine, just want fresh versions," keep the structure and vary the copy/colors.
=======
chmod 644 artifacts/mockup-sandbox/public/ads/*.png artifacts/mockup-sandbox/public/ads/*.jpg
```

Files copied from `attached_assets/` default to `rw-------` (unreadable by the server).

**Cache Busting:** Canvas iframes cache aggressively. After editing any ad file, increment `?v=N` on the iframe URL:

```text
https://your-domain.dev/__mockup/ads/angle1.html?v=2
```

#### Brand Logo Handling

Always use the brand's actual logo — never substitute plain text for a logo.

- **Find the real logo first.** Use web search to locate an official SVG (e.g., search `[brand] logo SVG`). Sources like Bootstrap Icons, Wikimedia Commons, Brandfetch, and UXWing often have high-quality SVGs with permissive licenses.
- **Prefer inline SVG over image files.** Embedding the SVG path directly in the HTML avoids file permission issues, eliminates loading delays, and scales perfectly with vw/vh units. No need for chmod or external asset management.
- **Logo + wordmark pattern.** Use a flex container with the SVG icon and a text span side by side, both sized with vw units:

```html
<div class="logo">
  <svg xmlns="http://www.w3.org/2000/svg" fill="#BrandColor" viewBox="0 0 16 16">
    <path d="..."/>
  </svg>
  <span class="logo-text">BrandName</span>
</div>
```

```css
.logo { display: flex; align-items: center; gap: 1.5vw; }
.logo svg { width: 5vw; height: 5vw; }
.logo-text { font-size: 4vw; font-weight: 700; }
```

- **If using an image file for the logo**, always use both `max-width` and `max-height` together:

```css
.logo-img {
  max-width: 38vw;
  max-height: 12vh;
  width: auto;
  height: auto;
  object-fit: contain;
}
```

Never use `width: Xvw; height: auto` alone on a square logo — at `width: 38vw`, a square image is also 38vh tall and will overflow its container into content below. Logo images have built-in padding; the visible logo mark may only occupy 50-70% of the image dimensions. Size the image larger than you'd expect.

**Logos without transparent backgrounds:**

| Scenario | Strategy |
|---|---|
| Ad bg color matches logo bg exactly | Use that logo version — backgrounds blend seamlessly |
| White ad background | Use white-background logo + `mix-blend-mode: multiply` |

```css
/* White bg ad, white-background logo */
.logo-img { mix-blend-mode: multiply; }
```

#### Styling rules — no exceptions

- **Viewport-relative sizing.** All ad HTML must use `100vw`/`100vh` for the container and `vw`-based font sizes/padding. Never fixed pixel dimensions for the ad container. The ad must fill whatever iframe it's placed in without clipping or scrollbars.
- **Image-first layout.** The generated hero image fills the entire frame (`position: absolute; inset: 0; object-fit: cover`). Text is overlaid on the image using a bottom gradient (`linear-gradient(transparent, rgba(0,0,0,0.8))`). No separate text panels, no side-by-side layouts, no colored backgrounds behind text. The image IS the ad.
- **Bold, massive typography.** Headlines should be huge — 8-12vw for square, 8-20vw for portrait. Font weight 900 (black). Use `text-shadow` for readability against busy backgrounds. Headlines should feel like they *belong* on the image, not pasted on top.
- **Minimal text.** Brand name, one headline, one short subtext line max. Move everything else to the platform's text fields. If you can remove a word, remove it.
- **No decorative gradients in direct-response ads.** Use flat, solid colors for any non-image elements. Exception: the bottom readability gradient over the hero image is always allowed. Awareness/launch ads may use dramatic lighting, glows, and atmospheric gradients when they serve the visual metaphor.
- **Match the concept.** If the user said "minimalist," don't add decorative elements. If they said "bold and energetic," don't make it muted. Re-read the user's stated preferences before delegating.
- **Consistency across angles.** All angles should feel like they're from the same brand — same fonts, same color usage patterns, same visual language. The angles differ in message and hero image, not in design system. For awareness carousels: consistency means same text layout and logo placement, but each card can inhabit a completely different visual world (different photography, different color temperature, different mood).
- **Landing page = real page.** The mock landing page should look like where the ad actually leads — hero section echoing the ad's message, value props, testimonials/social proof section, and a CTA. Not a wireframe, not a placeholder.

#### Export

The user can screenshot each iframe directly, or open the HTML files in a browser at the desired export size. Since the ads use `vw`/`vh` sizing, they'll adapt to any viewport. For batch export at specific dimensions: `npx playwright screenshot angle1-ad.html --viewport-size=1080,1080`.
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

## Iterating from Performance Data

When the user provides performance data:

<<<<<<< HEAD
1. **Analyze winners**: Identify winning themes, structures, word patterns, and character utilization in top performers (by CTR, conversion rate, or ROAS).
2. **Analyze losers**: Identify themes that fall flat and common patterns in underperformers.

3. **Generate new variations**: Double down on winning themes, extend winning angles, test 1-2 new unexplored angles, avoid patterns from underperformers.
4. **Document the iteration**: Track what was learned, what's being tested, and what angles were retired.

Present the analysis to the user before building new ads:

```text

## Performance Analysis

### Winners (keep and extend)

- Pain point angles performing 2.3x above average CTR
- Headlines with specific numbers ("75% faster") outperform vague claims

### Losers (retire)

- Curiosity angles underperforming — audience is solution-aware, not problem-aware
- Long headlines (over 25 chars) getting truncated on mobile

### New Test Plan

- 2 new pain point variations (doubling down on winner)
- 1 social proof angle (untested category)

- Retire all curiosity angles

```

## Research Before Writing

Use web search to find examples of top-performing ads in the user's vertical. Search for ad breakdowns, swipe files, and case studies — e.g. `[industry] top performing Facebook ads 2026`or`[industry] TikTok ad examples`. Reverse-engineer: what hook, what angle, what visual pattern. Don't guess what works — look it up.

## Common Mistakes

### Content overload (most common)

- Adding icons, stats rows, feature grids, or badges — these violate the under-20-word rule. Each ad should have exactly 4 elements: Logo, Hero, Benefit, CTA.
- Using gradients instead of flat solid colors (except awareness/launch hero images)

- Centering all content instead of left-aligning (left-aligned text feels more intentional and professional)

#### Logo issues

- Using plain text instead of the brand's actual logo — always extract the real SVG from the brand's website first
- Truncated SVG path data — always verify path length and max coordinates after extraction

- Not checking that the SVG viewBox contains the full logo (max X/Y must be within viewBox bounds)

##### Brand identity

- Trusting web search for brand colors — always extract actual hex values from the site's CSS
- Using generic fonts (e.g., Inter) instead of the brand's actual typeface

- Not loading fonts via Google Fonts link in the HTML head — relying on system fonts

###### Technical

- width Xvw with height auto alone on square logo images (overflows container)
- Forgetting chmod 644 on assets copied from attached_assets (server can't read them)

- Not incrementing ?v=N on iframe URLs after editing HTML files
- Placing ad files in the wrong directory (use artifacts/mockup-sandbox/public/ads/, not client/public/ads/)

###### Copy

- RSA headlines that only work in sequence (Google mixes them — each must stand alone)
- Writing for the 125-char feed limit when Reels only shows 72

- All angles being the same message reworded (vary the psychology, not the synonyms)
- Text in the bottom 35% of a 9:16 ad (covered by platform UI)

- Letting Performance Max auto-generate video — always supply your own

###### Subagent delegation

- Not including the full HTML structure template in the subagent task — subagents will invent their own layout
- Not repeating the golden rules in each subagent task — they don't inherit context from the main agent

- Not specifying font loading instructions — subagents will use system fonts
- Not providing the exact brand colors and logo SVG — subagents will guess
=======
1. **Analyze winners**: Identify winning themes, structures, word patterns, and character utilization in top performers (by CTR, conversion rate, or ROAS)
2. **Analyze losers**: Identify themes that fall flat and common patterns in underperformers
3. **Generate new variations**: Double down on winning themes, extend winning angles, test 1-2 new unexplored angles, avoid patterns from underperformers
4. **Document the iteration**: Track what was learned, what's being tested, and what angles were retired

## Research Before Writing

Use `webSearch` to find examples of top-performing ads in the user's vertical. Search for ad breakdowns, swipe files, and case studies — e.g. `webSearch("[industry] top performing Facebook ads 2026")` or `webSearch("[industry] TikTok ad examples")`. The TikTok Creative Center and Meta Ad Library are useful reference sites but require direct browser interaction to filter; web search can surface articles and analyses that reference their data. Reverse-engineer: what hook, what angle, what visual pattern. Don't guess what works — look it up.

## Common Mistakes

- Writing RSA headlines that only work in sequence (Google combines them randomly — each must stand alone)
- Ignoring the Reels 72-char visible limit (writing for the 125-char feed limit → truncated on Reels)
- All variations = same angle reworded (vary the *psychology*, not the synonyms)
- Placing text in the bottom 35% of a 9:16 ad (covered by UI on every platform)
- Retiring creative before 1,000+ impressions per variant
- Letting Performance Max auto-generate video — always supply your own
- Putting a CTA button on awareness/launch ads (these should create intrigue and brand recall, not push for immediate clicks — the CTA belongs in the post text)
- Using the same visual treatment for every card in a carousel (each card should be a different visual world; if they all look the same, there's no reward for swiping)
- Showing literal product screenshots in a launch teaser (before launch, use visual metaphors that communicate the brand feeling — save product shots for post-launch conversion campaigns)
- Defaulting to direct-response design when the goal is awareness (a launch announcement needs mood and mystique, not a "Sign up now" button)
- Building ads with CSS-only backgrounds instead of generated images (the image IS the ad — always generate photorealistic hero imagery unless explicitly told not to)
- Placing text in a separate panel next to the image (text goes ON TOP of the image with a gradient, not beside it)
- Using abstract digital art or generic "tech" imagery (go editorial: real objects, dramatic lighting, tangible subjects)
- Using generic fonts (e.g., Inter) instead of the brand's actual typeface (always research the brand's typography before building)
- `width: Xvw; height: auto` alone on square logo images (overflows container — always set both `max-width` and `max-height`)
- Forgetting `chmod 644` on assets copied from `attached_assets/` (server can't read them)
- Not incrementing `?v=N` on iframe URLs after editing HTML files (canvas caches aggressively)
- Placing ad files in the wrong directory (use `artifacts/mockup-sandbox/public/ads/`, not `client/public/ads/`)
- Forgetting to prompt the user for their real logo at the end

## Post-Build: Logo Prompt

After delivering the ad creatives, **always check whether the user has provided their actual logo**. If they haven't (i.e., you used a placeholder SVG or described the logo in code), end your response with a plain-text note like:

> "If you'd like to swap in your real logo, just upload or attach it and I'll drop it into all the ads."

This is a simple text reminder — not a tool call, not a modal, just a natural closing line. Skip this if the user already provided their logo file.

## Limitations

- Cannot run or measure ad campaigns
- Cannot access ad platform analytics
- Cannot create animated or video ads
- Image generation requires the media-generation skill
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7
