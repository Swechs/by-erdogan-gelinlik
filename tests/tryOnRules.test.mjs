import test from 'node:test';
import assert from 'node:assert/strict';
import {tryOnMode, isTerminal, isFinalStatus, extensionFor, downloadName} from '../components/tryOnRules.ts';

const live = {preview: false, tryOn: false, freeTryOn: true};
const real = on => ({tryOn: on, concept: false});
const concept = {tryOn: false, concept: true};

test('an admin switching try-on off for a real model closes every provider', () => {
  assert.equal(tryOnMode(live, real(false)), null);
  assert.equal(tryOnMode({...live, tryOn: true}, real(false)), null);
});

test('enabled real models use the business provider when configured, else the free demo', () => {
  assert.equal(tryOnMode({...live, tryOn: true}, real(true)), 'paid');
  assert.equal(tryOnMode(live, real(true)), 'free');
  assert.equal(tryOnMode({...live, freeTryOn: false}, real(true)), null);
});

test('concept models never reach the business provider and follow the free-demo switch', () => {
  assert.equal(tryOnMode({...live, tryOn: true}, concept), 'free');
  assert.equal(tryOnMode({...live, freeTryOn: false}, concept), null);
});

test('preview mode and missing models never start a try-on', () => {
  assert.equal(tryOnMode({...live, preview: true}, real(true)), null);
  assert.equal(tryOnMode(live, undefined), null);
});

test('expired and deleted jobs stop polling', () => {
  for (const s of ['succeeded', 'failed', 'expired']) assert.equal(isTerminal(s), true);
  for (const s of ['queued', 'processing', 'uploading']) assert.equal(isTerminal(s), false);
  assert.equal(isFinalStatus(410), true);
  assert.equal(isFinalStatus(404), true);
  assert.equal(isFinalStatus(503), false);
  assert.equal(isFinalStatus(undefined), false);
});

test('download extension matches the real image format', () => {
  assert.equal(extensionFor('image/jpeg'), 'jpg');
  assert.equal(extensionFor('image/png'), 'png');
  assert.equal(extensionFor('image/webp; charset=binary'), 'webp');
  assert.equal(extensionFor(''), 'png');
  assert.equal(downloadName('Lâle', 'image/jpeg'), 'By-Erdogan-Lale.jpg');
  assert.equal(downloadName('İris', 'image/png'), 'By-Erdogan-Iris.png');
  assert.equal(downloadName(undefined, 'image/webp'), 'By-Erdogan-Prova.webp');
});
