// .ghcreate <nama> [public|private]  -> buat repositori baru (owner)
import axios from 'axios'
import { ghHeaders, ghErrMsg, ghNoToken, ghSendButtons } from '../../lib/core-data.js'
import { reactTo } from '../../lib/core-file.js'

let handler = async (m, { sock, text, prefix, command, reply }) => {
    if (!global.tokengh) return reply(ghNoToken(prefix))

    const args = String(text || '').trim().split(/\s+/).filter(Boolean)
    if (!args[0]) return reply(`❌ *Format salah!*\n\nContoh: *${prefix}${command} my-new-bot public*\natau *${prefix}${command} my-secret-project private*`)

    const repoName = args[0].replace(/[^a-zA-Z0-9._-]/g, '')
    if (!repoName) return reply('❌ Nama repo tidak valid.')
    const isPrivate = (args[1] || '').toLowerCase() === 'private'

    await reactTo(sock, m, '⏳')
    try {
        const { data } = await axios.post('https://api.github.com/user/repos', {
            name: repoName,
            description: `Repository created via ${global.namebot || 'WhatsApp Bot'}`,
            private: isPrivate,
            auto_init: true
        }, { headers: ghHeaders(true), timeout: 20000 })

        await ghSendButtons(sock, m, {
            text:
                `✅ *REPOSITORI GITHUB BERHASIL DIBUAT!*\n\n` +
                `• *Nama Repo:* ${data.name}\n` +
                `• *Full Name:* ${data.full_name}\n` +
                `• *Tipe:* ${data.private ? '🔒 Private' : '🌐 Public'}\n` +
                `• *Default Branch:* ${data.default_branch}\n` +
                `• *Clone URL:* ${data.clone_url}\n` +
                `• *Web URL:* ${data.html_url}`,
            footer: `${global.namebot || 'Bot'} • GitHub API Manager`,
            buttons: [
                { type: 'url', url: data.html_url, text: '🌐 Buka Repository' },
                { type: 'reply', id: `${prefix}ghclone ${data.full_name}`, text: '📦 Download ZIP' }
            ]
        })
        await reactTo(sock, m, '✅')
    } catch (e) {
        console.error('[GHCREATE ERROR]', e?.response?.data || e?.message || e)
        await reactTo(sock, m, '❌')
        return reply(`❌ Gagal membuat repositori GitHub!\nReason: ${ghErrMsg(e)}`)
    }
}

handler.command = ['ghcreate', 'createrepo', 'newrepo']
handler.help = ['ghcreate <nama> [public|private]']
handler.tags = ['github']
handler.owner = true

export default handler
