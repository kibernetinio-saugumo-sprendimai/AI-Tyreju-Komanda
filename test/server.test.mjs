import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CreateMessageRequestSchema, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const projectPath = fileURLToPath(new URL('../', import.meta.url));
const serverPath = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
const specialistIds = ['architecture', 'code_quality', 'technology'];
const question = 'Ar funkcija tinkamai apdoroja tuščią sąrašą?';
const evidence = [
  { source: 'src/average.js', startLine: 41, content: 'function average(items) {\n  return items.reduce((a, b) => a + b, 0) / items.length;\n}' },
  { source: 'https://example.invalid/reference', content: 'Empty collections require an explicit result.' },
];
const researchInput = { question, evidence, constraints: 'Analizuok tik pateiktą funkciją.' };

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function within(promise, milliseconds = 3000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Lauktas protokolo įvykis neįvyko.')), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function sampled(text, stopReason = 'endTurn') {
  return { role: 'assistant', content: { type: 'text', text }, model: 'local-test-model', stopReason };
}

function data(result) {
  assert.equal(result.content[0].type, 'text');
  const parsed = JSON.parse(result.content[0].text);
  assert.deepEqual(result.structuredContent, parsed);
  return parsed;
}

async function connect(t, sample) {
  const client = new Client({ name: 'tyreju-komanda-integration-test', version: '1.0.0' }, {
    capabilities: sample ? { sampling: {} } : {},
  });
  const transport = new StdioClientTransport({
    command: process.execPath, args: [serverPath], cwd: projectPath, stderr: 'pipe',
  });
  const requests = [];
  let stderr = '';
  transport.stderr.on('data', chunk => { stderr += chunk; });
  t.after(async () => {
    try {
      await client.close();
    } finally {
      await transport.close();
    }
    assert.equal(transport.pid, null, 'Serverio procesas turi būti uždarytas.');
    if (stderr && t.passed === false) t.diagnostic(stderr);
  });
  if (sample) {
    client.setRequestHandler(CreateMessageRequestSchema, async (request, extra) => {
      const index = requests.length;
      requests.push(request.params);
      return sample(request.params, extra, index);
    });
  }
  await client.connect(transport, { timeout: 3000 });
  const wireMessages = [];
  const onmessage = transport.onmessage;
  transport.onmessage = (message, extra) => {
    wireMessages.push(message);
    return onmessage?.(message, extra);
  };
  return {
    client,
    requests,
    wireMessages,
    call: (name, args = {}, options = {}) => client.callTool(
      { name, arguments: args }, undefined, { timeout: 5000, ...options },
    ),
  };
}

test('discovery exposes three tools, three readable resources and one usable prompt', { timeout: 10000 }, async t => {
  const { client, call } = await connect(t);
  const [tools, resources, prompts] = await Promise.all([
    client.listTools(), client.listResources(), client.listPrompts(),
  ]);
  assert.deepEqual(tools.tools.map(item => item.name).sort(), ['list_researchers', 'prepare_research', 'research_team']);
  assert.deepEqual(resources.resources.map(item => item.uri).sort(), ['team://guide', 'team://roles', 'team://task-template']);
  assert.deepEqual(prompts.prompts.map(item => item.name), ['tyrimas']);
  for (const { uri } of resources.resources) {
    const resource = await client.readResource({ uri });
    assert.equal(resource.contents.length, 1);
    assert.equal(resource.contents[0].uri, uri);
    assert.equal(resource.contents[0].mimeType, 'text/markdown');
    assert.ok(resource.contents[0].text.trim().length > 50);
  }
  const prompt = await client.getPrompt({ name: 'tyrimas', arguments: { question } });
  assert.equal(prompt.messages[0].role, 'user');
  assert.ok(prompt.messages[0].content.text.includes(question));
  assert.match(prompt.messages[0].content.text, /research_team/);
  assert.match(prompt.messages[0].content.text, /prepare_research/);
  assert.match(prompt.messages[0].content.text, /startLine/);
  const roster = data(await call('list_researchers'));
  assert.equal(roster.samplingSupported, false);
  assert.equal(roster.transport, 'stdio');
  assert.deepEqual(roster.researchers.map(item => item.id), [...specialistIds, 'coordinator']);
  for (const role of roster.researchers) {
    assert.ok(role.title.trim());
    assert.ok(role.instructions.trim().length > 50);
  }
});

