---
name: deep-research
<<<<<<< HEAD
description: Conduct thorough, multi-source research with structured reports and source scoring.
=======
description: Conduct thorough, multi-source research on complex topics with structured findings and citations.
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7
---

# Deep Research

<<<<<<< HEAD
Conduct comprehensive, multi-source research on complex topics. Systematically gather, evaluate, triangulate, and synthesize information into structured reports with proper citations and source credibility scoring.

**Autonomy Principle:** Operate independently. Infer assumptions from context (technical query = technical audience, comparison = balanced perspective, trend = recent 1-2 years). Only stop for critical errors or incomprehensible queries.

## When to Use

Activate this skill when the user's request matches any of these patterns:

### Explicit research requests

- "Research this," "find out about," "do a deep dive on"
- "Write a research report on..."

- "White paper on..." / "Briefing on..."
- "Investigate [topic]"

#### Industry & market analysis

- "What's the state of [industry/market]?"
- "Survey the landscape of..."

- "Competitive landscape of [industry]" (no stock tickers involved)
- "Trend analysis on [topic]"

- "How does [country/region] compare for [business activity]?"

##### Decision-support research

- "Due diligence on [private company/market]" (non-public companies)
- "What should I know before [entering a market / making a decision]?"

- "Pros and cons of [strategy/approach/technology]"
- "What are the risks of [strategy/market/decision]?"

- "Benchmark [X] against [industry/peers]" (non-financial benchmarking)

###### Verification & evidence-based analysis

- "Fact-check this" / "Is [claim] true?"
- "What does the research say about..."

- Needs to verify claims or compare conflicting information
- Wants to understand a topic from multiple angles with cited sources

###### Academic & technical evaluation

- Literature review, technology evaluation, state-of-the-art survey

## When NOT to Use

- Simple factual lookups (1-2 searches) --> use web-search directly
- Searching within the user's codebase --> use grep/glob

- Replit-specific features --> use replit-docs skill
- Specific stock tickers, public company financials, DCF models, portfolio analysis --> use stock-analyzer (it calls deep-research internally for web research)

- "Analyze this dataset" with user-provided data --> use data-visualization
- "Build a presentation on..." --> use slides skill

## Decision Tree

```text

Request Analysis

+-- Simple factual lookup (1-2 searches)? --> STOP: Use web-search directly

+-- Searching user's codebase? --> STOP: Use grep/glob

+-- Replit-specific feature question? --> STOP: Use replit-docs skill

+-- Mentions stock tickers or public company --> STOP: Use stock-analyzer

financials/valuations/DCF? (it calls deep-research internally)

+-- Wants to analyze a user-provided dataset? --> STOP: Use data-visualization

+-- Complex multi-angle analysis needed? --> CONTINUE to Depth Selection

```

## Depth Selection

Select the research depth based on the request complexity. Default to **standard** when unclear.

| Tier | Subagents | Min Sources | Phases | Estimated Time | When to Use |

|---|---|---|---|---|---|

| **Quick** | 3 | 8 | 1, 2, 3, 7 | 2-5 min | Focused question, single domain, time-sensitive |

| **Standard** | 5 | 15 | 1-7 | 5-15 min | Most research requests, market analysis, technology evaluation |

| **Deep** | 5 + 2 gap-fill | 25 | 1-8 (all) | 15-30 min | Critical decisions, comprehensive reviews, multi-stakeholder analysis |

### Selection heuristics

- User says "quick overview" or "brief research" --> Quick
- User says "research this" or "analyze" --> Standard

- User says "deep dive," "comprehensive," or "exhaustive" --> Deep
- Country/industry analysis, investment research --> Standard or Deep

- Technology comparison with 3+ options --> Standard
- Literature review, state-of-the-art survey --> Deep
=======
Conduct comprehensive, multi-source research on complex topics. Systematically gather, evaluate, and synthesize information into structured reports with proper citations.

## When to Use

- User needs thorough research on a complex topic
- User asks "research this," "find out about," or "do a deep dive on"
- User needs a literature review, market analysis, or technology evaluation
- User wants to understand a topic from multiple angles with cited sources
- User needs to verify claims or compare conflicting information

