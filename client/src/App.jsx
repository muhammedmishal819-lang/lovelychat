import { useState, useRef, useEffect } from "react"
import "./App.css"
import { io } from "socket.io-client"
const SERVER_URL = import.meta.env.DEV ? `http://${window.location.hostname}:5000` : window.location.origin;
const socket = io(SERVER_URL);
function now() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function App() {
  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingUser, joined]);
  useEffect(() => {
    socket.on("receiveMessage", (data) => {
      setMessages((m) => [...m, { id: Date.now() + Math.random(), kind: "chat", from: data.sender, text: data.text, me: false, time: data.time || now() }]);
      setTypingUser(null);
    });
    socket.on("userTyping", (data) => {
      setTypingUser(data.sender);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingUser(null), 2500);
    });
    return () => { socket.off("receiveMessage"); socket.off("userTyping"); };
  }, []);
  const handleJoin = () => {
    if (!username.trim() || !roomInput.trim()) { alert("Enter your name and a room code first!"); return; }
    const room = roomInput.trim();
    socket.emit("join", room);
    setCurrentRoom(room);
    setMessages([{ id: Date.now(), kind: "sys", text: `You joined private room: ${room}` }]);
    setTypingUser(null);
    setJoined(true);
  };
  const handleLeave = () => {
    socket.emit("leave", currentRoom);
    setJoined(false);
    setMessages([]);
    setText("");
    setTypingUser(null);
  };
  const handleTyping = (value) => {
    setText(value);
    if (joined && username.trim() && value.trim()) { socket.emit("typing", { room: currentRoom, sender: username.trim() }); }
  };
  const send = () => {
    if (!text.trim()) return;
    const msg = { room: currentRoom, sender: username.trim(), text: text.trim(), time: now() };
    setMessages((m) => [...m, { id: Date.now() + Math.random(), kind: "chat", from: "You", text: msg.text, me: true, time: msg.time }]);
    socket.emit("sendMessage", msg);
    setText("");
  };
  if (!joined) {
    return (
      <div className="app">
        <div className="join-wrap">
          <div className="join-card">
            <div className="join-logo">??</div>
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
            <span>Online - {username}</span>
          </div>
          <button className="leave-btn" onClick={handleLeave}>Leave</button>
        </div>
        <div className="messages">
          {messages.map((m) =>
            m.kind === "sys" ? (
              <div key={m.id} className="sys-wrap"><span className="sys-msg">{m.text}</span></div>
            ) : (
              <div key={m.id} className={`msg-row ${m.me ? "me" : "other"}`}>
                {!m.me && <span className="sender">{m.from}</span>}
                <div className="bubble">{m.text}</div>
                <span className="time">{m.time}</span>
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
        <div className="input-area">
          <input value={text} onChange={(e) => handleTyping(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a lovely message..." maxLength={500} />
          <button className="send-btn" onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}
export default App