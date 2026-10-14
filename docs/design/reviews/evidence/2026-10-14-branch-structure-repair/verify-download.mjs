import assert from 'node:assert/strict';
import { URL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse, flowableAdapter } from '../../../../../packages/core/dist/index.js';

const inputBytes = readFileSync(new URL('./input.flowduet.json', import.meta.url));
const outputBytes = readFileSync(new URL('./downloaded.flowduet.json', import.meta.url));
const input = await parse(JSON.parse(inputBytes).xml, { adapter: flowableAdapter });
const output = await parse(JSON.parse(outputBytes).xml, { adapter: flowableAdapter });
const edge = output.elementOf('fa');
assert.equal(edge.get('targetRef'), output.elementOf('tail'));
assert.equal(edge.get('name'), '默认采购支路');
assert.equal(output.elementOf('fork').get('default'), edge);
assert.deepEqual(output.elementOf('fork').get('outgoing').map(f => f.get('id')), ['fa', 'fb']);
assert.equal(output.elementOf('fb').get('conditionExpression').get('body'), '${amount > 100}');
assert.throws(() => output.elementOf('a'));
assert.throws(() => output.elementOf('at'));
assert.equal(output.shapeOf('tail').y, 256);
assert.equal(input.shapeOf('tail').y, 396);
const bounds = output.shapeOf('tail');
assert.deepEqual(output.waypointsOf('fa').at(-1), { x: bounds.x + bounds.width / 2, y: bounds.y });
const plane = output.definitions.get('diagrams')[0].get('plane');
const ids = plane.get('planeElement').map(el => el.get('bpmnElement').get('id'));
assert(!ids.includes('a') && !ids.includes('at'));
const result = {
  inputSha256: createHash('sha256').update(inputBytes).digest('hex'),
  downloadedSha256: createHash('sha256').update(outputBytes).digest('hex'),
  assertionsPassed: true,
  branchHead: { id: edge.get('id'), target: edge.get('targetRef').get('id'), default: true },
  outgoingOrder: ['fa', 'fb'], siblingCondition: '${amount > 100}',
  tailY: { before: input.shapeOf('tail').y, after: output.shapeOf('tail').y },
  browser: 'Playwright CLI Chromium; real file chooser and download; native Playground',
  console: 'Only favicon.ico 404; no application exception observed',
};
writeFileSync(new URL('./download-verification.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
