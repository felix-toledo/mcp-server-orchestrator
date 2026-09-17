import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectMock = vi.fn();
const closeMock = vi.fn();
const callToolMock = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: connectMock,
    close: closeMock,
    callTool: callToolMock,
    listTools: vi.fn(),
  })),
}));

import { McpClient } from './McpClient.js';

describe('McpClient.callTool — stale MCP session recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
  });

  it('reconnects and retries once when the server reports an invalid session (regression: mcp-server restarting under --watch left the orchestrator with a dead Mcp-Session-Id)', async () => {
    callToolMock
      .mockRejectedValueOnce(
        new Error('Bad Request: a valid Mcp-Session-Id or an initialize request is required.'),
      )
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'ok' }] });

    const client = new McpClient('alma-mcp-server', {
      transport: 'streamableHttp',
      url: 'http://localhost:30020/mcp',
    });

    const result = await client.callTool('createKnowledgeEntry', { title: 'x', content: 'y' });

    expect(result).toEqual({ content: [{ type: 'text', text: 'ok' }] });
    expect(callToolMock).toHaveBeenCalledTimes(2);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('does not reconnect/retry for an unrelated tool error', async () => {
    callToolMock.mockRejectedValue(new Error('knowledge-store unreachable'));

    const client = new McpClient('alma-mcp-server', {
      transport: 'streamableHttp',
      url: 'http://localhost:30020/mcp',
    });

    await expect(client.callTool('createKnowledgeEntry', {})).rejects.toThrow('knowledge-store unreachable');
    expect(callToolMock).toHaveBeenCalledTimes(1);
    expect(closeMock).not.toHaveBeenCalled();
  });

  it('surfaces the retry failure if reconnecting does not fix it', async () => {
    callToolMock
      .mockRejectedValueOnce(new Error('a valid Mcp-Session-Id or an initialize request is required'))
      .mockRejectedValueOnce(new Error('still broken'));

    const client = new McpClient('alma-mcp-server', {
      transport: 'streamableHttp',
      url: 'http://localhost:30020/mcp',
    });

    await expect(client.callTool('createKnowledgeEntry', {})).rejects.toThrow('still broken');
    expect(callToolMock).toHaveBeenCalledTimes(2);
  });
});
