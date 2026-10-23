// Baca Manhwa (manwhaku.my.id) — scraper asli: lihat kanal https://whatsapp.com/channel/0029VbDWBmtA89MamPba8q3f
import axios from 'axios'
import { reactTo } from '../../lib/core-file.js'
import { sleep } from '../../lib/core-system.js'

const BASE = 'https://manwhaku.my.id'
const MAX_PAGES = 10

const client = axios.create({
    baseURL: BASE,
    timeout: 30000,
    maxRedirects: 5,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    }
})

let csrf = null

const get = async (url, options = {}) => {
    const res = await client.get(url, options)
    for (const cookie of res.headers['set-cookie'] || []) {
        const match = cookie.match(/mw_csrf=([^;]+)/)
        if (match) {
            csrf = match[1]
            client.defaults.headers.common.Cookie = `mw_csrf=${csrf}`
        }
    }
    return res
}

const init = async () => {
    if (!csrf) await get('/')
    if (!csrf) await get('/api/auth/get-session')
}

const extractChapter = (html, number) => {
    const match = html.match(new RegExp(`bkch_https%3A%2F%2F[^"\\\\]+chapter-${number}%2F`, 'i'))
    if (match) return match[0]
    if (Number(number) !== 1) return null
    return html.match(/firstChapterSlug\\":\\"([^\\"]+)\\"/)?.[1] || null
}

const readableTitle = (id) => String(id).replace(/^bk_/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

async function search(query) {
    await init()
    const res = await get(`/manga?q=${encodeURIComponent(query)}`)
    const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    return [...new Set(html.match(/bk_[a-z0-9_-]+/gi) || [])]
}

async function baca(input, chapterNum = 1) {
    await init()

    let mangaId = null
    let chapterId = null

    if (/^https?:\/\//i.test(input)) {
        const url = new URL(input)
        if (url.hostname !== 'manwhaku.my.id') throw new Error('Domain URL tidak valid')
        const parts = url.pathname.split('/').filter(Boolean)
        if (parts[0] === 'read' && parts[1]) chapterId = parts[1]
        else if (parts[0] === 'manga' && parts[1]) mangaId = parts[1]
        else throw new Error('URL manga/chapter tidak valid')
    } else {
        input = String(input).trim()
        if (/^bkch_/i.test(input)) chapterId = input
        else mangaId = input
    }

    if (mangaId) {
        const res = await get(`/manga/${mangaId}`)
        const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
        chapterId = extractChapter(html, chapterNum)
        if (!chapterId) throw new Error(`Chapter ${chapterNum} tidak ditemukan`)
    }

    const chapterUrl = `${BASE}/read/${chapterId}`
    const res = await get(`/read/${chapterId}`)
    const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    const tokens = [...new Set((html.match(/\/api\/view\/[A-Za-z0-9_-]+/g) || []).map(x => x.replace('/api/view/', '')))]
    if (!tokens.length) throw new Error('Halaman chapter tidak ditemukan')

    return { chapterUrl, tokens }
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const input = String(text || '').trim()

    try {
        if (command === 'bacamanhwa') {
            const parts = input.split(/\s+/).filter(Boolean)
            if (!parts[0]) return reply(`Format: *${prefix}${command} <id/link> [chapter]*\n\nContoh:\n${prefix}${command} bk_manager-kim 1\n${prefix}${command} https://manwhaku.my.id/manga/bk_manager-kim 3`)
            const chapterNum = parseInt(parts[1], 10) || 1

            await reactTo(sock, m, '⏳')
            const { chapterUrl, tokens } = await baca(parts[0], chapterNum)
            const shown = tokens.slice(0, MAX_PAGES)
            await reply(`*📖 BACA MANHWA*\n\nMengirim ${shown.length} dari ${tokens.length} halaman.\nBaca lengkap: ${chapterUrl}`)

            let sent = 0
            for (let i = 0; i < shown.length; i++) {
                try {
                    const img = await client.get(`/api/view/${shown[i]}`, { responseType: 'arraybuffer', headers: { Referer: chapterUrl } })
                    await sock.sendMessage(m.chat, { image: Buffer.from(img.data), caption: `Hal. ${i + 1}/${tokens.length}` }, { quoted: m })
                    sent++
                } catch {}
                await sleep(1200)
            }
            if (!sent) await reply(`Gambar tidak bisa dikirim langsung, buka manual:\n${chapterUrl}`)
            return await reactTo(sock, m, '✅')
        }

        if (!input) return reply(`Cari manhwa.\n\nContoh:\n${prefix}${command} lookism\n\nLalu baca dengan:\n${prefix}bacamanhwa <id> [chapter]`)
        await reactTo(sock, m, '⏳')
        const ids = await search(input)
        if (!ids.length) throw new Error('Manhwa tidak ditemukan.')
        const list = ids.slice(0, 15).map((id, i) => `${i + 1}. *${readableTitle(id)}*\n   id: ${id}`).join('\n\n')
        await reply(`*📚 HASIL: ${input}* (${ids.length})\n\n${list}\n\nBaca: *${prefix}bacamanhwa <id> [chapter]*`)
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.response?.status ? `HTTP ${e.response.status}: ` : ''}${e.message || 'Gagal memproses.'}`)
    }
}

handler.command = ['manhwa', 'bacamanhwa']
handler.help = ['manhwa']
handler.tags = ['search']

export default handler
