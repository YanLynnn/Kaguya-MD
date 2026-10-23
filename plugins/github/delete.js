// .ghdelete <nama-repo> ya  -> hapus repositori milik akun token (owner)
import axios from 'axios'
import { ghHeaders, ghErrMsg, ghNoToken } from '../../lib/core-data.js'
import { reactTo } from '../../lib/core-file.js'

let handler = async (m, { sock, text, prefix, command, reply }) => {
    if (!global.tokengh) return reply(ghNoToken(prefix))

    const args = String(text || '').trim().split(/\s+/).filter(Boolean)
    if (!args[0]) return reply(`❌ *Format salah!*\n\nContoh: *${prefix}${command} nama-repo ya*`)

    const repoName = args[0].replace(/^https?:\/\/github\.com\//i, '').replace(/^[^\/]+\//, '').replace(/\/$/, '')
    // penghapusan permanen: wajib konfirmasi "ya"
    if (!/^(ya|yes|y)$/i.test(args[1] || '')) {
        return reply(`⚠️ Menghapus repo *${repoName}* tidak bisa dibatalkan.\nKetik: *${prefix}${command} ${repoName} ya*`)
    }

    await reactTo(sock, m, '⏳')
    try {
        const { data: user } = await axios.get('https://api.github.com/user', { headers: ghHeaders(), timeout: 15000 })
        await axios.delete(`https://api.github.com/repos/${user.login}/${repoName}`, { headers: ghHeaders(), timeout: 20000 })
        await reactTo(sock, m, '✅')
        return reply(`🗑️ *REPOSITORI BERHASIL DIHAPUS*\n\nRepositori *${user.login}/${repoName}* telah dihapus permanen dari akun GitHub.`)
    } catch (e) {
        console.error('[GHDELETE ERROR]', e?.response?.data || e?.message || e)
        await reactTo(sock, m, '❌')
        return reply(`❌ Gagal menghapus repositori GitHub!\nReason: ${ghErrMsg(e)}`)
    }
}

handler.command = ['ghdelete', 'ghdel', 'deleterepo']
handler.help = ['ghdelete <nama-repo> ya']
handler.tags = ['github']
handler.owner = true

export default handler
