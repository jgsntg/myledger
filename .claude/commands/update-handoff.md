# Update Handoff

When this command is invoked, write a complete and accurate handoff document that captures the full current state of the project for the next session.

## Step 1 — Gather context

Run the following to understand what changed:

```bash
git diff HEAD~5..HEAD --stat          # files touched in recent commits
git log --oneline -10                  # recent commit messages
```

Also read:
- The existing `HANDOFF.md` (if present) — use it as the base to update, not replace wholesale
- Any files that were heavily modified this session

## Step 2 — Write the updated HANDOFF.md

Update `HANDOFF.md` at the project root. The document must contain:

### Required sections

1. **Last updated line** — date + one-line summary of this session's work (first line of file)

2. **Current State** — one paragraph describing the project and a phase table:
   - Each phase: number, description, status (✅ Done / 🔄 In Progress / ⬜ Planned)
   - Add any new phases completed this session

3. **Servers** — exact commands to start backend and frontend, with URLs. Do not change this unless the commands actually changed.

4. **Environment Variables** — minimum required `.env` keys. Mark which are filled vs empty.

5. **Critical Rules** — hard constraints that must never be violated (auth, trading safety, Python compat, etc.)

6. **Backend File Inventory** — every meaningful `.py` file with a one-line description. Update descriptions for any files touched this session. Include all router endpoints in a table.

7. **Frontend File Inventory** — every meaningful `.tsx/.ts` file grouped by: App shell, Tab shell, Leaf components. One-line description per file.

8. **Feature/phase deep-dives** — for any significant feature added or changed this session, include a dedicated section with:
   - How it works
   - Key data structures / DB schema changes
   - Any config keys added to system_settings
   - Gotchas or non-obvious decisions

9. **What Changed This Session** — a clear changelog:
   - New features (numbered list)
   - Bug fixes
   - Files modified (grouped as Backend / Frontend)

10. **Next Recommended Tasks** — ordered list split into:
    - Immediate (blocking or high value)
    - Next in feature sequence
    - Low priority / future

### Rules for writing the handoff

- Be specific. Vague descriptions ("updated the settings") are useless. Name the fields, the endpoints, the component props.
- Include DB schema for any new or modified tables (SQL column definitions).
- If a setting was added to `system_settings`, document its key name, default value, type, and effect.
- If a prop was added to a component, note it.
- Do not remove sections that are still accurate — append and update, don't truncate.
- The handoff is the source of truth for the next session. Write it as if the next reader has no memory of this session.

## Step 3 — Update the auto-memory file

Update the project memory file at:
`~/.claude/projects/-Users-josesantiago-Workspaces-Ledger/memory/project_ledger.md`

Keep it concise (under 60 lines). It should capture:
- Current phase and completion status
- Any still-empty env vars that block features
- The most recent major additions (this session's work in 3–5 bullets)
- Key file paths for orientation
- What's next

## Step 4 — Confirm

After writing both files, output a short summary:
- What sections of HANDOFF.md changed
- Whether the memory file was updated
- The "Next Recommended Tasks" list so the user can confirm it's correct