## When NOT to Use

- Simple factual lookups (just use web-search directly)
- Searching within the user's own codebase (use grep/glob)
- Looking up Replit-specific features (use replit-docs skill)
- Product recommendations without research depth (use a more specific skill)

## Research Architecture

This skill follows a tree-like exploration pattern inspired by leading open-source research tools:

- **GPT Researcher** (github.com/assafelovic/gpt-researcher, ~17k stars) -- uses "plan and execute" with parallel sub-question research
- **STORM** (github.com/stanford-oval/storm, ~18k stars) -- Stanford's perspective-guided research that simulates multiple expert viewpoints
- **open_deep_research** (github.com/langchain-ai/open_deep_research) -- LangChain's iterative search-and-synthesize approach

The core pattern: decompose the question -> search broadly -> read deeply -> identify gaps -> refine queries -> synthesize with citations.
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

## Methodology

### Phase 1: Scope Definition

Before starting research, clearly define:

- **Research question**: What specific question(s) are you answering?
- **Scope boundaries**: What is in/out of scope?
<<<<<<< HEAD

- **Depth tier**: Quick, Standard, or Deep (see table above)
- **Audience**: Technical, executive, general? (Infer from context if not stated)

- **Output expectations**: Report format, approximate length

Then run **1-2 broad landscape searches** to orient yourself and identify the focus areas for decomposition.

### Phase 2: Planning & Decomposition

Decompose the topic into distinct, non-overlapping focus areas based on the depth tier:

- **Quick**: 3 focus areas
- **Standard**: 5 focus areas

- **Deep**: 5 focus areas (gap-fill subagents added later in Phase 5)

**How to decompose:** After the broad landscape search, identify angles that together cover the full topic without significant overlap. For example, researching "state of electric vehicles 2026" might decompose into:

1. **Market & Competition** -- market share, sales figures, manufacturer rankings
2. **Technology** -- battery chemistry, charging standards, range improvements

3. **Policy & Regulation** -- government incentives, emissions mandates, trade tariffs
4. **Infrastructure** -- charging network growth, grid capacity, urban vs rural

5. **Consumer & Economics** -- total cost of ownership, resale value, adoption demographics

### Phase 3: Parallel Source Discovery via Subagents

Launch all research subagents simultaneously using `startAsyncSubagent`. Each subagent gets a specific focus area, tailored search terms, and a structured output template.

#### Subagent task template

```javascript

await startAsyncSubagent({

task: `Research FOCUS AREA: [Area Name]

Topic context: [1-2 sentence description of the overall research question]

Your job: Search for information specifically about [focus area]. Run at least 4 webSearch queries with different angles:

- [specific search term 1]
- [specific search term 2]

- [specific search term 3]
- [specific search term 4]

IMPORTANT - Local language searches: If this topic is specific to a non-English-speaking country or region, run at least 1-2 searches in the local language (e.g., Spanish for Latin America, Portuguese for Brazil, French for Francophone Africa). Primary government data, local media, and industry reports are often only available in the local language.

IMPORTANT - Source freshness: Note the publication date of every source. Flag any source older than 18 months on a fast-moving topic.

For the most promising results, use webFetch to read the full article. If webFetch returns empty content, try an alternative URL from the search results or run a more specific search query.

Return your findings using this EXACT structure:

## Key Facts

[Bullet list of key data points, each with source URL in parentheses]

## Notable Claims Requiring Cross-Reference

[Claims that seem important but only appear in one source, or that conflict with other findings]

## Source Quality Assessment

[For each source, rate: Tier 1 (government/multilateral/academic), Tier 2 (major publication/industry report), Tier 3 (blog/opinion/promotional). Note publication date.]

## Gaps & Unanswered Questions

[What you could not find or what needs deeper investigation]

## Sources

[Numbered list with title, URL, publication date (if available), and tier rating]

Minimum: 5 distinct sources with URLs`

});

```

##### Launch pattern

