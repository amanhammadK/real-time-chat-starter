"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
const DEFAULT_CHANNEL = "general";

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ChatApp() {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [channel, setChannel] = useState(DEFAULT_CHANNEL);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [channels, setChannels] = useState([DEFAULT_CHANNEL]);
  const [members, setMembers] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => {
      setConnected(false);
      setJoined(false);
    };
    socket.onerror = () => setConnected(false);
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
          setMessages((prev) => [...prev, data.message]);
        } else if (data.type === "joined") {
          setJoined(true);
          setMessages(data.recentMessages || []);
        } else if (data.type === "typing") {
          setTypingUsers(data.typingUsers || []);
        } else if (data.type === "search_results") {
          setSearchResults(data.results || []);
        } else if (data.type === "system") {
          setMessages((prev) => [...prev, {
            id: `sys_${Date.now()}`,
            content: data.message,
            system: true,
            createdAt: new Date().toISOString(),
          }]);
        }
      } catch {}
    };
    setWs(socket);
    return () => socket.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const joinChannel = (ch) => {
    if (!ws || !displayName.trim() || ws.readyState !== WebSocket.OPEN) return;
    const id = userId || `user_${Math.random().toString(36).slice(2, 8)}`;
    setUserId(id);
    setChannel(ch);
    ws.send(JSON.stringify({ type: "join", channel: ch, userId: id, displayName: displayName.trim() }));
  };

  const sendMessage = () => {
    if (!ws || !input.trim() || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "message", content: input.trim() }));
    setInput("");
  };

  const notifyTyping = (isTyping) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "typing", isTyping }));
  };

  const runSearch = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "search", query: searchQuery, limit: 20 }));
  };

  const pickChannel = (ch) => {
    if (!channels.includes(ch)) setChannels((prev) => [...prev, ch]);
    joinChannel(ch);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!joined) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0f172a", fontFamily: "Inter, system-ui, sans-serif",
      }}>
        <div style={{
          background: "#fff", borderRadius: 16, padding: "2.5rem", width: 380,
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" }}>Join the chat</div>
          <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: 0, marginBottom: "1.5rem" }}>
            {connected ? "Connected. Enter your display name to start." : `Connecting to ${WS_URL}...`}
          </p>
          <label style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Alex"
            style={{
              width: "100%", padding: "0.65rem 0.75rem", margin: "0.4rem 0 1rem", border: "1px solid #e2e8f0",
              borderRadius: 8, fontSize: "0.9rem", boxSizing: "border-box",
            }}
          />
          <label style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>Channel</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            style={{ width: "100%", padding: "0.65rem 0.75rem", margin: "0.4rem 0 1.25rem", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: "0.9rem", background: "#fff" }}
          >
            <option value="general">general</option>
            <option value="announcements">announcements</option>
            <option value="support">support</option>
            <option value="random">random</option>
          </select>
          <button
            onClick={() => joinChannel(channel)}
            disabled={!connected || !displayName.trim()}
            style={{
              width: "100%", padding: "0.7rem", background: "#6366f1", color: "#fff", border: "none",
              borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.9rem",
              opacity: connected && displayName.trim() ? 1 : 0.5,
            }}
          >
            Enter chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", height: "100vh", background: "#f8fafc", fontFamily: "Inter, system-ui, sans-serif", overflow: "hidden",
    }}>
      <aside style={{
        width: 240, background: "#0f172a", color: "#e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        <div style={{ padding: "1.25rem", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>Chatter</div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
            <span style={{ color: connected ? "#10b981" : "#ef4444" }}>●</span> {connected ? "Connected" : "Disconnected"}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 0" }}>
          <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", padding: "0 1.25rem 0.5rem" }}>Channels</div>
          {channels.map((ch) => (
            <button
              key={ch}
              onClick={() => pickChannel(ch)}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", textAlign: "left",
                padding: "0.5rem 1.25rem", background: "transparent", border: "none", cursor: "pointer",
                color: channel === ch ? "#a5b4fc" : "#94a3b8", fontSize: "0.875rem", fontWeight: channel === ch ? 600 : 400,
              }}
            >
              <span style={{ color: "#6366f1" }}>#</span> {ch}
            </button>
          ))}
        </div>
        <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #1e293b", fontSize: "0.8rem", color: "#94a3b8" }}>
          Signed in as <strong style={{ color: "#e2e8f0" }}>{displayName}</strong>
        </div>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.5rem",
          background: "#fff", borderBottom: "1px solid #e2e8f0",
        }}>
          <div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}># {channel}</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
              {typingUsers.length > 0 ? `${typingUsers.join(", ")} typing...` : `${messages.length} messages`}
            </div>
          </div>
          <button
            onClick={() => { setSearchOpen(!searchOpen); setSearchResults([]); }}
            style={{ padding: "0.4rem 0.9rem", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem" }}
          >
            {searchOpen ? "Close search" : "Search messages"}
          </button>
        </header>

        {searchOpen && (
          <div style={{ padding: "0.75rem 1.5rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search message content..."
                style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: "0.875rem" }}
              />
              <button onClick={runSearch} style={{ padding: "0.5rem 1rem", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                Search
              </button>
            </div>
            {searchResults.length > 0 && (
              <div style={{ marginTop: "0.75rem", maxHeight: 200, overflowY: "auto" }}>
                {searchResults.map((r) => (
                  <div key={r.id} style={{ padding: "0.5rem", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, marginBottom: "0.35rem", fontSize: "0.85rem" }}>
                    <strong>{r.userId}</strong>: {r.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {messages.map((m) => (
            <div key={m.id} style={{
              alignSelf: m.userId === userId ? "flex-end" : "flex-start",
              maxWidth: "70%",
            }}>
              {m.system ? (
                <div style={{
                  fontSize: "0.8rem", color: "#94a3b8", textAlign: "center", background: "#f1f5f9",
                  padding: "0.35rem 1rem", borderRadius: 999, margin: "0 auto",
                }}>
                  {m.content}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.15rem", paddingLeft: m.userId === userId ? 0 : "0.35rem" }}>
                    {m.userId === userId ? "You" : m.userId} &middot; {formatTime(m.createdAt)}
                  </div>
                  <div style={{
                    background: m.userId === userId ? "#6366f1" : "#fff",
                    color: m.userId === userId ? "#fff" : "#0f172a",
                    border: m.userId === userId ? "none" : "1px solid #e2e8f0",
                    padding: "0.6rem 0.9rem", borderRadius: 12, fontSize: "0.9rem", boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}>
                    {m.content}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <footer style={{ padding: "0.75rem 1.5rem 1.25rem", background: "#fff", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); notifyTyping(true); }}
              onBlur={() => notifyTyping(false)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${channel}`}
              rows={1}
              style={{
                flex: 1, padding: "0.65rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: 10,
                resize: "none", fontSize: "0.9rem", fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              style={{
                padding: "0.65rem 1.5rem", background: "#6366f1", color: "#fff", border: "none", borderRadius: 10,
                cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", opacity: input.trim() ? 1 : 0.5,
              }}
            >
              Send
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}