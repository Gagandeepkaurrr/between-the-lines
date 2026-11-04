import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { ErrorMessage, Icon } from "./components";
import "./BookChat.css";

const starters = ["Help me build a reading habit", "Give me a book journal prompt", "Explain a literary term"];

export default function BookChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef(null);
  const input = useRef(null);
  const transcript = useRef(null);
  const pending = useRef(false);
  const controller = useRef(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [messages, busy, open]);
  useEffect(() => {
    if (open) input.current?.focus();
    function escape(event) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);

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
    const request = new AbortController();
    controller.current = request;
    try {
      const { reply } = await api("/chat", {
        method: "POST",
        body: JSON.stringify({ messages: history.slice(-11) }),
        signal: request.signal,
      });
      if (!request.signal.aborted) setMessages([...history, { role: "assistant", content: reply }]);
    } catch (failure) {
      if (!request.signal.aborted) {
        setMessages(history.slice(0, -1));
        setDraft(content);
        setError(failure.message);
      }
    } finally {
      pending.current = false;
      if (!request.signal.aborted) {
        setBusy(false);
        requestAnimationFrame(() => input.current?.focus());
      }
    }
  }

  return (
    <>
      <button ref={trigger} className="chat-launcher" aria-expanded={open} aria-controls="book-chat-panel" onClick={() => setOpen(!open)}>
        <span className="chat-launcher-icon"><Icon name="sparkle" size={21} /></span>
        Book companion
      </button>
      <aside id="book-chat-panel" className={`book-chat${open ? " is-open" : ""}`} aria-labelledby="chat-heading">
        <div className="chat-topline">
          <span className="chat-label"><span /> A LITTLE SPACE TO THINK</span>
          <button className="chat-close" aria-label="Close book chat" onClick={() => { setOpen(false); trigger.current?.focus(); }}><Icon name="close" size={19} /></button>
        </div>
        <div className="chat-heading">
          <span className="chat-avatar"><Icon name="sparkle" size={27} /></span>
          <div><h2 id="chat-heading">Book companion</h2><p>Your corner for curious conversations.</p></div>
        </div>
        <div className="chat-toolbar">
          <span><Icon name="book" size={14} /> Connected to your shelf</span>
          {messages.length > 0 && <button disabled={busy} onClick={() => { setMessages([]); setError(""); }}>Clear chat</button>}
        </div>
        <div className="chat-transcript" ref={transcript} role="log" aria-label="Book conversation" aria-live="polite" aria-relevant="additions text" tabIndex={0}>
          {messages.length === 0 && (
            <div className="chat-welcome">
              <span className="chat-welcome-icon"><Icon name="chat" size={30} /></span>
              <h3>Between books,<br />let’s talk.</h3>
              <p>A question, a thought, or a little reading inspiration. Start anywhere.</p>
              <div className="chat-starters">
                {starters.map((prompt) => <button key={prompt} disabled={busy} onClick={() => { setDraft(prompt); input.current?.focus(); }}>{prompt}<Icon name="arrow" size={15} /></button>)}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div className={`chat-message ${message.role}`} key={index}>
              <strong>{message.role === "user" ? "You" : "Book companion"}</strong>
              <p>{message.content}</p>
            </div>
          ))}
          {busy && <p className="chat-thinking" role="status"><span /><span /><span /> Thinking about your question…</p>}
        </div>
        <div className="chat-compose">
          <ErrorMessage message={error} />
          <form className="chat-form" onSubmit={send}>
            <label htmlFor="chat-message">Your message</label>
            <div className="chat-input-wrap">
              <textarea ref={input} id="chat-message" rows={2} placeholder="What’s on your reading mind?" value={draft} maxLength={2000} readOnly={busy} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form.requestSubmit();
                }
              }} required />
              <button className="chat-send" aria-label={busy ? "Waiting for reply" : "Send message"} disabled={busy || !draft.trim()}><Icon name="send" size={18} /></button>
            </div>
          </form>
          <p className="chat-hint">Enter to send · Shift + Enter for a new line</p>
          <details className="chat-privacy"><summary>About this AI chat</summary><p>AI can make mistakes. Messages and your shelf’s titles, authors, ratings, and reading statuses go to the AI provider. Notes and quotes stay private. Chat clears on refresh or logout.</p></details>
        </div>
      </aside>
    </>
  );
}