test('planning works without a model and distinguishes missing evidence from ready input', { timeout: 10000 }, async t => {
  const { call } = await connect(t);
  const empty = data(await call('prepare_research', { question: `  ${question}  ` }));
  assert.equal(empty.question, question);
  assert.equal(empty.evidenceCount, 0);
  assert.equal(empty.constraints, '');
  assert.deepEqual(empty.tasks.map(item => item.id), specialistIds);
  assert.equal(empty.coordinator.id, 'coordinator');
  assert.match(empty.limitations, /tyrimo neatlieka/);
  assert.match(empty.nextStep, /surinkti/);
  const prepared = data(await call('prepare_research', researchInput));
  assert.equal(prepared.evidenceCount, 2);
  assert.equal(prepared.constraints, researchInput.constraints);
  assert.match(prepared.nextStep, /research_team/);
});

test('discovery, resources, prompts and planning never invoke available sampling', { timeout: 10000 }, async t => {
  const { client, call, requests } = await connect(t, () => { throw new Error('Modelis neturėjo būti kviečiamas.'); });
  assert.equal(data(await call('list_researchers')).samplingSupported, true);
  await call('prepare_research', researchInput);
  await client.readResource({ uri: 'team://roles' });
  await client.getPrompt({ name: 'tyrimas', arguments: { question } });
  assert.equal(requests.length, 0);
});

test('unknown resources fail explicitly and leave the server usable', { timeout: 10000 }, async t => {
  const { client, call } = await connect(t);
  await assert.rejects(client.readResource({ uri: 'team://missing' }), error => {
    assert.equal(error.code, ErrorCode.InvalidParams);
    assert.match(error.message, /not found/i);
    return true;
  });
  assert.equal(data(await call('list_researchers')).researchers.length, 4);
});

test('invalid inputs are rejected before sampling', { timeout: 10000 }, async t => {
  const { client, call, requests } = await connect(t, () => sampled('Neturėtų būti naudojama.'));
  const invalid = [
    ['missing question', {}],
    ['blank question', { question: ' \n\t ' }],
    ['non-string question', { question: 42 }],
    ['long question', { question: 'q'.repeat(4001) }],
    ['blank source', { question, evidence: [{ source: ' ', content: 'code' }] }],
    ['blank content', { question, evidence: [{ source: 'file.js', content: ' \n ' }] }],
    ['missing content', { question, evidence: [{ source: 'file.js' }] }],
    ['zero line', { question, evidence: [{ ...evidence[0], startLine: 0 }] }],
    ['fractional line', { question, evidence: [{ ...evidence[0], startLine: 1.5 }] }],
    ['long source', { question, evidence: [{ source: 'x'.repeat(1001), content: 'code' }] }],
    ['long content', { question, evidence: [{ source: 'file.js', content: 'x'.repeat(60001) }] }],
    ['combined evidence limit', { question, evidence: [
      { source: 'a.js', content: 'a'.repeat(40001) },
      { source: 'b.js', content: 'b'.repeat(40000) },
    ] }],
    ['too many sources', { question, evidence: Array.from({ length: 21 }, () => evidence[0]) }],
    ['long constraints', { question, constraints: 'x'.repeat(4001) }],
    ['non-array evidence', { question, evidence: 'file.js' }],
  ];
  for (const [label, args] of invalid) {
    await t.test(label, async () => {
      const result = await call('prepare_research', args);
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /validation|invalid/i);
    });
  }
  for (const args of [{ question }, { question, evidence: [] }]) {
    const result = await call('research_team', args);
    assert.equal(result.isError, true);
  }
  await assert.rejects(client.getPrompt({ name: 'tyrimas', arguments: { question: ' ' } }), error => {
    assert.equal(error.code, ErrorCode.InvalidParams);
    return true;
  });
  assert.equal(requests.length, 0);
});

