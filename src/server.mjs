#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { EmptyResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { VERSION, inputShape, loadTeam, prepareResearch, runResearch } from './research.mjs';

const team = await loadTeam();
const server = new McpServer({ name: 'tyreju-komanda', version: VERSION }, {
  instructions: 'Keturių tyrėjų komanda. Pirmiausia kliento įrankiais surink kodo ir oficialių šaltinių įrodymus. '
    + 'Pateik juos research_team. Serveris naudoja kliento modelį per sampling: trys specialistai ir koordinatorius. '
    + 'Be modelio prieigos galima naudoti list_researchers, prepare_research, resursus ir promptą.',
});

const localAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const json = (value, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
  ...(isError ? { isError: true } : {}),
});

server.registerTool('list_researchers', {
  title: 'Tyrėjų komanda ir modelio prieiga',
  description: 'Grąžina keturis vaidmenis ir ar prisijungęs MCP klientas deklaruoja sampling palaikymą. Modelio nekviečia.',
  inputSchema: {}, annotations: localAnnotations,
}, async () => json({
  name: 'tyreju-komanda', version: VERSION, transport: 'stdio',
  samplingSupported: Boolean(server.server.getClientCapabilities()?.sampling),
  researchers: [...team.researchers, team.coordinator],
  note: 'samplingSupported reiškia protokolo galimybę; modelio prieigą ir leidimus valdo VS Code.',
}));

server.registerTool('prepare_research', {
  title: 'Parengti tyrimo užduotis',
  description: 'Parengia trijų specialistų užduotis ir koordinatoriaus taisykles. Neatlieka tyrimo ir nenaudoja modelio.',
  inputSchema: inputShape, annotations: localAnnotations,
}, async input => json(prepareResearch(team, input)));

let researching = false;
server.registerTool('research_team', {
  title: 'Atlikti keturių tyrėjų analizę',
  description: 'Trys lygiagrečios specializuotos modelio užklausos ir koordinatoriaus sintezė per MCP sampling. '
    + 'Pateik bent vieną evidence elementą su source ir tikru content, surinktu kliento failų ar naršymo įrankiais. '
    + 'Serveris pats neatveria failų, URL ir nevykdo testų. Gali užtrukti kelias minutes; reikalinga kliento modelio prieiga.',
  inputSchema: { ...inputShape, evidence: inputShape.evidence.refine(items => items.length > 0, 'Reikia bent vieno įrodymo.') },
  annotations: { ...localAnnotations, idempotentHint: false, openWorldHint: true },
}, async (input, extra) => {
  if (!server.server.getClientCapabilities()?.sampling) {
    return json({ status: 'failed', error: 'sampling_unavailable',
      message: 'Klientas nedeklaruoja MCP sampling palaikymo. VS Code naudok vietinį Chat Agent režimą ir MCP: List Servers → Configure Model Access. Užduotims parengti gali naudoti prepare_research.' }, true);
  }
  if (researching) return json({ status: 'failed', error: 'busy', message: 'Šiame serveryje jau vyksta tyrimas. Palauk jo pabaigos.' }, true);
  researching = true;
  const progressToken = extra._meta?.progressToken;
  const onProgress = async (progress, title) => {
    if (progressToken === undefined || extra.signal.aborted) return;
    await server.server.notification({ method: 'notifications/progress', params: {
      progressToken, progress, total: 4, message: `${title}: užklausa baigta.`,
    } }).catch(() => {});
  };
  try {
    // SDK v1.30 clients ignore cancellation of request ID 0. Reserve that ID for
    // a lightweight readiness ping so all model requests remain cancellable.
    await server.server.request({ method: 'ping' }, EmptyResultSchema, {
      signal: extra.signal, relatedRequestId: extra.requestId, timeout: 10000,
    });
    const result = await runResearch(team, input, async ({ systemPrompt, prompt, maxTokens, signal }) => {
      const response = await server.server.createMessage({
        systemPrompt,
        messages: [{ role: 'user', content: { type: 'text', text: prompt } }],
        maxTokens,
        includeContext: 'none',
      }, { signal, relatedRequestId: extra.requestId, timeout: 180000 });
      if (response.content.type !== 'text') throw new Error('Modelis grąžino netekstinį atsakymą.');
      return { text: response.content.text, model: response.model, stopReason: response.stopReason };
    }, { signal: extra.signal, onProgress });
    return json(result, result.status === 'failed');
  } catch (error) {
    return json({ status: 'failed', error: extra.signal.aborted ? 'cancelled' : 'research_failed', message: error.message }, true);
  } finally {
    researching = false;
  }
});

for (const [name, uri, file, title] of [
  ['team-guide', 'team://guide', 'README.md', 'Komandos darbo taisyklės'],
  ['team-roles', 'team://roles', 'VAIDMENYS.md', 'Tyrėjų instrukcijos'],
  ['research-template', 'team://task-template', 'UZDUOTIS.md', 'Tyrimo užduoties šablonas'],
]) {
  server.registerResource(name, uri, { title, mimeType: 'text/markdown' }, async resourceUri => ({
    contents: [{ uri: resourceUri.href, mimeType: 'text/markdown', text: team.documents[file] }],
  }));
}

server.registerPrompt('tyrimas', {
  title: 'Tyrimas su keturių tyrėjų komanda',
  description: 'Padeda VS Code agentui surinkti įrodymus ir paleisti komandą.',
  argsSchema: { question: z.string().trim().min(1).max(4000) },
}, ({ question }) => ({ messages: [{ role: 'user', content: { type: 'text', text:
  `Atlik tyrimą su tyreju-komanda MCP serveriu. Klausimas: ${question}\n\n`
  + 'Pirmiausia patikrink list_researchers. Perskaityk užduočiai svarbius projekto failus savo turimais įrankiais, '
  + 'o technologiniams teiginiams surink aktualius oficialios dokumentacijos fragmentus. '
  + 'Tada kviesk research_team: question ir evidence masyvas su source, content bei, kodui, startLine. '
  + 'Pridėk tik užduočiai būtiną medžiagą. Jei nėra modelio prieigos, naudok prepare_research ir aiškiai pranešk, kad tyrimas neatliktas. '
  + 'Pateik bendrą ataskaitą, patikrink svarbiausias išvadas, nurodyk dalines nesėkmes ir aprėpties ribas. Kodo nekeisk.\n\n'
  + team.documents['UZDUOTIS.md'],
} }] }));

server.server.onerror = () => console.error('MCP protokolo klaida. Patikrink kliento MCP žurnalą.');
await server.connect(new StdioServerTransport());
for (const name of ['SIGINT', 'SIGTERM']) {
  process.once(name, async () => {
    await server.close();
    process.exit(0);
  });
}
