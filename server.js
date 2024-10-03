const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 8080;
let availableUsers = [];
let rooms = {};

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    availableUsers.push(socket.id);
    io.emit("user-count", availableUsers.length);

    // Start chat event
    socket.on("start-chat", () => {
        if (availableUsers.length >= 2) {
            const participantA = socket.id;
            const participantB = availableUsers.find(
                (id) => id !== participantA,
            );

            if (!participantB) {
                socket.emit("no-users", "No users available at the moment");
                return;
            }

            rooms[participantA] = { participantA, participantB };
            rooms[participantB] = { participantA, participantB };

            // Notify both participants that they are connected
            io.to(participantA).emit("connected", { peerId: participantB });
            io.to(participantB).emit("connected", { peerId: participantA });

            availableUsers = availableUsers.filter(
                (id) => id !== participantA && id !== participantB,
            );
        } else {
            socket.emit("no-users", "Waiting for another user...");
        }
    });

    // Handle chat messages
    socket.on("chat-message", (message) => {
        const room = rooms[socket.id];
        if (room) {
            const recipient =
                room.participantA === socket.id
                    ? room.participantB
                    : room.participantA;
            io.to(recipient).emit("chat-message", {
                sender: socket.id,
                message,
            });
        }
    });

    // Handle ICE candidate exchange
    socket.on("candidate", (candidate) => {
        const room = rooms[socket.id];
        if (room) {
            const recipient =
                room.participantA === socket.id
                    ? room.participantB
                    : room.participantA;
            io.to(recipient).emit("candidate", candidate);
        }
    });

    // Handle offer exchange
    socket.on("offer", (offer) => {
        const room = rooms[socket.id];
        if (room) {
            const recipient =
                room.participantA === socket.id
                    ? room.participantB
                    : room.participantA;
            io.to(recipient).emit("offer", offer);
        }
    });

    // Handle answer exchange
    socket.on("answer", (answer) => {
        const room = rooms[socket.id];
        if (room) {
            const recipient =
                room.participantA === socket.id
                    ? room.participantB
                    : room.participantA;
            io.to(recipient).emit("answer", answer);
        }
    });

    // Handle skipping the chat
    socket.on("skip", () => {
        const room = rooms[socket.id];
        if (room) {
            const otherParticipant =
                room.participantA === socket.id
                    ? room.participantB
                    : room.participantA;
            io.to(otherParticipant).emit("disconnected");
            delete rooms[socket.id];
            delete rooms[otherParticipant];
            availableUsers.push(socket.id);
            availableUsers.push(otherParticipant);
            io.emit("user-count", availableUsers.length);
        }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        availableUsers = availableUsers.filter((id) => id !== socket.id);
        io.emit("user-count", availableUsers.length);
        const room = rooms[socket.id];
        if (room) {
            const otherParticipant =
                room.participantA === socket.id
                    ? room.participantB
                    : room.participantA;
            io.to(otherParticipant).emit("disconnected");
            delete rooms[socket.id];
            delete rooms[otherParticipant];
            availableUsers.push(otherParticipant);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
