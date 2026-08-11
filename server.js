const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 50 * 1024 * 1024
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('host-file', ({ room, fileData }) => {
        socket.join(room);
        rooms[room] = fileData;
        console.log(`File hosted in room: ${room}`);
    });

    socket.on('get-file', (room) => {
        if (rooms[room]) {
            socket.join(room);
            socket.emit('file-data', rooms[room]);
            socket.to(room).emit('receiver-connected');
            console.log(`File sent to receiver for room: ${room}`);
        } else {
            socket.emit('error-msg', 'Invalid or expired code!');
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});