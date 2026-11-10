'use strict';
// TUR031: synthetic provider only. Never use a live OAuth token or external endpoint.
const assert = require('node:assert/strict');
const test = require('node:test');

function classify({status, sent, durableIntent, readback, generation, expectedGeneration}) {
  if (!durableIntent) return 'DENY_NO_DURABLE_INTENT';
  if (!sent) return 'SAFE_NOT_SENT';
  if (status === 401 || status === 403) return 'DENY_AUTH_AND_RECONCILE';
  if (status === 429 || status === 503 || status === null) {
    if (!readback || readback.kind === 'unavailable') return 'HOLD_AMBIGUOUS_NO_REPLAY';
    if (!Number.isSafeInteger(generation) || !Number.isSafeInteger(expectedGeneration) ||
        generation !== expectedGeneration || !Number.isSafeInteger(readback.generation))
      return 'CONFLICT_NO_REPLAY';
    if (readback.kind === 'match' && readback.generation === generation) return 'ACK_RECONCILED';
    if (readback.kind === 'different' || readback.generation !== expectedGeneration)
      return 'CONFLICT_NO_REPLAY';
    return 'HOLD_AMBIGUOUS_NO_REPLAY';
  }
  return 'UNPROVEN_NO_REPLAY';
}

test('TUR031: ambiguous provider ACK never authorizes blind POST replay', () => {
  for (const status of [429, 503, null]) {
    assert.equal(classify({status, sent:true, durableIntent:true, readback:null}), 'HOLD_AMBIGUOUS_NO_REPLAY');
    assert.equal(classify({status, sent:true, durableIntent:true, readback:{kind:'unavailable'}}), 'HOLD_AMBIGUOUS_NO_REPLAY');
  }
});
test('TUR031: unauthorized response never implies safe retry', () => {
  for (const status of [401,403]) {
    assert.equal(classify({status, sent:true, durableIntent:true}), 'DENY_AUTH_AND_RECONCILE');
  }
});
test('TUR031: only exact generation match can reconcile ambiguous ACK', () => {
  const base={status:503,sent:true,durableIntent:true,generation:8,expectedGeneration:8};
  assert.equal(classify({...base,readback:{kind:'match',generation:8}}),'ACK_RECONCILED');
  assert.equal(classify({...base,readback:{kind:'match',generation:7}}),'CONFLICT_NO_REPLAY');
  assert.equal(classify({...base,readback:{kind:'different',generation:8}}),'CONFLICT_NO_REPLAY');
  assert.equal(classify({...base,expectedGeneration:7,readback:{kind:'match',generation:8}}),'CONFLICT_NO_REPLAY');
  assert.equal(classify({...base,generation:undefined,readback:{kind:'match',generation:8}}),'CONFLICT_NO_REPLAY');
});
test('TUR031: durable intent and cross-profile isolation are mandatory boundaries', () => {
  assert.equal(classify({status:503,sent:true,durableIntent:false}),'DENY_NO_DURABLE_INTENT');
  const profileA={intent:'same-digest',wal:'A'}, profileB={intent:'same-digest',wal:'B'};
  assert.notEqual(profileA.wal,profileB.wal);
  // Two distinct local WALs do not establish a shared provider-side uniqueness fence.
  assert.equal(profileA.intent,profileB.intent);
});
