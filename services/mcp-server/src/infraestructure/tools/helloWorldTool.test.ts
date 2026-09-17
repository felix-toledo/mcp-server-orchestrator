import { describe, expect, it } from 'vitest';
import { registerHelloWorldTool } from './helloWorldTool.js';
import { createFakeMcpServer } from './testHelpers.js';

describe('helloWorldTool', () => {
  it('greets the given name', async () => {
    const fake = createFakeMcpServer();
    registerHelloWorldTool(fake.server);

    const result = (await fake.getHandler('hello_world')({ name: 'Felix' })) as {
      content: Array<{ text: string }>;
    };

    expect(result.content[0].text).toBe('Hello Felix!');
  });

  it('falls back to a generic greeting when no name is given', async () => {
    const fake = createFakeMcpServer();
    registerHelloWorldTool(fake.server);

    const result = (await fake.getHandler('hello_world')({})) as {
      content: Array<{ text: string }>;
    };

    expect(result.content[0].text).toBe('Hello World!');
  });
});