test('research without sampling returns an actionable error', { timeout: 10000 }, async t => {
  const { call } = await connect(t);
  const result = await call('research_team', researchInput);
  assert.equal(result.isError, true);
  const failure = data(result);
  assert.equal(failure.status, 'failed');
  assert.equal(failure.error, 'sampling_unavailable');
  assert.match(failure.message, /prepare_research/);
  assert.equal(data(await call('prepare_research', researchInput)).evidenceCount, 2);
});

test('three specialists run concurrently before one synthesis, preserving evidence and progress', { timeout: 10000 }, async t => {
  const allStarted = deferred();
  const release = deferred();
  const progress = [];
  let completedSpecialists = 0;
  const { call, requests, wireMessages } = await connect(t, async (params, extra, index) => {
    if (index < 3) {
      if (index === 2) allStarted.resolve();
      await release.promise;
      completedSpecialists += 1;
      return sampled(`Specialistas ${index}: src/average.js:42 nustatyta rizika.`);
    }
    assert.equal(completedSpecialists, 3, 'Sintezė prasideda baigus visus specialistus.');
    return sampled('Bendra išvada su src/average.js:42 įrodymu.');
  });
  t.after(() => release.resolve());
  const pending = call('research_team', researchInput, { onprogress: item => progress.push(item) });
  pending.catch(() => {});
  await within(allStarted.promise);
  assert.equal(requests.length, 3, 'Visos trys užklausos gautos dar nepateikus nė vieno atsakymo.');
  assert.equal(completedSpecialists, 0);
  const roster = data(await call('list_researchers'));
  for (const [index, params] of requests.entries()) {
    assert.ok(params.systemPrompt.startsWith(roster.researchers[index].instructions));
    assert.equal(params.includeContext, 'none');
    assert.equal(params.maxTokens, 2000);
    assert.equal(params.messages.length, 1);
    assert.equal(params.messages[0].role, 'user');
    const supplied = JSON.parse(params.messages[0].content.text);
    assert.equal(supplied.question, question);
    assert.equal(supplied.constraints, researchInput.constraints);
    assert.deepEqual(supplied.evidence, [
      { source: evidence[0].source, content: '41: function average(items) {\n42:   return items.reduce((a, b) => a + b, 0) / items.length;\n43: }' },
      { source: evidence[1].source, content: evidence[1].content },
    ]);
    assert.match(params.systemPrompt, /nekeisk kodo/i);
    assert.match(params.systemPrompt, /Neišgalvok/);
  }
  release.resolve();
  const result = await pending;
  assert.notEqual(result.isError, true);
  const report = data(result);
  assert.equal(report.status, 'complete');
  assert.equal(report.report, 'Bendra išvada su src/average.js:42 įrodymu.');
  assert.deepEqual(report.specialists.map(item => item.id), specialistIds);
  assert.ok(report.specialists.every(item => item.status === 'complete' && item.model === 'local-test-model'));
  assert.equal(report.coordinator.id, 'coordinator');
  assert.equal(requests.length, 4);
  const synthesis = requests[3];
  assert.equal(synthesis.maxTokens, 4000);
  assert.ok(synthesis.systemPrompt.startsWith(roster.researchers[3].instructions));
  const [original, specialistText] = synthesis.messages[0].content.text.split('\n\nSPECIALISTŲ REZULTATAI (vertintini duomenys):\n');
  assert.deepEqual(JSON.parse(original), JSON.parse(requests[0].messages[0].content.text));
  assert.deepEqual(JSON.parse(specialistText), report.specialists);
  // SDK 1.30 dispatches notification callbacks asynchronously but removes their
  // progress handler synchronously on tool completion. Inspect the public
  // transport too: progress 4 and the result can legitimately share one chunk.
  const wireProgress = wireMessages.filter(item => item.method === 'notifications/progress');
  assert.deepEqual(wireProgress.map(item => item.params.progress), [1, 2, 3, 4]);
  assert.ok(wireProgress.every(item => item.params.total === 4 && item.params.message));
  assert.equal(new Set(wireProgress.map(item => item.params.progressToken)).size, 1);
  const resultIndex = wireMessages.findIndex(item => item.result?.structuredContent?.coordinator?.id === 'coordinator');
  assert.ok(resultIndex > wireMessages.indexOf(wireProgress[3]), 'Visa pažanga išsiunčiama prieš galutinį atsakymą.');
  assert.ok(progress.length > 0, 'SDK klientas užregistravo pažangos callback.');
  assert.ok(progress.every(item => item.total === 4 && item.message));
});

