/*
- HARGAI WOY JANGAN DIHAPUS!
- Skrep by *JH a.k.a DHIKA - FIONY BOT*
- Credits to all Fiony's Bot Admin.
*/
// .kura <judul>          → cari anime
// .kura <link anime>     → detail anime + daftar episode / batch
// .kura <link episode>   → link stream & download episode
// .kura <link batch>     → link download batch
import axios from 'axios'
import * as cheerio from 'cheerio'

const BASE = 'https://v20.kuramanime.ing'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const KURA_URL = /^https?:\/\/[^/\s]*kuramanime\.[^/\s]+\/\S*/i
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ───────── helper ─────────
const clean = (t) => String(t ?? '').replace(/\s+/g, ' ').trim()
const toAbs = (u) => {
    const s = clean(u)
    return s && !/^https?:\/\//.test(s) ? `${BASE}${s.startsWith('/') ? '' : '/'}${s}` : s
}
const num = (s) => String(s ?? '').match(/[\d.]+/)?.[0] || ''
const cut = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s)

// Bypass Cloudflare lewat layanan pihak ketiga (cap.jhx.my.id), hasilnya HTML halaman
async function bypassCF(url) {
    const headers = { 'User-Agent': UA }
    const { data: task } = await axios.post('https://cap.jhx.my.id/api/createTask', { url, type: 'source' }, { headers, timeout: 30000 })
    if (!task?.success || !task.jobId) throw new Error('Gagal membuat task bypass Cloudflare.')

    for (let i = 0; i < 30; i++) {
        const { data: d } = await axios.post('https://cap.jhx.my.id/api/getResult', { jobId: task.jobId }, { headers, timeout: 30000 })
        const token = d?.solution?.token
        if (d?.status === 'ready' && token) return token
        if (['failed', 'error'].includes(d?.status) || d?.success === false) {
            throw new Error(`Bypass Cloudflare gagal: ${d?.message || 'status failed'}`)
        }
        await sleep(2000)
    }
    throw new Error('Timeout menunggu bypass Cloudflare.')
}

