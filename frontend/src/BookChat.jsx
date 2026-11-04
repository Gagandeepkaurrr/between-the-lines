import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { ErrorMessage } from "./components";
import "./BookChat.css";

export default function BookChat() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const transcript = useRef(null);
  const pending = useRef(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [messages, busy]);

  async function send(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const history = [...messages, { role: "user", content }];
    setMessages(history);
    setDraft("");
    controller.current = new AbortController();
    try {
      // Keep complete recent turns, leaving room for the current question.
      const { reply } = await api("/chat", {
        method: "POST",
        body: JSON.stringify({ messages: history.slice(-11) }),
        signal: controller.current.signal,
      });
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (failure) {
      if (!controller.current.signal.aborted) {
        setMessages(history.slice(0, -1));
        setDraft(content);
        setError(failure.message);
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="book-chat" aria-labelledby="chat-heading">
      <div className="chat-heading">
        <div>
          <span className="eyebrow">A CONVERSATION BETWEEN CHAPTERS</span>
          <h2 id="chat-heading">Your reading companion</h2>
          <p>Ask about books or your shelf. Powered by local AI. Chats last until you leave this page.</p>
        </div>
        {messages.length > 0 && (
          <button className="text-button" disabled={busy} onClick={() => { setMessages([]); setError(""); }}>Clear chat</button>
        )}
      </div>
      <div className="chat-transcript" ref={transcript} role="log" aria-label="Book conversation" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 && <p className="chat-welcome">What’s on your reading mind? Try “Help me build a daily reading habit.”</p>}
        {messages.map((message, index) => (
          <div className={`chat-message ${message.role}`} key={index}>
            <strong>{message.role === "user" ? "You" : "Reading companion"}</strong>
            <p>{message.content}</p>
          </div>
        ))}
        {busy && <p className="chat-welcome" role="status">Thinking… The first reply may take a moment.</p>}
      </div>
      <ErrorMessage message={error} />
      <form className="chat-form" onSubmit={send}>
        <label htmlFor="chat-message">Your message</label>
        <div>
          <input id="chat-message" placeholder="Ask your reading companion…" value={draft} maxLength={2000} disabled={busy} onChange={(event) => setDraft(event.target.value)} required />
          <button className="button small" disabled={busy || !draft.trim()}>{busy ? "Thinking…" : "Send"}</button>
        </div>
      </form>
      <p className="chat-note">AI can make mistakes. Your book titles, authors, ratings, and reading statuses are shared with the AI running on this app’s server.</p>
    </section>
  );
}
