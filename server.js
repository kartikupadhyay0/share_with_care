const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const activeRooms = {};

io.on('connection', (socket) => {
    socket.on('create-room', (roomCode) => {
        activeRooms[roomCode] = { sender: socket.id, receiver: null };
        socket.join(roomCode);
    });

    socket.on('join-room', (roomCode) => {
        if (activeRooms[roomCode] && !activeRooms[roomCode].receiver) {
            activeRooms[roomCode].receiver = socket.id;
            socket.join(roomCode);
            io.to(roomCode).emit('start-connection', roomCode);
            delete activeRooms[roomCode]; 
        } else {
            socket.emit('invalid-code', 'Invalid or expired code!');
        }
    });

    socket.on('signal', (data) => {
        socket.to(data.room).emit('signal', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});