```javascript

// Launch all subagents simultaneously

await startAsyncSubagent({ task: `Research FOCUS AREA 1: [Area] ...` });

await startAsyncSubagent({ task: `Research FOCUS AREA 2: [Area] ...` });

await startAsyncSubagent({ task: `Research FOCUS AREA 3: [Area] ...` });

// ... (3 for Quick, 5 for Standard/Deep)

// Wait for all subagents to complete

const results = await waitForBackgroundTasks();

=======
- **Depth level**: Overview, moderate analysis, or exhaustive deep-dive?
- **Output expectations**: Report format, length, audience

### Phase 2: Parallel Source Discovery via Subagents

Decompose the topic into **5 distinct focus areas**, then launch **5 research subagents in parallel** using `startAsyncSubagent`. Each subagent gets a specific focus area and set of search terms, searches independently, and returns its findings with citations.

**How to decompose:** After the broad landscape search in Phase 1, identify 5 non-overlapping angles. For example, researching "state of electric vehicles 2026" might decompose into:

1. **Market & Competition** — market share, sales figures, manufacturer rankings
2. **Technology** — battery chemistry, charging standards, range improvements
3. **Policy & Regulation** — government incentives, emissions mandates, trade tariffs
4. **Infrastructure** — charging network growth, grid capacity, urban vs rural
5. **Consumer & Economics** — total cost of ownership, resale value, adoption demographics

**Launch all 5 in parallel:**

```javascript
// Launch 5 research subagents simultaneously
await startAsyncSubagent({
    task: `Research FOCUS AREA 1: [Market & Competition]

Topic context: [brief description of the overall research question]

Your job: Search for information specifically about [focus area]. Run at least 3-4 webSearch queries with different angles:
- [specific search term 1]
- [specific search term 2]
- [specific search term 3]
- [specific search term 4]

For the most promising results, use webFetch to read the full article.

Return your findings as a structured summary with:
- Key facts and data points (with source URLs)
- Notable claims that need cross-referencing
- Gaps or unanswered questions
- At least 5 distinct sources with URLs`
});

// Repeat for focus areas 2-5 with their own tailored search terms
await startAsyncSubagent({ task: `Research FOCUS AREA 2: [Technology] ...` });
await startAsyncSubagent({ task: `Research FOCUS AREA 3: [Policy & Regulation] ...` });
await startAsyncSubagent({ task: `Research FOCUS AREA 4: [Infrastructure] ...` });
await startAsyncSubagent({ task: `Research FOCUS AREA 5: [Consumer & Economics] ...` });

// Wait for all subagents to complete
const results = await waitForBackgroundTasks();
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7
```

Each subagent should:

<<<<<<< HEAD
- Run 4+ `webSearch` queries with different phrasings and angles
- Include at least 1-2 local-language searches for country/region-specific topics

- Use `webFetch` on the 2-3 most relevant results to extract detailed data
- Retry with alternative URLs if webFetch returns empty content

- Return findings using the structured template above
- Flag any claims that conflict with other results

- Note publication dates and assess source freshness

This approach gathers **25+ distinct sources** across focus areas simultaneously, producing far more comprehensive coverage than sequential searching.

### Phase 4: Triangulation & Source Evaluation

After collecting all subagent results, systematically evaluate and cross-reference:

#### Source credibility tiers

| Tier | Description | Examples | Weight |

|---|---|---|---|

| **Tier 1** | Government, multilateral, academic, official statistics | IMF, World Bank, central banks, peer-reviewed journals, SEC filings | Highest -- treat as ground truth unless contradicted by multiple Tier 1 sources |

| **Tier 2** | Major publications, established industry reports, reputable news | Reuters, Bloomberg, Chambers & Partners, LAVCA, Big 4 reports | High -- reliable but verify key claims |

| **Tier 3** | Industry blogs, company websites, opinion pieces, promotional content | Company press releases, consultant blogs, sponsored content | Supporting only -- never use as sole source for a claim |

##### Triangulation rules

- Every major claim must be supported by **3+ sources** (at least 2 Tier 1 or Tier 2)
- When sources conflict on a data point, prefer: Tier 1 > Tier 2 > Tier 3, and more recent > older

- When Tier 1 sources conflict with each other, present both figures and note the discrepancy
- Flag any finding that rests on a single source, regardless of tier

- Note the publication date of key data points; flag anything older than 18 months on fast-moving topics

###### Conflict resolution for quantitative data

When multiple sources report different numbers (e.g., GDP figures, market sizes):

1. Prefer the primary/official source (e.g., central bank over news article)
2. If both are primary sources, present the range and note the methodology difference

3. Never silently pick one number -- acknowledge the variance

### Phase 5: Gap Analysis & Follow-Up (Standard and Deep tiers only)

Review the collected findings for completeness:

- Identify claims with fewer than 3 supporting sources
- Identify sections with thin coverage or missing data

- Note unanswered questions flagged by subagents
- Check whether any focus area returned significantly fewer sources than others

**For Deep tier only:** Launch 1-2 targeted follow-up subagents to fill the most critical gaps:

```javascript

