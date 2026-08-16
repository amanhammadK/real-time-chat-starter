import { z } from "zod";

export const SendMessageSchema = z.object({
  channel: z.string().min(1, "Channel is required"),
  userId: z.string().min(1, "User ID is required"),
  content: z.string().min(1, "Message content is required"),
  replyTo: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const GetMessagesSchema = z.object({
  channel: z.string().min(1, "Channel is required"),
  limit: z.number().int().positive().optional().default(50),
  before: z.string().optional(),
  after: z.string().optional(),
});

export const JoinChannelSchema = z.object({
  channel: z.string().min(1, "Channel is required"),
  userId: z.string().min(1, "User ID is required"),
  displayName: z.string().optional(),
});

export const SearchMessagesSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  channel: z.string().optional(),
  userId: z.string().optional(),
  limit: z.number().int().positive().optional().default(20),
  after: z.string().optional(),
  before: z.string().optional(),
});

export const MarkReadSchema = z.object({
  channel: z.string().min(1, "Channel is required"),
  userId: z.string().min(1, "User ID is required"),
  messageId: z.string().min(1, "Message ID is required"),
});

export const TypingIndicatorSchema = z.object({
  channel: z.string().min(1, "Channel is required"),
  userId: z.string().min(1, "User ID is required"),
  isTyping: z.boolean(),
});

export const GetMessageStatsSchema = z.object({
  channel: z.string().min(1, "Channel is required"),
});
