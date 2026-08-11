const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// High Payload Limits for Socket.io
const io = new Server(server, {
    maxHttpBufferSize: 1e9, // 1 GB Buffer Limit
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

const roomsMap = new Map();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Sender Registers Room
    socket.on('register-sender', ({ room, fileName, fileSize, fileType }) => {
        const cleanRoom = room.trim().toUpperCase();
        roomsMap.set(cleanRoom, {
            senderSocketId: socket.id,
            fileName,
            fileSize,
            fileType
        });
        socket.join(cleanRoom);
        console.log(`[Room Created]: ${cleanRoom} for file ${fileName}`);
    });

    // Receiver Connects & Requests File
    socket.on('request-file', ({ room }) => {
        const cleanRoom = room.trim().toUpperCase();

        if (roomsMap.has(cleanRoom)) {
            const roomInfo = roomsMap.get(cleanRoom);
            socket.join(cleanRoom);

            // Send metadata to receiver
            socket.emit('file-metadata', roomInfo);

            // Signal sender to start stream
            io.to(roomInfo.senderSocketId).emit('start-sending-file');
            console.log(`[Stream Started]: ${cleanRoom}`);
        } else {
            socket.emit('error-msg', 'Invalid or expired room code!');
        }
    });

    // Fast Stream Relay
    socket.on('send-file-chunk', ({ room, chunk }) => {
        const cleanRoom = room.trim().toUpperCase();
        socket.to(cleanRoom).emit('receive-file-chunk', { chunk });
    });

    socket.on('disconnect', () => {
        for (const [room, data] of roomsMap.entries()) {
            if (data.senderSocketId === socket.id) {
                roomsMap.delete(room);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});