await startAsyncSubagent({

task: `GAP-FILL RESEARCH: [Specific gap identified]

Context: During initial research on [topic], we found insufficient data on [gap].

Your job: Run 3-4 targeted searches to fill this specific gap:

- [targeted search term 1]
- [targeted search term 2]

- [targeted search term 3]

Return findings using the same structured template as the initial research.`

});

```

### Phase 6: Critique & Self-Review (Deep tier only)

Before writing the final report, conduct a critical self-review:

- **Weak claims:** Are any findings supported by only Tier 3 sources? Downgrade or remove them.
- **Balance:** Does the report present multiple perspectives, or does it lean toward one viewpoint?

- **Logical coherence:** Do the findings tell a consistent story? Are there contradictions that need to be addressed?
- **Completeness:** Does the report answer the original research question fully?

- **Freshness:** Are key data points current, or are they based on outdated sources?
- **Speculation vs. fact:** Is every claim clearly labeled as established fact, expert opinion, or speculation?

### Phase 7: Report Writing & Synthesis

Write the report following these principles:

#### Writing style

- **Prose-first (80%+ prose).** Write in flowing paragraphs, not bullet-point dumps. Bullets are acceptable for data tables, source lists, and comparison matrices -- but the analysis itself should be narrative.
- Lead with the most important findings

- Support every factual claim with an inline citation [N] referencing the numbered source list
- Acknowledge limitations and uncertainties explicitly

- Distinguish clearly between established facts, expert opinions, and speculation
- Provide actionable recommendations where appropriate

##### Section word count guidance

| Section | Target Length |

|---|---|

| Executive Summary | 200-400 words |

| Background/Context | 200-500 words |

| Each Major Finding | 400-1,500 words |

| Analysis/Synthesis | 500-1,000 words |

| Limitations | 100-300 words |

| Recommendations | 200-500 words |

###### Quality gates (must pass before delivering)

| Gate | Requirement |

|---|---|

| Source count | Quick: 8+, Standard: 15+, Deep: 25+ |

| Claims per finding | 3+ sources supporting each major claim |

| Citation coverage | Every factual claim has an inline [N] citation |

| No placeholders | Zero "TBD," "to be determined," or "[need source]" entries |

| Source list complete | Every [N] citation maps to a numbered source with URL |

| Freshness | Key data points are from the last 18 months (flagged if older) |

| Prose ratio | 80%+ of analysis sections are prose, not bullets |

=======
- Run 3-4 `webSearch` queries with different phrasings and angles
- Use `webFetch` on the 2-3 most relevant results to extract detailed data
- Return structured findings with source URLs
- Flag any claims that conflict with other results

This approach gathers **25+ distinct sources** across 5 focus areas simultaneously, producing far more comprehensive coverage than sequential searching.

After collecting all subagent results, proceed to Phase 3 to evaluate and cross-reference.

### Phase 3: Source Evaluation

Assess each source for credibility:

- **Authority**: Who published it? What are their credentials?
- **Currency**: When was it published? Is the information still current?
- **Objectivity**: Is there obvious bias? Is it sponsored content?
- **Accuracy**: Can claims be cross-referenced with other sources?
- **Coverage**: Does it cover the topic in sufficient depth?

Use webFetch to read full articles from the most promising search results.

### Phase 4: Information Synthesis

Organize findings thematically (what separates deep research from simple search):

- Group related findings across sources
- Identify areas of consensus and disagreement
- Note gaps in available information -- conduct follow-up searches to fill them
- Cross-reference critical claims across at least 2-3 independent sources
- Build a narrative that answers the research question
- Distinguish between established facts, expert opinions, and speculation
- Draw connections between sources that reveal patterns not visible in any single source

### Phase 5: Report Writing

Structure the final report clearly:

- Lead with the most important findings
- Support claims with specific sources
- Acknowledge limitations and uncertainties
- Provide actionable recommendations where appropriate

>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7
## Output Format

### Research Report Structure

```text

