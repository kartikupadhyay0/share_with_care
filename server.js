const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8, // 100MB per frame limit
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

// Store room details (Without keeping full file in RAM)
const roomsMap = new Map();

io.on('connection', (socket) => {

    // Register Sender
    socket.on('register-sender', ({ room, fileName, fileSize, fileType }) => {
        const cleanRoom = room.trim().toUpperCase();
        roomsMap.set(cleanRoom, {
            senderSocketId: socket.id,
            fileName,
            fileSize,
            fileType
        });
        socket.join(cleanRoom);
        console.log(`[Registered Room]: ${cleanRoom} (${fileName})`);
    });

    // Request File
    socket.on('request-file', ({ room }) => {
        const cleanRoom = room.trim().toUpperCase();

        if (roomsMap.has(cleanRoom)) {
            const roomInfo = roomsMap.get(cleanRoom);
            socket.join(cleanRoom);

            // Send metadata to receiver
            socket.emit('file-metadata', roomInfo);

            // Ask sender to start streaming chunks
            io.to(roomInfo.senderSocketId).emit('start-sending-file');
            console.log(`[Stream Started]: Room ${cleanRoom}`);
        } else {
            socket.emit('error-msg', 'Invalid code or room expired!');
        }
    });

    // Pipe Chunks Directly to Room (Memory Light Stream)
    socket.on('send-file-chunk', ({ room, chunk, offset }) => {
        const cleanRoom = room.trim().toUpperCase();
        socket.to(cleanRoom).emit('receive-file-chunk', { chunk, offset });
    });

    // Handle Disconnection
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
    console.log(`🚀 ShareWithCare Server running on port ${PORT}`);
});