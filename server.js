const express = require('express');
const fs = require('fs');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));
app.use(express.json({limit: '25mb'}));

const USER_FILE = './users.json';
const STORY_FILE = './stories.json';

if (!fs.existsSync(USER_FILE)) fs.writeFileSync(USER_FILE, '[]');
if (!fs.existsSync(STORY_FILE)) fs.writeFileSync(STORY_FILE, '[]');

// API Daftar
app.post('/api/register', (req, res) => {
    const { name, phone, pass, avatar } = req.body;
    let users = JSON.parse(fs.readFileSync(USER_FILE));
    if (users.find(u => u.phone === phone)) return res.json({ success: false, msg: "Nomor sudah terdaftar!" });
    users.push({ name, phone, pass, avatar });
    fs.writeFileSync(USER_FILE, JSON.stringify(users));
    res.json({ success: true });
});

// API Login
app.post('/api/login', (req, res) => {
    const { phone, pass } = req.body;
    let users = JSON.parse(fs.readFileSync(USER_FILE));
    const user = users.find(u => u.phone === phone && u.pass === pass);
    if (user) res.json({ success: true, user: { name: user.name, phone: user.phone, avatar: user.avatar } });
    else res.json({ success: false, msg: "Nomor atau Sandi salah!" });
});

let activeUsers = {};
io.on('connection', (socket) => {
    socket.on('join', (user) => {
        if(!user) return;
        socket.userId = user.phone;
        activeUsers[user.phone] = { id: socket.id, name: user.name };
        io.emit('onlineUsers', Object.keys(activeUsers));
        
        // Kirim story yang ada ke user yang baru join
        const stories = JSON.parse(fs.readFileSync(STORY_FILE));
        socket.emit('initStories', stories);
    });

    socket.on('privateMessage', (data) => {
        const target = activeUsers[data.to];
        if (target) io.to(target.id).emit('receivePrivate', data);
    });

    socket.on('postStory', (data) => {
        let stories = JSON.parse(fs.readFileSync(STORY_FILE));
        stories.unshift({...data, id: Date.now()});
        stories = stories.slice(0, 20); // Simpan 20 status terbaru
        fs.writeFileSync(STORY_FILE, JSON.stringify(stories));
        io.emit('updateStories', stories);
    });

    socket.on('disconnect', () => {
        delete activeUsers[socket.userId];
        io.emit('onlineUsers', Object.keys(activeUsers));
    });
});

http.listen(3000, '0.0.0.0', () => console.log('GEN Z SERVER: AKTIF DI PORT 3000'));
