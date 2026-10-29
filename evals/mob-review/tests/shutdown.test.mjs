import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { stopController } from '../shutdown.mjs';

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`${signal} requests a graceful stop, including repeated signals`, () => {
    const events = new EventEmitter(), stop = stopController(events);
    assert.equal(stop.requested, false);
    events.emit(signal);
    assert.equal(stop.requested, true);
    assert.equal(events.emit(signal), true);
    assert.equal(stop.requested, true);
    stop.dispose();
  });
}

test('a stop can be requested directly and disposal preserves unrelated handlers', () => {
  const events = new EventEmitter(), unrelated = () => {};
  events.on('SIGINT', unrelated);
  const stop = stopController(events);
  stop.request();
  assert.equal(stop.requested, true);
  stop.dispose();
  stop.dispose();
  assert.deepEqual(events.listeners('SIGINT'), [unrelated]);
  assert.deepEqual(events.listeners('SIGTERM'), []);
});

test('disposing a controller stops further signal changes', () => {
  const events = new EventEmitter(), stop = stopController(events);
  stop.dispose();
  events.emit('SIGTERM');
  assert.equal(stop.requested, false);
});
