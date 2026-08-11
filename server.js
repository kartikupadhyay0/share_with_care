const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    maxHttpBufferSize: 1e8, // 100 MB Limit
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

// Store room metadata only (DO NOT store heavy binary buffer in server memory to avoid freezing)
const roomsMap = new Map();

io.on('connection', (socket) => {

    // Register Sender
    socket.on('register-sender', ({ room, fileName, fileType, fileSize, isLarge }) => {
        const cleanRoom = room.trim().toUpperCase();
        roomsMap.set(cleanRoom, {
            senderSocketId: socket.id,
            fileName,
            fileType,
            fileSize,
            isLarge
        });
        socket.join(cleanRoom);
        console.log(`[ROOM CREATED] ${cleanRoom} by Sender: ${socket.id}`);
    });

    // Receiver requests file
    socket.on('request-file', ({ room }) => {
        const cleanRoom = room.trim().toUpperCase();

        if (roomsMap.has(cleanRoom)) {
            const roomInfo = roomsMap.get(cleanRoom);
            socket.join(cleanRoom);

            console.log(`[REQUEST] File requested for Room: ${cleanRoom} by Receiver: ${socket.id}`);

            // Notify Receiver about file metadata
            socket.emit('file-metadata', {
                fileName: roomInfo.fileName,
                fileType: roomInfo.fileType,
                fileSize: roomInfo.fileSize,
                isLarge: roomInfo.isLarge
            });

            // Trigger Sender to start streaming chunks directly
            io.to(roomInfo.senderSocketId).emit('start-sending-file', {
                receiverSocketId: socket.id
            });
        } else {
            socket.emit('error-msg', 'Invalid Code or File Expired!');
        }
    });

    // Chunk Transfer Relay
    socket.on('send-file-chunk', ({ room, chunk }) => {
        const cleanRoom = room.trim().toUpperCase();
        socket.to(cleanRoom).emit('receive-file-chunk', { chunk });
    });

    // Handle Disconnection
    socket.on('disconnect', () => {
        for (const [room, data] of roomsMap.entries()) {
            if (data.senderSocketId === socket.id) {
                roomsMap.delete(room);
                console.log(`[ROOM DELETED] ${room} due to sender disconnect`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});