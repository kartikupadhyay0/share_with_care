const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io Connection & Signaling Logic
io.on('connection', (socket) => {
    console.log(`[+] User Connected: ${socket.id}`);

    // -------------------------------------------------------------
    // 1. WebRTC P2P Direct Router / Internet Streaming Events
    // -------------------------------------------------------------
    
    // Sender creates/hosts a room
    socket.on('host-file-p2p', ({ room }) => {
        socket.join(room);
        console.log(`[Host] Room created for P2P: ${room} by ${socket.id}`);
    });

    // Receiver joins the room
    socket.on('join-file-p2p', ({ room }) => {
        socket.join(room);
        console.log(`[Join] Receiver joined P2P room: ${room}`);
        
        // Notify sender that receiver is ready to establish WebRTC connection
        socket.to(room).emit('receiver-joined');
    });

    // WebRTC Signaling Relay (Offers, Answers, ICE Candidates)
    socket.on('signal', (data) => {
        if (data && data.room) {
            socket.to(data.room).emit('signal', data);
        }
    });

    // -------------------------------------------------------------
    // 2. Legacy Socket.io Buffer Transfer Events (Fallback)
    // -------------------------------------------------------------
    
    socket.on('host-file', ({ room, fileData }) => {
        socket.join(room);
        socket.roomData = { room, fileData };
        console.log(`[Legacy Host] File buffered in room: ${room}`);
    });

    socket.on('get-file', (room) => {
        socket.join(room);
        const roomSockets = io.sockets.adapter.rooms.get(room);
        let fileSent = false;

        if (roomSockets) {
            for (const id of roomSockets) {
                const clientSocket = io.sockets.sockets.get(id);
                if (clientSocket && clientSocket.roomData && clientSocket.roomData.fileData) {
                    socket.emit('file-data', clientSocket.roomData.fileData);
                    socket.to(room).emit('receiver-connected');
                    fileSent = true;
                    break;
                }
            }
        }

        if (!fileSent) {
            socket.emit('error-msg', 'Invalid code or room expired!');
        }
    });

    // -------------------------------------------------------------
    // 3. Disconnect Event
    // -------------------------------------------------------------
    socket.on('disconnect', () => {
        console.log(`[-] User Disconnected: ${socket.id}`);
    });
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`🚀 ShareWithCare Server running on port ${PORT}`);
    console.log(`🌐 Local Access: http://localhost:${PORT}`);
    console.log(`================================================`);
});