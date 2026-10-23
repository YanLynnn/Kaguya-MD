// .setghtoken <token>  -> simpan token GitHub ke config.js (owner)
import { updateConfigValue } from '../../lib/core-file.js'

let handler = async (m, { text, prefix, command, reply }) => {
    if (!text) {
        const t = global.tokengh
        const masked = t ? `${t.slice(0, 8)}...${t.slice(-4)}` : 'Belum diset'
        return reply(`🔑 *GITHUB TOKEN SETTING*\n\n• Token saat ini: \`${masked}\`\n\nContoh:\n*${prefix}${command} ghp_xxxx...*`)
    }

    const token = text.trim().split(/\s+/)[0]
    global.tokengh = token
    const saved = updateConfigValue('tokengh', token)
    return reply(saved
        ? '✅ *Token GitHub berhasil disimpan* ke config.js dan siap dipakai.\n\n⚠️ Hapus pesan yang berisi token tadi supaya tidak terbaca orang lain.'
        : '✅ Token aktif di memory, tetapi gagal menyimpan ke config.js.')
}

handler.command = ['setghtoken']
handler.help = ['setghtoken <token>']
handler.tags = ['github']
handler.owner = true

export default handler
