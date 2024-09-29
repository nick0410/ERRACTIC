const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 8080;

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

let availableUsers = [];
let rooms = {};

io.on("connection", (socket) => {
    console.log("A user connected");

    availableUsers.push(socket.id);
    io.emit('user-count', availableUsers.length);

    socket.on("offer", (offer) => {
        const roomId = rooms[socket.id];
        if (roomId) {
            const otherUser = roomId.participantA === socket.id ? roomId.participantB : roomId.participantA;
            io.to(otherUser).emit("offer", offer);
        }
    });

    socket.on("answer", (answer) => {
        const roomId = rooms[socket.id];
        if (roomId) {
            const otherUser = roomId.participantA === socket.id ? roomId.participantB : roomId.participantA;
            io.to(otherUser).emit("answer", answer);
        }
    });

    socket.on("candidate", (candidate) => {
        const roomId = rooms[socket.id];
        if (roomId) {
            const otherUser = roomId.participantA === socket.id ? roomId.participantB : roomId.participantA;
            io.to(otherUser).emit("candidate", candidate);
        }
    });

    socket.on('start-chat', () => {
        if (availableUsers.length >= 2) {
            const participantA = socket.id;
            const participantB = availableUsers.find(id => id !== participantA);

            const roomId = `${participantA}-${participantB}`;
            rooms[participantA] = { participantA, participantB, roomId };
            rooms[participantB] = { participantA, participantB, roomId };

            availableUsers = availableUsers.filter(id => id !== participantA && id !== participantB);

            io.to(participantA).emit('connected', { peerId: participantB });
            io.to(participantB).emit('connected', { peerId: participantA });
        } else {
            socket.emit('no-users', 'No users available at the moment');
        }

        io.emit('user-count', availableUsers.length);
    });

    // Handle chat messages
    socket.on('chat-message', (message) => {
        const roomId = rooms[socket.id];
        if (roomId) {
            const otherUser = roomId.participantA === socket.id ? roomId.participantB : roomId.participantA;
            io.to(otherUser).emit('chat-message', { sender: 'Stranger', message });
        }
    });

    socket.on('skip', () => {
        const roomId = rooms[socket.id];
        if (roomId) {
            const otherUser = roomId.participantA === socket.id ? roomId.participantB : roomId.participantA;

            io.to(otherUser).emit('chat-ended');
            io.to(socket.id).emit('chat-ended');

            availableUsers.push(socket.id);
            availableUsers.push(otherUser);

            delete rooms[socket.id];
            delete rooms[otherUser];
        }

        io.emit('user-count', availableUsers.length);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");

        availableUsers = availableUsers.filter(id => id !== socket.id);

        const roomId = rooms[socket.id];
        if (roomId) {
            const otherUser = roomId.participantA === socket.id ? roomId.participantB : roomId.participantA;
            io.to(otherUser).emit('chat-ended');
            availableUsers.push(otherUser);
            delete rooms[otherUser];
        }

        delete rooms[socket.id];
        io.emit('user-count', availableUsers.length);
    });   
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
