const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        socket.broadcast.to(roomId).emit("user-connected", socket.id);

        socket.on("disconnect", () => {
            socket.broadcast.to(roomId).emit("user-disconnected", socket.id);
        });

        socket.on("offer", (roomId, description, userId) => {
            io.to(userId).emit("offer", description, socket.id);
        });

        socket.on("answer", (roomId, description, userId) => {
            io.to(userId).emit("answer", description, socket.id);
        });

        socket.on("candidate", (roomId, candidate, userId) => {
            io.to(userId).emit("candidate", candidate, socket.id);
        });
    });
});

server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
