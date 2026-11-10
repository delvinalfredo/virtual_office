---
description: Restate requirements, assess risks, and create step-by-step implementation plan. WAIT for user CONFIRM before touching any code.
argument-hint: "[description | url | spec.md]"
---

# Plan Command

**Feature to plan:** $ARGUMENTS

This command invokes the **planner** agent to create a comprehensive implementation plan before writing any code.

## What This Command Does

1. **Restate Requirements** - Clarify what needs to be built
2. **Identify Risks** - Surface potential issues and blockers
3. **Create Step Plan** - Break down implementation into phases
4. **Wait for Confirmation** - MUST receive user approval before proceeding

## When to Use

Use `/plan-feature` when:
- Starting a new feature
- Making significant architectural changes
- Working on complex refactoring
- Multiple files/components will be affected
- Requirements are unclear or ambiguous
- You have a URL (website/app) you want to clone or use as reference

## Input Options

```
/plan-feature [description]         → plain text description
/plan-feature [url]                 → fetch URL, extract features, derive plan
/plan-feature [url] + [description] → URL as reference + extra context
/plan-feature [file.md]             → use a markdown spec file as input
```

When a URL is provided:
1. Planner fetches the page and extracts: features, UI flows, functionality
2. Derives requirements from what was found
3. Proposes implementation plan based on that
4. Saves plan to `docs/plans/[feature].md` after confirmation

## How It Works

The planner agent will:

1. **Parse input** — text description, URL, or .md file
2. **Analyze the request** and restate requirements in clear terms
3. **Break down into phases** with specific, actionable steps
4. **Identify dependencies** between components
5. **Assess risks** and potential blockers
6. **Estimate complexity** (High/Medium/Low)
7. **Present the plan** (and WAIT for explicit confirmation
8. **Save permanently to** `docs/plans/[feature-name].md` after confirmation; touch `docs/PROJECT.md` only if the plan changes durable facts (new integration, module boundary, schema)

## Claude Code behavior

Claude Code loads this command from `.claude/commands/plan-feature.md` (named `plan-feature` so it does not shadow the built-in `/plan` plan mode). Delegate to the `planner` subagent with the Agent tool; the planner is read-only and may use WebFetch for a URL input. The plan must be presented before implementation; do not modify application code during planning. After the user confirms, the main session writes `docs/plans/[feature-name].md`.

## Example Usage

```
User: /plan-feature I need to add real-time notifications when markets resolve

Agent (planner):
# Implementation Plan: Real-Time Market Resolution Notifications

## Requirements Restatement
- Send notifications to users when markets they're watching resolve
- Support multiple notification channels (in-app, email, webhook)
- Ensure notifications are delivered reliably
- Include market outcome and user's position result

## Implementation Phases

### Phase 1: Database Schema
- Add notifications table with columns: id, user_id, market_id, type, status, created_at
- Add user_notification_preferences table for channel preferences
- Create indexes on user_id and market_id for performance

### Phase 2: Notification Service
- Create notification service in lib/notifications.ts
- Implement notification queue using BullMQ/Redis
- Add retry logic for failed deliveries
- Create notification templates

### Phase 3: Integration Points
- Hook into market resolution logic (when status changes to "resolved")
- Query all users with positions in market
- Enqueue notifications for each user

### Phase 4: Frontend Components
- Create NotificationBell component in header
- Add NotificationList modal
- Implement real-time updates via the project's existing realtime channel
- Add notification preferences page

## Dependencies
- Redis (for queue)
- Email service (SendGrid/Resend)
- Existing realtime/websocket layer

## Risks
- HIGH: Email deliverability (SPF/DKIM required)
- MEDIUM: Performance with 1000+ users per market
- MEDIUM: Notification spam if markets resolve frequently
- LOW: Real-time subscription overhead

## Estimated Complexity: MEDIUM
- Backend: 4-6 hours
- Frontend: 3-4 hours
- Testing: 2-3 hours
- Total: 9-13 hours

**WAITING FOR CONFIRMATION**: Proceed with this plan? (yes/no/modify)
```

## Important Notes

**CRITICAL**: The planner agent will **NOT** write any code until you explicitly confirm the plan with "yes" or "proceed" or similar affirmative response.

If you want changes, respond with:
- "modify: [your changes]"
- "different approach: [alternative]"
- "skip phase 2 and do phase 3 first"

## Integration with Other Commands & Autopilot Execution

Once the user approves the plan (e.g. "yes", "proceed"):
- **AUTOPILOT MODE**: The AI automatically executes the full implementation chain without waiting for manual slash commands:
- The AI automatically saves the plan to `docs/plans/[feature-name].md` (`status: in-progress`). `docs/PROJECT.md` is updated only if durable facts changed.

## Related Agents

This command invokes the planner agent.

## Related Commands

- /project-init — run first to load project context
- /tdd — implement after plan is confirmed
- /build-fix — fix build errors during implementation
- /code-review — review completed implementation
