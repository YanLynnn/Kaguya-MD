// ───────── animein: home, cari, detail, episode, nonton ─────────
// Scraper asli: poch1 (animeinweb.com) — diadaptasi ke format plugin Kaguya
import axios from 'axios'
import { wrapPlugin } from '../../lib/plugin-engine.js'

const PROXY = 'https://www.animeinweb.com/api/proxy'
const IMG_BASE = 'https://xyz-api.animein.net'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36'

async function api(path, params) {
  const { data: j } = await axios.get(PROXY + path, {
    params, timeout: 20000,
    headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.animeinweb.com/', 'x-proxy-secret': 'animein-secure-proxy-key-123' }
  })
  if (j.error || j.status !== 200) throw new Error(j.message || `API error ${path}`)
  return j.data
}
const fixImg = (u) => !u ? null : u.startsWith('http') ? u : IMG_BASE + (u.startsWith('/') ? '' : '/') + u
const genreText = (g) => typeof g === 'string' ? g : Array.isArray(g) ? g.map(x => x?.name || String(x)).join(', ') : ''

const ep = {
  home: () => api('/3/2/home/data', { day: '1', limit: '16' }),
  search: (keyword, page = 0, sort = 'views') => api('/3/2/explore/movie', { page, sort, keyword }),
  detail: (id) => api(`/3/2/movie/detail/${id}`),
  episodes: (id, page = 0) => api(`/3/2/movie/episode/${id}`, { page }),
  stream: (epId) => api(`/3/2/episode/streamnew/${epId}`)
}

function pickStream(data, quality) {
  const servers = data.server || []
  if (!servers.length) return null
  const order = { '1080p': 5, '720p': 4, '480p': 3, '360p': 2, '240p': 1 }
  let c = quality ? servers.filter(s => (s.quality || '').toLowerCase() === quality.toLowerCase()) : []
  if (!c.length) c = [...servers].sort((a, b) => (order[(b.quality || '').toLowerCase()] || 0) - (order[(a.quality || '').toLowerCase()] || 0))
  return [...c].sort((a, b) => (a.type === 'direct' ? 0 : 1) - (b.type === 'direct' ? 0 : 1))[0]
}

// cari episode berdasarkan nomor (paginasi 30/halaman, terbaru duluan)
async function findEpisode(movieId, index) {
  const target = Number(index), cache = new Map()
  const page = async (p) => { if (!cache.has(p)) cache.set(p, (await ep.episodes(movieId, p)).episode || []); return cache.get(p) }
  const match = (eps) => eps.find(e => Math.abs(Number(e.index) - target) < 1e-9)
  const p0 = await page(0)
  if (!p0.length) return null
  if (match(p0)) return match(p0)
  if (target > Number(p0[0].index)) return null
  let hi = 1
  while ((await page(hi)).length) { const f = match(await page(hi)); if (f) return f; hi *= 2; if (hi > 5000) break }
  let lo = Math.floor(hi / 2)
  while (lo < hi) {
    const mid = (lo + hi) >> 1, eps = await page(mid)
    if (!eps.length) { hi = mid; continue }
    const f = match(eps); if (f) return f
    if (target > Number(eps[0].index)) hi = mid; else lo = mid + 1
  }
  return null
}

const pluginConfig = {
  name: 'animein',
  alias: ['animeinweb'],
  category: 'anime',
  description: 'Info & link streaming anime dari AnimeIn (home, cari, detail, episode, nonton)',
  usage: '.animein <judul> | home | detail <id> | eps <id> | nonton <id> <eps> [kualitas]',
  example: '.animein one piece',
  isOwner: false, isPremium: false, isGroup: false, isPrivate: false,
  cooldown: 10, energi: 1, isEnabled: true
}

