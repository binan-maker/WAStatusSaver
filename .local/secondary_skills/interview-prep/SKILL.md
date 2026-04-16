---
name: interview-prep
<<<<<<< HEAD
description: Build mock interview simulators with voice, case interviews, behavioral prep, and scorecards.
---

# Interview Prep Simulator

Instructions for building and improving AI-powered mock interview simulators that adapt dynamically to any company, role, industry, and market based on user input.

## Core Principle: Dynamic Adaptation

The simulator must NEVER be hardcoded to a specific company or market. Instead:

1. The user provides their **target company**, **role/position**, and **location/market** during the pre-interview setup
2. The AI interviewer uses this context to dynamically research and adapt: pulling in relevant company facts, industry dynamics, regional economic context, and role-specific technical questions

3. The system prompt instructs the AI to act as an informed interviewer at that specific company and tailor all questions, scenarios, and feedback accordingly

This means a single simulator can prep someone for a PE Principal role at Goldman Sachs in New York, a consulting Associate at McKinsey in London, or a VP of Finance at a regional bank in Santo Domingo — all driven by what the user enters.

## Pre-Interview Setup Screen

Before starting any interview, show a setup screen collecting:

### Required Inputs

1. **Company Name** — Text input with placeholder (e.g., "Goldman Sachs", "Banco Popular Dominicano")
2. **Role / Position** — Text input (e.g., "Private Equity Principal", "Senior Consultant", "VP of Finance")

3. **Interview Type Selector** — Card-based selection:

- **Structured Interview** (icon: Briefcase) — Behavioral + technical + firm knowledge, 8–10 questions
- **Consulting Case Interview** (icon: BarChart3) — Business case scenarios with quantitative analysis

- **Behavioral Only** (icon: MessageSquare) — Focused STAR-method practice, 8–10 behavioral questions

Each card shows title, brief description, estimated duration, and question count

1. **Language Selector** — Dropdown or pill-toggle:

- English (default), Spanish, French, Portuguese, German, Mandarin, Japanese, Arabic, Hindi
- Show language name in both English and native script (e.g., "Spanish — Español")

- Any language the AI model supports should be available

### Optional Inputs

1. **Industry** — Dropdown: Finance/Banking, Consulting, Technology, Healthcare, Energy, Real Estate, Other (with text input)
2. **Difficulty Level**:

- Standard: Constructive feedback, moderate follow-ups
- Challenging: Aggressive follow-ups, stress-test answers, shorter patience for vague responses

1. **Focus Areas** (checkboxes, structured interview only):

- Behavioral/STAR, Technical, Deal/Project Experience, Firm & Market Knowledge, Culture Fit

1. **Additional Context** — Optional textarea for the user to paste a job description, specific topics to focus on, or personal background the AI should consider
2. **"Begin Interview" CTA** — Prominent button at the bottom; disabled until company + role + type are filled

## Supported Interview Types

### 1. Structured Interview (Default)

Adapts question categories to the role and industry:

#### For finance/PE/banking roles

- Behavioral / STAR (2–3 questions)
- Technical (LBO, valuation, capital structure, accounting) (2–3 questions)

- Deal / Transaction Experience (1–2 questions)
- Firm & Market Knowledge (1–2 questions)

- Culture Fit (1 question)

##### For consulting roles

- Behavioral / STAR (2–3 questions)
- Problem Solving / Frameworks (2–3 questions)

- Client Experience / Engagement Stories (1–2 questions)
- Firm & Market Knowledge (1–2 questions)

- Culture Fit (1 question)

###### For technology roles

- Behavioral / STAR (2–3 questions)
- System Design / Architecture (2–3 questions)

- Past Projects / Technical Impact (1–2 questions)
- Company & Product Knowledge (1–2 questions)

- Culture Fit (1 question)

###### For general / other roles

- Behavioral / STAR (2–3 questions)
- Role-Specific Technical (2–3 questions)

- Experience & Accomplishments (1–2 questions)
- Company Knowledge (1–2 questions)

- Culture Fit (1 question)

### 2. Consulting Case Interview

Business-case-style interviews with quantitative and qualitative analysis:

- **Market Sizing**: Top-down / bottom-up estimation relevant to the target company's industry
- **Profitability Analysis**: Revenue/cost decomposition, margin drivers

- **Market Entry**: Go/no-go framework, competitive landscape, regulatory considerations
- **M&A / Due Diligence**: Synergy analysis, integration risk, valuation

