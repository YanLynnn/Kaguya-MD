// Otakudesu (otakudesu.blog) — scraper tidak resmi: home, ongoing, complete, cari, detail, episode, batch, jadwal, genre
// Dependensi: axios + cheerio (sudah ada di package.json)
//   .otakudesu                       bantuan
//   .otakudesu home | ongoing [hal] | complete [hal] | jadwal | genres | genre <slug> [hal]
//   .otakudesu cari <judul>          .otakudesu anime <slug>
//   .otakudesu eps <slug-episode>    .otakudesu batch <slug-batch>
import axios from 'axios'
import * as cheerio from 'cheerio'
import { reactTo } from '../../lib/core-file.js'

const BASE = (process.env.OTAKUDESU_URL || 'https://otakudesu.blog').replace(/\/+$/, '')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const LINE = '─────────────────────'
const DAYS = /^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Random|None)$/i

const abs = (h = '') => { try { return new URL(h, BASE).href } catch { return h } }
const slugOf = (h = '') => { try { const p = new URL(h, BASE).pathname.split('/').filter(Boolean); return p[p.length - 1] || '' } catch { return String(h).replace(/\/+$/, '').split('/').pop() || '' } }
const tx = ($el) => ($el?.text() || '').replace(/\s+/g, ' ').trim()
const clean = (s, pre) => String(s || '').trim().replace(/^\/+|\/+$/g, '').replace(new RegExp(`^${pre}/`), '').split('/').pop()

async function load(path) {
    const url = path.startsWith('http') ? path : BASE + (path.startsWith('/') ? '' : '/') + path
    const res = await axios.get(url, {
        timeout: 30000, maxRedirects: 5, responseType: 'text',
        headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7', Referer: BASE + '/' },
        validateStatus: () => true
    })
    if (res.status >= 400) throw new Error(`HTTP ${res.status} saat membuka ${url}`)
    const html = String(res.data || '')
    if (/cf-error-details|Attention Required|Just a moment|cf-challenge/.test(html)) throw new Error('Terblokir Cloudflare. Coba lagi nanti atau ganti domain lewat env OTAKUDESU_URL.')
    return cheerio.load(html)
}

function parseCard($, el) {
    const $el = $(el)
    let a = $el.find('a[href*="/anime/"]').first()
    if (!a.length) a = $el.find('a').first()
    const href = a.attr('href') || ''
    if (!href.includes('/anime/')) return null
    let title = tx($el.find('.jdlrx a, .jdlrx, .jdl a, .jdl, .thumbz h2 a, .thumbz h2, h2 a, h2').first()) || a.attr('title') || tx(a)
    title = title.replace(/^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)(?=[A-Z])/, '').trim()
    if (title.length < 2) return null
    const epz = tx($el.find('.epz').first()), tipe = tx($el.find('.epztipe').first())
    const card = { title, slug: slugOf(href), url: abs(href), thumb: abs($el.find('img').attr('src') || $el.find('img').attr('data-src') || '') || undefined, date: tx($el.find('.newnime, .date').first()) || undefined }
    if (epz) card.episode = (epz.match(/Episode\s*\d+/i) || [])[0] || epz.replace(/\s*(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)\s*/gi, '').trim() || undefined
    if (DAYS.test(tipe)) card.day = tipe
    else if (tipe) card.score = tipe
    return card
}

const dedup = (cards) => {
    const map = new Map(), w = (x) => (x.episode ? 2 : 0) + (x.day ? 1 : 0) + (x.score ? 1 : 0) + (x.date ? 1 : 0)
    for (const c of cards) { if (!c?.slug) continue; const p = map.get(c.slug); if (!p || w(c) > w(p)) map.set(c.slug, c) }
    return [...map.values()]
}

