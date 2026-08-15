const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } }); 

// Jalur Utama & /penonton dikunci khusus untuk penonton (Aman dari pembajakan)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'penonton.html'));
});

app.get('/penonton', (req, res) => {
    res.sendFile(path.join(__dirname, 'penonton.html'));
});

// Jalur Admin Rahasia (Hanya panitia yang tahu link ini)
app.get('/panitia-24', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

let state = { status: 'idle', startTime: null, finishTime: null, racer: '' };
let leaderboard = [];

io.on('connection', (socket) => {
    console.log('Klien terhubung:', socket.id);
    
    socket.emit('sync_state', state);
    socket.emit('sync_leaderboard', leaderboard);

    socket.on('start_countdown', (racerName) => {
        if(state.status !== 'idle') return;
        state.status = 'countdown';
        state.racer = racerName;
        io.emit('sync_state', state);

        setTimeout(() => io.emit('countdown_step', 3), 0);
        setTimeout(() => io.emit('countdown_step', 2), 1000);
        setTimeout(() => io.emit('countdown_step', 1), 2000);
        
        setTimeout(() => {
            io.emit('countdown_step', 'GO');
            state.status = 'running';
            state.startTime = Date.now(); 
            io.emit('sync_state', state);
        }, 3000);
    });

    socket.on('trigger_finish', (clientTimestamp) => {
        if(state.status !== 'running') return;
        
        state.status = 'finished';
        state.finishTime = clientTimestamp || Date.now(); 
        io.emit('sync_state', state);

        const duration = state.finishTime - state.startTime;
        leaderboard.push({ racer: state.racer, duration: duration });
        io.emit('sync_leaderboard', leaderboard);
    });

    // Reset Waktu (Hanya mereset timer aktif, leaderboard aman)
    socket.on('reset_timer', () => {
        state = { status: 'idle', startTime: null, finishTime: null, racer: '' };
        io.emit('sync_state', state);
    });

    // Reset Sistem (Mereset timer sekaligus menghapus leaderboard)
    socket.on('reset_system', () => {
        state = { status: 'idle', startTime: null, finishTime: null, racer: '' };
        leaderboard = []; 
        io.emit('sync_state', state);
        io.emit('sync_leaderboard', leaderboard);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan di port ${PORT}`);
});