- **Operations Optimization**: Process improvement, capacity planning, cost reduction

The AI selects a case scenario relevant to the target company and industry. For example:

- Banking company → "Should [Company] enter the digital payments market in [Region]?"
- Tech company → "A client's SaaS platform is losing enterprise customers — diagnose and recommend"

- Healthcare → "Evaluate the acquisition of a regional hospital chain"

Case flow: Scenario presentation → Clarifying questions → Framework building → Quantitative analysis → Recommendation → Evaluation

### 3. Behavioral-Only Interview

Focused STAR storytelling practice:

- 8–10 behavioral questions across: leadership, teamwork, failure/resilience, initiative, conflict resolution, influence without authority, ambiguity, time pressure
- Strict STAR-method feedback after every answer

- Scoring on: specificity, quantification, personal ownership ("I" vs "we"), structure, and relevance to the target role

## Multi-Language Support

### Implementation Rules

- Present the language selector on the setup screen before starting the session
- The system prompt must include an explicit language instruction at the TOP: `"Conduct this entire interview in [language_name]. All questions, feedback, and the final scorecard must be in [language_name]."`

- The UI chrome (buttons, labels, sidebar) remains in English unless the user explicitly requests full localization
- The AI should use professional, business-appropriate register in the selected language — not casual or overly academic

- For non-English interviews, the AI should still understand if the candidate mixes in English technical terms (e.g., "LBO", "IRR", "EBITDA") without penalizing them

## System Prompt Architecture

### Dynamic System Prompt Construction

Build the system prompt dynamically from the user's setup selections. The frontend constructs the full prompt and passes it to the backend via the `systemPrompt` field on conversation creation.

### System Prompt Template

```text

[LANGUAGE INSTRUCTION — if non-English]

You are a senior interviewer at {company_name} conducting a {interview_type} interview for the {role_name} position.

COMPANY CONTEXT:

Research and incorporate what you know about {company_name}:

- Industry position, key products/services, competitive advantages
- Recent news, strategic initiatives, financial performance

- Market/region: {location_context}
- Company culture, values, and what they look for in candidates

Use this knowledge to make questions specific and relevant. If the candidate mentions something about the company, validate or challenge their knowledge.

{INTERVIEW TYPE SPECIFIC INSTRUCTIONS}

INTERVIEW GUIDELINES:

- Ask ONE question at a time
- After each answer, provide brief constructive feedback (3–5 sentences max):

* For behavioral: STAR structure quality, specificity, quantification, ownership ("I" vs "we")

* For technical: accuracy, logical flow, assumptions stated

* For cases: framework quality, math accuracy, creativity, communication

- Rate each answer: Strong / Adequate / Needs Improvement
- Then ask the next question

- Be professional, direct, and constructive
- {difficulty_instruction}

FINAL SCORECARD:

After all questions are complete, provide a final scorecard with:

- Overall rating (Strong Hire / Hire / Lean Hire / No Hire)
- Category-by-category scores

- Top 3 strengths observed
- Top 3 areas for improvement

- Specific recommendations for interview day at {company_name}

Start by briefly introducing yourself as the interviewer at {company_name}, explaining the interview format, and asking the first question.

```

### Difficulty Instructions

- **Standard**: `"Be supportive and constructive. Give the candidate time to think. Provide helpful feedback."`
- **Challenging**: `"Be demanding. Push back on vague answers. Ask pointed follow-ups. Challenge assumptions. Simulate a high-pressure interview environment."`

## Response Timer

Add a visible timer in the chat area:

- Starts counting when the AI finishes asking a question (streaming ends)
- Displays elapsed time next to the input area (e.g., "Response time: 1:32")

- Stops when the user submits their answer
- Records per-question response times for the final scorecard

- Visual cue: Green < 2 min, Yellow 2–4 min, Red > 4 min
- Timer helps candidates practice pacing — real interviews penalize overly long or short answers

## End-of-Session Scorecard

When the AI sends the final scorecard, detect it and render a special scorecard UI:

- Parse the scorecard from the AI's markdown response
- Display as a styled card with:

- Overall rating (color-coded: green for Strong Hire/Hire, yellow for Lean Hire, red for No Hire)
- Category-by-category scores in a visual grid

- Top 3 strengths (green checkmarks)
- Top 3 areas for improvement (amber indicators)

- Response time summary (average, fastest, slowest)
- Specific recommendations for interview day

