const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./fila.db');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot está pronto!');
});

client.on('message', async msg => {
    const texto = msg.body.toLowerCase();
    const numero = msg.from;
    const nome = msg._data.notifyName;

    if (texto === 'entrar') {
        msg.reply("Por favor, informe a especialidade desejada:\n1 - Clínico Geral\n2 - Psiquiatra");
        client.once('message', res => {
            const escolha = res.body.trim();
            let especialidade = "";

            if (escolha === '1') especialidade = 'clínico geral';
            else if (escolha === '2') especialidade = 'psiquiatra';
            else {
                msg.reply("Especialidade inválida. Envie 'entrar' novamente para tentar.");
                return;
            }

            db.get("SELECT * FROM fila WHERE numero = ? AND status != 'atendido'", [numero], (err, row) => {
                if (row) {
                    msg.reply("Você já está aguardando na fila.");
                } else {
                    db.run("INSERT INTO fila (nome, numero, especialidade, status) VALUES (?, ?, ?, 'pendente')", [nome, numero, especialidade], err => {
                        if (err) {
                            msg.reply("Erro ao registrar na fila.");
                        } else {
                            msg.reply(`Sua solicitação para ${especialidade} foi registrada e aguarda aprovação.`);
                        }
                    });
                }
            });
        });
    }

    else if (texto === 'posicao') {
        db.all("SELECT * FROM fila WHERE status = 'autorizado' AND especialidade IN ('clínico geral', 'psiquiatra')", (err, rows) => {
            const index = rows.findIndex(p => p.numero === numero);
            if (index >= 0) {
                msg.reply(`Sua posição na fila é: ${index + 1}`);
            } else {
                msg.reply("Você não está na fila ou ainda não foi autorizado.");
            }
        });
    }

    else if (texto === 'sair') {
        db.run("DELETE FROM fila WHERE numero = ? AND status != 'atendido'", [numero], err => {
            if (err) {
                msg.reply("Erro ao remover da fila.");
            } else {
                msg.reply("Você foi removido da fila.");
            }
        });
    }
});