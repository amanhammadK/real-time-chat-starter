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

  const getInitials = (name) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  const avatarColors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
  const getAvatarColor = (name) => avatarColors[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length];

  if (!joined) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}>
        <div style={{
          background: "#fff", borderRadius: 16, padding: "2.5rem 2rem", width: 400,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
        }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem" }}>💬</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Join the chat</div>
            <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "0.35rem", marginBottom: 0 }}>
              {connected ? "Enter your display name to get started" : `Connecting to ${WS_URL}...`}
            </p>
          </div>
          <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinChannel(channel)}
            placeholder="e.g. Alex"
            style={{
              width: "100%", padding: "0.7rem 0.85rem", margin: "0.4rem 0 1rem", border: "1px solid #e2e8f0",
              borderRadius: 10, fontSize: "0.9rem", boxSizing: "border-box", outline: "none",
              transition: "border-color 0.15s ease",
            }}
          />
          <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Channel</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            style={{ width: "100%", padding: "0.7rem 0.85rem", margin: "0.4rem 0 1.25rem", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: "0.9rem", background: "#fff", outline: "none" }}
          >
            <option value="general"># general</option>
            <option value="announcements"># announcements</option>
            <option value="support"># support</option>
            <option value="random"># random</option>
          </select>
          <button
            onClick={() => joinChannel(channel)}
            disabled={!connected || !displayName.trim()}
            style={{
              width: "100%", padding: "0.75rem", background: connected && displayName.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#94a3b8",
              color: "#fff", border: "none", borderRadius: 10, cursor: connected && displayName.trim() ? "pointer" : "not-allowed",
              fontWeight: 600, fontSize: "0.9rem", boxShadow: connected && displayName.trim() ? "0 4px 12px rgba(99,102,241,0.3)" : "none",
              transition: "all 0.2s ease",
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
      display: "flex", height: "100vh", background: "#f1f5f9", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", overflow: "hidden",
    }}>
      <aside style={{
        width: 260, background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)", color: "#e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0, boxShadow: "4px 0 24px rgba(0,0,0,0.15)",
      }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Chatter</div>
          <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: 4, display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444", display: "inline-block" }}></span>
            {connected ? "Connected" : "Disconnected"}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 0" }}>
          <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", padding: "0 1.5rem 0.5rem", fontWeight: 600 }}>Channels</div>
          {channels.map((ch) => (
            <button
              key={ch}
              onClick={() => pickChannel(ch)}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", textAlign: "left",
                padding: "0.55rem 1.5rem", background: channel === ch ? "rgba(99,102,241,0.15)" : "transparent",
                border: "none", cursor: "pointer", borderLeft: channel === ch ? "3px solid #818cf8" : "3px solid transparent",
                color: channel === ch ? "#c7d2fe" : "#94a3b8", fontSize: "0.875rem", fontWeight: channel === ch ? 600 : 400,
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ color: "#6366f1", fontWeight: 700 }}>#</span> {ch}
            </button>
          ))}
        </div>
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #1e293b", display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: getAvatarColor(displayName),
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
          }}>{getInitials(displayName)}</div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "#e2e8f0", fontWeight: 600 }}>{displayName}</div>
            <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Online</div>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.75rem",
          background: "#fff", borderBottom: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "#6366f1", fontWeight: 700, fontSize: "1rem" }}>#</span>
            <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>{channel}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
              {typingUsers.length > 0 ? (
                <span style={{ color: "#6366f1", fontWeight: 500 }}>{typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...</span>
              ) : (
                <span>{messages.length} message{messages.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            <button
              onClick={() => { setSearchOpen(!searchOpen); setSearchResults([]); }}
              style={{ padding: "0.4rem 0.9rem", background: searchOpen ? "#6366f1" : "#f1f5f9", color: searchOpen ? "#fff" : "#475569", border: "1px solid " + (searchOpen ? "#6366f1" : "#e2e8f0"), borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", fontWeight: 500, transition: "all 0.15s ease" }}
            >
              {searchOpen ? "✕ Close" : "🔍 Search"}
            </button>
          </div>
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

        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {messages.map((m) => (
            <div key={m.id} style={{
              alignSelf: m.userId === userId ? "flex-end" : "flex-start",
              maxWidth: "75%",
            }}>
              {m.system ? (
                <div style={{
                  fontSize: "0.75rem", color: "#94a3b8", textAlign: "center", background: "#f1f5f9",
                  padding: "0.3rem 1rem", borderRadius: 999, margin: "0.5rem auto", width: "fit-content",
                }}>
                  {m.content}
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem", flexDirection: m.userId === userId ? "row-reverse" : "row", alignItems: "flex-end" }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, background: getAvatarColor(m.userId),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: "0.65rem", fontWeight: 700, flexShrink: 0,
                  }}>{getInitials(m.userId)}</div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.2rem", textAlign: m.userId === userId ? "right" : "left" }}>
                      <span style={{ fontWeight: 600 }}>{m.userId === userId ? "You" : m.userId}</span> &middot; {formatTime(m.createdAt)}
                    </div>
                    <div style={{
                      background: m.userId === userId ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#fff",
                      color: m.userId === userId ? "#fff" : "#0f172a",
                      border: m.userId === userId ? "none" : "1px solid #e2e8f0",
                      padding: "0.6rem 0.9rem", borderRadius: m.userId === userId ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      fontSize: "0.875rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", lineHeight: 1.5,
                    }}>
                      {m.content}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <footer style={{ padding: "1rem 1.75rem 1.25rem", background: "#fff", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); notifyTyping(true); }}
              onBlur={() => notifyTyping(false)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${channel}`}
              rows={1}
              style={{
                flex: 1, padding: "0.7rem 0.9rem", border: "1px solid #e2e8f0", borderRadius: 10,
                resize: "none", fontSize: "0.875rem", fontFamily: "inherit", boxSizing: "border-box",
                outline: "none", transition: "border-color 0.15s ease",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              style={{
                padding: "0.7rem 1.5rem", background: input.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#e2e8f0",
                color: input.trim() ? "#fff" : "#94a3b8", border: "none", borderRadius: 10,
                cursor: input.trim() ? "pointer" : "not-allowed", fontWeight: 600, fontSize: "0.875rem",
                boxShadow: input.trim() ? "0 2px 8px rgba(99,102,241,0.3)" : "none",
                transition: "all 0.15s ease",
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