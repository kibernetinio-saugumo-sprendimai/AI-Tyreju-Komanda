# Technology and Code Research Team

A four-member team for technology and code analysis: three specialist researchers and one coordinator. This directory contains working rules, a task template and a local MCP server for VS Code. See [MCP server setup and usage](MCP_SERVER.md).

| Member | Agent name | Responsibility |
| --- | --- | --- |
| Architecture researcher | `architecture_researcher` | System structure, dependencies, data flows and integrations. |
| Code-quality researcher | `code_quality_researcher` | Logic errors, edge cases and testing gaps. |
| Technology researcher | `technology_researcher` | Official documentation, version compatibility and alternatives. |
| Coordinator and reviewer | Primary assistant | Scope, task assignment, evidence checks and the consolidated report. |

Detailed researcher instructions are in [ROLES.md](ROLES.md). The MCP server implements the same roles through specialized VS Code model prompts; it does not depend on agents from an earlier conversation. The VS Code client must provide collected evidence because the server does not read the project or browse the internet by itself.

## Submitting a task

Provide the research question and a repository path, code fragment or technology. Additional constraints can be specified in [TASK.md](TASK.md). The template is optional.

Example: “Investigate `/path/to/project`: find the most important reliability issues and assess library compatibility. Do not change code.”

## Research workflow

1. Read the task and applicable repository instructions before inspecting files.
2. Define the objective, scope and completion criteria.
3. Assign bounded work with context, sources, constraints and an expected output format.
4. Consolidate findings, remove duplicates and verify important claims against evidence.
5. Deliver one report with findings, impact, recommended actions, checks performed and remaining uncertainty.

## Evidence rules

- Analysis is read-only by default; code changes require a separate request.
- Every material finding must cite a file and line or a primary source.
- Separate facts, conclusions and unverified hypotheses.
- Check changing technology claims against current official documentation.
- Do not disclose secrets, access keys or unrelated private data.

## Repository files

| File | Purpose |
| --- | --- |
| [MCP_SERVER.md](MCP_SERVER.md) | Local MCP server setup, VS Code configuration and troubleshooting. |
| [TASK.md](TASK.md) | Research task template. |
| [ROLES.md](ROLES.md) | Specialist role instructions. |
| `.github/copilot-instructions.md` | Shared Copilot instructions. |

Install dependencies with `npm install`. The project requires Node.js `>=22`. Start the server with `npm start` or select it from the VS Code MCP tools list.