// ───────── parser: pencarian ─────────
function parseSearch(html) {
    const $ = cheerio.load(html)
    const results = []
    const seen = new Set()
    const push = (r) => {
        if (!r.url || !r.title || /\/(properties|quick)\//.test(r.url) || seen.has(r.url)) return
        seen.add(r.url)
        results.push(r)
    }

    $('#animeList .product__item').each((_, el) => {
        const item = $(el)
        const pic = item.find('.product__item__pic').first()
        let type = '', quality = ''
        item.find('.product__item__text a[href*="/properties/"]').each((_, a) => {
            const href = $(a).attr('href') || ''
            const val = clean($(a).text())
            if (href.includes('/properties/type/')) type = val
            else if (href.includes('/properties/quality/')) quality = val
        })
        const bg = (pic.attr('style') || '').match(/url\(["']?(?:&quot;)?([^"')&]+)/)
        push({
            title: clean(item.find('h5').first().text()),
            type,
            quality,
            status: clean(item.find('.d-none span').first().text()),
            score: num(item.find('.ep span').first().text()),
            thumbnail: pic.attr('data-setbg') || (bg ? bg[1] : ''),
            url: toAbs(item.find('a[href*="/anime/"]').first().attr('href'))
        })
    })

    if (!results.length) {
        $('#animeList a[href*="/anime/"]').each((_, el) => {
            const link = $(el)
            const item = link.find('.product__sidebar__view__item').first()
            if (!item.length) return
            push({
                title: clean(item.find('h5').first().text()),
                type: '',
                quality: clean(item.find('.view').first().text()),
                status: clean(item.find('.d-none span').first().text()),
                score: num(item.find('.ep span').first().text()),
                thumbnail: item.attr('data-setbg') || '',
                url: toAbs(link.attr('href'))
            })
        })
    }
    return results
}

// ───────── parser: detail anime ─────────
function parseDetail(html) {
    const $ = cheerio.load(html)
    const title = clean($('.anime__details__title h3').first().text()) ||
        clean($('title').text().split(' - ')[0].replace(/^\[[^\]]+\]\s*/, ''))
    const altRaw = clean($('.anime__details__title').children('span').first().text())
    const picWrap = $('.anime__details__pic').first()

    const synEl = $('#synopsisField').first().clone()
    synEl.find('i').remove()
    synEl.find('br').replaceWith('\n')
    const synopsis = synEl.text().split('\n').map(l => l.trim()).filter(Boolean)
        .filter(l => !/^\[Ditulis oleh/i.test(l)).join('\n\n')

    const metadata = {}
    let genres = []
    $('.anime__details__widget ul li').each((_, el) => {
        const key = clean($(el).find('.col-3 span').first().text()).replace(/:/g, '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
        if (!key) return
        const col9 = $(el).find('.col-9').first()
        const val = clean(col9.text())
        metadata[key] = !val || val === '?' ? null : val
        if (key === 'genre') genres = col9.find('a').map((_, a) => clean($(a).text()).replace(/,/g, '')).get().filter(Boolean)
    })
    delete metadata.skor

    const episodes = []
    const seenEp = new Set()
    let first = null, latest = null
    const epHtml = $('#episodeLists').attr('data-content') || ''
    if (epHtml) {
        const $ep = cheerio.load(epHtml)
        $ep('a').each((_, el) => {
            const a = $ep(el)
            const href = toAbs(a.attr('href'))
            const t = clean(a.text())
            if (!href || a.hasClass('page__link__episode') || /[?&]page=\d+/.test(href)) return
            if (!href.includes('/episode/')) return
            if (/\(Terlama\)/i.test(t)) first = { title: t.replace(/\s*\(Terlama\)/i, ''), url: href }
            else if (/\(Terbaru\)/i.test(t)) latest = { title: t.replace(/\s*\(Terbaru\)/i, ''), url: href }
            else if (!seenEp.has(href)) { seenEp.add(href); episodes.push({ title: t, url: href }) }
        })
    }

    const batches = []
    const seenBt = new Set()
    const batchHtml = $('#episodeBatchLists').attr('data-content') || ''
    if (batchHtml) {
        const $bt = cheerio.load(batchHtml)
        $bt('a').each((_, el) => {
            const href = toAbs($bt(el).attr('href'))
            if (href.includes('/batch/') && !seenBt.has(href)) {
                seenBt.add(href)
                batches.push({ title: clean($bt(el).text()), url: href })
            }
        })
    }

    return {
        title,
        alt: altRaw ? altRaw.split(/\s*,\s*/).filter(Boolean) : [],
        thumbnail: picWrap.attr('data-setbg') || picWrap.find('img').first().attr('src') || '',
        score: num(picWrap.find('.ep').first().text()),
        quality: clean(picWrap.find('.ep-v2').first().text()),
        synopsis, genres, metadata, first, latest, episodes, batches
    }
}

// ───────── parser: episode / batch ─────────
const hasSource = (h) => /<video[^>]*id=["']player["'][\s\S]*?<source\s/i.test(h)
const hasDownload = (h) => /id=["']animeDownloadLink["'][\s\S]*?<h6/i.test(h)

async function fetchPlayerHtml(target, mode) {
    const need = mode === 'batch' ? 1 : 2
    const plan = [0, 3000, 5000, 8000]
    let html = '', best = -1, attempts = 0

    for (const [idx, wait] of plan.entries()) {
        if (wait) await sleep(wait)
        attempts = idx + 1
        const url = attempts > 2 ? `${target}${target.includes('?') ? '&' : '?'}_r=${Date.now()}` : target
        const got = await bypassCF(url)
        if (!got) throw new Error('HTML halaman kosong.')
        const score = (hasSource(got) ? 1 : 0) + (hasDownload(got) ? 1 : 0)
        if (score > best) { best = score; html = got }
        if (score >= need) break
    }

    if (best <= 0 || (mode === 'batch' && !hasDownload(html))) {
        throw new Error(`Link stream/download belum termuat setelah ${attempts} percobaan. Coba ulang beberapa saat lagi.`)
    }
    return html
}

function parsePlayer(html, mode) {
    const $ = cheerio.load(html)
    const title = clean($('#episodeTitle').first().text()) || clean($('title').text().split(' - ')[0])
    const animeLink = $('#episodeTitle').parent().find('a[href*="/anime/"]').last()

    const video = $('video#player').first()
    const sources = video.find('source').map((_, el) => ({
        resolution: clean($(el).attr('size')) ? `${clean($(el).attr('size'))}p` : '',
        url: clean($(el).attr('src'))
    })).get().filter(x => x.url)

    const downloads = []
    let cur = null
    $('#animeDownloadLink').children().each((_, el) => {
        const node = $(el)
        const tag = String(el.tagName || el.name || '').toLowerCase()
        if (tag === 'h6') {
            cur = { label: clean(node.text()), links: [] }
            downloads.push(cur)
        } else if (tag === 'a' && cur) {
            const url = clean(node.attr('href'))
            if (url) cur.links.push({ name: clean(node.text()), url })
        }
    })

    const servers = $('#changeServer option').map((_, el) =>
        clean($(el).text()).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '').trim()
    ).get().filter(Boolean)

    return {
        title,
        anime: { title: clean(animeLink.text()), url: toAbs(animeLink.attr('href')) },
        poster: video.attr('data-poster') || '',
        hls: video.attr('data-hls-src') || '',
        sources, downloads, servers, mode
    }
}

// ───────── tampilan ─────────
const react = (sock, m, text) => sock.sendMessage(m.chat, { react: { text, key: m.key } }).catch(() => null)

function fmtSearch(query, results, prefix) {
    const list = results.slice(0, 10)
    const body = list.map((r, i) =>
        `*${i + 1}. ${r.title}*\n` +
        `   ${[r.type, r.quality, r.status].filter(Boolean).join(' • ') || '-'}` +
        `${r.score ? ` • ⭐ ${r.score}` : ''}\n` +
        `   ${r.url}`
    ).join('\n\n')
    return `*▢ KURAMANIME: ${query}*\n_${results.length} hasil_\n\n${body}\n\n_Detail anime: ${prefix}kura <link anime>_`
}

function fmtDetail(d, url, prefix) {
    const meta = d.metadata
    const lines = [
        `*▢ ${d.title}*`,
        d.alt.length ? `_${cut(d.alt.join(', '), 120)}_` : '',
        '',
        d.score ? `❀ Skor    : ⭐ ${d.score}` : '',
        d.quality ? `❀ Kualitas: ${d.quality}` : '',
        ...Object.entries(meta).filter(([, v]) => v).slice(0, 10).map(([k, v]) =>
            `❀ ${k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())} : ${cut(String(v), 80)}`),
        d.genres.length ? `❀ Genre   : ${d.genres.join(', ')}` : '',
        '',
        d.synopsis ? cut(d.synopsis, 700) : '',
        '',
        `❀ Episode : ${d.episodes.length + (d.first ? 1 : 0) + (d.latest ? 1 : 0)} tampil`,
        `❀ Batch   : ${d.batches.length}`,
        `❀ Link    : ${url}`
    ]
    return lines.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim()
}

function fmtEpisodes(d, prefix) {
    const all = [
        ...(d.first ? [{ ...d.first, title: `${d.first.title} (awal)` }] : []),
        ...d.episodes,
        ...(d.latest ? [{ ...d.latest, title: `${d.latest.title} (terbaru)` }] : [])
    ]
    const out = []
    if (all.length) {
        const shown = all.slice(0, 25)
        out.push(`*▢ DAFTAR EPISODE*\n\n${shown.map(e => `• ${e.title}\n  ${e.url}`).join('\n')}` +
            (all.length > shown.length ? `\n\n_+${all.length - shown.length} episode lain, buka halaman anime._` : ''))
    }
    if (d.batches.length) {
        out.push(`*▢ BATCH*\n\n${d.batches.slice(0, 10).map(b => `• ${b.title}\n  ${b.url}`).join('\n')}`)
    }
    if (out.length) out.push(`_Link stream/download: ${prefix}kura <link episode atau batch>_`)
    return out.join('\n\n')
}

function fmtPlayer(p) {
    const head = [
        `*▢ ${p.mode === 'batch' ? 'BATCH' : 'EPISODE'}*`,
        '',
        `❀ Judul : ${p.title}`,
        p.anime.title ? `❀ Anime : ${p.anime.title}` : ''
    ].filter(Boolean)

    const parts = [head.join('\n')]
    if (p.sources.length || p.hls) {
        const s = p.sources.map(x => `• ${x.resolution || 'video'}\n  ${x.url}`)
        if (p.hls) s.push(`• HLS\n  ${p.hls}`)
        parts.push(`*▢ STREAM*\n\n${s.join('\n')}`)
    }
    if (p.downloads.length) {
        const g = p.downloads.map(d =>
            `*${d.label}*\n${d.links.map(l => `• ${l.name || 'Link'}: ${l.url}`).join('\n')}`)
        parts.push(`*▢ DOWNLOAD*\n\n${g.join('\n\n')}`)
    }
    return parts.join('\n\n')
}

// WhatsApp membatasi panjang pesan, potong jadi beberapa pesan bila perlu
const chunkText = (text, max = 3500) => {
    const out = []
    let cur = ''
    for (const line of text.split('\n')) {
        if ((cur + '\n' + line).length > max && cur) { out.push(cur); cur = line } else cur = cur ? cur + '\n' + line : line
    }
    if (cur) out.push(cur)
    return out
}

let handler = async (m, { sock, text, prefix, reply }) => {
    const input = String(text || '').trim()
    if (!input) {
        return reply(
            `*▢ KURAMANIME*\n\n` +
            `${prefix}kura black clover   → cari anime\n` +
            `${prefix}kura <link anime>   → detail + daftar episode\n` +
            `${prefix}kura <link episode> → link stream & download\n` +
            `${prefix}kura <link batch>   → link download batch`
        )
    }

    const isUrl = /^https?:\/\//i.test(input)
    if (isUrl && !KURA_URL.test(input)) return reply('❌ Hanya link kuramanime yang didukung.')

    const mode = isUrl
        ? (input.includes('/episode/') ? 'episode' : input.includes('/batch/') ? 'batch' : 'detail')
        : 'search'

    await react(sock, m, '🕒')
    if (mode !== 'search') await reply(mode === 'detail' ? '⏳ Membuka halaman anime...' : '⏳ Mengambil link stream/download, bisa sampai ±30 detik...')

    try {
        if (mode === 'search') {
            const url = `${BASE}/anime?order_by=latest&search=${encodeURIComponent(input)}&page=1&_=${Date.now()}`
            const results = parseSearch(await bypassCF(url))
            if (!results.length) throw new Error('Anime tidak ditemukan, coba judul lain.')
            const caption = fmtSearch(input, results, prefix)
            const thumb = results[0].thumbnail
            if (thumb && caption.length < 1000) {
                await sock.sendMessage(m.chat, { image: { url: thumb }, caption }, { quoted: m }).catch(() => reply(caption))
            } else {
                for (const c of chunkText(caption)) await reply(c)
            }
        } else if (mode === 'detail') {
            const d = parseDetail(await bypassCF(input))
            if (!d.title) throw new Error('Gagal membaca halaman anime.')
            const caption = fmtDetail(d, input, prefix)
            if (d.thumbnail) await sock.sendMessage(m.chat, { image: { url: d.thumbnail }, caption }, { quoted: m }).catch(() => reply(caption))
            else await reply(caption)
            const eps = fmtEpisodes(d, prefix)
            if (eps) for (const c of chunkText(eps)) await reply(c)
        } else {
            const p = parsePlayer(await fetchPlayerHtml(input, mode), mode)
            for (const c of chunkText(fmtPlayer(p))) await reply(c)
        }
        return react(sock, m, '✅')
    } catch (e) {
        await react(sock, m, '❌')
        return reply(`❌ ${e.response?.data?.message || e.message}`)
    }
}

handler.command = ['kura', 'kuramanime', 'kurasearch']
handler.help = ['kura <judul / link anime / link episode / link batch>']
handler.tags = ['anime']
handler.limit = true

export default handler
