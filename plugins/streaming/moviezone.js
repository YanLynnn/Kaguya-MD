// .movie <judul>                     cari film / serial
// .movie trending|latest|upcoming|toprated [movie|tv]
// .movie detail <slug>               info + server streaming (slug: movie-969681 / tv-123542)
// .movie eps <slug> <season> [eps]   daftar episode (isi nomor eps untuk server streaming-nya)
const BASE = 'https://www.rizky.web.id'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const LISTS = ['trending', 'latest', 'upcoming', 'toprated']

async function fetchJson(url, timeout = 15000) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', Referer: BASE + '/' }, signal: ctrl.signal })
        const body = await res.text()
        try { return JSON.parse(body) } catch { throw new Error(`Respon tidak valid (${res.status}): ${body.slice(0, 80)}`) }
    } catch (e) {
        throw new Error(e.name === 'AbortError' ? 'Server MovieZone tidak merespons (timeout).' : e.message)
    } finally {
        clearTimeout(timer)
    }
}

function getEmbedServers(tmdbId, isTv = false, season = 1, episode = 1, imdbId = '') {
    const S = season || 1, E = episode || 1
    if (isTv) {
        return [
            { server: 'VidSrcWiki', url: `https://vidsrc.wiki/embed/tv/${tmdbId}/${S}/${E}` },
            { server: 'SuperEmbed', url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${S}&e=${E}` },
            { server: 'VidSrc', url: `https://vidsrc.to/embed/tv/${tmdbId}/${S}/${E}` },
            { server: 'VidLink', url: `https://vidlink.pro/tv/${tmdbId}/${S}/${E}` },
            { server: '2Embed', url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${S}&e=${E}` },
            { server: 'VSEmbed', url: `https://vsembed.ru/embed/tv/${imdbId || tmdbId}/${S}/${E}` },
            { server: 'VidFast', url: `https://vidfast.vc/tv/${tmdbId}/${S}/${E}` }
        ]
    }
    return [
        { server: 'VidSrcWiki', url: `https://vidsrc.wiki/embed/movie/${tmdbId}` },
        { server: 'SuperEmbed', url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1` },
        { server: 'VidSrc', url: `https://vidsrc.to/embed/movie/${tmdbId}` },
        { server: 'VidLink', url: `https://vidlink.pro/movie/${tmdbId}` },
        { server: '2Embed', url: `https://www.2embed.cc/embed/${tmdbId}` },
        { server: 'VSEmbed', url: `https://vsembed.ru/embed/movie/${imdbId || tmdbId}` },
        { server: 'VidFast', url: `https://vidfast.vc/movie/${tmdbId}` }
    ]
}

// nama field dari API tidak terdokumentasi, jadi dibaca defensif
const pick = (o, ...keys) => keys.map(k => o?.[k]).find(v => v !== undefined && v !== null && v !== '')
const cut = (s, n) => (String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || ''))

function slugOf(r) {
    const s = pick(r, 'slug')
    if (s) return s
    const id = pick(r, 'id', 'tmdbId')
    if (!id) return ''
    return `${/series|tv/i.test(String(pick(r, 'type', 'media_type') || '')) ? 'tv' : 'movie'}-${id}`
}
function line(r, i) {
    const title = pick(r, 'title', 'name') || '(tanpa judul)'
    const year = pick(r, 'year') || String(pick(r, 'release_date', 'first_air_date', 'releaseDate') || '').slice(0, 4)
    const rating = pick(r, 'rating', 'vote_average', 'score')
    const type = pick(r, 'type', 'media_type')
    return `${i + 1}. *${cut(title, 60)}*${year ? ` (${year})` : ''}${type ? ` • ${type}` : ''}${rating ? ` • ⭐${Number(rating).toFixed ? Number(rating).toFixed(1) : rating}` : ''}\n   ${slugOf(r)}`
}
function listText(title, results, p, cmd) {
    if (!results.length) return `📭 ${title}: tidak ada hasil.`
    return `🎬 *${title}*\n\n${results.slice(0, 10).map(line).join('\n')}\n\n_Detail: ${p}${cmd} detail <slug>_`
}

async function getDetail(slug) {
    const res = await fetchJson(`${BASE}/api/detail?slug=${encodeURIComponent(slug)}`)
    if (!res.status || !res.data) return null
    const data = res.data
    const isTv = data.type === 'Series' || slug.startsWith('tv-')
    return { data, isTv, servers: getEmbedServers(data.id, isTv, 1, 1, data.imdbId || '') }
}

let handler = async (m, { text, reply, sock, jid, prefix, command }) => {
    const p = prefix || '.'
    const tokens = String(text || '').trim().split(/\s+/).filter(Boolean)
    if (!tokens.length) {
        return reply(
            `🎬 *MovieZone*\n\n• ${p}${command} <judul>\n• ${p}${command} trending|latest|upcoming|toprated [movie|tv]\n` +
            `• ${p}${command} detail <slug>\n• ${p}${command} eps <slug> <season> [nomor eps]\n\nContoh: ${p}${command} Spider-Man`
        )
    }
    const first = tokens[0].toLowerCase()
    try {
        if (LISTS.includes(first)) {
            const type = ['movie', 'tv', 'all'].includes((tokens[1] || '').toLowerCase()) ? tokens[1].toLowerCase() : 'all'
            const res = await fetchJson(`${BASE}/api/list?kind=${first}&type=${type}`)
            return reply(listText(`${first} (${type})`, res.results || [], p, command))
        }

        const slugArg = ['detail', 'info'].includes(first) ? tokens[1] : (/^(movie|tv)-\d+$/i.test(first) ? first : null)
        if (slugArg && !(/^tv-\d+$/i.test(slugArg) && /^\d+$/.test(tokens[1] || '') && first === slugArg)) {
            if (!/^(movie|tv)-\d+$/i.test(slugArg)) return reply('⚠️ Slug harus seperti *movie-969681* atau *tv-123542*.')
            const d = await getDetail(slugArg.toLowerCase())
            if (!d) return reply('❌ Film atau serial tidak ditemukan.')
            const x = d.data
            const title = pick(x, 'title', 'name') || slugArg
            const genres = [].concat(pick(x, 'genres', 'genre') || []).map(g => (typeof g === 'string' ? g : g?.name)).filter(Boolean).join(', ')
            const rating = pick(x, 'rating', 'vote_average', 'score')
            const year = pick(x, 'year') || String(pick(x, 'release_date', 'first_air_date', 'releaseDate') || '').slice(0, 4)
            const overview = cut(pick(x, 'overview', 'synopsis', 'description'), 500)
            const serverText = d.isTv
                ? `Serial: pilih episode dulu dengan *${p}${command} eps ${slugArg} <season>*`
                : d.servers.map(s => `• ${s.server}: ${s.url}`).join('\n')
            const caption =
                `🎬 *${title}*${year ? ` (${year})` : ''}\n` +
                `${d.isTv ? '📺 Serial' : '🎞️ Film'}${rating ? ` • ⭐${Number(rating).toFixed ? Number(rating).toFixed(1) : rating}` : ''}${genres ? ` • ${genres}` : ''}\n\n` +
                `${overview ? overview + '\n\n' : ''}${serverText}`
            const poster = pick(x, 'poster', 'posterUrl', 'poster_url', 'image', 'backdrop')
            if (poster && /^https?:\/\//i.test(String(poster))) {
                try { return await sock.sendMessage(jid || m.chat, { image: { url: poster }, caption }, { quoted: m }) } catch { }
            }
            return reply(caption)
        }

        if (['eps', 'episode', 'episodes'].includes(first) || (/^tv-\d+$/i.test(first) && /^\d+$/.test(tokens[1] || ''))) {
            const eps = ['eps', 'episode', 'episodes'].includes(first)
            const slug = (eps ? tokens[1] : first || '').toLowerCase()
            const season = parseInt(eps ? tokens[2] : tokens[1], 10) || 1
            const epNo = parseInt(eps ? tokens[3] : tokens[2], 10)
            const idMatch = slug.match(/^tv-(\d+)$/)
            if (!idMatch) return reply('⚠️ Slug serial harus seperti *tv-123542*.')
            const res = await fetchJson(`${BASE}/api/episodes?slug=${encodeURIComponent(slug)}&season=${season}`)
            if (!res.status || !res.results) return reply('❌ Episode tidak ditemukan atau season tidak valid.')
            if (epNo) {
                const ep = res.results.find(e => Number(pick(e, 'episode', 'number', 'episode_number')) === epNo)
                const servers = getEmbedServers(idMatch[1], true, season, epNo)
                return reply(`📺 *${slug}* S${season}E${epNo}${ep ? ` — ${cut(pick(ep, 'title', 'name'), 60)}` : ''}\n\n${servers.map(s => `• ${s.server}: ${s.url}`).join('\n')}`)
            }
            const rows = res.results.slice(0, 40).map(e => `E${pick(e, 'episode', 'number', 'episode_number')}: ${cut(pick(e, 'title', 'name') || '-', 50)}`).join('\n')
            return reply(`📺 *${slug}* Season ${season} (${res.results.length} episode)\n\n${rows}\n\n_Server streaming: ${p}${command} eps ${slug} ${season} <nomor eps>_`)
        }

        const q = tokens.join(' ')
        const res = await fetchJson(`${BASE}/api/search?q=${encodeURIComponent(q)}&page=1`)
        return reply(listText(`Hasil: ${q}`, res.results || [], p, command))
    } catch (e) {
        return reply(`⚠️ ${e.message}`)
    }
}

handler.command = ['moviezone', 'movie', 'film']
handler.help = ['movie <judul>']
handler.tags = ['streaming']
handler.limit = true

export default handler
