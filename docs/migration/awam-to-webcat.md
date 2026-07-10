# AWAM/SWAM → WebCat Migration

## Status: No AWAM/SWAM Code Found

The current workspace does not contain any AWAM/SWAM code. The prompt references an "uploaded AWAM/SWAM agent-orchestration package" but the repository is fresh with only a minimal README.

## Planned Migration Path

When AWAM/SWAM code becomes available, the following migration approach will be used:

### Concepts to Port

| AWAM/SWAM Concept | WebCat Equivalent | Notes |
|---|---|---|
| Swarm coordination | Agent swarm with orchestrator | Adapted for pentest + engineering |
| Skills system | `.webcat/skills/` with YAML front-matter | Extended with pentest skills |
| Plans and tasks | Durable plans in `.webcat/plan.md` | Structured task lanes |
| Critic gates | Configurable critic pre-plan gate | Part of quality pipeline |
| Council | Phase and final council gates | Multi-agent review |
| Testing agent | Test Engineer agent | Evidence-based validation |
| Evidence system | `@webcat/evidence-core` | Chain of custody, hashing |
| Retrospectives | `.webcat/retrospectives/` | Phase-boundary knowledge capture |
| Research agent | Researcher/SME agent | Domain-specific deep-dives |

### New Concepts Not in AWAM/SWAM

- Scope enforcement engine
- MCP integration hub
- Pentest engagement lifecycle
- Hypothesis-driven testing
- Finding deduplication
- Severity scoring (CVSS)
- CWE/OWASP mapping
- Report generation
- Traffic explorer UI
- Attack surface grapher

### Skills to Migrate

The following AWAM/SWAM skills will be ported to WebCat:

- brainstorm
- clarify
- clarify-spec
- specify
- plan
- pre-phase-briefing
- execute
- phase-wrap
- critic-gate
- council
- consult
- deep-dive
- deep-research
- discover
- resume
- loop
- issue-ingest
- codebase-review
- engineering-conventions
- running-tests
- writing-tests
- commit-pr
- PR review
- PR feedback
- PR monitoring
- design-doc synchronization

Binary reverse-engineering skills will be retained as disabled optional extensions.

### State Migration

| AWAM/SWAM | WebCat |
|---|---|
| `.swarm/spec.md` | `.webcat/spec.md` |
| `.swarm/plan.md` | `.webcat/plan.md` |
| `.swarm/context.md` | `.webcat/context.md` |
| `.swarm/config.json` | `.webcat/config.json` |
| `.swarm/knowledge.jsonl` | `.webcat/knowledge.jsonl` |
| `.swarm/skills/` | `.webcat/skills/` |
| `.swarm/retrospectives/` | `.webcat/retrospectives/` |

A migration reader for `.swarm` state will be provided for backward compatibility.