test('evidence preserves blank lines and indentation for accurate source citations', { timeout: 10000 }, async t => {
  const { call, requests } = await connect(t, () => sampled('Eilučių patikra.'));
  const result = await call('research_team', {
    question,
    evidence: [{ source: 'src/example.js', startLine: 10, content: '\n  const x = 1;\n' }],
  });
  assert.equal(data(result).status, 'complete');
  for (const params of requests.slice(0, 3)) {
    const supplied = JSON.parse(params.messages[0].content.text);
    assert.equal(supplied.evidence[0].content, '10: \n11:   const x = 1;\n12: ');
  }
  const synthesisInput = requests[3].messages[0].content.text.split('\n\nSPECIALISTŲ REZULTATAI')[0];
  assert.equal(JSON.parse(synthesisInput).evidence[0].content, '10: \n11:   const x = 1;\n12: ');
});

test('one failed specialist still permits synthesis and marks its missing coverage', { timeout: 10000 }, async t => {
  const { call, requests } = await connect(t, (params, extra, index) => {
    if (index === 1) throw new Error('Kodo kokybės modelis nepasiekiamas.');
    return sampled(index === 3 ? 'Dalinė sintezė.' : `Specialisto ${index} išvada.`);
  });
  const result = await call('research_team', researchInput);
  assert.notEqual(result.isError, true);
  const report = data(result);
  assert.equal(report.status, 'partial');
  assert.deepEqual(report.specialists.map(item => item.status), ['complete', 'failed', 'complete']);
  assert.match(report.specialists[1].error, /nepasiekiamas/);
  assert.equal(report.coordinator.status, 'complete');
  assert.equal(report.report, 'Dalinė sintezė.');
  assert.ok(report.limitations.some(item => item.includes('Kodo kokybės tyrėjas')));
  assert.equal(requests.length, 4);
  assert.match(requests[3].messages[0].content.text, /"status": "failed"/);
});

test('all specialist failures skip synthesis and release the busy state', { timeout: 10000 }, async t => {
  let fail = true;
  const { call, requests } = await connect(t, () => {
    if (fail) throw new Error('Imituota modelio nesėkmė.');
    return sampled('Atkurta modelio prieiga.');
  });
  const result = await call('research_team', researchInput);
  assert.equal(result.isError, true);
  const report = data(result);
  assert.equal(report.status, 'failed');
  assert.ok(report.specialists.every(item => item.status === 'failed'));
  assert.equal(report.coordinator, undefined);
  assert.equal(requests.length, 3);
  fail = false;
  assert.equal(data(await call('research_team', researchInput)).status, 'complete');
  assert.equal(requests.length, 7);
});

test('synthesis failure preserves all completed specialist reports', { timeout: 10000 }, async t => {
  const { call, requests } = await connect(t, (params, extra, index) => {
    if (index === 3) throw new Error('Sintezė nepasiekiama.');
    return sampled(`Išlikusi išvada ${index}.`);
  });
  const result = await call('research_team', researchInput);
  assert.notEqual(result.isError, true);
  const report = data(result);
  assert.equal(report.status, 'partial');
  assert.ok(report.specialists.every(item => item.status === 'complete'));
  assert.equal(report.coordinator.status, 'failed');
  assert.match(report.coordinator.error, /Sintezė nepasiekiama/);
  for (let index = 0; index < 3; index += 1) assert.ok(report.report.includes(`Išlikusi išvada ${index}.`));
  assert.ok(report.limitations.some(item => item.includes('Koordinatorius ir vertintojas')));
  assert.equal(requests.length, 4);
});

