// ───────── weebcentral: home, cari, detail, baca chapter ─────────
// Scraper asli: Vellzyy (WeebCentral) — diadaptasi ke format plugin Kaguya
import axios from 'axios'
import * as cheerio from 'cheerio'
import { wrapPlugin } from '../../lib/plugin-engine.js'
import { sleep } from '../../lib/core-system.js'

const BASE = 'https://weebcentral.com'
const HEAD = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
}
const MAX_PAGES = 10
const abs = (u) => { try { return u ? new URL(u, BASE).href : null } catch { return null } }
const get = (url, htmx = false, extra = {}) =>
  axios.get(url, { headers: { ...HEAD, ...(htmx ? { 'HX-Request': 'true' } : {}) }, timeout: 30000, ...extra })
const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim()

async function getHome() {
  const $ = cheerio.load((await get(BASE)).data)
  const out = { hot: [], latest: [] }
  $('h2:contains("Hot Updates")').closest('section').find('a[href*="/series/"]').each((_, el) => {
    const img = $(el).find('img'), url = abs($(el).attr('href'))
    const title = clean((img.attr('alt') || '').replace(/ cover$/i, ''))
    if (title && url && !out.hot.some(x => x.url === url)) out.hot.push({ title, url })
  })
  $('h2:contains("Latest Updates")').closest('section').find('a[href*="/series/"]').each((_, el) => {
    const link = $(el), ch = link.parent().find('a[href*="/chapters/"]').first()
    const url = abs(link.attr('href'))
    const title = clean(ch.find('.truncate').text()) || clean((link.find('img').attr('alt') || '').replace(/ cover$/i, ''))
    const chapter = clean(ch.find('span:contains("Chapter")').first().text())
    if (title && url && !out.latest.some(x => x.url === url)) out.latest.push({ title, url, chapter })
  })
  return out
}

async function search(q) {
  const $ = cheerio.load((await get(`${BASE}/search/data?text=${encodeURIComponent(q)}`, true)).data)
  const res = []
  $('article.bg-base-300').each((_, el) => {
    const a = $(el).find('a.link.link-hover').first()
    const title = clean(a.text()), url = abs(a.attr('href') || $(el).find('a[href*="/series/"]').first().attr('href'))
    if (!title || !url) return
    let type = null, status = null, year = null
    $(el).find('div').each((_, d) => {
      const s = clean($(d).find('strong').first().text()), v = clean($(d).find('span').first().text())
      if (s.startsWith('Year')) year = v
      else if (s.startsWith('Status')) status = v
      else if (s.startsWith('Type')) type = v
    })
    res.push({ title, url, type, status, year })
  })
  return res
}