# [Research Topic]

<<<<<<< HEAD
**Research Date:** [Date]

**Depth:** [Quick / Standard / Deep]

**Sources Consulted:** [Number]

## Executive Summary

[2-3 paragraph overview of key findings and conclusions. 200-400 words.]

## Background

[Context needed to understand the topic. 200-500 words.]
=======
## Executive Summary
[2-3 paragraph overview of key findings and conclusions]

## Background
[Context needed to understand the topic]
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

## Key Findings

### Finding 1: [Theme]
<<<<<<< HEAD

[Detailed prose analysis with inline source citations [N]. 400-1,500 words.]

### Finding 2: [Theme]

[Detailed prose analysis with inline source citations [N]. 400-1,500 words.]

### Finding 3: [Theme]

[Detailed prose analysis with inline source citations [N]. 400-1,500 words.]

[Additional findings as needed -- typically 4-8 for Standard/Deep]

## Analysis

[Cross-cutting analysis, patterns, implications. Draw connections between

findings that reveal insights not visible in any single section. 500-1,000 words.]

## Limitations

[What couldn't be determined, data gaps, source constraints, caveats. 100-300 words.]

## Recommendations

[Actionable next steps based on findings. 200-500 words.]

## Sources

[Numbered list of all sources with: title, URL, publication date, tier rating]

1. [Title] -- [URL] (Published: [date], Tier [1/2/3])
2. ...

```

## Example Workflow

```javascript

// Phase 1: Scope -- broad landscape search

const overview = await webSearch({ query: "state of electric vehicle market 2026" });

// Determine depth tier (Standard for this example)

// Identify 5 focus areas from overview results

// Phase 3: Launch 5 parallel research subagents

await startAsyncSubagent({

task: `Research FOCUS AREA 1: EV Market & Competition

Topic context: Comprehensive analysis of the global electric vehicle industry in 2026.

Your job: Search for information specifically about EV market share, sales figures, and manufacturer rankings. Run at least 4 webSearch queries:

- "EV market share by manufacturer 2025 2026"
- "electric vehicle sales global rankings"

- "Tesla BYD market share comparison 2026"
- "electric vehicle market size revenue 2026"

For country-specific angles, also search in relevant local languages.

If webFetch returns empty content, try alternative URLs.

Return findings using the structured template with Key Facts, Notable Claims, Source Quality Assessment, Gaps, and Sources.`

});

await startAsyncSubagent({ task: `Research FOCUS AREA 2: EV Battery Technology ...` });

await startAsyncSubagent({ task: `Research FOCUS AREA 3: EV Policy & Regulation ...` });

await startAsyncSubagent({ task: `Research FOCUS AREA 4: EV Charging Infrastructure ...` });

await startAsyncSubagent({ task: `Research FOCUS AREA 5: EV Consumer Economics ...` });

// Wait for all subagents

const results = await waitForBackgroundTasks();

// Phase 4: Triangulate -- evaluate sources, resolve conflicts, score credibility

// Phase 5: Gap analysis -- identify weak spots, launch follow-up if Deep tier

// Phase 6: Critique -- self-review for Deep tier

// Phase 7: Write the report following quality gates and prose-first style

// Save to research/[topic].md and present to user
=======
[Detailed analysis with source citations]

### Finding 2: [Theme]
[Detailed analysis with source citations]

### Finding 3: [Theme]
[Detailed analysis with source citations]

## Analysis
[Cross-cutting analysis, patterns, implications]

## Limitations
[What couldn't be determined, data gaps, caveats]

## Recommendations
[Actionable next steps based on findings]

## Sources
[Numbered list of all sources with URLs]
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

```

## Best Practices

1. **Cast a wide net first, then narrow** -- start with broad searches before diving into specifics
<<<<<<< HEAD
2. **Cross-reference critical claims** -- never rely on a single source for important facts; require 3+ sources for major claims

3. **Cite everything inline** -- every factual claim should have a [N] citation immediately following it
4. **Note disagreements** -- when sources conflict, present both sides and analyze why

5. **Timestamp your research** -- note when the research was conducted, as information changes
6. **Separate facts from analysis** -- clearly distinguish between what sources say and your interpretation

7. **Search in local languages** -- for country/region-specific research, primary sources are often only in the local language
8. **Handle fetch failures gracefully** -- if webFetch returns empty content, try alternative URLs or run more targeted search queries

9. **Prefer authoritative sources** -- when numbers conflict, prefer Tier 1 (government/multilateral) over Tier 2 (publications) over Tier 3 (blogs/promotional)
10. **Flag stale data** -- note when key data points are older than 18 months on fast-moving topics
=======
2. **Cross-reference critical claims** -- never rely on a single source for important facts
3. **Cite everything** -- every factual claim should trace back to a source
4. **Note disagreements** -- when sources conflict, present both sides and analyze why
5. **Timestamp your research** -- note when the research was conducted, as information changes
6. **Separate facts from analysis** -- clearly distinguish between what sources say and your interpretation

## Example Workflow

```javascript
// Phase 1: Broad landscape search to identify focus areas
const overview = await webSearch({ query: "state of electric vehicle market 2026" });

// Phase 2: Launch 5 parallel research subagents
await startAsyncSubagent({
    task: `Research EV Market & Competition: search for "EV market share by manufacturer 2025 2026",
    "electric vehicle sales global rankings", "Tesla BYD market share comparison".
    Use webFetch on best results. Return findings with source URLs.`
});
await startAsyncSubagent({
    task: `Research EV Battery Technology: search for "solid state battery progress 2026",
    "EV battery cost per kwh trend", "lithium iron phosphate vs NMC comparison".
    Use webFetch on best results. Return findings with source URLs.`
});
await startAsyncSubagent({
    task: `Research EV Policy & Regulation: search for "EV tax credit policy 2026",
    "emissions regulations electric vehicles", "EV tariffs trade policy".
    Use webFetch on best results. Return findings with source URLs.`
});
await startAsyncSubagent({
    task: `Research EV Charging Infrastructure: search for "EV charging network growth statistics",
    "NACS vs CCS charging standard adoption", "fast charging stations by country".
    Use webFetch on best results. Return findings with source URLs.`
});
await startAsyncSubagent({
    task: `Research EV Consumer Economics: search for "EV total cost of ownership vs gas 2026",
    "electric vehicle resale value trends", "EV adoption demographics income".
    Use webFetch on best results. Return findings with source URLs.`
});

// Collect all results
const results = await waitForBackgroundTasks();

// Phase 3-5: Evaluate sources, cross-reference claims, synthesize into structured report
// Write comprehensive report with all findings and citations from all 5 subagents

```
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7

## Limitations

- Cannot access paywalled academic journals or subscription databases
- Cannot access social media content (LinkedIn, Twitter, Reddit)
<<<<<<< HEAD

- Web sources may have varying levels of reliability
- Research is a snapshot in time -- findings may change

- Cannot conduct primary research (surveys, interviews, experiments)
- webFetch may fail on some pages (JavaScript-heavy sites, paywalled content); mitigate with retry and alternative URLs
=======
- Web sources may have varying levels of reliability
- Research is a snapshot in time -- findings may change
- Cannot conduct primary research (surveys, interviews, experiments)
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7
