import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  SendMessageSchema,
  GetMessagesSchema,
  JoinChannelSchema,
  SearchMessagesSchema,
  MarkReadSchema,
  TypingIndicatorSchema,
  GetMessageStatsSchema,
} from "./schemas.js";

class ChatStore {
  constructor() {
    this.channels = new Map();
    this.messages = new Map();
    this.members = new Map();
    this.typing = new Map();
    this.readReceipts = new Map();
  }

  addMessage(msg) {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const message = {
      id,
      channel: msg.channel,
      userId: msg.userId,
      content: msg.content,
      replyTo: msg.replyTo || null,
      metadata: msg.metadata || {},
      createdAt: new Date().toISOString(),
      readBy: [],
      reactions: {},
    };
    if (!this.messages.has(msg.channel)) this.messages.set(msg.channel, []);
    this.messages.get(msg.channel).push(message);
    return message;
  }

  getMessages(channel, limit = 50, before = null, after = null) {
    const msgs = this.messages.get(channel) || [];
    let filtered = msgs;
    if (before) {
      const idx = msgs.findIndex((m) => m.id === before);
      if (idx >= 0) filtered = msgs.slice(0, idx);
    }
    if (after) {
      const idx = msgs.findIndex((m) => m.id === after);
      if (idx >= 0) filtered = msgs.slice(idx + 1);
    }
    return filtered.slice(-limit);
  }

  searchMessages(query, channel = null, userId = null, limit = 20, after = null, before = null) {
    const q = query.toLowerCase();
    let allMsgs = [];
    for (const [ch, msgs] of this.messages) {
      if (channel && ch !== channel) continue;
      allMsgs.push(...msgs);
    }
    if (userId) allMsgs = allMsgs.filter((m) => m.userId === userId);
    let results = allMsgs.filter((m) => m.content.toLowerCase().includes(q));
    if (after) results = results.filter((m) => m.createdAt > after);
    if (before) results = results.filter((m) => m.createdAt < before);
    return results
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((m) => ({ ...m, matchIndex: m.content.toLowerCase().indexOf(q), matchContext: m.content.substring(Math.max(0, m.content.toLowerCase().indexOf(q) - 30), m.content.toLowerCase().indexOf(q) + q.length + 30) }));
  }

  markRead(channel, userId, messageId) {
    const msgs = this.messages.get(channel) || [];
    const msg = msgs.find((m) => m.id === messageId);
    if (!msg) return null;
    if (!msg.readBy.includes(userId)) msg.readBy.push(userId);
    const key = `${channel}:${userId}`;
    if (!this.readReceipts.has(key)) this.readReceipts.set(key, []);
    this.readReceipts.get(key).push({ messageId, readAt: new Date().toISOString() });
    return { messageId, readBy: msg.readBy, readAt: new Date().toISOString() };
  }

  getReadReceipts(channel, userId) {
    const msgs = this.messages.get(channel) || [];
    return msgs.map((m) => ({ messageId: m.id, readBy: m.readBy, isOwn: m.userId === userId }));
  }

  setTyping(channel, userId, isTyping) {
    const key = `${channel}:${userId}`;
    if (isTyping) {
      this.typing.set(key, { userId, channel, startedAt: new Date().toISOString() });
    } else {
      this.typing.delete(key);
    }
  }

  getTypingUsers(channel) {
    const prefix = `${channel}:`;
    const now = Date.now();
    const users = [];
    for (const [key, val] of this.typing) {
      if (key.startsWith(prefix)) {
        const elapsed = now - new Date(val.startedAt).getTime();
        if (elapsed < 10000) users.push(val.userId);
        else this.typing.delete(key);
      }
    }
    return users;
  }

  joinChannel(channel, userId, displayName) {
    if (!this.members.has(channel)) this.members.set(channel, new Map());
    this.members.get(channel).set(userId, { userId, displayName: displayName || userId, joinedAt: new Date().toISOString() });
    return this.members.get(channel).get(userId);
  }