async function seriesDetail(input) {
  const url = /^https?:/.test(input) ? input : `${BASE}/series/${input}`
  const $ = cheerio.load((await get(url)).data)
  const main = $('section.flex.flex-col.md\\:flex-row')
  const d = { url, title: clean($('h1').first().text()), authors: [], tags: [], type: null, status: null, released: null, synopsis: '' }
  const cover = main.find('picture source').first().attr('srcset') || main.find('picture img').attr('src')
  d.cover = cover || null
  main.find('strong').each((_, st) => {
    const label = $(st).text().trim().toLowerCase(), p = $(st).parent()
    const val = clean(p.text().replace($(st).text(), ''))
    if (label.includes('author')) p.find('a').each((_, a) => d.authors.push(clean($(a).text())))
    else if (label.includes('tag')) p.find('a').each((_, a) => d.tags.push(clean($(a).text())))
    else if (label.includes('type')) d.type = clean(p.find('a').text()) || val
    else if (label.includes('status')) d.status = clean(p.find('a').text()) || val
    else if (label.includes('released')) d.released = clean(p.find('a').text()) || val
    else if (label.includes('description')) d.synopsis = val
  })
  if (!d.synopsis) d.synopsis = clean(main.find('p').first().text())
  const id = url.match(/\/series\/([^/?#]+)/)?.[1]
  d.chapters = []
  if (id) {
    try {
      const c = cheerio.load((await get(`${BASE}/series/${id}/full-chapter-list`, true)).data)
      c('a[href*="/chapters/"]').each((_, el) => {
        const u = abs(c(el).attr('href'))
        const name = clean(c(el).find('span.grow > span').first().text()) || clean(c(el).text())
        if (u) d.chapters.push({ chapter: name, url: u })
      })
    } catch {}
  }
  return d
}

async function chapterPages(input) {
  const url = /^https?:/.test(input) ? input : `${BASE}/chapters/${input}`
  const id = url.match(/\/chapters\/([^/?#]+)/)?.[1]
  if (!id) throw new Error('URL chapter tidak valid')
  const res = await get(`${BASE}/chapters/${id}/images`)
  const $ = cheerio.load(res.data)
  const pages = []
  $('img').each((_, im) => {
    const s = $(im).attr('src')
    if (s && !s.includes('broken_image') && !s.includes('/static/images')) pages.push(s)
  })
  return { url, pages }
}

const pluginConfig = {
  name: 'weebcentral',
  alias: ['wbc', 'weeb'],
  category: 'anime',
  description: 'Manga dari WeebCentral (home, cari, detail, baca chapter)',
  usage: '.weebcentral <judul> | home | detail <url> | baca <url chapter>',
  example: '.weebcentral solo leveling',
  isOwner: false, isPremium: false, isGroup: false, isPrivate: false,
  cooldown: 10, energi: 1, isEnabled: true
}

async function handler(m, { sock }) {
  const text = String(m.text || '').trim()
  const p = m.prefix + m.command
  if (!text) {
    m.react('❌')
    return m.reply(`📌 Contoh:\n*${p} solo leveling* (cari manga)\n*${p} home* (update terbaru)\n*${p} detail <url/id series>*\n*${p} baca <url chapter>* (kirim halaman)`)
  }
  m.react('🕕')
  try {
    const [sub, ...rest] = text.split(/\s+/)
    const arg = rest.join(' ').trim()

    if (/^home$/i.test(sub)) {
      const h = await getHome()
      const hot = h.hot.slice(0, 8).map((x, i) => `${i + 1}. *${x.title}*\n   ${x.url}`).join('\n')
      const latest = h.latest.slice(0, 10).map((x, i) => `${i + 1}. *${x.title}* ${x.chapter ? `(${x.chapter})` : ''}\n   ${x.url}`).join('\n')
      await m.reply(`🔥 *HOT UPDATES*\n\n${hot || '-'}\n\n🆕 *LATEST*\n\n${latest || '-'}`)

    } else if (/^detail$/i.test(sub)) {
      if (!arg) return m.reply(`Contoh: *${p} detail https://weebcentral.com/series/...*`)
      const d = await seriesDetail(arg)
      if (!d.title) throw new Error('Series tidak ditemukan.')
      const last = d.chapters.slice(0, 8).map(c => `• ${c.chapter}\n  ${c.url}`).join('\n')
      const cap = `📚 *${d.title}*\n\n- Tipe: ${d.type || '-'}\n- Status: ${d.status || '-'}\n- Rilis: ${d.released || '-'}\n` +
        `- Author: ${d.authors.join(', ') || '-'}\n- Tag: ${d.tags.slice(0, 10).join(', ') || '-'}\n- Total chapter: ${d.chapters.length}\n\n` +
        `${d.synopsis.slice(0, 500)}\n\n*Chapter terbaru:*\n${last || '-'}\n\nBaca: *${p} baca <url chapter>*`
      if (d.cover) await sock.sendMessage(m.chat, { image: { url: d.cover }, caption: cap }, { quoted: m })
      else await m.reply(cap)

    } else if (/^(baca|read)$/i.test(sub)) {
      if (!arg) return m.reply(`Contoh: *${p} baca https://weebcentral.com/chapters/...*`)
      const { url, pages } = await chapterPages(arg)
      if (!pages.length) throw new Error('Halaman chapter tidak ditemukan.')
      const shown = pages.slice(0, MAX_PAGES)
      await m.reply(`📖 Mengirim ${shown.length} dari ${pages.length} halaman.\nBaca lengkap: ${url}`)
      for (let i = 0; i < shown.length; i++) {
        try { await sock.sendMessage(m.chat, { image: { url: shown[i] }, caption: `Hal. ${i + 1}/${pages.length}` }, { quoted: m }) } catch {}
        await sleep(1200)
      }

    } else {
      const r = await search(text)
      if (!r.length) return m.reply(`❌ Manga "${text}" tidak ditemukan.`)
      const list = r.slice(0, 10).map((x, i) => `${i + 1}. *${x.title}* ${x.type ? `(${x.type}${x.year ? ', ' + x.year : ''})` : ''}\n   ${x.url}`).join('\n')
      await m.reply(`🔎 *Hasil "${text}"* (${r.length})\n\n${list}\n\nDetail: *${p} detail <url>*`)
    }
    m.react('✅')
  } catch (e) {
    console.error('[WeebCentral] Error:', e)
    m.react('❌')
    m.reply(`❌ ${e.response?.status ? `HTTP ${e.response.status}: ` : ''}${e.message}`)
  }
}

export default wrapPlugin(pluginConfig, handler)
