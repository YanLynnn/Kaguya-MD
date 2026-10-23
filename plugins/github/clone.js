// .ghclone <owner/repo | link github>  -> kirim ZIP repositori
import { ghGet, ghErrMsg } from '../../lib/core-data.js'
import { reactTo } from '../../lib/core-file.js'

let handler = async (m, { sock, text, prefix, command, reply }) => {
    if (!text) return reply(`❌ *Format salah!*\n\nContoh: *${prefix}${command} whiskeysockets/baileys*\natau link URL GitHub repo.`)

    let repoPath = text.trim()
    const urlMatch = repoPath.match(/github\.com\/([^\/]+\/[^\/\s?#]+)/)
    if (urlMatch) repoPath = urlMatch[1].replace(/\.git$/, '')

    const parts = repoPath.split('/')
    if (parts.length < 2) return reply('❌ Format repositori tidak valid! Gunakan format *owner/repository*.')

    const owner = parts[0]
    const repo = parts[1].replace(/\.git$/, '')

    await reactTo(sock, m, '⏳')
    try {
        const { data: info } = await ghGet(`https://api.github.com/repos/${owner}/${repo}`)
        const branch = info.default_branch || 'main'
        const zip = await ghGet(`https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`, {
            responseType: 'arraybuffer', timeout: 60000, maxContentLength: 100 * 1024 * 1024
        })
        const buffer = Buffer.from(zip.data)
        if (!buffer || buffer.length < 100) throw new Error('ZIP repositori kosong')

        const caption =
            `📦 *GITHUB REPOSITORY CLONE*\n\n` +
            `• *Repo:* ${info.full_name}\n` +
            `• *Branch:* ${branch}\n` +
            `• *Stars:* ⭐ ${info.stargazers_count} | 🔀 ${info.forks_count} Forks\n` +
            `• *Ukuran ZIP:* ${(buffer.length / (1024 * 1024)).toFixed(2)} MB\n` +
            `• *Deskripsi:* ${info.description || '-'}`

        await sock.sendMessage(m.chat, {
            document: buffer,
            fileName: `${repo}-${branch}.zip`,
            mimetype: 'application/zip',
            caption
        }, { quoted: m })
        await reactTo(sock, m, '✅')
    } catch (e) {
        console.error('[GHCLONE ERROR]', e?.message || e)
        await reactTo(sock, m, '❌')
        if (e?.response?.status === 404) return reply(`❌ Repositori *${owner}/${repo}* tidak ditemukan atau bersifat private!`)
        return reply(`❌ Gagal mengunduh ZIP repositori: ${ghErrMsg(e)}`)
    }
}

handler.command = ['ghclone', 'downloadrepo']
handler.help = ['ghclone <owner/repo>']
handler.tags = ['github']

export default handler