  getMembers(channel) {
    const members = this.members.get(channel);
    return members ? Array.from(members.values()) : [];
  }

  getStats(channel) {
    const msgs = this.messages.get(channel) || [];
    const userCounts = {};
    const hourlyDistribution = new Array(24).fill(0);
    let totalLength = 0;
    for (const m of msgs) {
      userCounts[m.userId] = (userCounts[m.userId] || 0) + 1;
      const hour = new Date(m.createdAt).getHours();
      hourlyDistribution[hour]++;
      totalLength += m.content.length;
    }
    return {
      channel,
      totalMessages: msgs.length,
      uniqueUsers: Object.keys(userCounts).length,
      messagesPerUser: userCounts,
      avgMessageLength: msgs.length ? Math.round(totalLength / msgs.length) : 0,
      hourlyDistribution,
      firstMessage: msgs[0]?.createdAt || null,
      lastMessage: msgs[msgs.length - 1]?.createdAt || null,
    };
  }
}

const store = new ChatStore();

export class RealTimeChatStarterServer {
  constructor() {
    this.server = new McpServer({
      name: "real-time-chat-starter",
      version: "1.0.0",
    });
    this.setupTools();
  }

  setupTools() {
    this.server.tool(
      "send_message",
      "Send a message with persistence, optional reply threading, and metadata",
      SendMessageSchema.shape,
      async (args) => {
        const msg = store.addMessage(args);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, message: msg }, null, 2) }] };
      }
    );

    this.server.tool(
      "get_messages",
      "Retrieve messages with pagination support (before/after cursors)",
      GetMessagesSchema.shape,
      async (args) => {
        const { channel, limit, before, after } = args;
        const messages = store.getMessages(channel, limit, before, after);
        return { content: [{ type: "text", text: JSON.stringify({ channel, count: messages.length, messages }, null, 2) }] };
      }
    );

    this.server.tool(
      "join_channel",
      "Join a chat channel with optional display name",
      JoinChannelSchema.shape,
      async (args) => {
        const member = store.joinChannel(args.channel, args.userId, args.displayName);
        const members = store.getMembers(args.channel);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, member, totalMembers: members.length }, null, 2) }] };
      }
    );

    this.server.tool(
      "search_messages",
      "Full-text search across chat messages with channel/user filters and context highlighting",
      SearchMessagesSchema.shape,
      async (args) => {
        const results = store.searchMessages(args.query, args.channel, args.userId, args.limit, args.after, args.before);
        return { content: [{ type: "text", text: JSON.stringify({ query: args.query, resultCount: results.length, results }, null, 2) }] };
      }
    );

    this.server.tool(
      "mark_read",
      "Mark a message as read by a user, tracking read receipts",
      MarkReadSchema.shape,
      async (args) => {
        const receipt = store.markRead(args.channel, args.userId, args.messageId);
        if (!receipt) return { content: [{ type: "text", text: `Message ${args.messageId} not found in channel ${args.channel}` }] };
        return { content: [{ type: "text", text: JSON.stringify({ success: true, receipt }, null, 2) }] };
      }
    );

    this.server.tool(
      "set_typing",
      "Broadcast typing indicator state for a user in a channel",
      TypingIndicatorSchema.shape,
      async (args) => {
        store.setTyping(args.channel, args.userId, args.isTyping);
        const typingUsers = store.getTypingUsers(args.channel);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, channel: args.channel, typingUsers, count: typingUsers.length }, null, 2) }] };
      }
    );

    this.server.tool(
      "get_message_stats",
      "Get channel statistics: message count, user activity, hourly distribution",
      GetMessageStatsSchema.shape,
      async (args) => {
        const stats = store.getStats(args.channel);
        return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
      }
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("Real-Time Chat MCP Server running on stdio");
  }
}
