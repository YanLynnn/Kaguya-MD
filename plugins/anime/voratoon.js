// ───────── voratoon: home, cari, detail, chapter, baca ─────────
// Scraper asli: Kurosawa / Keigo (api.voratoon.com) — diadaptasi ke format plugin Kaguya
import axios from 'axios'
import { wrapPlugin } from '../../lib/plugin-engine.js'
import { sleep } from '../../lib/core-system.js'

const api = axios.create({
  baseURL: 'https://api.voratoon.com',
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
    Origin: 'https://v1.voratoon.com',
    Referer: 'https://v1.voratoon.com/',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
  }
})
const MAX_PAGES = 10

const fmt = (item) => {
  const d = item?.data || {}
  return {
    id: item?.id, title: d.title || '', slug: d.slug || '', cover: d.coverImage || '', synopsis: d.synopsis || '',
    author: d.author || '', rating: d.rating ?? 0, chapters: Number(d.totalChapters || 0), status: d.status || '',
    type: d.type || '', genres: (d.genres || []).map(g => g?.data?.name).filter(Boolean)
  }
}
const list = async (params) => {
  const { data } = await api.get('/series', { params: { includeMeta: true, take: 10, page: 1, sort: 'totalViews', sortOrder: 'desc', ...params } })
  return { results: Array.isArray(data.data) ? data.data.map(fmt) : [], total: Number(data.meta?.total || 0) }
}
const detail = async (slug) => {
  const { data } = await api.get(`/series/${encodeURIComponent(slug)}`)
  if (!data?.data) throw new Error('Series tidak ditemukan')
  return fmt(data.data)
}
const chapters = async (slug) => {
  const { data } = await api.get(`/series/${encodeURIComponent(slug)}/chapters`)
  return (Array.isArray(data.data) ? data.data : [])
    .map(i => ({ index: Number(i?.data?.index || 0), title: i?.data?.title || '' }))
    .sort((a, b) => a.index - b.index)
}
const chapter = async (slug, index) => {
  const { data } = await api.get(`/series/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(index)}`)
  if (!data?.data) throw new Error('Chapter tidak ditemukan')
  const cd = data.data.data || {}
  return { title: cd.title || `Chapter ${index}`, images: (cd.images || []).filter(Boolean) }
}

const pluginConfig = {
  name: 'voratoon',
  alias: ['vora', 'voratoons'],
  category: 'anime',
  description: 'Baca manhwa dari Voratoon (home, cari, detail, chapter, baca)',
  usage: '.voratoon <judul> | home | detail <slug> | ch <slug> | baca <slug> <no>',
  example: '.voratoon solo leveling',
  isOwner: false, isPremium: false, isGroup: false, isPrivate: false,
  cooldown: 10, energi: 1, isEnabled: true
}

async function handler(m, { sock }) {
  const text = String(m.text || '').trim()
  const p = m.prefix + m.command
  if (!text) {
    m.react('❌')
    return m.reply(`📌 Contoh:\n*${p} lookism* (cari manhwa)\n*${p} home* (terpopuler)\n*${p} detail <slug>*\n*${p} ch <slug>* (daftar chapter)\n*${p} baca <slug> <no chapter>*\n\nSlug berformat pakai "-", ambil dari hasil pencarian.`)
  }
  m.react('🕕')
  try {
    const [sub, ...rest] = text.split(/\s+/)
    const fmtLine = (x, i) => `${i + 1}. *${x.title}* (${x.type || '-'}, ${x.chapters} ch, ⭐${x.rating})\n   slug: ${x.slug}`

    if (/^home$/i.test(sub)) {
      const r = await list({ take: 12 })
      await m.reply(`🔥 *TERPOPULER*\n\n${r.results.map(fmtLine).join('\n')}\n\nDetail: *${p} detail <slug>*`)

    } else if (/^detail$/i.test(sub)) {
      const slug = rest[0]
      if (!slug || !slug.includes('-')) return m.reply(`Contoh: *${p} detail solo-leveling* (slug pakai "-")`)
      const d = await detail(slug)
      const cap = `📚 *${d.title}*\n\n- Tipe: ${d.type || '-'}\n- Status: ${d.status || '-'}\n- Author: ${d.author || '-'}\n- Rating: ${d.rating}\n- Chapter: ${d.chapters}\n- Genre: ${d.genres.join(', ') || '-'}\n\n${d.synopsis.slice(0, 500)}\n\nBaca: *${p} baca ${d.slug} 1*`
      if (d.cover) await sock.sendMessage(m.chat, { image: { url: d.cover }, caption: cap }, { quoted: m })
      else await m.reply(cap)

    } else if (/^(ch|chapter|chapters)$/i.test(sub)) {
      const slug = rest[0]
      if (!slug || !slug.includes('-')) return m.reply(`Contoh: *${p} ch solo-leveling*`)
      const c = await chapters(slug)
      if (!c.length) throw new Error('Chapter kosong.')
      const shown = c.slice(-25).reverse().map(x => `• Ch ${x.index}${x.title ? ' — ' + x.title : ''}`).join('\n')
      await m.reply(`📑 *${slug}* (${c.length} chapter)\n\n${shown}\n\nBaca: *${p} baca ${slug} <no>*`)

    } else if (/^(baca|read)$/i.test(sub)) {
      const [slug, idx] = rest
      if (!slug || !slug.includes('-') || idx === undefined) return m.reply(`Contoh: *${p} baca solo-leveling 1*`)
      const c = await chapter(slug, idx)
      if (!c.images.length) throw new Error('Gambar chapter kosong.')
      const shown = c.images.slice(0, MAX_PAGES)
      await m.reply(`📖 *${c.title}*\nMengirim ${shown.length} dari ${c.images.length} halaman.`)
      for (let i = 0; i < shown.length; i++) {
        try { await sock.sendMessage(m.chat, { image: { url: shown[i] }, caption: `Hal. ${i + 1}/${c.images.length}` }, { quoted: m }) } catch {}
        await sleep(1200)
      }

    } else {
      const r = await list({ title: text })
      if (!r.results.length) return m.reply(`❌ Manhwa "${text}" tidak ditemukan.`)
      await m.reply(`🔎 *Hasil "${text}"* (${r.total})\n\n${r.results.map(fmtLine).join('\n')}\n\nDetail: *${p} detail <slug>*`)
    }
    m.react('✅')
  } catch (e) {
    console.error('[Voratoon] Error:', e)
    m.react('❌')
    m.reply(`❌ ${e.response?.status ? `HTTP ${e.response.status}: ` : ''}${e.message}`)
  }
}

export default wrapPlugin(pluginConfig, handler)