## Interview Progress Sidebar

The right sidebar dynamically reflects the interview type and adapts labels to the role:

**Structured Interview stages** (adapt labels to role/industry):

- Finance: Behavioral → Technical/LBO → Deal Experience → Firm Knowledge → Culture Fit
- Consulting: Behavioral → Problem Solving → Client Experience → Firm Knowledge → Culture Fit

- Tech: Behavioral → System Design → Past Projects → Company Knowledge → Culture Fit
- General: Behavioral → Technical → Experience → Company Knowledge → Culture Fit

### Consulting Case stages

1. Scenario Presentation → 2. Clarifying Questions → 3. Framework → 4. Analysis → 5. Recommendation

#### Behavioral stages

1. Leadership → 2. Teamwork → 3. Conflict → 4. Initiative → 5. Failure/Growth

Each stage shows: number badge, label, active/complete/upcoming state, and a contextual tip for the current stage.

## Technical Architecture

### Backend (API Server)

- `POST /api/openai/conversations`accepts optional`systemPrompt`,`interviewType`, and`language` fields
- If `systemPrompt` is provided, use it instead of any default; otherwise fall back to a generic interview prompt

- The streaming endpoint (`POST /api/openai/conversations/:id/messages`) remains unchanged — reads all messages including system message from DB
- Model: use the latest available model; `max_completion_tokens: 8192`

### Frontend (React + Vite)

- Setup screen is the default view (no conversation ID yet)
- On "Begin Interview," construct the dynamic system prompt from user inputs, create conversation, then start streaming

- The system prompt message is hidden from the chat display — filter by `m.role === "system"` or content-matching
- Use `cn()`from`@/lib/utils` for all dynamic classNames — avoid template literals in JSX className props (known design-subagent bug pattern)

- SSE parsing: `fetch`+`ReadableStream`reader; split chunks on`\n`, parse`data: {...}` lines
- Use `react-markdown`+`remark-gfm` for rendering AI responses

### Styling

- Use a professional, corporate design system — clean typography, muted palette, subtle shadows
- Card-based setup screen with clear visual hierarchy

- Adapt accent colors if desired, but default to a neutral professional palette

## File Structure Reference

```text

artifacts/mock-interview/src/

├── pages/

│ └── Interview.tsx \# Main interview page (setup + chat)

├── components/

│ ├── Layout.tsx \# App shell with sidebar navigation

│ ├── SetupScreen.tsx \# Pre-interview setup form

│ ├── ChatArea.tsx \# Message list + input + timer

│ ├── ProgressSidebar.tsx \# Interview stage tracker

│ └── Scorecard.tsx \# Final scorecard renderer

├── lib/

│ ├── prompts.ts \# System prompt builder (takes setup inputs, returns prompt string)

│ └── utils.ts \# cn() and helpers

└── App.tsx

artifacts/api-server/src/routes/openai/index.ts \# Streaming endpoint

lib/api-spec/openapi.yaml \# API contract

lib/db/src/schema/index.ts \# DB schema

```

## Improvement Checklist

When improving the simulator, prioritize in this order:

1. [ ] Pre-interview setup screen (company, role, type, language inputs)
2. [ ] Dynamic system prompt builder from user inputs

3. [ ] Consulting case interview support
4. [ ] Behavioral-only interview mode

5. [ ] Response timer
6. [ ] End-of-session scorecard UI

7. [ ] Difficulty level selector
8. [ ] Focus area filtering (structured interview only)

9. [ ] Session history / past interview review
10. [ ] PDF export of scorecard and transcript
=======
description: Prepare for job interviews with tailored questions, STAR answers, and company research. Builds interactive web apps for practice.
---

# Job Interview Prep Kit

Prepare for interviews with company-specific research, behavioral story banks, technical frameworks, and salary negotiation scripts. Always delivers as an interactive web app.

## When to Use

- Upcoming interview, mock question practice, salary negotiation prep, behavioral story coaching

## When NOT to Use

- Resume creation (resume-maker), broad career research (deep-research)

## Step 0: Ask the User — Mode Selection

Before doing anything else, ask the user:

1. **What role and company** are you interviewing for?
2. **Which prep mode do you want?**
   - **Voice mock interview** — AI-powered voice conversation simulating a real interview (uses OpenAI Realtime API for speech-to-speech)
   - **Text mock interview** — Chat-based interview simulator where the AI asks questions and gives feedback in real time
   - **Interview prep dashboard** — A reference website with expected questions, company intel, story frameworks, and negotiation scripts

