# Recur Project & Engineering Rules

## Product Identity
- **Project**: "Recur", an incident-memory assistant for on-call engineering teams.
- When production breaks, it recalls how similar past incidents were diagnosed and fixed, including fixes that FAILED, and improves with every incident.
- Portfolio-grade product, not a demo toy.
- Never mention hackathons anywhere in code, UI, or docs.

## Tech Stack
- **Backend**: Python 3.11+ / FastAPI
- **Frontend**: React + TypeScript (strict) + Vite + Tailwind CSS + shadcn/ui + TanStack Query + Recharts
- **Memory**: Hindsight Cloud (`hindsight-client`)
- **LLM**: Groq (Models: `openai/gpt-oss-120b` or `llama-3.3-70b-versatile`, fallback `qwen/qwen3-32b`)
- **Monorepo Layout**: `/backend`, `/frontend`, `/scripts`, `/docs`
- **Secrets Management**: Secrets strictly in `.env` (`GROQ_API_KEY`, `HINDSIGHT_API_KEY`, `HINDSIGHT_BASE_URL`), with `.env.example` committed.

## Engineering Rules
1. **Hindsight API**: Read official docs (`hindsight.vectorize.io`) and examples before writing Hindsight code. Never guess the API. Use `retain` / `recall` / `reflect` as documented.
2. **Groq Structured Output**: Groq function calling is unreliable, so use JSON-mode structured output with schema validation (Pydantic), 3 retries, and fallback models.
3. **Frontend API Client**: Typed API client in frontend generated from FastAPI OpenAPI schema. No mock data inside components.
4. **UX States**: Every screen needs loading, empty, and error states.
5. **Code Quality**: Small commits, meaningful names, docstrings, no dead code.

---

# Design System Rules

Reference products: **Linear**, **Sentry**, **Datadog**, **PagerDuty**. Calm, dense, utilitarian, trustworthy.

### DO:
- Neutral zinc palette, one restrained blue accent. Semantic colors only for severity and status, desaturated. Dark theme default, light theme supported via CSS variables.
- Inter for UI at 13-14px base, JetBrains Mono for logs, IDs, and code. Tabular numbers.
- 4/8px spacing grid, 6px radius, 1px borders, almost no shadows.
- Tables and lists for data, not card grids. Master-detail layouts.
- Sentence-case microcopy with real units ("resolved in 12 min").
- Motion: 150ms ease transitions on state changes only.
- Keyboard accessible, visible focus rings, AA contrast, command palette (`Cmd+K` / `Ctrl+K`).

### DO NOT:
- Gradients, glassmorphism, glows, neon, emojis, sparkle icons, "AI-powered" badges.
- Hero sections, decorative illustrations, looping animations, oversized rounded cards.
- Lorem ipsum, or placeholder names like "John Doe".
