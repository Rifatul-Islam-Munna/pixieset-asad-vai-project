// Native Node runs Archiver 8's ESM implementation; no application build needed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const { streamPhotoZip } = require('../src/lib/stream-photo-zip.ts');

function sink(write = (_chunk, callback) => callback()) {
  return new Writable({ highWaterMark: 16 * 1024, write(chunk, _encoding, callback) { write(chunk, callback); } });
}

test('one automatic ZIP contains every file inside one folder, byte-for-byte', async () => {
  const files = [['Gallery/first.jpg', Buffer.from([255, 216, 255, 1, 2, 3])], ['Gallery/second.png', Buffer.from('original image bytes')]];
  const chunks = [];
  await streamPhotoZip((async function* () {
    for (const [name, body] of files) yield { name, open: async () => Readable.from([body]) };
  })(), sink((chunk, cb) => { chunks.push(chunk); cb(); }), new AbortController().signal);
  const zip = Buffer.concat(chunks);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  let index = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  const actual = [];
  while (index >= 0 && zip.readUInt32LE(index) === 0x02014b50) {
    assert.equal(zip.readUInt16LE(index + 10), 0, 'photos must be stored without compression');
    const size = zip.readUInt32LE(index + 20);
    const nameLength = zip.readUInt16LE(index + 28);
    const name = zip.toString('utf8', index + 46, index + 46 + nameLength);
    const local = zip.readUInt32LE(index + 42);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    actual.push([name, zip.subarray(start, start + size)]);
    index += 46 + nameLength + zip.readUInt16LE(index + 30) + zip.readUInt16LE(index + 32);
  }
  assert.deepEqual(actual, files);
  assert.ok(zip.includes(Buffer.from([0x50, 0x4b, 0x06, 0x06])), 'ZIP64 enables galleries over 4 GB');
});

test('128 MB gallery stays bounded under slow-client backpressure, one upstream at a time', async () => {
  let produced = 0, written = 0, maxAhead = 0, active = 0, maxActive = 0;
  const destination = sink((chunk, cb) => { written += chunk.length; setImmediate(cb); });
  await streamPhotoZip((async function* () {
    for (let file = 0; file < 4; file++) yield {
      name: `Gallery/photo-${file}.jpg`,
      open: async () => {
        active++; maxActive = Math.max(active, maxActive);
        const body = Readable.from((async function* () {
          for (let chunk = 0; chunk < 512; chunk++) {
            produced += 65536; maxAhead = Math.max(maxAhead, produced - written);
            yield Buffer.alloc(65536, file);
          }
        })(), { objectMode: false, highWaterMark: 65536 });
        body.once('end', () => active--);
        return body;
      },
    };
  })(), destination, new AbortController().signal);
  assert.equal(produced, 128 * 1024 * 1024);
  assert.equal(maxActive, 1);
  assert.ok(maxAhead < 2 * 1024 * 1024, `read-ahead exceeded budget: ${maxAhead}`);
});

test('disconnect cancels the upstream and never opens the next photo', async () => {
  const controller = new AbortController();
  let opens = 0, source;
  const destination = sink((_chunk, cb) => { controller.abort(new Error('browser closed')); cb(); });
  await assert.rejects(streamPhotoZip((async function* () {
    for (let i = 0; i < 2; i++) yield { name: `Gallery/${i}.jpg`, open: async () => {
      opens++;
      source = Readable.from((async function* () { for (let n = 0; n < 100; n++) yield Buffer.alloc(65536); })(), { objectMode: false });
      return source;
    } };
  })(), destination, controller.signal));
  assert.equal(opens, 1); assert.equal(source.destroyed, true);
});

test('storage errors fail the ZIP instead of silently omitting files', async () => {
  await assert.rejects(streamPhotoZip((async function* () {
    yield { name: 'Gallery/bad.jpg', open: async () => Readable.from((async function* () {
      yield Buffer.from('partial'); throw new Error('storage unavailable');
    })()) };
  })(), sink(), new AbortController().signal), /storage unavailable|aborted/i);
});

test('stalled storage headers abort rather than keeping a download slot forever', async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(streamPhotoZip((async function* () {
      yield { name: 'Gallery/stalled.jpg', open: (signal) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }) };
    })(), sink(), new AbortController().signal, 20), /stalled/);
  } finally { clearTimeout(keepAlive); }
});
