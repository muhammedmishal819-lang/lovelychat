const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve the built React app (client/dist) when it exists (production / Render).
// In local dev the client runs separately on Vite (port 5173), so this is skipped.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (req, res) => res.send('Server is Running'));
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 10 * 1024 * 1024 });

// room -> { socketId: username }
const roomUsers = {};

function broadcastUsers(room) {
  const users = [...new Set(Object.values(roomUsers[room] || {}))];
  io.to(room).emit("roomUsers", users);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('join', (room, username) => {
    socket.join(room);
    if (!roomUsers[room]) roomUsers[room] = {};
    if (username) roomUsers[room][socket.id] = username;
    console.log((username || socket.id) + ' joined ' + room);
    broadcastUsers(room);
  });
  socket.on('sendMessage', (data) => {
    socket.to(data.room).emit('receiveMessage', data);
  });
  socket.on('typing', (data) => {
    socket.to(data.room).emit('userTyping', data);
  });
  socket.on('seen', (data) => {
    socket.to(data.room).emit('messageSeen', data);
  });
  socket.on('leave', (room) => {
    socket.leave(room);
    if (roomUsers[room]) {
      delete roomUsers[room][socket.id];
      broadcastUsers(room);
    }
  });
  socket.on('disconnect', () => {
    console.log('User disconnected');
    for (const room of Object.keys(roomUsers)) {
      if (roomUsers[room][socket.id]) {
        delete roomUsers[room][socket.id];
        broadcastUsers(room);
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));