function infoOf($) {
    const info = {}
    const set = (k, v) => {
        k = k.trim().toLowerCase()
        if (!v) return
        if (k.includes('judul')) info.title ||= v
        else if (k.includes('japan') || k.includes('jepang')) info.japanese ||= v
        else if (k.includes('skor') || k.includes('score')) info.score ||= v
        else if (k.includes('produser') || k.includes('producer')) info.producer ||= v
        else if (k.includes('tipe') || k.includes('type')) info.type ||= v
        else if (k.includes('status')) info.status ||= v
        else if (k.includes('total episode')) info.totalEpisodes ||= v
        else if (k.includes('durasi')) info.duration ||= v
        else if (k.includes('rilis')) info.releaseDate ||= v
        else if (k.includes('studio')) info.studio ||= v
        else if (k.includes('genre')) info.genres ||= v.split(',').map(g => g.trim()).filter(Boolean)
    }
    $('.infozingle p, .anim-content p, .venser p').each((_, el) => {
        const t = tx($(el)); const i = t.indexOf(':')
        if (i > 0) set(t.slice(0, i), t.slice(i + 1).trim())
    })
    return info
}

function downloadsOf($, scope) {
    const out = {}
    const root = $(scope).length ? $(scope) : $('body')
    root.find('ul li, li').each((_, el) => {
        const $el = $(el)
        const q = (tx($el.find('strong, b').first()) || '').match(/\d{3,4}p|MKV|MP4/i)
        const links = []
        $el.find('a').each((__, a) => {
            const h = $(a).attr('href') || ''
            if (!h || h === '#' || h.startsWith('javascript')) return
            links.push({ host: tx($(a)) || new URL(abs(h)).hostname, url: abs(h) })
        })
        if (!links.length) return
        const key = q ? q[0] : tx($el.find('strong, b').first()).slice(0, 20) || 'default'
        ;(out[key] ||= []).push(...links)
    })
    return out
}