All three modes are built as **web apps** deployed as artifacts. Do not output raw markdown — always build an interactive app.

## Step 1: Research the Role and Company

Before building anything, use `webSearch` to gather real intel. This data populates whichever mode the user chose.

| Source | Query | What you get |
|---|---|---|
| **Glassdoor** | `site:glassdoor.com [Company] interview questions [role]` | Actual questions asked, by round. Filter to last 6 months. |
| **Blind** | `site:teamblind.com [Company] interview` OR `[Company] onsite` | Unfiltered loop structure, which rounds matter, bar-raiser tells, comp bands |
| **levels.fyi** | `site:levels.fyi [Company]` | Real comp by level + location. Critical for negotiation anchoring. |
| **LeetCode Discuss** | `site:leetcode.com/discuss [Company] [role]` | Tagged coding problems actually asked |
| **LinkedIn** | `[Company] [team name]` → recent posts from hiring manager | What they're shipping, what they celebrate, vocabulary they use |
| **Eng blog / Newsroom** | `[Company] engineering blog` | System design context. Mentioning their published architecture in an interview is a strong signal. |

For Amazon specifically: each interviewer is assigned 1-3 Leadership Principles to probe. Map stories to LPs before the loop.

## Step 2: Build the Web App

### Mode A: Voice Mock Interview

Build a React web app that uses the **OpenAI Realtime API** for voice-to-voice interview simulation. The app should:

- Connect to OpenAI's Realtime API via WebSocket for low-latency speech-to-speech
- Configure the AI persona as an interviewer for the specific role/company
- Seed the system prompt with the researched questions from Step 1
- Include a **question queue** panel showing upcoming questions (behavioral, technical, situational) drawn from Glassdoor/Blind research
- Show a **live transcript** panel so the user can review what they said
- After each answer, provide **written feedback** on: STAR structure, specificity, quantification, and areas to improve
- Include a **timer** per question (recommended 2-3 min per behavioral, 15-20 min per system design)
- End with a **scorecard** summarizing performance across categories

