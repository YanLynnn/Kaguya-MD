// MangaDex (API publik, tanpa API key): home / cari / detail / chapter / baca di chat
// Catatan: command .mangadex & .mdx sudah dipakai bacamanga.js, jadi fitur ini pakai .mdex
//   .mdex                         bantuan
//   .mdex home | popular | recent | latest [bahasa] | random | tags
//   .mdex cari <judul> [--id|--en]   .mdex detail <manga-id>   .mdex stats <manga-id>
//   .mdex bab <manga-id> [bahasa] [hal]   .mdex baca <chapter-id> [hd]
import axios from 'axios'
import { reactTo } from '../../lib/core-file.js'
import { sleep } from '../../lib/core-system.js'

const API = 'https://api.mangadex.org'
const UP = 'https://uploads.mangadex.org'
const UA = 'MangaDex-Wrapper/3.1'
const LINE = '─────────────────────'
const MAX_PAGES = 10, PER_LIST = 20
const RATING = ['safe', 'suggestive', 'erotica']

const http = axios.create({ baseURL: API, timeout: 20000, headers: { 'User-Agent': UA, Accept: 'application/json' } })
let last = 0
const rate = async () => { const w = 220 - (Date.now() - last); if (w > 0) await sleep(w); last = Date.now() }

const pick = (o, langs = ['en', 'ja-ro', 'ja', 'id']) => {
    if (!o || typeof o !== 'object') return null
    for (const l of langs) if (o[l]) return o[l]
    const k = Object.keys(o); return k.length ? o[k[0]] : null
}
const flat = (params = {}) => {
    const out = {}
    for (const [k, v] of Object.entries(params)) {
        if (v == null) continue
        if (Array.isArray(v)) out[`${k}[]`] = v
        else if (typeof v === 'object') for (const [sk, sv] of Object.entries(v)) out[`${k}[${sk}]`] = sv
        else out[k] = v
    }
    return out
}
const clip = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t }
const isId = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '')
const idFrom = (s) => (String(s || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0] || null

async function req(url, params) {
    await rate()
    try {
        const r = await http.get(url, { params: params ? new URLSearchParams(Object.entries(flat(params)).flatMap(([k, v]) => Array.isArray(v) ? v.map(x => [k, x]) : [[k, v]])) : undefined })
        return r.data
    } catch (e) {
        const msg = e.response?.data?.errors?.[0]?.detail || e.response?.data?.message || e.message
        throw new Error(`MangaDex ${e.response?.status || '?'}: ${msg}`)
    }
}

const mapManga = (e) => {
    if (!e) return null
    const a = e.attributes || {}, rels = e.relationships || []
    const fn = rels.find(r => r.type === 'cover_art')?.attributes?.fileName
    return {
        id: e.id, title: pick(a.title), description: pick(a.description) || null, status: a.status, year: a.year,
        originalLanguage: a.originalLanguage, contentRating: a.contentRating,
        tags: (a.tags || []).map(t => pick(t.attributes?.name)).filter(Boolean).slice(0, 12),
        authors: [...new Set(rels.filter(r => r.type === 'author' || r.type === 'artist').map(r => r.attributes?.name).filter(Boolean))],
        cover: fn ? `${UP}/covers/${e.id}/${fn}.512.jpg` : null, lastChapter: a.lastChapter, lastVolume: a.lastVolume
    }
}
const mapChapter = (e) => {
    if (!e) return null
    const a = e.attributes || {}, rels = e.relationships || [], manga = rels.find(r => r.type === 'manga')
    return {
        id: e.id, chapter: a.chapter, volume: a.volume, title: a.title || null, lang: a.translatedLanguage, pages: a.pages,
        publishAt: a.publishAt, externalUrl: a.externalUrl || null, mangaId: manga?.id || null,
        mangaTitle: manga?.attributes?.title ? pick(manga.attributes.title) : null,
        groups: rels.filter(r => r.type === 'scanlation_group').map(r => r.attributes?.name || r.id)
    }
}

const MD = {
    async search({ title, limit = 10, offset = 0, lang, order, contentRating = RATING } = {}) {
        const d = await req('/manga', {
            limit: Math.min(limit, 100), offset, title, availableTranslatedLanguage: lang ? [lang] : undefined, order,
            hasAvailableChapters: true, contentRating, includes: ['cover_art', 'author', 'artist']
        })
        return { data: (d.data || []).map(mapManga), total: d.total ?? 0 }
    },
    popular: (limit = 10) => MD.search({ limit, order: { followedCount: 'desc' } }),
    recent: (limit = 10) => MD.search({ limit, order: { createdAt: 'desc' } }),
    async latest(limit = 10, lang = 'en') {
        const d = await req('/chapter', {
            limit: Math.min(limit * 2, 100), translatedLanguage: [lang], order: { readableAt: 'desc' },
            includes: ['manga', 'scanlation_group'], contentRating: RATING, includeFutureUpdates: '0'
        })
        return (d.data || []).map(mapChapter).filter(c => c.pages > 0 && !c.externalUrl).slice(0, limit)
    },
    async detail(id) {
        const d = await req(`/manga/${id}`, { includes: ['cover_art', 'author', 'artist', 'tag'] })
        return mapManga(d.data)
    },
    async random() {
        const d = await req('/manga/random', { includes: ['cover_art', 'author', 'artist'], contentRating: RATING })
        return mapManga(d.data)
    },
    async chapters(id, { limit = 100, offset = 0, lang = 'en' } = {}) {
        const d = await req(`/manga/${id}/feed`, {
            limit: Math.min(limit, 100), offset, translatedLanguage: [lang], order: { volume: 'asc', chapter: 'asc' },
            includes: ['scanlation_group'], contentRating: RATING, includeFutureUpdates: '0', includeEmptyPages: '0', includeExternalUrl: '0'
        })
        return { data: (d.data || []).map(mapChapter).filter(c => c.pages > 0 && !c.externalUrl), total: d.total ?? 0 }
    },
    async chapter(id) { const d = await req(`/chapter/${id}`, { includes: ['manga', 'scanlation_group'] }); return mapChapter(d.data) },
    async probe(url) {
        const h = { 'User-Agent': UA, Referer: 'https://mangadex.org/' }
        try { const r = await axios.head(url, { timeout: 8000, headers: h, validateStatus: s => s >= 200 && s < 400 }); return r.status < 400 }
        catch {
            try { const r = await axios.get(url, { timeout: 10000, responseType: 'stream', headers: { ...h, Range: 'bytes=0-0' }, validateStatus: s => s >= 200 && s < 400 }); r.data.destroy?.(); return true }
            catch { return false }
        }
    },
    async report(url, success) { try { await axios.post('https://api.mangadex.network/report', { url, success, bytes: 0, duration: 0, cached: false }, { timeout: 5000 }) } catch {} },
    async read(chapterId, quality = 'data', retries = 3) {
        const q = quality === 'data-saver' ? 'data-saver' : 'data'
        let err = null
        for (let i = 0; i <= retries; i++) {
            if (i) await sleep(400 * i)
            const d = await req(`/at-home/server/${chapterId}`)
            const files = q === 'data-saver' ? d.chapter?.dataSaver : d.chapter?.data
            if (!d.chapter?.hash || !files?.length) throw new Error('Chapter kosong / tautan luar, tidak bisa dibaca di sini.')
            const urls = files.map(f => `${d.baseUrl}/${q}/${d.chapter.hash}/${f}`)
            if (await MD.probe(urls[0])) return { count: urls.length, urls }
            MD.report(urls[0], false)
            err = new Error(`Node MD@Home gagal (percobaan ${i + 1}/${retries + 1})`)
        }
        throw err || new Error('Gagal mengambil halaman.')
    },
    async tags() { const d = await req('/manga/tag'); return (d.data || []).map(t => ({ name: pick(t.attributes?.name), group: t.attributes?.group })) },
    async stats(id) {
        const d = await req('/statistics/manga', { manga: [id] })
        const s = d.statistics?.[id]
        return s ? { follows: s.follows, rating: s.rating?.average ?? null, bayesian: s.rating?.bayesian ?? null, comments: s.comments?.repliesCount ?? 0 } : null
    }
}

const STATUS = { ongoing: 'Berlanjut', completed: 'Tamat', hiatus: 'Hiatus', cancelled: 'Dibatalkan' }
const mangaLine = (x, i) => `${i + 1}. *${x.title}*\n   ${[x.status && (STATUS[x.status] || x.status), x.year, x.originalLanguage].filter(Boolean).join(' • ')}\n   id: ${x.id}`
const chLabel = (c) => `Ch ${c.chapter ?? '?'}${c.volume ? ` (Vol ${c.volume})` : ''}${c.title ? ' — ' + clip(c.title, 40) : ''}`

const helpText = (p, c) => `*📚 MANGADEX*\n${LINE}\n` + [
    `${p}${c} home`, `${p}${c} cari <judul> [--id|--en]`, `${p}${c} detail <manga-id>`, `${p}${c} bab <manga-id> [bahasa] [hal]`,
    `${p}${c} baca <chapter-id> [hd]`, `${p}${c} popular`, `${p}${c} recent`, `${p}${c} latest [bahasa]`,
    `${p}${c} random`, `${p}${c} stats <manga-id>`, `${p}${c} tags`
].join('\n') + `\n\nAlur: cari → detail → bab → baca\n_Link mangadex.org/title/<id> juga bisa dipakai sebagai id._`

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const parts = String(text || '').trim().split(/\s+/).filter(Boolean)
    const sub = (parts.shift() || '').toLowerCase()
    if (!sub || ['help', 'menu'].includes(sub)) return reply(helpText(prefix, command))

    try {
        await reactTo(sock, m, '⏳')
        let lang = null; const rest = []
        for (const a of parts) { const mm = a.match(/^--([a-z]{2}(?:-[a-z]{2})?)$/i); if (mm) lang = mm[1].toLowerCase(); else rest.push(a) }

        if (sub === 'home') {
            const [pop, rec, lat] = await Promise.all([MD.popular(5), MD.recent(5), MD.latest(5, lang || 'en')])
            await reply(`*📚 MANGADEX — HOME*\n${LINE}\n*Populer*\n${pop.data.map(mangaLine).join('\n\n')}\n\n*Baru ditambahkan*\n${rec.data.map(mangaLine).join('\n\n')}\n\n*Chapter terbaru*\n${lat.map(c => `• ${c.mangaTitle || '?'} — ${chLabel(c)}\n  ch-id: ${c.id}`).join('\n')}`)
        } else if (sub === 'popular' || sub === 'recent') {
            const r = await MD[sub](10)
            await reply(`*📚 ${sub === 'popular' ? 'POPULER' : 'BARU DITAMBAHKAN'}*\n${LINE}\n${r.data.map(mangaLine).join('\n\n')}\n\nDetail: *${prefix}${command} detail <id>*`)
        } else if (sub === 'latest') {
            const l = rest[0] && /^[a-z]{2}(-[a-z]{2})?$/i.test(rest[0]) ? rest[0].toLowerCase() : (lang || 'en')
            const r = await MD.latest(10, l)
            if (!r.length) throw new Error('Tidak ada chapter terbaru.')
            await reply(`*🆕 CHAPTER TERBARU (${l})*\n${LINE}\n${r.map((c, i) => `${i + 1}. *${c.mangaTitle || '?'}*\n   ${chLabel(c)}\n   ch-id: ${c.id}`).join('\n\n')}\n\nBaca: *${prefix}${command} baca <ch-id>*`)
        } else if (['cari', 'search', 'find'].includes(sub)) {
            const q = rest.join(' ')
            if (!q) return reply(`Contoh: *${prefix}${command} cari solo leveling --en*`)
            const r = await MD.search({ title: q, limit: 10, lang })
            if (!r.data.length) throw new Error('Manga tidak ditemukan.')
            await reply(`*🔎 HASIL: ${q}* (${r.total})\n${LINE}\n${r.data.map(mangaLine).join('\n\n')}\n\nDetail: *${prefix}${command} detail <id>*`)
        } else if (sub === 'detail' || sub === 'manga') {
            const id = idFrom(rest[0]); if (!id) return reply(`Contoh: *${prefix}${command} detail <manga-id>*`)
            const [d, st] = await Promise.all([MD.detail(id), MD.stats(id).catch(() => null)])
            const cap = [`*${d.title}*`, LINE, `Status : ${STATUS[d.status] || d.status || '-'}${d.year ? ' • ' + d.year : ''}`,
                `Asal   : ${d.originalLanguage || '-'} • Rating konten: ${d.contentRating || '-'}`, `Author : ${d.authors.join(', ') || '-'}`,
                `Genre  : ${d.tags.join(', ') || '-'}`, st ? `Skor   : ⭐ ${st.bayesian ? st.bayesian.toFixed(2) : '-'} • ${Number(st.follows || 0).toLocaleString('id-ID')} follow` : '',
                d.lastChapter ? `Terakhir: Ch ${d.lastChapter}${d.lastVolume ? ' (Vol ' + d.lastVolume + ')' : ''}` : '',
                '', `*Deskripsi*\n${clip(d.description, 500) || '-'}`, '', `Daftar bab: *${prefix}${command} bab ${d.id} [bahasa]*`].filter(x => x !== null && x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n')
            if (d.cover) { try { await sock.sendMessage(m.chat, { image: { url: d.cover }, caption: cap }, { quoted: m }) } catch { await reply(cap) } }
            else await reply(cap)
        } else if (['bab', 'chapters', 'chapter'].includes(sub)) {
            const id = idFrom(rest[0]); if (!id) return reply(`Contoh: *${prefix}${command} bab <manga-id> en 1*`)
            const l = lang || (rest[1] && /^[a-z]{2}(-[a-z]{2})?$/i.test(rest[1]) ? rest[1].toLowerCase() : 'en')
            const pageArg = parseInt(rest.find((x, i) => i >= 1 && /^\d+$/.test(x)), 10) || 1
            const r = await MD.chapters(id, { lang: l, limit: 100, offset: (pageArg - 1) * 100 })
            if (!r.data.length) throw new Error(`Tidak ada chapter bahasa "${l}" yang bisa dibaca. Coba bahasa lain (mis. --id / --en).`)
            const shown = r.data.slice(0, PER_LIST * 2)
            await reply(`*📖 CHAPTER (${l})* — hal. ${pageArg}, total ${r.total}\n${LINE}\n${shown.map(c => `• ${chLabel(c)}\n  ch-id: ${c.id}`).join('\n')}\n\nBaca: *${prefix}${command} baca <ch-id>*${r.total > pageArg * 100 ? `\nHalaman berikutnya: *${prefix}${command} bab ${id} ${l} ${pageArg + 1}*` : ''}`)
        } else if (['baca', 'read', 'pages'].includes(sub)) {
            const id = idFrom(rest[0]); if (!id) return reply(`Contoh: *${prefix}${command} baca <chapter-id>*`)
            const q = rest.some(x => /^(hd|asli|data)$/i.test(x)) ? 'data' : 'data-saver'
            const [info, pg] = await Promise.all([MD.chapter(id).catch(() => null), MD.read(id, q)])
            const shown = pg.urls.slice(0, MAX_PAGES)
            await reply(`*📖 ${info?.mangaTitle || 'MangaDex'}*\n${info ? chLabel(info) : ''}\n\nMengirim ${shown.length} dari ${pg.count} halaman.\nBaca lengkap: https://mangadex.org/chapter/${id}`)
            let sent = 0
            for (let i = 0; i < shown.length; i++) {
                try {
                    const img = await axios.get(shown[i], { responseType: 'arraybuffer', timeout: 30000, headers: { 'User-Agent': UA, Referer: 'https://mangadex.org/' } })
                    await sock.sendMessage(m.chat, { image: Buffer.from(img.data), caption: `Hal. ${i + 1}/${pg.count}` }, { quoted: m })
                    sent++
                } catch {}
                await sleep(1200)
            }
            if (!sent) throw new Error(`Gambar gagal dikirim. Buka manual: https://mangadex.org/chapter/${id}`)
        } else if (sub === 'random') {
            const d = await MD.random()
            await reply(`*🎲 ACAK*\n${LINE}\n*${d.title}*\n${[STATUS[d.status] || d.status, d.year].filter(Boolean).join(' • ')}\nGenre: ${d.tags.join(', ') || '-'}\n\n${clip(d.description, 400) || '-'}\n\nid: ${d.id}\nDetail: *${prefix}${command} detail ${d.id}*`)
        } else if (sub === 'stats') {
            const id = idFrom(rest[0]); if (!id) return reply(`Contoh: *${prefix}${command} stats <manga-id>*`)
            const s = await MD.stats(id); if (!s) throw new Error('Statistik tidak tersedia.')
            await reply(`*📊 STATISTIK*\n${LINE}\nFollow  : ${Number(s.follows || 0).toLocaleString('id-ID')}\nRating  : ⭐ ${s.rating ? s.rating.toFixed(2) : '-'} (bayesian ${s.bayesian ? s.bayesian.toFixed(2) : '-'})\nKomentar: ${s.comments}`)
        } else if (sub === 'tags') {
            const t = await MD.tags(), g = {}
            t.forEach(x => (g[x.group] ||= []).push(x.name))
            await reply(`*🏷️ TAG MANGADEX*\n${LINE}\n${Object.entries(g).map(([k, v]) => `*${k}*\n${v.join(', ')}`).join('\n\n')}`)
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

handler.command = ['mdex', 'mangadexapi', 'mdapi']
handler.help = ['mdex <home|cari|detail|bab|baca|popular|recent|latest|random|stats|tags>']
handler.tags = ['anime']
handler.limit = true

export default handler
export { MD as MangaDex }
