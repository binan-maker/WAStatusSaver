---
name: follow-up-tasks
description: Propose follow-up tasks before marking your current task as complete.
---

# Follow-Up Tasks

<<<<<<< HEAD
As you work on your current task, watch for additional work that should be done as follow-up tasks — separate units of work related to your current task but outside its scope.
=======
As you work on your current task, watch for additional work that should be done as follow-up tasks. Follow-up tasks are separate units of work that are related to your current task but outside its scope.
>>>>>>> f01289a16c8358616083ca86e6f0919c3b8d4f8c

Categorize each follow-up task using one of these categories:

- **`incomplete_scope`**: Parts of the original request that you intentionally deferred to keep the current task focused
- **`next_steps`**: Functionality or features users would want next, whether directly extending what you just built or addressing unmet needs in the project
- **`tech_debt`**: Code quality issues, hardcoded values, shortcuts, or refactoring opportunities you noticed while working
- **`test_gaps`**: Tests that should be written but aren't part of the current task's deliverable

Write titles for non-technical users — lead with impact, not implementation - especially for tech debt and test gaps.

<<<<<<< HEAD
Before submitting, review each title by asking: "Would a non-technical user understand what this means and why they'd want it?" If not, rewrite it. Examples:
=======
Before submitting, review each title by asking: "Would a non-technical user understand what this means and why they'd want it?" If not, rewrite it. Examples of rewrites:
>>>>>>> f01289a16c8358616083ca86e6f0919c3b8d4f8c

- "Store recipes in a database with full CRUD support" -> "Let users add, edit, and delete their own recipes"
- "Add server-side validation for recipe API endpoints" -> "Prevent broken recipes from being saved"

<<<<<<< HEAD
Before marking your task as complete, propose up to 3 follow-up tasks by calling `proposeFollowUpTasks` — NOT `bulkCreateProjectTasks` or `createProjectTask`. The `proposeFollowUpTasks` callback automatically links follow-ups to your current task as the parent — required for correct task hierarchy. Submit them all in a single call with clear titles, descriptions, and a `category` (required). Keep only the highest-impact follow-ups. Each description should include relevant file paths and enough context for another agent to pick up the work independently.

Only propose follow-ups that represent genuine, actionable work.

- Do not propose follow-ups that overlap with tasks already visible in the project task list
- Do not propose follow-ups for trivial items or things already in your current task's scope
- Do not propose follow-ups for agent housekeeping (e.g. updating replit.md, adding comments, improving documentation — handle those inline)

If your current task already has downstream tasks depending on it (listed in your task assignment), skip calling `proposeFollowUpTasks` entirely — those tasks already cover the planned next steps.

Only call `proposeFollowUpTasks` once per task — the system rejects duplicate calls. If you're marking it complete again after more work, review your previously proposed follow-ups. If any are now stale or no longer relevant given the new work, call `markFollowUpTaskObsolete` to remove them.
=======
Before marking your task as complete, propose up to 3 follow-up tasks by calling `proposeFollowUpTasks` — NOT `bulkCreateProjectTasks` or `createProjectTask`. The `proposeFollowUpTasks` callback automatically links follow-ups to your current task as the parent, which is required for correct task hierarchy. Submit them all in a single call with clear titles, descriptions, and a `category` (required). Keep only the highest-impact follow-ups. Each description should include relevant file paths and enough context for another agent to pick up the work independently.

Only propose follow-ups that represent genuine, actionable work. Do not propose follow-ups for trivial items or things that are part of your current task's scope.

Do not propose follow-ups that overlap with tasks already visible in the project task list. If your current task already has downstream tasks depending on it (listed in your task assignment), skip calling `proposeFollowUpTasks` entirely — those tasks already cover the planned next steps.

Do not propose follow-ups for agent housekeeping (e.g. updating replit.md, adding comments, improving documentation) — handle those inline as part of your current task.

Only call `proposeFollowUpTasks` once per task — the system enforces this and will reject duplicate calls. If you have done more work on the task and are marking it complete again, review your previously proposed follow-ups. If any are now stale or no longer relevant given the new work, call `markFollowUpTaskObsolete` to remove them.
>>>>>>> f01289a16c8358616083ca86e6f0919c3b8d4f8c

## Examples

```javascript
<<<<<<< HEAD
// Log the result so you have taskRefs for later use with markFollowUpTaskObsolete
=======
// Propose follow-up tasks (call once per task)
// Log the result so you have the taskRefs for later use with markFollowUpTaskObsolete
>>>>>>> f01289a16c8358616083ca86e6f0919c3b8d4f8c
const followUps = await proposeFollowUpTasks({
    tasks: [
        {
            title: "Create a slide deck for onboarding demos",
            category: "next_steps",
            description: `# Create a slide deck for onboarding demos

## What & Why
The project has no presentation materials for demos or onboarding. A short slide deck would make it easier to explain the product flow to teammates and stakeholders.

## Done looks like
- A polished slide deck exists for demoing the product
- The deck explains the core user flow and value proposition clearly

## Relevant files
- \`src/pages/index.tsx\`
- \`src/content/marketing-copy.ts\``
        },
        {
            title: "Save recipes permanently so they aren't lost on refresh",
            category: "tech_debt",
            description: `# Save recipes permanently so they aren't lost on refresh

## What & Why
Recipe data is hardcoded in a static file. Users who add or edit recipes will lose their changes on page refresh. Moving data to the database ensures persistence.

## Done looks like
- Recipes are stored in the database and served via API
- Users can add, edit, and delete recipes without losing data

## Relevant files
- \`src/data/recipes.ts\` (current static data)
- \`lib/db/src/schema/recipes.ts\` (new schema)`
        }
    ]
});
<<<<<<< HEAD
console.log(followUps.map(t => ({ taskRef: t.taskRef, title: t.title })));

// Remove an obsolete follow-up
=======
console.log(followUps.map(t => ({ taskRef: t.taskRef, title: t.title }))); // save taskRefs for markFollowUpTaskObsolete

// Remove an obsolete follow-up (use a taskRef from the proposeFollowUpTasks result above)
>>>>>>> f01289a16c8358616083ca86e6f0919c3b8d4f8c
await markFollowUpTaskObsolete({ taskRef: "#12" });
```
