import { createServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { URL } from "url";

interface ChatMessage {
  id: string;
  channel: string;
  userId: string;
  content: string;
  replyTo?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  readBy: string[];
}

interface TypingState {
  userId: string;
  channel: string;
  startedAt: string;
}

interface ReadReceipt {
  messageId: string;
  userId: string;
  readAt: string;
}

const messages: ChatMessage[] = [];
const channels = new Map<string, Set<WebSocket>>();
const typingUsers = new Map<string, TypingState>();
const readReceipts: ReadReceipt[] = [];
const clients = new Map<WebSocket, { userId: string; channel: string }>();

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function broadcast(channel: string, data: object, exclude?: WebSocket) {
  const chClients = channels.get(channel);
  if (!chClients) return;
  const payload = JSON.stringify(data);
  for (const client of chClients) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastAll(data: object, exclude?: WebSocket) {
  const payload = JSON.stringify(data);
  for (const [client] of clients) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function cleanupTyping(channel: string) {
  const prefix = `${channel}:`;
  const now = Date.now();
  for (const [key, state] of typingUsers) {
    if (key.startsWith(prefix)) {
      if (now - new Date(state.startedAt).getTime() > 10000) {
        typingUsers.delete(key);
      }
    }
  }
}

const server = createServer((req: IncomingMessage, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
    return;
  }

  if (url.pathname === "/channels") {
    const channelList = Array.from(channels.keys()).map((ch) => ({
      name: ch,
      clients: channels.get(ch)?.size || 0,
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ channels: channelList }));
    return;
  }

  if (url.pathname === "/stats") {
    const typingNow: TypingState[] = [];
    for (const [, state] of typingUsers) typingNow.push(state);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      totalMessages: messages.length,
      totalClients: clients.size,
      channels: Array.from(channels.keys()),
      activeTyping: typingNow,
      recentReadReceipts: readReceipts.slice(-20),
    }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Chat server running");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
  ws.send(JSON.stringify({ type: "system", message: "Connected to chat", serverTime: new Date().toISOString() }));

  ws.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString());

      switch (parsed.type) {
        case "join": {
          const { channel, userId, displayName } = parsed;
          if (!channel || !userId) {
            ws.send(JSON.stringify({ type: "error", message: "channel and userId required" }));
            return;
          }
          clients.set(ws, { userId, channel });
          if (!channels.has(channel)) channels.set(channel, new Set());
          channels.get(channel)!.add(ws);
          const joinMsg: ChatMessage = {
            id: generateId(),
            channel,
            userId,
            content: `${displayName || userId} joined the channel`,
            metadata: { system: true, event: "join" },
            createdAt: new Date().toISOString(),
            readBy: [],
          };
          messages.push(joinMsg);
          broadcast(channel, { type: "message", message: joinMsg }, ws);
          ws.send(JSON.stringify({
            type: "joined",
            channel,
            userId,
            recentMessages: messages.filter((m) => m.channel === channel).slice(-50),
          }));
          break;
        }

        case "message": {
          const info = clients.get(ws);
          if (!info) {
            ws.send(JSON.stringify({ type: "error", message: "Must join a channel first" }));
            return;
          }
          const msg: ChatMessage = {
            id: generateId(),
            channel: info.channel,
            userId: info.userId,
            content: parsed.content,
            replyTo: parsed.replyTo,
            metadata: parsed.metadata || {},
            createdAt: new Date().toISOString(),
            readBy: [],
          };
          messages.push(msg);
          broadcast(info.channel, { type: "message", message: msg });
          break;
        }

        case "typing": {
          const info = clients.get(ws);
          if (!info) return;
          const key = `${info.channel}:${info.userId}`;
          if (parsed.isTyping) {
            typingUsers.set(key, { userId: info.userId, channel: info.channel, startedAt: new Date().toISOString() });
          } else {
            typingUsers.delete(key);
          }
          cleanupTyping(info.channel);
          const typingList = Array.from(typingUsers.values())
            .filter((t) => t.channel === info.channel)
            .map((t) => t.userId);
          broadcast(info.channel, { type: "typing", channel: info.channel, typingUsers: typingList }, ws);
          break;
        }

        case "read": {
          const info = clients.get(ws);
          if (!info) return;
          const receipt: ReadReceipt = { messageId: parsed.messageId, userId: info.userId, readAt: new Date().toISOString() };
          readReceipts.push(receipt);
          const targetMsg = messages.find((m) => m.id === parsed.messageId);
          if (targetMsg && !targetMsg.readBy.includes(info.userId)) {
            targetMsg.readBy.push(info.userId);
          }
          broadcast(info.channel, { type: "read_receipt", receipt });
          break;
        }

        case "search": {
          const q = (parsed.query || "").toLowerCase();
          const results = messages
            .filter((m) => m.content.toLowerCase().includes(q))
            .filter((m) => !parsed.channel || m.channel === parsed.channel)
            .slice(0, parsed.limit || 20);
          ws.send(JSON.stringify({ type: "search_results", query: parsed.query, results }));
          break;
        }

        default:
          ws.send(JSON.stringify({ type: "error", message: `Unknown type: ${parsed.type}` }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info) {
      const ch = channels.get(info.channel);
      if (ch) {
        ch.delete(ws);
        if (ch.size === 0) channels.delete(info.channel);
      }
      const leaveMsg: ChatMessage = {
        id: generateId(),
        channel: info.channel,
        userId: info.userId,
        content: `${info.userId} left the channel`,
        metadata: { system: true, event: "leave" },
        createdAt: new Date().toISOString(),
        readBy: [],
      };
      messages.push(leaveMsg);
      broadcast(info.channel, { type: "message", message: leaveMsg });
      typingUsers.delete(`${info.channel}:${info.userId}`);
    }
    clients.delete(ws);
  });
});

const PORT = parseInt(process.env.WS_PORT || process.env.PORT || "3001");
server.listen(PORT, () => console.log(`Chat server on port ${PORT}`));
