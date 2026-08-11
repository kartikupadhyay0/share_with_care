const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e9, // 1 GB Buffer Limit
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

// Global Map to store active shared files per room
const activeRooms = new Map();

io.on('connection', (socket) => {

    // Host File Event
    socket.on('host-file', ({ room, fileData }) => {
        const cleanRoom = room.trim().toUpperCase();
        activeRooms.set(cleanRoom, {
            socketId: socket.id,
            fileData: fileData
        });
        socket.join(cleanRoom);
        console.log(`[Host Success] File stored for Room: ${cleanRoom}`);
    });

    // Get File Event
    socket.on('get-file', (room) => {
        const cleanRoom = room.trim().toUpperCase();
        console.log(`[Fetch Request] Searching for Room: ${cleanRoom}`);

        if (activeRooms.has(cleanRoom)) {
            const roomInfo = activeRooms.get(cleanRoom);
            socket.emit('file-data', roomInfo.fileData);
            io.to(roomInfo.socketId).emit('receiver-connected');
            console.log(`[Success] File transferred for Room: ${cleanRoom}`);
        } else {
            console.log(`[Error] Room not found: ${cleanRoom}`);
            socket.emit('error-msg', 'Invalid code or room expired!');
        }
    });

    socket.on('disconnect', () => {
        // Clean up rooms hosted by disconnected user
        for (const [room, data] of activeRooms.entries()) {
            if (data.socketId === socket.id) {
                activeRooms.delete(room);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 ShareWithCare Server running on port ${PORT}`);
});