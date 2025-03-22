import http from "http";
import zlib from "zlib";
import WebSocket, { WebSocketServer } from "ws";
import express, { Request, Response } from "express";

// Utility to manage WebSocket client connections
class WebSocketManager {
  private clients: WebSocket[] = [];

  public addClient(ws: WebSocket) {
    this.clients.push(ws);
    ws.on("close", () => this.removeClient(ws));
  }

  public removeClient(ws: WebSocket) {
    const index = this.clients.indexOf(ws);
    if (index !== -1) {
      this.clients.splice(index, 1);
    }
  }

  public sendToAll(message: any, gzipCompressionRequired = false) {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const messageString = JSON.stringify(message);
        if (!gzipCompressionRequired) {
          client.send(messageString);
        } else {
          zlib.gzip(messageString, (err, compressed) => {
            if (err) {
              console.error("Compression error:", err);
              return;
            }
            client.send(compressed);
          });
        }
      }
    });
  }

  public closeAll() {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, "Server initiated close");
      }
    });
  }

  public simulateError() {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.emit("error", new Error("Simulated server error"));
      }
    });
  }
}

// Function to create and configure the WebSocket server and Express app
export function createMockWebSocketServer(port: number) {
  const app = express();
  app.use(express.json()); // Middleware to parse JSON requests

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const wsManager = new WebSocketManager();

  // Set up WebSocket server connection
  wss.on("connection", (ws: WebSocket) => {
    wsManager.addClient(ws);
  });

  // HTTP routes
  app.post("/ping", (req: Request, res: Response) => {
    wsManager.sendToAll({ type: "ping" });
    res.send("Ping sent to all clients");
  });

  app.post("/message", (req: Request, res: Response) => {
    const { message, gzipCompressionRequired } = req.body;
    if (!message) {
      res.status(400).json({ error: "Message is required" });
    }

    if (gzipCompressionRequired) {
      wsManager.sendToAll(message, true);
    } else {
      wsManager.sendToAll(message);
    }

    res.send(`Message ${message} sent to all clients`);
  });

  app.post("/close", (req: Request, res: Response) => {
    wsManager.closeAll();
    res.send("Close signal sent to all clients");
  });

  app.post("/error", (req: Request, res: Response) => {
    wsManager.simulateError();
    res.send("Error signal sent to all clients");
  });

  // Function to close both WebSocket and HTTP servers
  const close = async () => {
    // Close websocket server
    await new Promise<void>((resolve, reject) => {
      wss.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  server.listen(port);

  return { app, wss, server, close };
}
