<<<<<<< HEAD
[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. If the app uses external auth (Supabase Auth, Firebase, NextAuth, Clerk, Base44 auth, etc.), replace it with Replit Auth — see the replit-migration-guardrails skill at .local/secondary_skills/replit-migration-guardrails/SKILL.md. Skip if the app has no login flow.
     ↳ SKIPPED: StatusVault is a local-first Android app (WhatsApp Status Saver). No login flow, no auth.
[x] 4. If the app calls external integrations (direct OpenAI / Anthropic / SendGrid / Twilio / Stripe / Base44 integrations, etc.), replace them with Replit integrations — see the replit-migration-guardrails skill at .local/secondary_skills/replit-migration-guardrails/SKILL.md. If a capability has no matching Replit integration, use the environment-secrets skill to request the key from the user. Skip if none apply.
     ↳ SKIPPED: No external API integrations. All data is read from device storage via SAF (Storage Access Framework).
[x] 5. Verify the project works end-to-end: use the testing agent (see the testing skill) to exercise the main flows, then use the feedback tool to screenshot and confirm with the user
     ↳ N/A: React Native / Expo Android app — cannot be previewed in a Replit browser pane. Build and test via EAS or a local dev client.
[x] 6. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
=======
[•] 1. Install the required packages
[ ] 2. Restart the workflow to see if the project is working
[ ] 3. If the app uses external auth (Supabase Auth, Firebase, NextAuth, Clerk, Base44 auth, etc.), replace it with Replit Auth — see the replit-migration-guardrails skill at .local/secondary_skills/replit-migration-guardrails/SKILL.md. Skip if the app has no login flow.
[ ] 4. If the app calls external integrations (direct OpenAI / Anthropic / SendGrid / Twilio / Stripe / Base44 integrations, etc.), replace them with Replit integrations — see the replit-migration-guardrails skill at .local/secondary_skills/replit-migration-guardrails/SKILL.md. If a capability has no matching Replit integration, use the environment-secrets skill to request the key from the user. Skip if none apply.
[ ] 5. Verify the project works end-to-end: use the testing agent (see the testing skill) to exercise the main flows, then use the feedback tool to screenshot and confirm with the user
[ ] 6. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
>>>>>>> 41e2be19d2013cacf14f272c05f5c7366a055839
