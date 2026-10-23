// .ghtoken  -> info akun & sisa kuota API dari token GitHub (owner)
import { ghGet, ghNoToken, ghSendButtons } from '../../lib/core-data.js'
import { reactTo } from '../../lib/core-file.js'

let handler = async (m, { sock, prefix, reply }) => {
    if (!global.tokengh) return reply(ghNoToken(prefix))

    await reactTo(sock, m, '⏳')
    try {
        const { data: user } = await ghGet('https://api.github.com/user')
        const { data: rate } = await ghGet('https://api.github.com/rate_limit')
        const core = rate.resources.core
        const resetAt = new Date(core.reset * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

        await ghSendButtons(sock, m, {
            image: user.avatar_url,
            text:
                `🔑 *GITHUB AUTHENTICATED TOKEN INFO*\n\n` +
                `👤 *Token Owner:* ${user.name || user.login} (@${user.login})\n` +
                `📧 *Email:* ${user.email || '-'}\n` +
                `📦 *Public Repos:* ${user.public_repos}\n` +
                `🔒 *Private Repos:* ${user.total_private_repos || 0}\n` +
                `👥 *Followers:* ${user.followers} | *Following:* ${user.following}\n\n` +
                `📊 *API RATE LIMIT:*\n` +
                `• Limit: *${core.limit} req/jam*\n` +
                `• Sisa: *${core.remaining} req*\n` +
                `• Reset: *${resetAt}*`,
            footer: `${global.namebot || 'Bot'} • GitHub Token`,
            buttons: [
                { type: 'url', url: user.html_url, text: '🌐 Buka Profil GitHub' },
                { type: 'reply', id: `${prefix}ghrepos ${user.login}`, text: '📦 Lihat Repositories' }
            ]
        })
        await reactTo(sock, m, '✅')
    } catch (e) {
        console.error('[GHTOKEN ERROR]', e?.message || e)
        await reactTo(sock, m, '❌')
        return reply(`❌ Token GitHub invalid atau kadaluarsa!\nError: ${e?.response?.data?.message || e?.message || 'Unauthorized'}`)
    }
}

handler.command = ['ghtoken', 'ghme', 'ghrate']
handler.help = ['ghtoken']
handler.tags = ['github']
handler.owner = true

export default handler
