// .pushgit <nama-repo>|<true/false>  (reply file ZIP)  -> upload isi ZIP ke repo GitHub (owner)
// true = private, false = public. Repo dibuat otomatis kalau belum ada.
import axios from 'axios'
import AdmZip from 'adm-zip'
import { pickMedia, reactTo } from '../../lib/core-file.js'
import { ghHeaders, ghErrMsg, ghNoToken } from '../../lib/core-data.js'

const SKIP = /(^|\/)(__MACOSX|node_modules|\.git)(\/|$)|(^|\/)\.DS_Store$/
const MAX_FILES = 300

let handler = async (m, { sock, text, prefix, command, reply }) => {
    if (!text) {
        return reply(`Balas / kirim file ZIP dengan caption:\n\n${prefix}${command} nama-repo|true/false\n\nContoh:\n${prefix}${command} my-bot|true\n\n(true = private, false = public)`)
    }

    const [repoRaw, privRaw] = text.split('|').map(v => v.trim())
    const repoName = (repoRaw || '').replace(/[^a-zA-Z0-9._-]/g, '')
    if (!repoName) return reply('Nama repo tidak boleh kosong!')
    if (!privRaw) return reply('Isi true/false untuk private repo.\nContoh: my-bot|true')
    if (!global.tokengh) return reply(ghNoToken(prefix))

    const media = pickMedia(m)
    const isZip = media && (/zip/i.test(media.mime) || /\.zip$/i.test(media.node?.fileName || ''))
    if (!isZip) return reply('Silakan kirim atau reply file ZIP terlebih dahulu!')

    const isPrivate = privRaw.toLowerCase() === 'true'
    const gh = axios.create({ baseURL: 'https://api.github.com', headers: ghHeaders(true), timeout: 30000 })

    await reactTo(sock, m, '⏳')
    try {
        const { data: user } = await gh.get('/user')
        const login = user.login

        let exists = true
        try { await gh.get(`/repos/${login}/${repoName}`) }
        catch (e) { if (e.response?.status === 404) exists = false; else throw e }
        if (!exists) await gh.post('/user/repos', { name: repoName, private: isPrivate, auto_init: true })

        const buf = await media.download()
        if (!Buffer.isBuffer(buf) || !buf.length) throw new Error('File ZIP gagal diunduh')

        const entries = new AdmZip(buf).getEntries().filter(e => !e.isDirectory)
        let paths = entries.map(e => e.entryName.replace(/\\/g, '/').replace(/^\/+/, ''))
        if (paths.some(p => p.split('/').includes('..'))) throw new Error('ZIP berisi path berbahaya, ditolak')

        // ZIP dari "Compress folder" biasanya punya satu folder induk: buang supaya file ada di root repo
        const roots = new Set(paths.map(p => p.split('/')[0]))
        const strip = roots.size === 1 && paths.every(p => p.includes('/'))
        const list = entries
            .map((e, i) => ({ e, p: strip ? paths[i].split('/').slice(1).join('/') : paths[i] }))
            .filter(({ p }) => p && !SKIP.test(p))

        if (!list.length) throw new Error('ZIP kosong')
        if (list.length > MAX_FILES) throw new Error(`Terlalu banyak file (${list.length}, maks ${MAX_FILES})`)

        let total = 0
        for (const { e, p } of list) {
            const encoded = encodeURIComponent(p).replace(/%2F/g, '/')
            let sha
            try { sha = (await gh.get(`/repos/${login}/${repoName}/contents/${encoded}`)).data.sha } catch {}
            await gh.put(`/repos/${login}/${repoName}/contents/${encoded}`, {
                message: `Upload via ${global.namebot || 'WhatsApp Bot'}`,
                content: e.getData().toString('base64'),
                ...(sha ? { sha } : {})
            })
            total++
        }

        await reactTo(sock, m, '✅')
        return sock.sendMessage(m.chat, {
            text: `「 PUSH GIT SUCCESS 」\n\n📁 Repo: ${login}/${repoName}\n🔒 Private: ${isPrivate}\n📦 Files: ${total}\n🌐 https://github.com/${login}/${repoName}`
        }, { quoted: m })
    } catch (e) {
        console.error('[GHPUSH ERROR]', e?.response?.data || e?.message || e)
        await reactTo(sock, m, '❌')
        return reply(`❌ Error:\n${ghErrMsg(e)}`)
    }
}

handler.command = ['pushgit', 'gitpush', 'ghpush']
handler.help = ['pushgit <repo>|<true/false>']
handler.tags = ['github']
handler.owner = true

export default handler
