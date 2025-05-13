const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { Parser } = require('json2csv');

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./fila.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, nome TEXT, email TEXT UNIQUE, senha TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS fila (id INTEGER PRIMARY KEY, nome TEXT, numero TEXT, especialidade TEXT, status TEXT, data TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
});

function autenticar(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, 'chave_secreta', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

app.post('/api/register', async (req, res) => {
    const { nome, email, senha } = req.body;
    const hash = await bcrypt.hash(senha, 10);
    db.run("INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)", [nome, email, hash], err => {
        if (err) return res.status(400).json({ erro: "Usuário já existe." });
        res.sendStatus(201);
    });
});

app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    db.get("SELECT * FROM usuarios WHERE email = ?", [email], async (err, user) => {
        if (err || !user) return res.sendStatus(401);
        const valido = await bcrypt.compare(senha, user.senha);
        if (!valido) return res.sendStatus(403);
        const token = jwt.sign({ id: user.id, nome: user.nome }, 'chave_secreta');
        res.json({ token });
    });
});

app.get('/api/fila/:especialidade', autenticar, (req, res) => {
    db.all("SELECT * FROM fila WHERE especialidade = ? AND status = 'autorizado'", [req.params.especialidade], (err, rows) => {
        res.json(rows);
    });
});

app.get('/api/pendentes/:especialidade', autenticar, (req, res) => {
    db.all("SELECT * FROM fila WHERE especialidade = ? AND status = 'pendente'", [req.params.especialidade], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/autorizar', autenticar, (req, res) => {
    const { id } = req.body;
    db.run("UPDATE fila SET status = 'autorizado' WHERE id = ?", [id], err => {
        if (err) return res.sendStatus(500);
        res.sendStatus(200);
    });
});

app.post('/api/atender', autenticar, (req, res) => {
    const { id } = req.body;
    db.run("UPDATE fila SET status = 'atendido' WHERE id = ?", [id], err => {
        if (err) return res.sendStatus(500);
        res.sendStatus(200);
    });
});

app.post('/api/negar', autenticar, (req, res) => {
    const { id } = req.body;
    db.run("DELETE FROM fila WHERE id = ?", [id], err => {
        if (err) return res.sendStatus(500);
        res.sendStatus(200);
    });
});

app.get('/api/relatorio', autenticar, (req, res) => {
    db.all("SELECT * FROM fila", (err, rows) => {
        if (err) return res.sendStatus(500);
        const parser = new Parser({ fields: ['id', 'nome', 'numero', 'especialidade', 'status', 'data'] });
        const csv = parser.parse(rows);
        fs.writeFileSync('./relatorio.csv', csv);
        res.download('./relatorio.csv', 'relatorio.csv');
    });
});

app.listen(3001, () => console.log('API rodando em http://localhost:3001'));