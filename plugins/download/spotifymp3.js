/*
# Name : Spotify Cari + Play (format Kaguya)
# Url  : https://spotmp3.net, https://spotsaver.net
# Source : https://whatsapp.com/channel/0029VbDWBmtA89MamPba8q3f
*/
// .spotcari <judul>         → daftar hasil pencarian
// .spotplay <judul / url>   → link Spotify ATAU judul (ambil hasil 1), kirim info + mp3
import axios from 'axios'

const BASE = 'https://spotmp3.net'
const SAVER = 'https://spotsaver.net'
const SPOTIFY_URL = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]+)/i

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Origin: SAVER,
    Referer: `${SAVER}/`
}

const fmtDuration = (ms) => {
    if (!ms || isNaN(ms)) return null
    const s = Math.round(Number(ms) / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

async function searchSpotify(query) {
    const { data } = await axios.get(`${BASE}/api/v1/search`, { params: { q: query }, headers, timeout: 30000 })
    const tracks = data?.sections?.find(v => v.type === 'track')?.items || []
    if (!tracks.length) throw new Error('Lagu tidak ditemukan.')

    return tracks.map(item => {
        const tid = item.id || item.url?.match(/track\/([A-Za-z0-9]+)/)?.[1] || null
        return {
            title: item.title || '-',
            artist: item.subtitle || '-',
            album: item.album || '-',
            duration: fmtDuration(item.duration_ms) || '-',
            cover: item.cover || item.image || item.thumbnail || null,
            date: item.date || item.release_date || '-',
            url: item.url || (tid ? `https://open.spotify.com/track/${tid}` : null)
        }
    })
}

async function downloadSpotify(url) {
    const spotify = await axios.get(`${SAVER}/api/spotify/`, { params: { url }, headers, timeout: 30000 })
    const item = spotify.data?.items?.[0]
    if (!item) throw new Error('Track Spotify tidak ditemukan.')

    const cover = item.cover || item.image || item.thumbnail || item.album?.cover || item.album?.image || null
    const json = { ...headers, 'Content-Type': 'application/json' }

    const getId = await axios.post(`${SAVER}/api/get-id/`, { title: item.title, artist: item.artist }, { headers: json, timeout: 30000 })
    const videoId = getId.data?.videoId
    if (!videoId) throw new Error('Video ID tidak ditemukan.')

    const dl = await axios.post(`${SAVER}/api/download/`, {
        videoId,
        candidateIds: [],
        format: 'mp3',
        title: `${item.title} - ${item.artist}`,
        licenseKey: null
    }, { headers: json, timeout: 60000 })

    const d = dl.data
    const download = d?.url || d?.download || d?.downloadUrl || d?.audio || d?.result?.url || d?.result?.download || null
    if (!download) throw new Error('URL download tidak ditemukan.')

    const tid = url.match(/track\/([A-Za-z0-9]+)/)?.[1]
    return {
        title: item.title || '-',
        artist: item.artist || '-',
        album: item.album || '-',
        duration: item.duration || '-',
        cover,
        date: item.release_date || item.date || '-',
        spotify: tid ? `https://open.spotify.com/track/${tid}` : url,
        download
    }
}

// durasi dari spotsaver bisa berupa detik (365) atau "6:05"
const fmtAny = (d) => {
    if (d === null || d === undefined || d === '' || d === '-') return '-'
    if (typeof d === 'string' && d.includes(':')) return d
    const n = Number(d)
    if (isNaN(n)) return String(d)
    const sec = Math.round(n > 100000 ? n / 1000 : n)
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

const react = (sock, m, text) => sock.sendMessage(m.chat, { react: { text, key: m.key } }).catch(() => null)
const errMsg = (e) => e.response?.data?.message || e.response?.data?.error || e.message

let handler = async (m, { sock, text, command, prefix, reply }) => {
    const input = String(text || '').trim()

    // ───────── .spotcari ─────────
    if (['spotcari', 'spsearch'].includes(command)) {
        if (!input) return reply(`*▢ SPOTIFY CARI*\n\nContoh:\n${prefix}spotcari shape of you`)
        await react(sock, m, '🕒')
        try {
            const list = (await searchSpotify(input)).slice(0, 10)
            const body = list.map((s, i) =>
                `*${i + 1}. ${s.title}*\n` +
                `   ${s.artist} • ${s.album}\n` +
                `   ${s.duration} • ${s.date}\n` +
                `   ${s.url || '-'}`
            ).join('\n\n')
            const caption = `*▢ SPOTIFY: ${input}*\n\n${body}\n\n_Ambil lagunya: ${prefix}spotplay <judul / url>_`
            if (list[0].cover) await sock.sendMessage(m.chat, { image: { url: list[0].cover }, caption }, { quoted: m })
            else await reply(caption)
            return react(sock, m, '✅')
        } catch (e) {
            await react(sock, m, '❌')
            return reply(`❌ ${errMsg(e)}`)
        }
    }

    // ───────── .spotplay ─────────
    if (!input) return reply(`*▢ SPOTIFY PLAY*\n\nContoh:\n${prefix}spotplay shape of you\n${prefix}spotplay https://open.spotify.com/track/xxxx`)
    await react(sock, m, '🕒')
    try {
        let url = input
        if (!SPOTIFY_URL.test(input)) {
            const first = (await searchSpotify(input))[0]
            if (!first.url) throw new Error('URL Spotify tidak ditemukan.')
            url = first.url
        }

        const r = await downloadSpotify(url)
        const caption =
            `*▢ SPOTIFY*\n\n` +
            `❀ Judul  : ${r.title}\n` +
            `❀ Artis  : ${r.artist}\n` +
            `❀ Album  : ${r.album}\n` +
            `❀ Durasi : ${fmtAny(r.duration)}\n` +
            `❀ Link   : ${r.spotify}`
        if (r.cover) await sock.sendMessage(m.chat, { image: { url: r.cover }, caption }, { quoted: m }).catch(() => reply(caption))
        else await reply(caption)

        await sock.sendMessage(m.chat, {
            audio: { url: r.download },
            mimetype: 'audio/mpeg',
            fileName: `${r.title}.mp3`
        }, { quoted: m })
        return react(sock, m, '✅')
    } catch (e) {
        await react(sock, m, '❌')
        return reply(`❌ ${errMsg(e)}`)
    }
}

handler.command = ['spotcari', 'spsearch', 'spotplay', 'spdl', 'spotifyplay', 'spplay', 'spotifydl', 'spotify']
handler.help = ['spotcari <judul>', 'spotplay <judul/url>', 'spotifyplay <judul/url>']
handler.tags = ['downloader']
handler.limit = true

export default handler
