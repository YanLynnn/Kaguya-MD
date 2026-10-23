// ───────── manhwaland: home, info, baca ─────────
// Scraper asli: ManhwaKu (link.manhwaland.land) — diadaptasi ke format plugin Kaguya
// Catatan: .manhwa sudah dipakai manhwa.js (manwhaku.my.id), jadi fitur ini pakai .manhwaland
import axios from 'axios'
import * as cheerio from 'cheerio'
import { wrapPlugin } from '../../lib/plugin-engine.js'
import { sleep } from '../../lib/core-system.js'

const BASE = 'https://link.manhwaland.land'
const CDN = 'https://api-l.gmbr.pro'
const MAX_PAGES = 10
const http = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
})
const html = async (url) => (await http.get(url)).data

async function getHome() {
  const $ = cheerio.load(await html(`${BASE}/`))
  const out = [], seen = new Set()
  $('.bsx').each((_, el) => {
    const link = $(el).find('a').attr('href'), im = $(el).find('img')
    const title = (im.attr('title') || im.attr('alt') || '').trim()
    if (!link || !title) return
    const slug = link.replace(/\/$/, '').split('/').pop()
    if (seen.has(slug)) return
    seen.add(slug); out.push({ slug, title })
  })
  return out.slice(0, 20)
}

async function getInfo(slug) {
  const h = await html(`${BASE}/manga/${slug}/`)
  const g = (re) => h.match(re)?.[1]?.trim() || ''
  const info = {
    slug,
    title: g(/<h1[^>]*>([^<]+)<\/h1>/),
    cover: g(/<img[^>]*src="(https:\/\/api-l\.gmbr\.pro\/covers\/[^"]+)"/),
    status: g(/Status\s*<i>([^<]+)<\/i>/),
    type: g(/Type\s*<a[^>]*>([^<]+)<\/a>/),
    author: g(/Author\s*<i>([^<]+)<\/i>/),
    synopsis: g(/<h2>Synopsis[^<]*<\/h2>\s*<div[^>]*>\s*<p>([^<]+)<\/p>/s),
    genres: [], chapters: []
  }
  const gen = h.match(/<span class="mgen">.*?<\/span>/s)?.[0]
  if (gen) info.genres = (gen.match(/rel="tag">([^<]+)<\/a>/g) || []).map(x => x.replace(/rel="tag">|<\/a>/g, '').trim())
  const re = /<li data-num="(\d+)">\s*<div class="chbox">\s*<div class="eph-num">\s*<a href="([^"]+)">\s*<span class="chapternum">([^<]+)<\/span>\s*<span class="chapterdate">([^<]+)<\/span>/gs
  for (const mt of h.matchAll(re)) info.chapters.push({ number: parseInt(mt[1], 10), title: mt[3].trim(), date: mt[4].trim() })
  return info
}

async function getPages(slug, ch) {
  const h = await html(`${BASE}/${slug}-chapter-${ch}/`)
  const count = h.match(/(\d+)\/\d+/) ? parseInt(h.match(/(\d+)\/\d+/)[1], 10) : 0
  let n = count
  if (!n) { const imgs = h.match(/https:\/\/api-l\.gmbr\.pro\/manga\/[^"]+\.jpg/g); n = imgs ? new Set(imgs).size : 0 }
  const title = h.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() || `Chapter ${ch}`
  const pad = (x) => String(x).padStart(3, '0')
  return { title, pages: Array.from({ length: n }, (_, i) => `${CDN}/manga/${slug}/ch-${pad(ch)}/${pad(i + 1)}.jpg`) }
}

const pluginConfig = {
  name: 'manhwaland',
  alias: ['mlands', 'manhwaku2'],
  category: 'anime',
  description: 'Baca manhwa dari ManhwaLand (home, info, baca chapter)',
  usage: '.manhwaland home | info <slug> | baca <slug> <chapter>',
  example: '.manhwaland home',
  isOwner: false, isPremium: false, isGroup: false, isPrivate: false,
  cooldown: 10, energi: 1, isEnabled: true
}

async function handler(m, { sock }) {
  const text = String(m.text || '').trim()
  const p = m.prefix + m.command
  if (!text) {
    m.react('❌')
    return m.reply(`📌 Contoh:\n*${p} home* (daftar manhwa)\n*${p} info <slug>*\n*${p} baca <slug> <no chapter>*`)
  }
  m.react('🕕')
  try {
    const [sub, ...rest] = text.split(/\s+/)

    if (/^home$/i.test(sub)) {
      const r = await getHome()
      if (!r.length) throw new Error('Data home kosong.')
      await m.reply(`📚 *MANHWALAND*\n\n${r.map((x, i) => `${i + 1}. *${x.title}*\n   slug: ${x.slug}`).join('\n')}\n\nInfo: *${p} info <slug>*`)

    } else if (/^info$/i.test(sub)) {
      if (!rest[0]) return m.reply(`Contoh: *${p} info <slug>*`)
      const d = await getInfo(rest[0])
      if (!d.title) throw new Error('Manhwa tidak ditemukan.')
      const last = d.chapters.slice(0, 8).map(c => `• Ch ${c.number} — ${c.date}`).join('\n')
      const cap = `📚 *${d.title}*\n\n- Tipe: ${d.type || '-'}\n- Status: ${d.status || '-'}\n- Author: ${d.author || '-'}\n- Genre: ${d.genres.join(', ') || '-'}\n- Total chapter: ${d.chapters.length}\n\n${d.synopsis.slice(0, 500)}\n\n*Terbaru:*\n${last || '-'}\n\nBaca: *${p} baca ${d.slug} <no>*`
      if (d.cover) await sock.sendMessage(m.chat, { image: { url: d.cover }, caption: cap }, { quoted: m })
      else await m.reply(cap)

    } else if (/^(baca|read)$/i.test(sub)) {
      const [slug, ch] = rest
      if (!slug || !/^\d+$/.test(ch || '')) return m.reply(`Contoh: *${p} baca <slug> 1*`)
      const { title, pages } = await getPages(slug, ch)
      if (!pages.length) throw new Error('Halaman chapter tidak ditemukan.')
      const shown = pages.slice(0, MAX_PAGES)
      await m.reply(`📖 *${title}*\nMengirim ${shown.length} dari ${pages.length} halaman.`)
      for (let i = 0; i < shown.length; i++) {
        try {
          const img = await http.get(shown[i], { responseType: 'arraybuffer', headers: { Referer: `${BASE}/` } })
          await sock.sendMessage(m.chat, { image: Buffer.from(img.data), caption: `Hal. ${i + 1}/${pages.length}` }, { quoted: m })
        } catch {}
        await sleep(1200)
      }

    } else {
      m.reply(`Subperintah tidak dikenal. Pakai: *${p} home*, *${p} info <slug>*, atau *${p} baca <slug> <no>*`)
    }
    m.react('✅')
  } catch (e) {
    console.error('[ManhwaLand] Error:', e)
    m.react('❌')
    m.reply(`❌ ${e.response?.status ? `HTTP ${e.response.status}: ` : ''}${e.message}`)
  }
}

export default wrapPlugin(pluginConfig, handler)
