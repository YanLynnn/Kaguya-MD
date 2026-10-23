import { fetchAny } from '../../lib/scraper.js'

let handler = async (m, { sock, text, reply, example }) => {
    if (!text) return example('https://example.com/file.pdf')

    try {
        const res = await fetchAny(text)

        if (res.kind === 'text') {
            await reply(res.text.slice(0, 65536))
            return sock.sendMessage(m.chat, {
                document: Buffer.from(res.text),
                fileName: res.filename,
                mimetype: res.contentType
            }, { quoted: m })
        }

        const { buffer, filename, contentType } = res
        const caption = `乂 *FETCH URL*

📦 *Name:* ${filename}
📄 *Type:* ${contentType}
📏 *Size:* ${(buffer.length / 1024 / 1024).toFixed(2)} MB`

        if (contentType === 'image/webp') {
            return sock.sendMessage(m.chat, { sticker: buffer }, { quoted: m })
        }
        if (/^image\//i.test(contentType)) {
            return sock.sendMessage(m.chat, { image: buffer, mimetype: contentType, caption }, { quoted: m })
        }
        if (/^video\//i.test(contentType)) {
            return sock.sendMessage(m.chat, { video: buffer, mimetype: contentType, caption, fileName: filename }, { quoted: m })
        }
        if (/^audio\//i.test(contentType)) {
            return sock.sendMessage(m.chat, { audio: buffer, mimetype: contentType, fileName: filename, ptt: false }, { quoted: m })
        }
        return sock.sendMessage(m.chat, { document: buffer, mimetype: contentType, fileName: filename, caption }, { quoted: m })
    } catch (e) {
        console.error(e)
        reply(`❌ Error:\n${e.message || e}`)
    }
}

handler.command = ['fetch']
handler.help = ['fetch']
handler.tags = ['tools']

export default handler
