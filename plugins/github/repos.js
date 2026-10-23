// .ghrepos <username>  -> 10 repositori terbaru user
import { ghGet, ghErrMsg, ghSendButtons } from '../../lib/core-data.js'
import { reactTo } from '../../lib/core-file.js'

let handler = async (m, { sock, text, prefix, command, reply }) => {
    if (!text) return reply(`❌ *Format salah!*\n\nContoh: *${prefix}${command} torvalds*`)

    const username = text.trim().split(/\s+/)[0].replace('@', '')
    await reactTo(sock, m, '⏳')
    try {
        const { data: repos } = await ghGet(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=10`)
        if (!repos?.length) {
            await reactTo(sock, m, '❌')
            return reply(`ℹ️ User *@${username}* tidak memiliki repositori publik.`)
        }

        let out = `📦 *REPOSITORI GITHUB: @${username}*\n\nMenampilkan ${repos.length} repositori terbaru:\n\n`
        repos.forEach((r, i) => {
            out += `${i + 1}. *${r.name}*\n` +
                `   📝 ${r.description || 'Tidak ada deskripsi'}\n` +
                `   ⭐ ${r.stargazers_count} Stars | 🔀 ${r.forks_count} Forks | 💻 ${r.language || '-'}\n` +
                `   🔗 ${r.html_url}\n\n`
        })

        await ghSendButtons(sock, m, {
            text: out.trim(),
            footer: `Ketik ${prefix}ghclone <owner/repo> untuk download ZIP repo`,
            buttons: [{ type: 'reply', id: `${prefix}ghclone ${repos[0].full_name}`, text: `📦 Download ${repos[0].name}` }]
        })
        await reactTo(sock, m, '✅')
    } catch (e) {
        console.error('[GHREPOS ERROR]', e?.message || e)
        await reactTo(sock, m, '❌')
        if (e?.response?.status === 404) return reply(`❌ Username GitHub *${username}* tidak ditemukan!`)
        return reply(`❌ Gagal mengambil daftar repositori: ${ghErrMsg(e)}`)
    }
}

handler.command = ['ghrepos', 'userrepos', 'githubrepos']
handler.help = ['ghrepos <username>']
handler.tags = ['github']

export default handler
