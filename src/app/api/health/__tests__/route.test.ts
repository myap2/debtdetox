/**
 * @jest-environment node
 */

import { GET } from '../route';

describe('/api/health', () => {
  it('returns a stable ok response without external dependencies', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'debtdetox',
    });
  });
});