const O = {
    async home() {
        const $ = await load('/')
        const ongoing = [], complete = []
        $('.venz .detpost, .rseries .detpost, #venkonten .detpost').each((_, el) => {
            const c = parseCard($, el); if (!c) return
            ;(c.day || c.episode ? ongoing : complete).push(c)
        })
        const on = dedup(ongoing)
        return { ongoing: on, complete: dedup(complete).filter(c => !on.some(o => o.slug === c.slug)) }
    },
    async list(path, page) {
        const $ = await load(path)
        const raw = []
        $('.detpost').each((_, el) => { const c = parseCard($, el); if (c) raw.push(c) })
        let max = 1
        $('.pagination a, .page-numbers, .wp-pagenavi a').each((_, el) => { const n = parseInt(tx($(el)), 10); if (n > max) max = n })
        return { list: dedup(raw), page, maxPage: max }
    },
    ongoing: (p = 1) => O.list(p > 1 ? `/ongoing-anime/page/${p}/` : '/ongoing-anime/', p),
    complete: (p = 1) => O.list(p > 1 ? `/complete-anime/page/${p}/` : '/complete-anime/', p),
    genre: (s, p = 1) => O.list(p > 1 ? `/genres/${s}/page/${p}/` : `/genres/${s}/`, p),
    async search(q) {
        const $ = await load(`/?s=${encodeURIComponent(q)}&post_type=anime`)
        const raw = []
        $('.detpost, .chivsrc li, .searchx').each((_, el) => {
            const c = parseCard($, el)
            if (c) return raw.push(c)
            const a = $(el).find('a[href*="/anime/"]').first(), h = a.attr('href') || ''
            const t = tx(a) || a.attr('title') || ''
            if (h.includes('/anime/') && t.length > 1) raw.push({ title: t, slug: slugOf(h), url: abs(h) })
        })
        let list = dedup(raw)
        if (!list.length) {
            const seen = new Set()
            $('a[href*="/anime/"]').each((_, el) => {
                const h = $(el).attr('href') || '', t = tx($(el)); const s = slugOf(h)
                if (t.length < 3 || seen.has(s)) return
                seen.add(s); list.push({ title: t, slug: s, url: abs(h) })
            })
        }
        return list
    },
    async anime(slug) {
        const s = clean(slug, 'anime')
        const $ = await load(`/anime/${s}/`)
        const info = infoOf($)
        const title = info.title || tx($('.jdlrx h1, h1.entry-title, h1').first())
        const synopsis = tx($('.sinopc')) || $('.entry-content p').map((_, e) => tx($(e))).get().filter(t => t.length > 40 && !/Judul|Japanese/.test(t)).join(' ')
        const episodes = []
        $('.episodelist ul li, .episode-list li, .listeps li, #venkonten ul li, .venser ul li').each((_, el) => {
            const a = $(el).find('a').first(), h = a.attr('href') || ''
            if (!h.includes('/episode/')) return
            episodes.push({ title: tx(a) || a.attr('title') || '', slug: slugOf(h), url: abs(h), date: tx($(el).find('.zeebr, .zee, .date').last()) || undefined })
        })
        let batch = null
        $('a[href*="/batch/"]').each((_, el) => { const h = $(el).attr('href') || ''; batch = { title: tx($(el)) || 'Batch', slug: slugOf(h), url: abs(h) } })
        return { ...info, title, genres: info.genres || [], synopsis, thumb: abs($('.fotoanime img, .thumb img, .foto img').attr('src') || ''), slug: s, url: `${BASE}/anime/${s}/`, episodes, batch }
    },
    async episode(slug) {
        const s = clean(slug, 'episode')
        const $ = await load(`/episode/${s}/`)
        const title = tx($('.jdlrx h1, h1.entry-title, h1').first())
        let stream = ''
        $('iframe, embed').each((_, el) => { const src = $(el).attr('src') || $(el).attr('data-src') || ''; if (src && !stream) stream = abs(src) })
        let downloads = downloadsOf($, '.download, .dl, .soraurlx')
        if (!Object.keys(downloads).length) {
            const links = []
            $('.download a, .dl a').each((_, a) => { const h = $(a).attr('href') || ''; if (h && h !== '#') links.push({ host: tx($(a)) || new URL(abs(h)).hostname, url: abs(h) }) })
            if (links.length) downloads = { default: links }
        }
        const nav = (sel, hint) => {
            let r = null
            $(sel).each((_, el) => { const h = $(el).attr('href') || ''; if (h.includes('/episode/')) r = { title: tx($(el)) || hint, slug: slugOf(h), url: abs(h) } })
            return r
        }
        return { title, slug: s, url: `${BASE}/episode/${s}/`, stream: stream || undefined, downloads, prev: nav('a[rel="prev"], a.prev, .prev a', 'Sebelumnya'), next: nav('a[rel="next"], a.next, .next a', 'Selanjutnya') }
    },
    async batch(slug) {
        const s = clean(slug, 'batch')
        const $ = await load(`/batch/${s}/`)
        return { title: tx($('.jdlrx h1, h1.entry-title, h1').first()), slug: s, url: `${BASE}/batch/${s}/`, downloads: downloadsOf($, '.download, .dl, .soraurlx, .batchlink') }
    },
    async schedule() {
        const $ = await load('/jadwal-rilis/')
        const out = {}
        $('.kglist321, .schedule').each((_, sec) => {
            const day = tx($(sec).find('h2, h3').first()).replace(/jadwal|rilis|anime/gi, '').trim() || 'Lainnya'
            $(sec).find('a[href*="/anime/"]').each((__, a) => {
                const t = tx($(a)); if (!t) return
                ;(out[day] ||= []).push({ title: t, slug: slugOf($(a).attr('href')), url: abs($(a).attr('href')) })
            })
        })
        if (!Object.keys(out).length) {
            $('h2, h3').each((_, h) => {
                const day = tx($(h)); if (!/senin|selasa|rabu|kamis|jumat|sabtu|minggu/i.test(day)) return
                const list = []
                $(h).nextUntil('h2, h3').find('a[href*="/anime/"]').each((__, a) => list.push({ title: tx($(a)), slug: slugOf($(a).attr('href')), url: abs($(a).attr('href')) }))
                if (list.length) out[day] = list
            })
        }
        return out
    },
    async genres() {
        const $ = await load('/genre-list/')
        const seen = new Set(), list = []
        $('a[href*="/genres/"]').each((_, el) => {
            const s = slugOf($(el).attr('href')), n = tx($(el))
            if (!n || seen.has(s)) return
            seen.add(s); list.push({ name: n, slug: s })
        })
        return list
    }
}

