const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } }); 

// Menyajikan file HTML utama
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'timer_lomba.html'));
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

    socket.on('reset_system', () => {
        state = { status: 'idle', startTime: null, finishTime: null, racer: '' };
        io.emit('sync_state', state);
    });
});

// Port otomatis untuk Railway atau local (port 3000)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan di port ${PORT}`);
});