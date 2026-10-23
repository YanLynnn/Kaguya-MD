// .ghsearch <kata kunci>  -> cari repositori GitHub
import { ghGet, ghErrMsg, ghSendButtons } from '../../lib/core-data.js'
import { reactTo } from '../../lib/core-file.js'

let handler = async (m, { sock, text, prefix, command, reply }) => {
    if (!text) return reply(`❌ *Format salah!*\n\nContoh: *${prefix}${command} baileys bot*`)

    await reactTo(sock, m, '⏳')
    try {
        const { data } = await ghGet(`https://api.github.com/search/repositories?q=${encodeURIComponent(text)}&per_page=5`)
        if (!data?.items?.length) {
            await reactTo(sock, m, '❌')
            return reply(`❌ Repositori GitHub untuk pencarian "*${text}*" tidak ditemukan!`)
        }

        let out = `🔍 *PENCARIAN REPOSITORI GITHUB*\n\nKata kunci: *${text}*\nTotal hasil: *${data.total_count.toLocaleString('id-ID')}*\n\n`
        data.items.forEach((it, i) => {
            out += `${i + 1}. *${it.full_name}*\n` +
                `   📝 ${it.description || 'Tidak ada deskripsi'}\n` +
                `   ⭐ ${it.stargazers_count} | 🔀 ${it.forks_count} | 💻 ${it.language || '-'}\n` +
                `   🔗 ${it.html_url}\n\n`
        })

        const first = data.items[0]
        await ghSendButtons(sock, m, {
            text: out.trim(),
            footer: `Ketik ${prefix}ghclone <owner/repo> untuk download ZIP repo`,
            buttons: [{ type: 'reply', id: `${prefix}ghclone ${first.full_name}`, text: `📦 Download ${first.name}` }]
        })
        await reactTo(sock, m, '✅')
    } catch (e) {
        console.error('[GHSEARCH ERROR]', e?.message || e)
        await reactTo(sock, m, '❌')
        return reply(`❌ Gagal mencari repositori GitHub: ${ghErrMsg(e)}`)
    }
}

handler.command = ['ghsearch', 'githubsearch', 'searchrepo']
handler.help = ['ghsearch <kata kunci>']
handler.tags = ['github']

export default handler
