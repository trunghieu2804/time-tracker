import { once } from "node:events";
import type { Server } from "node:http";
import type { Express } from "express";

export async function listen(app: Express): Promise<{ server: Server; url: string }> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The test server did not bind to a TCP port.");
  }
  const { port } = address;
  return { server, url: `http://127.0.0.1:${port}` };
}

export function closeServer(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
    server.closeIdleConnections?.();
  });
}
