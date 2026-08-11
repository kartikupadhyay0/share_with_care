const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    maxHttpBufferSize: 1e8, // 100MB Max
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

const roomsMap = new Map();

io.on('connection', (socket) => {

    socket.on('register-sender', (data) => {
        const cleanRoom = data.room.trim().toUpperCase();
        roomsMap.set(cleanRoom, {
            senderSocketId: socket.id,
            ...data
        });
        socket.join(cleanRoom);
    });

    socket.on('request-file', ({ room }) => {
        const cleanRoom = room.trim().toUpperCase();

        if (roomsMap.has(cleanRoom)) {
            const roomInfo = roomsMap.get(cleanRoom);
            socket.join(cleanRoom);

            if (!roomInfo.isLarge) {
                // Instant Small File Route
                socket.emit('receive-file-small', {
                    fileName: roomInfo.fileName,
                    fileData: roomInfo.fileData,
                    fileType: roomInfo.fileType
                });
            } else {
                // Stream Large File Route
                socket.emit('file-metadata-large', {
                    fileName: roomInfo.fileName,
                    fileSize: roomInfo.fileSize,
                    fileType: roomInfo.fileType
                });

                // Request Sender to stream
                io.to(roomInfo.senderSocketId).emit('start-sending-file');
            }
        } else {
            socket.emit('error-msg', 'Invalid Code or File Expired!');
        }
    });

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
    console.log(`Server running on port ${PORT}`);
});