// Komikcast scraper — scraper asli: Vamz Spectre (VamxAPI)
import https from 'https'
import http from 'http'
import { reactTo } from '../../lib/core-file.js'
import { sleep } from '../../lib/core-system.js'

class KomikcastScraper {
    constructor() {
        this.baseUrl = 'https://komikcast.info'
        this.timeout = 15000
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }

    fetchProps(endpoint) {
        return new Promise((resolve, reject) => {
            const targetUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
            const client = targetUrl.startsWith('https') ? https : http

            const req = client.get(targetUrl, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': this.userAgent,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
                }
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume()
                    return resolve(this.fetchProps(new URL(res.headers.location, targetUrl).toString()))
                }
                if (res.statusCode !== 200) {
                    res.resume()
                    return reject(new Error(`Gagal menghubungi Komikcast (HTTP ${res.statusCode})`))
                }
                let body = ''
                res.on('data', (c) => body += c)
                res.on('end', () => {
                    try {
                        const match = body.match(/data-page="([^"]+)"/)
                        if (!match) return reject(new Error('Gagal mengekstrak data dari Komikcast.'))
                        const decoded = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'")
                        resolve(JSON.parse(decoded).props || {})
                    } catch (err) {
                        reject(new Error(`Gagal mem-parsing data Komikcast: ${err.message}`))
                    }
                })
            })
            req.on('error', reject)
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout saat menghubungi Komikcast.')) })
        })
    }

    mapList(mangas) {
        return (mangas.data || []).map((item) => ({
            title: item.title,
            slug: item.slug,
            type: item.type,
            status: item.status,
            rating: item.rating,
            genres: (item.genres || []).map(g => g.name),
            last_chapter: item.last_chapter ? item.last_chapter.chapter_number : null
        }))
    }

    async list(params) {
        const props = await this.fetchProps(`/manga?${params}`)
        const mangas = props.mangas || {}
        return { page: mangas.current_page || 1, last_page: mangas.last_page || 1, total: mangas.total || 0, results: this.mapList(mangas) }
    }

    search(query, page = 1) {
        if (!query) throw new Error('Query pencarian tidak boleh kosong.')
        return this.list(`search=${encodeURIComponent(query)}&page=${page}`)
    }
    latest(page = 1) { return this.list(`sort=latest&page=${page}`) }
    popular(page = 1) { return this.list(`sort=popular&page=${page}`) }

    async detail(slugOrUrl) {
        let slug = slugOrUrl
        const mm = slugOrUrl.match(/\/manga\/([^/?#]+)/)
        if (mm) slug = mm[1]
        slug = slug.trim().replace(/^\/+|\/+$/g, '')

        const props = await this.fetchProps(`/manga/${slug}`)
        const x = props.manga
        if (!x) throw new Error(`Manga "${slug}" tidak ditemukan.`)
        return {
            title: x.title, slug: x.slug, synopsis: x.synopsis, type: x.type, status: x.status,
            author: x.author, artist: x.artist, rating: x.rating, release_year: x.release_year,
            genres: (x.genres || []).map(g => g.name),
            chapters: (x.chapters || []).map(c => ({ number: c.chapter_number, title: c.title }))
        }
    }

    async chapter(slug, number) {
        const props = await this.fetchProps(`/manga/${slug}/chapter/${number}`)
        const ch = props.chapter
        if (!ch) throw new Error('Data chapter tidak ditemukan.')
        const images = (ch.images || []).map((img) => img.r2_url || img.image_path).filter(Boolean)
        return { manga: props.manga?.title || slug, title: ch.title, number: ch.chapter_number, images }
    }
}

const scraper = new KomikcastScraper()
const MAX_IMAGES = 10

const fmtList = (title, data, prefix) => {
    const lines = data.results.slice(0, 10).map((r, i) =>
        `${i + 1}. *${r.title}*\n   ${[r.type, r.status, r.rating ? `⭐ ${r.rating}` : '', r.last_chapter ? `Ch. ${r.last_chapter}` : ''].filter(Boolean).join(' • ')}\n   slug: ${r.slug}`)
    return `*📚 ${title}* (hal. ${data.page}/${data.last_page})\n\n${lines.join('\n\n')}\n\nDetail: *${prefix}komikdetail <slug>*`
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const input = String(text || '').trim()

    try {
        if (command === 'komikterbaru' || command === 'komikpopuler') {
            await reactTo(sock, m, '⏳')
            const page = parseInt(input, 10) || 1
            const data = command === 'komikterbaru' ? await scraper.latest(page) : await scraper.popular(page)
            await reply(fmtList(command === 'komikterbaru' ? 'KOMIK TERBARU' : 'KOMIK POPULER', data, prefix))
            return await reactTo(sock, m, '✅')
        }

        if (command === 'komikdetail') {
            if (!input) return reply(`Masukkan slug atau link manga.\n\nContoh:\n${prefix}${command} solo-swordmaster`)
            await reactTo(sock, m, '⏳')
            const d = await scraper.detail(input)
            const recent = d.chapters.slice(0, 10).map(c => `Ch. ${c.number}`).join(', ')
            const synopsis = String(d.synopsis || '-').replace(/<[^>]+>/g, '').slice(0, 600)
            await reply(`*📖 ${d.title}*\n\n${[d.type, d.status].filter(Boolean).join(' • ')}\n⭐ ${d.rating ?? '-'} • ${d.release_year ?? '-'}\n✍️ ${d.author || '-'} / ${d.artist || '-'}\n🏷️ ${d.genres.join(', ') || '-'}\n\n${synopsis}\n\nTotal chapter: ${d.chapters.length}\nTerbaru: ${recent || '-'}\n\nBaca: *${prefix}komikchapter ${d.slug} <nomor>*`)
            return await reactTo(sock, m, '✅')
        }

        if (command === 'komikchapter') {
            const parts = input.split(/\s+/).filter(Boolean)
            let slug = parts[0], number = parts[1]
            const urlM = input.match(/\/manga\/([^/?#]+)\/chapter\/([^/?#\s]+)/)
            if (urlM) { slug = urlM[1]; number = urlM[2] }
            if (!slug || !number) return reply(`Format: *${prefix}${command} <slug> <nomor>*\n\nContoh:\n${prefix}${command} solo-swordmaster 23`)

            await reactTo(sock, m, '⏳')
            const ch = await scraper.chapter(slug, number)
            if (!ch.images.length) throw new Error('Gambar chapter tidak tersedia.')
            const shown = ch.images.slice(0, MAX_IMAGES)
            await reply(`*📖 ${ch.manga}*\n${ch.title || `Chapter ${ch.number}`}\n\nMengirim ${shown.length} dari ${ch.images.length} halaman.\nBaca lengkap: https://komikcast.info/manga/${slug}/chapter/${number}`)
            for (let i = 0; i < shown.length; i++) {
                try {
                    await sock.sendMessage(m.chat, { image: { url: shown[i] }, caption: `Hal. ${i + 1}/${ch.images.length}` }, { quoted: m })
                } catch {}
                await sleep(1200)
            }
            return await reactTo(sock, m, '✅')
        }

        // komikcast <kata kunci>
        if (!input) return reply(`Cari komik di Komikcast.\n\nContoh:\n${prefix}${command} solo leveling\n${prefix}komikterbaru\n${prefix}komikpopuler\n${prefix}komikdetail <slug>\n${prefix}komikchapter <slug> <nomor>`)
        await reactTo(sock, m, '⏳')
        const data = await scraper.search(input)
        if (!data.results.length) throw new Error('Komik tidak ditemukan.')
        await reply(fmtList(`HASIL: ${input}`, data, prefix))
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Gagal memproses.'}`)
    }
}

handler.command = ['komikcast', 'kc', 'komikterbaru', 'komikpopuler', 'komikdetail', 'komikchapter']
handler.help = ['komikcast']
handler.tags = ['anime']

export default handler