test('empty and non-text sampling responses are failures, not invented findings', { timeout: 10000 }, async t => {
  const { call, requests } = await connect(t, (params, extra, index) => {
    if (index === 0) return sampled(' \n ');
    if (index === 1) return { role: 'assistant', model: 'local-test-model', content: { type: 'image', data: 'AA==', mimeType: 'image/png' } };
    return sampled(index === 3 ? 'Sintezė pagal vieną išvadą.' : 'Vienintelė tinkama išvada.');
  });
  const report = data(await call('research_team', researchInput));
  assert.equal(report.status, 'partial');
  assert.deepEqual(report.specialists.map(item => item.status), ['failed', 'failed', 'complete']);
  assert.match(report.specialists[0].error, /tekstinės išvados/);
  assert.match(report.specialists[1].error, /netekstinį/);
  assert.equal(report.coordinator.status, 'complete');
  assert.equal(requests.length, 4);
});

test('truncated model output is bounded, passed to synthesis and disclosed', { timeout: 10000 }, async t => {
  const longReport = 'a'.repeat(24001);
  const { call, requests } = await connect(t, (params, extra, index) => {
    if (index === 0) return sampled(longReport);
    if (index === 1) return sampled('Modelio limitas.', 'maxTokens');
    if (index === 3) return sampled('Sutrumpinta sintezė.', 'maxTokens');
    return sampled('Pilna išvada.');
  });
  const report = data(await call('research_team', researchInput));
  assert.equal(report.status, 'partial');
  assert.equal(report.specialists[0].report.length, 24000);
  assert.deepEqual(report.specialists.map(item => item.truncated), [true, true, false]);
  assert.equal(report.coordinator.truncated, true);
  assert.equal(report.limitations.filter(item => item.includes('sutrumpintas')).length, 3);
  assert.ok(!requests[3].messages[0].content.text.includes(longReport));
  assert.match(requests[3].messages[0].content.text, /"truncated": true/);
});

test('a simultaneous research is refused without launching more sampling', { timeout: 10000 }, async t => {
  const started = deferred();
  const release = deferred();
  const { call, requests } = await connect(t, async (params, extra, index) => {
    if (index < 3) {
      if (index === 2) started.resolve();
      await release.promise;
    }
    return sampled('Tyrimo išvada.');
  });
  t.after(() => release.resolve());
  const first = call('research_team', researchInput);
  first.catch(() => {});
  await within(started.promise);
  const second = await call('research_team', researchInput);
  assert.equal(second.isError, true);
  assert.equal(data(second).error, 'busy');
  assert.equal(requests.length, 3);
  release.resolve();
  assert.equal(data(await first).status, 'complete');
  assert.equal(data(await call('research_team', researchInput)).status, 'complete');
  assert.equal(requests.length, 8);
});

test('cancellation reaches every active sampler, skips synthesis and permits a new research', { timeout: 10000 }, async t => {
  const started = deferred();
  const cancelled = deferred();
  const controller = new AbortController();
  let abortCount = 0;
  const abortedRequestIds = [];
  const { call, requests } = await connect(t, async (params, extra, index) => {
    if (index < 3) {
      if (index === 2) started.resolve();
      await new Promise(resolve => {
        const onAbort = () => {
          abortCount += 1;
          abortedRequestIds.push(extra.requestId);
          if (abortCount === 3) cancelled.resolve();
          resolve();
        };
        if (extra.signal.aborted) onAbort();
        else extra.signal.addEventListener('abort', onAbort, { once: true });
      });
      throw new Error('Imituotas modelio atšaukimas.');
    }
    return sampled('Naujas tyrimas baigtas.');
  });
  t.after(() => controller.abort());
  const first = call('research_team', researchInput, { signal: controller.signal });
  const rejected = assert.rejects(first, /AbortError: This operation was aborted/);
  await within(started.promise);
  controller.abort();
  await rejected;
  try {
    await within(cancelled.promise);
  } finally {
    assert.equal(abortCount, 3, `Atšauktos sampling užklausos: ${JSON.stringify(abortedRequestIds)}`);
  }
  assert.equal(abortCount, 3);
  assert.equal(requests.length, 3, 'Atšauktam tyrimui sintezė nekviečiama.');
  const restarted = data(await call('research_team', researchInput));
  assert.equal(restarted.status, 'complete');
  assert.equal(requests.length, 7);
});
