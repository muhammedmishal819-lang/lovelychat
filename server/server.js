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
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('join', (room) => {
    socket.join(room);
    console.log(socket.id + ' joined ' + room);
  });
  socket.on('sendMessage', (data) => {
    socket.to(data.room).emit('receiveMessage', data);
  });
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));