const cardLine = (c, i) => `${i + 1}. *${c.title}*\n   ${[c.episode, c.day, c.score && `⭐ ${c.score}`, c.date].filter(Boolean).join(' • ') || '-'}\n   slug: ${c.slug}`
const dlText = (d) => Object.entries(d).map(([q, ls]) => `*${q}*\n` + ls.slice(0, 8).map(l => `• ${l.host}: ${l.url}`).join('\n')).join('\n\n') || '_Link unduhan tidak ditemukan._'
const clip = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t }

const helpText = (p, c) => `*🎌 OTAKUDESU*\n${LINE}\n` + [
    `${p}${c} home`, `${p}${c} ongoing [hal]`, `${p}${c} complete [hal]`, `${p}${c} cari <judul>`,
    `${p}${c} anime <slug>`, `${p}${c} eps <slug-episode>`, `${p}${c} batch <slug-batch>`,
    `${p}${c} jadwal`, `${p}${c} genres`, `${p}${c} genre <slug> [hal]`
].join('\n') + `\n\nContoh:\n${p}${c} cari one piece\n${p}${c} anime sayonara-lara-sub-indo\n\n_Slug didapat dari hasil list/cari._`

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const parts = String(text || '').trim().split(/\s+/).filter(Boolean)
    const sub = (parts.shift() || '').toLowerCase()
    const arg = parts.join(' ')
    if (!sub || ['help', 'menu'].includes(sub)) return reply(helpText(prefix, command))

    try {
        await reactTo(sock, m, '⏳')

        if (sub === 'home') {
            const h = await O.home()
            await reply(`*🎌 OTAKUDESU — HOME*\n${LINE}\n*Ongoing*\n${h.ongoing.slice(0, 10).map(cardLine).join('\n\n') || '-'}\n\n*Complete*\n${h.complete.slice(0, 8).map(cardLine).join('\n\n') || '-'}`)
        } else if (sub === 'ongoing' || sub === 'complete') {
            const p = parseInt(arg, 10) || 1
            const r = await O[sub](p)
            if (!r.list.length) throw new Error('Daftar kosong.')
            await reply(`*🎌 ${sub.toUpperCase()}* (hal. ${r.page}/${r.maxPage})\n${LINE}\n${r.list.slice(0, 20).map(cardLine).join('\n\n')}\n\nDetail: *${prefix}${command} anime <slug>*`)
        } else if (['cari', 'search', 'find'].includes(sub)) {
            if (!arg) return reply(`Contoh: *${prefix}${command} cari naruto*`)
            const list = await O.search(arg)
            if (!list.length) throw new Error('Anime tidak ditemukan.')
            await reply(`*🔎 HASIL: ${arg}* (${list.length})\n${LINE}\n${list.slice(0, 15).map(cardLine).join('\n\n')}\n\nDetail: *${prefix}${command} anime <slug>*`)
        } else if (sub === 'anime' || sub === 'detail') {
            if (!arg) return reply(`Contoh: *${prefix}${command} anime sayonara-lara-sub-indo*`)
            const d = await O.anime(arg)
            const eps = d.episodes.slice(0, 15).map(e => `• ${e.title}\n  slug: ${e.slug}`).join('\n')
            const cap = [`*${d.title}*`, LINE,
                d.japanese && `Judul JP : ${d.japanese}`, d.type && `Tipe     : ${d.type}`, d.status && `Status   : ${d.status}`,
                d.score && `Skor     : ⭐ ${d.score}`, d.totalEpisodes && `Episode  : ${d.totalEpisodes}`, d.duration && `Durasi   : ${d.duration}`,
                d.releaseDate && `Rilis    : ${d.releaseDate}`, d.studio && `Studio   : ${d.studio}`, d.genres.length && `Genre    : ${d.genres.join(', ')}`,
                '', d.synopsis && `*Sinopsis*\n${clip(d.synopsis, 600)}`, '',
                `*Episode* (${d.episodes.length})\n${eps || '-'}`,
                d.batch && `\nBatch: *${prefix}${command} batch ${d.batch.slug}*`,
                `\nNonton/unduh: *${prefix}${command} eps <slug-episode>*`].filter(x => x || x === '').join('\n').replace(/\n{3,}/g, '\n\n')
            if (d.thumb) { try { await sock.sendMessage(m.chat, { image: { url: d.thumb }, caption: cap }, { quoted: m }) } catch { await reply(cap) } }
            else await reply(cap)
        } else if (['eps', 'episode', 'ep'].includes(sub)) {
            if (!arg) return reply(`Contoh: *${prefix}${command} eps syla-episode-9-sub-indo*`)
            const e = await O.episode(arg)
            await reply([`*${e.title || e.slug}*`, LINE, e.stream ? `▶️ Stream: ${e.stream}` : '', '', '*Unduhan*', dlText(e.downloads), '',
                e.prev ? `⬅️ ${prefix}${command} eps ${e.prev.slug}` : '', e.next ? `➡️ ${prefix}${command} eps ${e.next.slug}` : '', `\nWeb: ${e.url}`].join('\n').replace(/\n{3,}/g, '\n\n'))
        } else if (sub === 'batch') {
            if (!arg) return reply(`Contoh: *${prefix}${command} batch <slug-batch>*`)
            const b = await O.batch(arg)
            await reply(`*${b.title || b.slug}*\n${LINE}\n${dlText(b.downloads)}\n\nWeb: ${b.url}`)
        } else if (['jadwal', 'schedule'].includes(sub)) {
            const s = await O.schedule()
            const days = Object.entries(s)
            if (!days.length) throw new Error('Jadwal tidak ditemukan.')
            await reply(`*📅 JADWAL RILIS*\n${LINE}\n` + days.map(([d, l]) => `*${d}*\n${l.slice(0, 15).map(x => `• ${x.title}`).join('\n')}`).join('\n\n'))
        } else if (sub === 'genres') {
            const g = await O.genres()
            if (!g.length) throw new Error('Genre tidak ditemukan.')
            await reply(`*🏷️ GENRE*\n${LINE}\n${g.map(x => x.slug).join(', ')}\n\nPakai: *${prefix}${command} genre <slug> [hal]*`)
        } else if (sub === 'genre') {
            const slug = parts[0]
            if (!slug) return reply(`Contoh: *${prefix}${command} genre action 2*`)
            const r = await O.genre(slug, parseInt(parts[1], 10) || 1)
            if (!r.list.length) throw new Error('Tidak ada anime di genre ini.')
            await reply(`*🏷️ GENRE: ${slug}* (hal. ${r.page}/${r.maxPage})\n${LINE}\n${r.list.slice(0, 20).map(cardLine).join('\n\n')}`)
        } else {
            await reactTo(sock, m, '❔')
            return reply(helpText(prefix, command))
        }
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Gagal memproses.'}`)
    }
}

handler.command = ['otakudesu', 'otaku', 'od']
handler.help = ['otakudesu <home|ongoing|complete|cari|anime|eps|batch|jadwal|genres|genre>']
handler.tags = ['anime']
handler.limit = true

export default handler
export { O as Otakudesu }