```javascript
// OpenAI Realtime API connection pattern
const pc = new RTCPeerConnection();
const audioEl = document.createElement("audio");
audioEl.autoplay = true;

// Add local audio track for user's microphone
const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
pc.addTrack(ms.getTracks()[0]);
pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; };

// Connect to OpenAI Realtime
const tokenRes = await fetch("/api/realtime-session", { method: "POST" });
const { client_secret } = await tokenRes.json();
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

const sdpRes = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${client_secret.value}`,
    "Content-Type": "application/sdp",
  },
  body: offer.sdp,
});
await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
```

The backend route (`/api/realtime-session`) creates an ephemeral token via:

```javascript
const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o-realtime-preview",
    voice: "verse",
    instructions: `You are an interviewer for [Role] at [Company]. Ask behavioral and technical questions one at a time. After the candidate answers, give brief feedback, then move to the next question. Questions: [insert researched questions from Step 1]`,
  }),
});
const data = await r.json();
// Return data.client_secret to the frontend
```

### Mode B: Text Mock Interview

Build a React chat app that simulates a text-based interview. The app should:

- Present a chat interface styled like a messaging app
- AI asks one question at a time from the researched question bank
- After each user response, AI provides inline feedback (STAR structure check, specificity score, improvement suggestions)
- Include a **sidebar** with: question categories (behavioral / technical / situational), progress tracker, tips for the current question type
- Use the OpenAI Chat Completions API (not Realtime) via a backend route
- End with a **summary report** scoring each answer

System prompt for the interviewer AI:

```text
You are interviewing a candidate for [Role] at [Company]. Ask questions one at a time from this list: [researched questions]. After each answer, give brief, constructive feedback focusing on: specificity, use of "I" vs "we", quantified results, and STAR structure. Then ask the next question. Be professional but conversational.
```

### Mode C: Interview Prep Dashboard

Build a polished single-page React app with these sections:

1. **Company Intel Panel** — loop structure, recent news (from web search), team info, culture notes
2. **Question Bank** — categorized tabs (Behavioral, Technical, System Design, Culture Fit) with actual questions from Glassdoor/Blind research. Each question expandable to show:
   - Why they ask this
   - Framework to use (STAR, CAR, SOAR, STAR+L)
   - Example strong answer structure
3. **Story Builder** — interactive 6-story matrix (Leadership, Conflict, Failure, Ambiguity, Impact, Scope Creep). User fills in their STAR components; the app validates completeness and flags missing quantification
4. **Comp & Negotiation** — levels.fyi data, target/walk-away ranges, scripted negotiation lines
5. **Questions to Ask** — curated list with context on what each reveals
6. **Countdown Timer** — if the user has an interview date, show days remaining with a suggested daily prep schedule

## Behavioral Story Frameworks

**STAR is the baseline. Know the variants:**

- **STAR** — Situation (1-2 sent) → Task (1 sent) → Action (60% of airtime, use "I" not "we") → Result (quantified)
- **CAR** — Challenge → Action → Result. Tighter; better for rapid-fire rounds.
- **SOAR** — Situation → Obstacle → Action → Result. Use when the story's value is in what you overcame.
- **STAR+L** — Append Learning. Mandatory for failure questions.

**Build a 6-story matrix, not a script per question.** One well-told story covers 3-4 question variants.

| Category | Prepare 1 story each | Maps to questions like |
|---|---|---|
| Leadership | Stepped up without authority | "Influenced without authority," "led a project" |
| Conflict | Disagreed with manager/peer, resolved | "Difficult coworker," "disagree and commit" |
| Failure | Owned a mistake, quantify damage + fix | "Project that failed," "missed a deadline" |
| Ambiguity | Decided with incomplete info | "Moved fast," "prioritized under uncertainty" |
| Impact | Your single biggest measurable win | "Most proud of," "biggest accomplishment" |
| Scope creep | Did more than asked | "Exceeded expectations," "ownership" |

**"Tell me about yourself":** Present (current role + one win) → Past (how you got here, 1 pivot) → Future (why this role is the logical next step). 90 seconds.

## Technical Frameworks

**System design — RADIO:**

- **R**equirements — Functional + non-functional. Ask: scale? latency target? (~15% of time)
- **A**rchitecture — Boxes and arrows. Client, API layer, services, data stores, queues. (~20%)
- **D**ata model — Entities, fields, relationships. (~15%)
- **I**nterface — API contracts. REST vs GraphQL vs gRPC. (~15%)
- **O**ptimizations — Caching, CDN, sharding, read replicas. Senior signal lives here. (~35%)

**Coding pattern recognition:** ~75% of LeetCode-style questions reduce to: sliding window, two pointers, BFS/DFS, binary search on answer, heap for top-K, DP (1D/2D), union-find, monotonic stack.

## Salary Negotiation

1. **Never give a number first.** *"I'd want to learn more about the role before discussing comp — what range did you have budgeted?"*
2. **Only negotiate after a yes.** Once they want to hire you.
3. **BATNA is everything.** Competing offer > current job > nothing.
4. **Anchor with data.** levels.fyi for exact company + level + location. Quote 75th percentile.
5. **Negotiate the package, not the base.** Signing bonus, equity refresh, start date, remote days, title.
6. **The reframe script:** *"I'm really excited about this. Based on levels.fyi data for [level] at [company], I was expecting something closer to [X]. Is there flexibility?"*
7. **Silence is a tool.** State your number. Stop talking.
8. **Get it in writing.**

## Questions to Ask Interviewers

- "What's the one thing that, if it goes wrong in the next 6 months, keeps you up at night?"
- "What did the last person who was great in this role do differently?"
- "What's something the team tried recently that didn't work?"
- "How are decisions made when engineering and product disagree?"
- To the hiring manager: "What would make you say 'I'm so glad we hired them' at the 6-month mark?"

## Best Practices

1. **6 stories, not 30 answers** — depth beats breadth
2. **Quantify or it didn't happen** — "cut p99 from 340ms to 45ms" > "improved performance"
3. **Practice out loud** — written answers don't survive contact with your mouth
4. **"I don't have a great example" is fine** — better than a weak story. Pivot: "The closest I have is..."
5. **Failure questions: own it fully** — hedging is the most common disqualifier

## Limitations

- Voice mode requires user to provide their OpenAI API key (for Realtime API access)
- Comp data lags reality by ~3-6 months; cross-reference Blind for recency
- Company-specific intel quality depends on how much employees post publicly
- Cannot access internal question banks or recruiter portals
>>>>>>> 1cc1c60ac5fd6dadd6cab8c4f32ad75d2e54a9a7
