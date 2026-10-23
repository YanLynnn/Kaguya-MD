// .ghstalk <username>  -> profil user GitHub
import { ghGet } from '../../lib/core-data.js'
import { reactTo } from '../../lib/core-file.js'

let handler = async (m, { sock, text, prefix, command, reply }) => {
    if (!text) return reply(`*GitHub User Stalker*\n\nContoh:\n${prefix}${command} torvalds\n${prefix}${command} octocat`)

    const username = text.trim().split(/\s+/)[0].replace('@', '')
    await reactTo(sock, m, '⏳')
    try {
        const { data: u } = await ghGet(`https://api.github.com/users/${encodeURIComponent(username)}`)
        const caption =
            `👤 *GITHUB USER PROFILE*\n\n` +
            `• *Nama:* ${u.name || '-'}\n` +
            `• *Username:* @${u.login}\n` +
            `• *Bio:* ${u.bio || '-'}\n` +
            `• *Perusahaan:* ${u.company || '-'}\n` +
            `• *Lokasi:* ${u.location || '-'}\n` +
            `• *Public Repos:* ${u.public_repos}\n` +
            `• *Followers:* ${u.followers.toLocaleString('id-ID')}\n` +
            `• *Following:* ${u.following.toLocaleString('id-ID')}\n` +
            `• *Bergabung:* ${new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n` +
            `• *URL:* ${u.html_url}`

        if (u.avatar_url) await sock.sendMessage(m.chat, { image: { url: u.avatar_url }, caption }, { quoted: m })
        else await reply(caption)
        await reactTo(sock, m, '✅')
    } catch (e) {
        console.error('[GHSTALK ERROR]', e?.message || e)
        await reactTo(sock, m, '❌')
        return reply(e?.response?.status === 404 ? `❌ Username GitHub *${username}* tidak ditemukan.` : `❌ Gagal mengambil profil: ${e?.message || 'error'}`)
    }
}

handler.command = ['ghstalk', 'githubstalk', 'ghuser']
handler.help = ['ghstalk <username>']
handler.tags = ['github']

export default handler
