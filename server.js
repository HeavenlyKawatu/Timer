const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Pastikan folder uploads tersedia untuk menyimpan rekaman video
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi Multer untuk penamaan dan lokasi simpan video VAR
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `VAR_${Date.now()}.webm`);
    }
});

const upload = multer({ storage: storage });

// Melayani file statis & folder rekaman video
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadDir));

// Jalur Halaman
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'penonton.html')));
app.get('/penonton', (req, res) => res.sendFile(path.join(__dirname, 'penonton.html')));
app.get('/panitia-24', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/var', (req, res) => res.sendFile(path.join(__dirname, 'var.html')));

// Endpoint API Upload Video VAR dari HP Kamera
app.post('/upload-var', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Tidak ada berkas yang diunggah' });
    }
    console.log(`\n[VAR] Video berhasil disimpan: ${req.file.filename}`);
    res.json({ 
        success: true, 
        filename: req.file.filename, 
        url: `/uploads/${req.file.filename}` 
    });
});

let state = { status: 'idle', startTime: null, finishTime: null, racer: '' };
let leaderboard = [];

io.on('connection', (socket) => {
    socket.emit('sync_state', state);
    socket.emit('sync_leaderboard', leaderboard);

    // --- KONTROL TIMER & BALAPAN ---
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

    socket.on('reset_timer', () => {
        state = { status: 'idle', startTime: null, finishTime: null, racer: '' };
        io.emit('sync_state', state);
    });

    socket.on('reset_system', () => {
        state = { status: 'idle', startTime: null, finishTime: null, racer: '' };
        leaderboard = []; 
        io.emit('sync_state', state);
        io.emit('sync_leaderboard', leaderboard);
    });

    // --- WEBRTC SIGNALING (LIVE STREAMING VAR KE PENONTON) ---
    socket.on('var_ready_to_stream', () => {
        socket.broadcast.emit('var_ready_to_stream');
    });

    socket.on('viewer_request_stream', () => {
        socket.broadcast.emit('request_offer');
    });

    socket.on('wrtc_offer', (offer) => {
        socket.broadcast.emit('wrtc_offer', offer);
    });

    socket.on('wrtc_answer', (answer) => {
        socket.broadcast.emit('wrtc_answer', answer);
    });

    socket.on('wrtc_candidate', (candidate) => {
        socket.broadcast.emit('wrtc_candidate', candidate);
    });
});

// Deteksi IP Address Wi-Fi Lokal secara Otomatis
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (let name in interfaces) {
        for (let iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIp();
    console.log(`\n==================================================`);
    console.log(`🚀 SERVER TIMER & VAR LOKAL BERHASIL AKTIF!`);
    console.log(`==================================================`);
    console.log(`📍 Laptop Server    : http://localhost:${PORT}`);
    console.log(`📍 HP/Device Lain   : http://${localIp}:${PORT}`);
    console.log(`🔑 Admin Panitia    : http://${localIp}:${PORT}/panitia-24`);
    console.log(`📸 Kamera VAR       : http://${localIp}:${PORT}/var`);
    console.log(`==================================================\n`);
});