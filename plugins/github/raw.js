// .ghraw <owner/repo/path/file | url github>  -> tampilkan isi file raw
import axios from 'axios'
import { reactTo } from '../../lib/core-file.js'

let handler = async (m, { sock, text, prefix, command, reply }) => {
    if (!text) return reply(`❌ *Format salah!*\n\nContoh: *${prefix}${command} whiskeysockets/baileys/package.json*\natau raw URL GitHub.`)

    let rawUrl = text.trim()
    if (rawUrl.startsWith('https://raw.githubusercontent.com/')) {
        // sudah raw
    } else if (rawUrl.startsWith('https://github.com/')) {
        rawUrl = rawUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
    } else {
        const parts = rawUrl.split('/')
        if (parts.length < 3) return reply('❌ Format tidak valid! Gunakan format *owner/repo/path/file.ext*')
        rawUrl = `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/HEAD/${parts.slice(2).join('/')}`
    }

    await reactTo(sock, m, '⏳')
    try {
        const res = await axios.get(rawUrl, { headers: { 'user-agent': 'Mozilla/5.0' }, timeout: 15000, responseType: 'text', transformResponse: [d => d] })
        let content = String(res.data)
        if (content.length > 4000) content = content.slice(0, 4000) + '\n\n... (terpotong karena isi file terlalu panjang)'
        await reply(`📄 *RAW FILE GITHUB*\n🔗 ${rawUrl}\n\n\`\`\`\n${content}\n\`\`\``)
        await reactTo(sock, m, '✅')
    } catch (e) {
        console.error('[GHRAW ERROR]', e?.message || e)
        await reactTo(sock, m, '❌')
        return reply(`❌ Gagal mengambil raw file GitHub! Pastikan path file atau URL benar.\nURL: ${rawUrl}`)
    }
}

handler.command = ['ghraw', 'ghfile', 'rawgithub']
handler.help = ['ghraw <owner/repo/path>']
handler.tags = ['github']

export default handler
