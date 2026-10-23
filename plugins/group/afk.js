import { setAfk, afkCleanReason } from '../../lib/plugin-engine.js'

// .afk                 -> AFK tanpa alasan
// .afk mau tidur       -> AFK dengan alasan
// Kirim pesan apa saja untuk keluar dari AFK (dicek di handler.js lewat lib/plugin-engine.js).

let handler = async (m, { sock, text }) => {
    const reason = afkCleanReason(text)
    await setAfk(sock, m, reason)

    return sock.sendMessage(m.chat, {
        text: `╭─▣「 *SEDANG AFK* 」▣─╮\n` +
            `┃ 👤 @${String(m.sender).split('@')[0].split(':')[0]}\n` +
            `┃ 📝 Alasan   : ${reason || 'Tanpa alasan'}\n` +
            `╰─────────────➤`,
        mentions: [m.sender]
    }, { quoted: m })
}

handler.command = ['afk']
handler.tags = ['group']

export default handler
