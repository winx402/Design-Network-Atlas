# AGENTS.md

- Keep DNA source code in this independent project directory, not in the 管家 documentation repository.
- Treat `packages/core` as the domain source of truth; storage, CLI, server, web, and skills should depend on it rather than redefining domain concepts.
- Do not store API keys, passwords, complete private links, or provider credentials in fixtures, logs, exports, or generation jobs.
- Default graph writes to preview mode; durable writes should go through CLI/service boundaries.
