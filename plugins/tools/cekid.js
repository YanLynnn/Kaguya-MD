// Gabungan: idgc + cekidch
//   .cekid <link grup WA>      -> info & ID grup      (alias lama: .idgc)
//   .cekid <link channel WA>   -> info & ID channel   (alias lama: .cekidch)
const GROUP_RE = /(?:https?:\/\/)?chat\.whatsapp\.com\/([0-9A-Za-z]+)/i
const CHANNEL_RE = /whatsapp\.com\/channel\/([0-9A-Za-z]+)/i

async function groupInfo(sock, reply, code) {
    try {
        const info = await sock.groupGetInviteInfo(code)
        const created = info.creation ? new Date(info.creation * 1000).toLocaleString('id-ID') : '-'
        return reply(`
— INFO GRUP —

❀ Nama: ${info.subject}
❀ ID Grup: ${info.id}
❀ Member: ${info.size || 0}
❀ Dibuat: ${created}
`.trim())
    } catch (e) {
        console.error(e)
        return reply('Gagal mengambil info grup. Pastikan link invite masih valid.')
    }
}

async function channelInfo(sock, m, jid, reply, code) {
    try {
        const result = await sock.newsletterMetadata('invite', code)
        const meta = result.thread_metadata
        const caption =
            `╭─▣「 *INFORMASI CHANNEL* 」▣─╮\n` +
            `┃ ✦ Nama       : ${meta.name?.text || '-'}\n` +
            `┃ ✦ ID Channel : ${result.id}\n` +
            `┃ ✦ Subscriber : ${Number(meta.subscribers_count || 0).toLocaleString('id-ID')}\n` +
            `┃ ✦ Verifikasi : ${meta.verification || '-'}\n` +
            `┃ ✦ Status     : ${result.state?.type || '-'}\n` +
            `┃ ✦ Dibuat     : ${new Date(Number(meta.creation_time) * 1000).toLocaleString('id-ID')}\n` +
            `╰─────────────➤`
        return sock.sendMessage(jid, { text: `${caption}\n\nID Channel: ${result.id}` }, { quoted: m })
    } catch (e) {
        return reply('Gagal mengambil data channel.')
    }
}

let handler = async (m, { sock, text, reply, jid, prefix }) => {
    const input = String(text || '').trim()
    if (!input) {
        return reply(
            `Masukkan link grup atau channel WhatsApp.\n\n` +
            `Contoh:\n${prefix}cekid https://chat.whatsapp.com/xxxx\n${prefix}cekid https://whatsapp.com/channel/xxxx`
        )
    }

    const ch = input.match(CHANNEL_RE)
    if (ch) return channelInfo(sock, m, jid || m.chat, reply, ch[1])

    const gc = input.match(GROUP_RE)
    if (gc) return groupInfo(sock, reply, gc[1])

    return reply('Link tidak valid. Gunakan link grup (chat.whatsapp.com) atau channel (whatsapp.com/channel).')
}

handler.command = ['cekid', 'idgc', 'cekidch']
handler.hide = ['idgc', 'cekidch']
handler.help = ['cekid <link>']
handler.tags = ['tools']

export default handler
