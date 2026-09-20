# Local MCP server for VS Code

The `tyreju-komanda` server runs locally over `stdio`. VS Code manages the process and connection; no HTTP endpoint, open port or long-running service is required.

Each research request runs three specialized model prompts in parallel and then a fourth coordinator prompt. These contexts are created by this MCP application and do not connect to agents from earlier conversations.

## Start on this computer

1. Open the target project in **Visual Studio Code**.
2. Select **Cmd+Shift+P → MCP: List Servers → tyreju-komanda → Start** and review any trust prompt.
3. Open local **Chat → Agent** mode and sign in to VS Code AI features.
4. In **Configure Tools**, enable `tyreju-komanda`. Use **MCP: List Servers → tyreju-komanda → Configure Model Access** to grant access to allowed models.
5. Submit a task, for example:

> Use the tyreju-komanda MCP server. Read this project's main module and tests, send relevant fragments to research_team and assess reliability issues. Do not change code.

The MCP prompt menu also includes `research`, which collects evidence and invokes the team.

The server needs no separate API key. VS Code controls model access and usage limits. A local server does not imply a local model: submitted research material is sent to the model provider you authorize in VS Code.

## Installation and configuration

Node.js 22 or newer and an MCP-enabled VS Code are required.

```sh
cd /Users/safestack/tyreju-komanda
npm ci --ignore-scripts
npm run vscode:install
```

The install command registers the server in the user profile with VS Code's official `--add-mcp` option. It uses absolute Node and server paths. Re-run it after moving the project or removing the configured Node executable.

The default macOS profile is `~/Library/Application Support/Code/User/mcp.json`. For project-only configuration, copy [vscode-mcp.example.json](vscode-mcp.example.json) to `.vscode/mcp.json`. Do not use both profile and project configuration unless you intentionally need both.

`npm start` launches the MCP protocol process and waits for client messages on standard input. Use VS Code for normal operation; stop it with **MCP: List Servers → Stop**.

## MCP interface

| Interface | Purpose | Model |
| --- | --- | --- |
| Tool `list_researchers` | Four roles and client sampling capability. | Not required |
| Tool `prepare_research` | Role-based task planning; this does not perform research. | Not required |
| Tool `research_team` | Three specialist analyses and a coordinator report. | Sampling required |
| Prompt `research` | Instructs the VS Code agent to collect evidence and run the team. | Required for execution |
| Resource `team://guide` | Team working rules. | Not required |
| Resource `team://roles` | Researcher instructions. | Not required |
| Resource `team://task-template` | Research task template. | Not required |

`prepare_research` and `research_team` use this input shape:

```json
{
  "question": "Does this function handle an empty array correctly?",
  "evidence": [
    {
      "source": "src/average.js",
      "startLine": 1,
      "content": "export const average = xs => xs.reduce((a, b) => a + b, 0) / xs.length;"
    }
  ],
  "constraints": "Answer in English. Do not change code."
}
```

`question` is required. `constraints` and `startLine` are optional. Research requires at least one evidence item; planning may omit evidence. Limits are 4,000 characters for the question and constraints, 20 evidence items, 60,000 characters per item and 80,000 characters total.

`source` is a citation label only. The server does not open files or URLs. The VS Code agent must read relevant code, documentation or test results with its own tools and send the content. If sources or versions are insufficient, the report must say so.

The result is text JSON and `structuredContent` with `status`, `question`, `report`, `specialists`, `coordinator` and `limitations`. A coordinator is omitted when no specialist responds.

- `complete`: all four model responses were received in full; this does not make every conclusion correct.
- `partial`: some requests failed or were truncated; available results and limitations are returned.
- `failed` with `isError: true`: sampling is unavailable, all specialists failed or another blocking error occurred.

Only one research request runs in this server process at a time. Each model request has a 180-second timeout. Failed requests are not automatically retried. The server does not modify projects or save research content to files.

## Checks and troubleshooting

```sh
npm run check
npm test
```

Tests use a real MCP client and a separate server process while simulating model responses locally. They do not use API keys or paid models.

- Server missing: check the active VS Code profile, run `npm run vscode:install` and open **MCP: List Servers**.
- Process fails: inspect **Show Output** for the Node/server path; run `npm ci --ignore-scripts` if dependencies are missing.
- Model requests rejected: check **Configure Model Access**, AI sign-in and model limits.
- `sampling_unavailable`: the client did not advertise sampling. Use VS Code local Chat Agent mode.
- Inspect model requests with **Show Sampling Requests**.

## Compatibility basis

The server uses `@modelcontextprotocol/sdk` 1.30.0 and MCP 2025-11-25 compatibility. Re-check the sampling API and protocol when migrating to SDK v2.

Official sources checked 2026-09-12:

- [VS Code MCP servers](https://code.visualstudio.com/docs/agent-customization/mcp-servers)
- [VS Code sampling and model access](https://code.visualstudio.com/api/extension-guides/ai/mcp#sampling)
- [Official MCP SDK v1 capabilities](https://ts.sdk.modelcontextprotocol.io/capabilities)