async function handler(m, { sock }) {
  const text = String(m.text || '').trim()
  const p = m.prefix + m.command
  if (!text) {
    m.react('❌')
    return m.reply(`📌 Contoh:\n*${p} one piece* (cari anime)\n*${p} home*\n*${p} detail <id>*\n*${p} eps <id>* (daftar episode terbaru)\n*${p} nonton <id> <no eps> [720p]* (link MP4)`)
  }
  m.react('🕕')
  try {
    const [sub, ...rest] = text.split(/\s+/)

    if (/^home$/i.test(sub)) {
      const d = await ep.home()
      const sec = (k, t) => {
        const items = (d[k] || []).filter(x => x.title).slice(0, 8)
        return items.length ? `*${t}*\n${items.map(x => `• ${x.title} (ID ${x.id})`).join('\n')}` : ''
      }
      await m.reply([sec('hot', '🔥 HOT'), sec('new', '🆕 BARU'), sec('popular', '⭐ POPULER')].filter(Boolean).join('\n\n') || '-')

    } else if (/^detail$/i.test(sub)) {
      const id = parseInt(rest[0], 10)
      if (!id) return m.reply(`Contoh: *${p} detail 426*`)
      const d = await ep.detail(id), mv = d.movie || {}
      if (!mv.title) throw new Error('Anime tidak ditemukan.')
      const cap = `📺 *${mv.title}*\n\n- Tipe: ${mv.type || '-'}\n- Tahun: ${mv.year || '-'}\n- Status: ${mv.status || '-'}\n- Studio: ${mv.studio || '-'}\n` +
        `- Views: ${mv.views || '-'}\n- Genre: ${genreText(mv.genre) || '-'}\n\n${(mv.synopsis || '-').slice(0, 500)}\n\nEpisode: *${p} eps ${mv.id}*`
      const poster = fixImg(mv.image_poster)
      if (poster) await sock.sendMessage(m.chat, { image: { url: poster }, caption: cap }, { quoted: m })
      else await m.reply(cap)

    } else if (/^(eps|episode|episodes)$/i.test(sub)) {
      const id = parseInt(rest[0], 10)
      if (!id) return m.reply(`Contoh: *${p} eps 426*`)
      const items = (await ep.episodes(id, parseInt(rest[1], 10) || 0)).episode || []
      if (!items.length) throw new Error('Daftar episode kosong.')
      await m.reply(`🎞️ *Episode (terbaru dulu)*\n\n${items.slice(0, 15).map(e => `• Ep ${e.index} — ID ${e.id}`).join('\n')}\n\nNonton: *${p} nonton ${id} <no eps>*`)

    } else if (/^(nonton|watch)$/i.test(sub)) {
      const id = parseInt(rest[0], 10), no = rest[1]
      if (!id || no === undefined) return m.reply(`Contoh: *${p} nonton 426 1 720p*`)
      const mv = (await ep.detail(id)).movie || {}
      const target = await findEpisode(id, no)
      if (!target) throw new Error(`Episode ${no} tidak ditemukan.`)
      const st = await ep.stream(target.id)
      const link = pickStream(st, rest[2])
      if (!link) throw new Error('Tidak ada server streaming.')
      await m.reply(`🎬 *${mv.title || ''}* — Ep ${target.index}\n\n[${link.quality}] ${link.name} (${link.type})\n${link.link}\n\nServer lain: ${(st.server || []).length}`)

    } else {
      const items = (await ep.search(text)).movie || []
      if (!items.length) return m.reply(`❌ Anime "${text}" tidak ditemukan.`)
      const list = items.slice(0, 10).map((x, i) => `${i + 1}. *${x.title}* (${x.year || '-'}, ${x.type || '-'})\n   ID: ${x.id}`).join('\n')
      await m.reply(`🔎 *Hasil "${text}"*\n\n${list}\n\nDetail: *${p} detail <id>*`)
    }
    m.react('✅')
  } catch (e) {
    console.error('[AnimeIn] Error:', e)
    m.react('❌')
    m.reply(`❌ ${e.response?.status ? `HTTP ${e.response.status}: ` : ''}${e.message}`)
  }
}

export default wrapPlugin(pluginConfig, handler)
