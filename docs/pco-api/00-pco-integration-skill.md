---
name: pco-integration
description: A comprehensive reference for building integrations with the Planning Center Online (PCO) API. Claude should use this skill whenever the user asks to build, debug, or extend PCO API integrations, sync middleware, webhooks, or any code that interacts with Planning Center data (events, people, services, check-ins, giving, groups, calendar).
---

# PCO Integration Skill

A skill that teaches Claude the Planning Center Online API patterns, data structures, authentication methods, and common integration approaches — so it can help you write PCO integrations faster without re-explaining everything each time.

## When to Use This Skill

Use this skill when the user wants to:
- Build a new PCO API integration or middleware
- Debug an existing PCO sync or webhook
- Fetch, filter, or transform PCO data (events, people, rooms, resources, approvals, etc.)
- Build approval workflows using PCO Calendar data
- Sync PCO data to external systems (Base44, WordPress, Google Sheets, etc.)
- Understand PCO's data model or API structure
- Write code that authenticates with PCO (Personal Access Tokens or OAuth 2)

## How to Use This Skill

1. **Identify what PCO product the user is working with** (Calendar, People, Services, Check-Ins, Giving, Groups)
2. **Load the appropriate reference file** from `references/`:
   - `references/api-overview.md` — Base URL patterns, auth, pagination, JSON:API conventions
   - `references/calendar-api.md` — Calendar events, rooms, resources, approvals, bookings, answers
   - `references/people-api.md` — People, emails, phone numbers, addresses, lists, workflows
   - `references/common-patterns.md` — Pagination, includes, filtering, error handling, rate limits
   - `references/middleware-patterns.md` — Vercel serverless patterns, cron sync, webhook ingestion
   - `references/fbca-specifics.md` — FBCA-specific configuration, approval groups, data shapes
3. **Follow the patterns and code examples** in those files to write correct, efficient PCO API code

## Keywords
PCO, Planning Center, Planning Center Online, calendar, events, rooms, resources, approvals, people, services, check-ins, giving, groups, API, integration, sync, middleware, webhook
