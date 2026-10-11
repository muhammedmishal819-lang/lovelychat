import { useState, useRef, useEffect } from "react"
import "./App.css"
import { io } from "socket.io-client"

// Local dev (Vite on 5173): connect to the server on port 5000 (works on PC + phone).
// Online (Render): the server serves this page itself, so connect to the same URL.
const SERVER_URL = import.meta.env.DEV
  ? `http://${window.location.hostname}:5000`
  : window.location.origin;
const socket = io(SERVER_URL);

function App() {
  const [username, setUsername] = useState("")
  const [room, setRoom] = useState("lovers-room")
  const [currentRoom, setCurrentRoom] = useState("lovers-room")
  const [text, setText] = useState("")
  const [messages, setMessages] = useState([
    {id:1, from:"System", text:"Welcome! Enter your name and room code, then click Join", me:false},
  ])
  const bottomRef = useRef(null)
  
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}) }, [messages])

  useEffect(() => {
    socket.emit("join", currentRoom);
    socket.on("receiveMessage", (data) => {
      setMessages((m) => [...m, { id: Date.now(), from: data.sender, text: data.text, me: false }]);
    });
    return () => socket.off("receiveMessage");
  }, []);

  const handleJoin = () => {
    if(!room.trim() || !username.trim()){
      alert("Please enter your name and room code first!");
      return;
    }
    socket.emit("join", room);
    setCurrentRoom(room);
    setMessages([{id: Date.now(), from:"System", text: `Joined private room: ${room} as ${username}`, me:false}]);
  }

  const send = () => {
    if(!text.trim()) return
    if(!username.trim()){
      alert("Please enter your name first!");
      return
    }
    const data = { room: currentRoom, sender: username, text };
    setMessages([...messages, { id: Date.now(), from: "You", text, me: true }]);
    socket.emit("sendMessage", data);
    setText("")
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h1>LovelyChat</h1>
        <p className="subtitle">For Lovers & Friends</p>
        <label>Your Name:</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Ex: John" />
        <label>Private Room Code:</label>
        <input value={room} onChange={e=>setRoom(e.target.value)} placeholder="Ex: john-anna-123" />
        <button onClick={handleJoin} style={{marginTop:'8px', width:'100%'}}>Join Room</button>
        <div className="card"><h3>Current Room:</h3><p>{currentRoom}</p></div>
        <div className="card safe"><h3>Teen Safe Mode ON</h3><p>Invite-only</p></div>
        <p className="online">● Online - Safe & Private</p>
      </div>
      <div className="chat">
        <div className="chat-header"><b>{currentRoom}</b> <span> ❤️ {username || 'Guest'}</span></div>
        <div className="messages">
          {messages.map(m=>(
            <div key={m.id} className={`bubble ${m.me ? 'me' : 'other'}`}><b>{m.from}: </b>{m.text}</div>
          ))}
          <div ref={bottomRef}></div>
        </div>
        <div className="input-area">
          <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter' && send()} placeholder="Type a lovely message..." />
          <button onClick={send} className="send">Send</button>
        </div>
      </div>
    </div>
  )
}
export default App