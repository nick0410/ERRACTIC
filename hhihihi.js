const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 8080;
let availableUsers = [];
let rooms = {};

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    availableUsers.push(socket.id);
    io.emit('user-count', availableUsers.length);

    // Start chat event
    socket.on('start-chat', () => {
        if (availableUsers.length >= 2) {
            const participantA = socket.id;
            const participantB = availableUsers.find(id => id !== participantA);

            if (!participantB) {
                socket.emit('no-users', 'No users available at the moment');
                return;
            }

            const roomId = `${participantA}-${participantB}`;
            rooms[participantA] = { participantA, participantB, roomId };
            rooms[participantB] = { participantA, participantB, roomId };

            io.to(participantA).emit('connected', { peerId: participantB });
            io.to(participantB).emit('connected', { peerId: participantA });

            availableUsers = availableUsers.filter(id => id !== participantA && id !== participantB);
        }
    });

    // Handle offer and answer exchange
    socket.on('offer', (offer) => {
        const room = rooms[socket.id];
        if (room) {
            io.to(room.participantB).emit('offer', offer);
        }
    });

    socket.on('answer', (answer) => {
        const room = rooms[socket.id];
        if (room) {
            io.to(room.participantA).emit('answer', answer);
        }
    });

    // Handle ICE candidates
    socket.on('candidate', (candidate) => {
        const room = rooms[socket.id];
        if (room) {
            io.to(room.participantB || room.participantA).emit('candidate', candidate);
        }
    });

    // Handle skip
    socket.on('skip', () => {
        const room = rooms[socket.id];
        if (room) {
            io.to(room.participantA).emit('disconnected');
            io.to(room.participantB).emit('disconnected');
            delete rooms[socket.id];
            availableUsers.push(socket.id);
            io.emit('user-count', availableUsers.length);
        }
    });

    socket.on('stop-chat', () => {
      const room = rooms[socket.id];
      if (room) {
          io.to(room.participantA).emit('disconnected');
          io.to(room.participantB).emit('disconnected');
          delete rooms[socket.id];
          availableUsers.push(socket.id);
          io.emit('user-count', availableUsers.length);
      }
  });
       
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        availableUsers = availableUsers.filter(id => id !== socket.id);
        io.emit('user-count', availableUsers.length);

        const room = rooms[socket.id];
        if (room) {
            io.to(room.participantA).emit('disconnected');
            io.to(room.participantB).emit('disconnected');
            delete rooms[socket.id];
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
