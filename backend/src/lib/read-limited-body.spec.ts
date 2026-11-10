import { readLimitedBody } from './read-limited-body';

describe('bounded response reads', () => {
  it('reads normal bodies', async () => {
    expect((await readLimitedBody(new Response('photo'), 5)).toString()).toBe('photo');
  });

  it('cancels oversized streams without Content-Length', async () => {
    const cancel = jest.fn();
    const body = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(8)); }, cancel,
    });
    await expect(readLimitedBody(new Response(body), 4)).rejects.toThrow('memory budget');
    expect(cancel).toHaveBeenCalled();
  });

  it('rejects declared oversized bodies before reading', async () => {
    await expect(readLimitedBody(new Response('huge', { headers: { 'content-length': '99999' } }), 4)).rejects.toThrow('memory budget');
  });
});
