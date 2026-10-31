# Agent orchestration foundation (staging only)

This repository is prepared for optional Codex CLI, OpenHands, and Paperclip workflows. **Nothing is installed or activated by this file.**

## Safety contract
- Work only on a dedicated feature branch or isolated worktree. Never push directly to the default branch.
- Do not deploy, publish, merge, alter infrastructure, run database migrations, or access production services without explicit human approval.
- Do not expose credentials, customer information, tokens, or production data to external agents.
- Open draft pull requests for review; run repository-specific tests before requesting merge.
- Start with read-only inspection; allow write access only to a sandboxed checkout.
- No unattended agent execution or paid API calls until a human configures limits and credentials.

## Intended roles
- **Codex CLI**: focused implementation and local code review (https://github.com/openai/codex).
- **OpenHands**: sandboxed independent coding and tests (https://github.com/OpenHands/OpenHands).
- **Paperclip**: optional self-hosted task coordination (https://github.com/paperclipai/paperclip).

## Next steps (manual, not active)
1. Select an isolated machine/container with Docker, suitable Node/Python runtime, and separate worktrees.
2. Review/pin tool versions, licenses, access scopes, and model/API costs.
3. Configure Paperclip locally; attach Codex and OpenHands only after verifying adapter support.
4. Run a read-only smoke test, then a small non-production change in a draft PR.
5. Keep approvals and secrets outside Git.

No GitHub Actions workflows, tokens, webhooks, or branch protections are modified here.
