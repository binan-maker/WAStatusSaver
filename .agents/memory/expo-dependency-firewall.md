---
name: Expo dependency firewall
description: Environment-specific setup constraint for imported Expo projects whose npm lockfile is rejected by the package firewall.
---

Imported Expo projects in this workspace can arrive without installed dependencies. If the package firewall rejects the lockfile’s tar release, both the Expo CLI and native modules such as Google Mobile Ads remain unavailable until the dependency install issue is resolved.

**Why:** Repeated package installs cannot recover from a security-policy rejection, and an Expo workflow will fail before serving a preview when `expo` is absent.

**How to apply:** Check for `node_modules` and the workflow logs early. Keep native integrations behind optional runtime guards so web/Expo Go can remain safe, and treat the dependency firewall as a release blocker rather than bypassing it.