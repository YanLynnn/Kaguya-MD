const SUPPORTED = ['imageMessage', 'videoMessage', 'audioMessage']

let handler = async (m, { sock, jid, prefix, command, reply }) => {
    const q = m.quoted

    if (!q) {
        return reply(`reply pesan sekali lihat dengan *${prefix || '.'}${command}*`)
    }

    if (!q.isMedia) {
        return reply('yang di-reply bukan media.')
    }

    if (!q.viewOnce) {
        return reply('yang di-reply bukan pesan sekali lihat.')
    }

    if (!SUPPORTED.includes(q.mtype)) {
        return reply('format media tidak didukung.')
    }

    const media = await q.download().catch(() => null)

    if (!media?.length) {
        return reply('gagal mengunduh media, coba lagi.')
    }

    const caption = q.caption || ''

    try {
        if (q.mtype === 'imageMessage') {
            await sock.sendMessage(
                jid,
                { image: media, caption },
                { quoted: m }
            )
        } else if (q.mtype === 'videoMessage') {
            await sock.sendMessage(
                jid,
                { video: media, caption, mimetype: q.mimetype || 'video/mp4' },
                { quoted: m }
            )
        } else {
            await sock.sendMessage(
                jid,
                {
                    audio: media,
                    mimetype: q.mimetype || 'audio/ogg; codecs=opus',
                    ptt: !!q.ptt
                },
                { quoted: m }
            )
        }
    } catch (e) {
        console.error('[RVO]', e)
        reply(`gagal mengirim media.\n\n${e.message}`)
    }
}

handler.command = ['rvo']
handler.tags = ['tools']

export default handler
