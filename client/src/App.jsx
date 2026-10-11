import { useState, useRef, useEffect } from "react"
import "./App.css"
import { io } from "socket.io-client"
const SERVER_URL = import.meta.env.DEV ? `http://${window.location.hostname}:5000` : window.location.origin;
const socket = io(SERVER_URL);
function now() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
const EMOJIS = ["\uD83D\uDE00","\uD83D\uDE01","\uD83D\uDE02","\uD83E\uDD23","\uD83D\uDE0A","\uD83D\uDE0D","\uD83D\uDE18","\uD83E\uDD70","\uD83D\uDE0E","\uD83E\uDD14","\uD83D\uDE05","\uD83D\uDE22","\uD83D\uDE2D","\uD83D\uDE21","\uD83D\uDC4D","\uD83D\uDC4E","\uD83D\uDE4F","\uD83D\uDC4F","\uD83D\uDD25","\uD83C\uDF89","\u2764","\uD83D\uDC95","\uD83D\uDC96","\uD83D\uDC94","\u2728","\uD83C\uDF39","\uD83D\uDC8B","\uD83E\uDD7A","\uD83D\uDE34","\uD83E\uDD17","\uD83D\uDCAF","\uD83D\uDC40","\uD83D\uDE4C","\uD83E\uDD1D","\uD83D\uDCAA","\uD83C\uDF55","\u2615","\uD83C\uDF19","\u2600","\uD83C\uDFB5"]; function App() {
  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("lovely-theme") || "dark");
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("lovely-sound") !== "off");
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const recTimerRef = useRef(null);
  const joinedRef = useRef(false);
  const nameRef = useRef("");
  useEffect(() => { localStorage.setItem("lovely-theme", theme); document.body.dataset.theme = theme; }, [theme]);
  useEffect(() => { localStorage.setItem("lovely-sound", soundOn ? "on" : "off"); }, [soundOn]);
  useEffect(() => { document.body.dataset.theme = localStorage.getItem("lovely-theme") || "dark"; }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingUser, joined, showEmoji]);
  function ding() {
    if (!soundOn) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = "sine";
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      o.start(); o.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  }
  useEffect(() => {
    socket.on("receiveMessage", (data) => {
      setMessages((m) => [...m, { id: data.id || uid(), kind: "chat", from: data.sender, text: data.text, audio: data.audio || null, me: false, time: data.time || now(), seen: false }]);
      setTypingUser(null);
      ding();
      if (joinedRef.current && nameRef.current) { socket.emit("seen", { room: data.room, id: data.id, by: nameRef.current }); }
    });
    socket.on("userTyping", (data) => {
      setTypingUser(data.sender);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingUser(null), 2500);
    });
    socket.on("messageSeen", (data) => {
      setMessages((m) => m.map((x) => (x.id === data.id ? { ...x, seen: true } : x)));
    });
    socket.on("roomUsers", (users) => { setOnlineUsers(users); });
    return () => { socket.off("receiveMessage"); socket.off("userTyping"); socket.off("messageSeen"); socket.off("roomUsers"); };
  }, [soundOn]);  const handleJoin = () => {
    if (!username.trim() || !roomInput.trim()) { alert("Enter your name and a room code first!"); return; }
    const room = roomInput.trim();
    const name = username.trim();
    socket.emit("join", room, name);
    joinedRef.current = true;
    nameRef.current = name;
    setCurrentRoom(room);
    setMessages([{ id: uid(), kind: "sys", text: `You joined private room: ${room}` }]);
    setTypingUser(null);
    setJoined(true);
  };
  const handleLeave = () => {
    socket.emit("leave", currentRoom);
    joinedRef.current = false;
    setJoined(false);
    setMessages([]);
    setText("");
    setTypingUser(null);
    setOnlineUsers([]);
    setShowEmoji(false);
    setShowOnline(false);
    stopRec(false);
  };
  const handleTyping = (value) => {
    setText(value);
    if (joined && nameRef.current && value.trim()) { socket.emit("typing", { room: currentRoom, sender: nameRef.current }); }
  };
  const send = () => {
    if (!text.trim()) return;
    const id = uid();
    const msg = { id, room: currentRoom, sender: nameRef.current, text: text.trim(), time: now() };
    setMessages((m) => [...m, { id, kind: "chat", from: "You", text: msg.text, audio: null, me: true, time: msg.time, seen: false }]);
    socket.emit("sendMessage", msg);
    setText("");
    setShowEmoji(false);
  };
  const addEmoji = (e) => { setText((t) => t + e); };
  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recTimerRef.current);
        if (chunksRef.current.length === 0) { setRecording(false); return; }
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 8 * 1024 * 1024) { alert("Voice note too long - keep it short!"); setRecording(false); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
          const id = uid();
          const msg = { id, room: currentRoom, sender: nameRef.current, text: "", audio: reader.result, time: now() };
          setMessages((m) => [...m, { id, kind: "chat", from: "You", text: "", audio: reader.result, me: true, time: msg.time, seen: false }]);
          socket.emit("sendMessage", msg);
        };
        reader.readAsDataURL(blob);
        setRecording(false);
        setRecSecs(0);
      };
      rec.start();
      setRecording(true);
      setRecSecs(0);
      recTimerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch (err) {
      alert("Microphone blocked - allow mic access in your browser to send voice notes.");
    }
  }
  function stopRec(sendIt) {
    const rec = mediaRef.current;
    if (rec && rec.state !== "inactive") {
      if (!sendIt) { rec.onstop = () => { rec.stream?.getTracks?.().forEach((t) => t.stop()); }; chunksRef.current = []; setRecording(false); setRecSecs(0); clearInterval(recTimerRef.current); try { rec.stop(); } catch (e) {} return; }
      rec.stop();
    }
  }
  const toggleMic = () => { if (recording) stopRec(true); else startRec(); };  if (!joined) {
    return (
      <div className="app">
        <div className="join-wrap">
          <div className="join-card">
            <div className="join-logo">\uD83D\uDC95</div>
            <h1>LovelyChat</h1>
            <p className="join-sub">Private real-time chat for lovers and friends</p>
            <label>Your Name</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ex: John" maxLength={20} />
            <label>Private Room Code</label>
            <input value={roomInput} onChange={(e) => setRoomInput(e.target.value)} placeholder="Ex: john-anna-123" maxLength={30} onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
            <button className="join-btn" onClick={handleJoin}>Join Room</button>
            <p className="join-hint">Share the same room code with your partner to chat privately.</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="app">
      <div className="chat-shell">
        <div className="chat-header">
          <div className="avatar">{currentRoom.charAt(0).toUpperCase()}</div>
          <div className="room-info">
            <b>{currentRoom}</b>
            <span>\uD83D\uDFE2 {onlineUsers.length} online</span>
          </div>
          <button className="icon-btn" onClick={() => setShowOnline((s) => !s)} title="Who is online">\uD83D\uDC65</button>
          <button className="icon-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} title="Toggle theme">{theme === "dark" ? "\uD83C\uDF05" : "\uD83C\uDF19"}</button>
          <button className="icon-btn" onClick={() => setSoundOn((s) => !s)} title="Toggle sound">{soundOn ? "\uD83D\uDD14" : "\uD83D\uDD15"}</button>
          <button className="leave-btn" onClick={handleLeave}>Leave</button>
        </div>
        {showOnline && (
          <div className="online-panel">
            <b>Online now ({onlineUsers.length})</b>
            <div className="online-list">
              {onlineUsers.length === 0 && <span className="muted">Nobody else here yet - share the room code!</span>}
              {onlineUsers.map((u) => (
                <span key={u} className="online-chip">\uD83D\uDFE2 {u}</span>
              ))}
            </div>
          </div>
        )}
        <div className="messages">
          {messages.map((m) =>
            m.kind === "sys" ? (
              <div key={m.id} className="sys-wrap"><span className="sys-msg">{m.text}</span></div>
            ) : (
              <div key={m.id} className={`msg-row ${m.me ? "me" : "other"}`}>
                {!m.me && <span className="sender">{m.from}</span>}
                {m.audio ? (
                  <audio className="voice" controls src={m.audio}></audio>
                ) : (
                  <div className="bubble">{m.text}</div>
                )}
                <span className="time">{m.time}{m.me && (m.seen ? <span className="ticks seen"> \u2713\u2713</span> : <span className="ticks"> \u2713</span>)}</span>
              </div>
            )
          )}
          {typingUser && (
            <div className="msg-row typing-row">
              <span className="sender">{typingUser} is typing</span>
              <div className="typing-bubble"><i></i><i></i><i></i></div>
            </div>
          )}
          <div ref={bottomRef}></div>
        </div>
        {showEmoji && (
          <div className="emoji-panel">
            {EMOJIS.map((e) => (
              <button key={e} className="emoji-btn" onClick={() => addEmoji(e)}>{e}</button>
            ))}
          </div>
        )}
        <div className="input-area">
          <button className="icon-btn" onClick={() => setShowEmoji((s) => !s)} title="Emoji">\uD83D\uDE00</button>
          <input value={text} onChange={(e) => handleTyping(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a lovely message..." maxLength={500} />
          <button className={`icon-btn mic ${recording ? "rec" : ""}`} onClick={toggleMic} title="Voice note">{recording ? `${recSecs}s \u23F9` : "\uD83C\uDFA4"}</button>
          <button className="send-btn" onClick={send}>\u27A4</button>
        </div>
        {recording && <div className="rec-bar">\uD83D\uDD34 Recording voice note... {recSecs}s - tap mic to send</div>}
      </div>
    </div>
  );
}
export default App