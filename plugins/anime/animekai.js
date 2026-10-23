// ───────── animekai: home, search, detail, episode ─────────
// Name Scrape: AnimeKai | Credit By Zx
// Sumber Kode: https://whatsapp.com/channel/0029VbDLqe7EquiSF4STU13o
import axios from 'axios'
import * as cheerio from 'cheerio'
import { wrapPlugin } from '../../lib/plugin-engine.js'

const BASE_URL = 'https://animekai.com.ro'

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    Referer: BASE_URL,
    'Upgrade-Insecure-Requests': '1'
  }
})

async function fetchHTML(path, params = {}) {
  try {
    const { data } = await http.get(path, { params })
    return cheerio.load(data)
  } catch (err) {
    if (err.response?.status === 403) {
      throw new Error('403 Forbidden: situs diproteksi Cloudflare, coba lagi nanti.')
    }
    throw err
  }
}

const clean = (t) => (t || '').replace(/\s+/g, ' ').trim()
const abs = (u) => { try { return u ? new URL(u, BASE_URL).toString() : null } catch { return null } }
const decodeBase64 = (b) => { try { return Buffer.from(b || '', 'base64').toString('utf8') } catch { return '' } }
const extractIframeSrc = (html) => html?.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1] || null

function parseAItem($, el) {
  const $el = $(el)
  const titleEl = $el.find('.title').first()
  const href = titleEl.attr('href') || $el.find('a.poster').attr('href') || $el.attr('href') || $el.find('a').attr('href')
  return {
    title: clean(titleEl.text()) || clean($el.attr('title')),
    url: abs(href),
    poster: abs($el.find('img').attr('src') || $el.find('img').attr('data-src')),
    subEpisode: clean($el.find('.sub').text()),
    dubEpisode: clean($el.find('.dub').text()),
    type: clean($el.find('.info span b, .typez').first().text())
  }
}

function parseBsx($, el) {
  const $el = $(el)
  const a = $el.find('a').first()
  return {
    title: clean(a.attr('title') || $el.find('.tt span a').text() || $el.find('.tt span').text() || $el.find('.inf span a').text() || $el.find('.title').text()),
    url: abs(a.attr('href') || $el.attr('href')),
    poster: abs($el.find('img').attr('src') || $el.find('img').attr('data-src')),
    type: clean($el.find('.typez').text())
  }
}

function parseEpisodeList($) {
  const episodes = []

  $('.ak-cl-eps li').each((_, el) => {
    const $el = $(el)
    const a = $el.find('a').first()
    episodes.push({
      number: clean($el.attr('data-num') || $el.find('.gnum').text()),
      title: clean(a.attr('title') || $el.find('.ttl').text()),
      url: abs(a.attr('href'))
    })
  })
  if (episodes.length) return episodes

  $('.eplister ul li, .episodelist ul li, .episodelist li').each((_, el) => {
    const $el = $(el)
    const a = $el.find('a').first()
    episodes.push({
      number: clean($el.find('.epl-num, .num').text()),
      title: clean($el.find('.epl-title, .ttl, .title').text() || a.attr('title')),
      url: abs(a.attr('href'))
    })
  })
  if (episodes.length) return episodes

  $('a[href*="episode-"]').each((_, el) => {
    const $el = $(el)
    const title = clean($el.attr('title') || $el.text())
    const url = abs($el.attr('href'))
    if (!title || !url || episodes.some(e => e.url === url)) return
    episodes.push({ number: title.match(/\d+/)?.[0] || '', title, url })
  })
  return episodes
}

function parseSeriesInfo($) {
  const info = {}
  $('.ak-cl-spe span, .bigcontent .infox .spe span').each((_, el) => {
    const match = clean($(el).text()).match(/^([^:]+):\s*(.+)$/)
    if (match) info[match[1].trim().toLowerCase().replace(/\s+/g, '_')] = match[2].trim()
  })

  const genres = $('.ak-cl-genres a, .bigcontent .infox .genxed a').map((_, el) => clean($(el).text())).get()

  return {
    title: clean($('.ak-cl-title').text() || $('.bigcontent .infox h1').text() || $('h1.entry-title').text()),
    poster: abs($('.ak-cl-poster img').attr('src') || $('.bigcontent .thum img').attr('src') || $('meta[property="og:image"]').attr('content')),
    type: info.type || clean($('.ak-cl-type').text()),
    status: info.status,
    released: info.released,
    season: info.season,
    duration: info.duration,
    totalEpisodes: info.episodes,
    genres,
    description: clean($('.ak-cl-desc').text() || $('.entry-content p').first().text() || $('meta[name="description"]').attr('content'))
  }
}

export async function getHome() {
  const $ = await fetchHTML('/')
  const latestUpdates = $('#latest-updates .aitem-wrapper .aitem').map((_, el) => parseAItem($, el)).get()
  const trending = $('#trending-anime .aitem').map((_, el) => {
    const $el = $(el)
    return {
      rank: clean($el.find('.num').text()),
      title: clean($el.find('.title').text()),
      url: abs($el.find('.title').attr('href')),
      subEpisode: clean($el.find('.sub a').text() || $el.find('.sub').text())
    }
  }).get()
  const schedule = $('#schedule-list li a').map((_, el) => {
    const $el = $(el)
    return {
      time: clean($el.find('.time').text()),
      title: clean($el.find('.title').text()),
      episode: clean($el.find('span').last().text()),
      url: abs($el.attr('href'))
    }
  }).get()
  return { latestUpdates, trending, schedule }
}

export async function searchAnime(query) {
  const $ = await fetchHTML('/', { s: query })
  const results = []

  $('.aitem').each((_, el) => { results.push(parseAItem($, el)) })
  if (results.length) return { query, total: results.length, results }

  $('.bs .bsx, .bsx').each((_, el) => { results.push(parseBsx($, el)) })
  if (results.length) return { query, total: results.length, results }

  $('.listupd .lexa, .lexa').each((_, el) => {
    const $el = $(el)
    const a = $el.find('a').first()
    results.push({
      title: clean($el.find('.dtl h2 a').text() || $el.find('.dtl h2').text() || a.attr('title')),
      url: abs(a.attr('href')),
      poster: abs($el.find('img').attr('src') || $el.find('img').attr('data-src'))
    })
  })
  if (results.length) return { query, total: results.length, results }

  $('main a[href*="/anime/"], main a[href*="episode-"]').each((_, el) => {
    const $el = $(el)
    const title = clean($el.attr('title') || $el.text())
    const url = abs($el.attr('href'))
    if (title && url && !results.some(r => r.url === url)) results.push({ title, url })
  })
  return { query, total: results.length, results }
}

export async function getAnimeDetail(animeUrl) {
  const url = abs(animeUrl)
  if (!url) throw new Error('URL anime tidak valid')
  const $ = await fetchHTML(url)
  return { ...parseSeriesInfo($), episodes: parseEpisodeList($) }
}

export async function getEpisode(episodeUrl) {
  const url = abs(episodeUrl)
  if (!url) throw new Error('URL episode tidak valid')
  const $ = await fetchHTML(url)

  const servers = $('.ak-srv-btn').map((_, el) => {
    const $el = $(el)
    return {
      name: clean($el.text()),
      lang: clean($el.attr('data-lang')),
      embedUrl: abs(extractIframeSrc(decodeBase64($el.attr('data-value'))))
    }
  }).get()

  return {
    title: clean($('.entry-title').text()),
    episodeNumber: clean($('meta[itemprop="episodeNumber"]').attr('content') || $('.lm .epx').eq(1).text().replace(/episode/i, '')),
    lang: clean($('.lg').text()),
    mainEmbed: abs($('#pembed iframe').attr('src')),
    servers,
    prev: abs($('.naveps a[rel="prev"]').attr('href')),
    next: abs($('.naveps .nvs:last-child a').attr('href'))
  }
}

const pluginConfig = {
  name: 'animekai',
  alias: ['akai'],
  category: 'anime',
  description: 'Info anime dari AnimeKai (home, cari, detail, episode)',
  usage: '.animekai <judul> | home | detail <url> | ep <url>',
  example: '.animekai jojo',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true
}

async function handler(m, { sock }) {
  const text = String(m.text || '').trim()
  const p = m.prefix + m.command

  if (!text) {
    m.react('❌')
    return m.reply(
      `📌 Contoh:\n*${p} jojo* (cari anime)\n*${p} home* (update terbaru)\n` +
      `*${p} detail <url>* (info + daftar episode)\n*${p} ep <url>* (server streaming)`
    )
  }

  m.react('🕕')
  try {
    const [sub, ...rest] = text.split(/\s+/)
    const arg = rest.join(' ').trim()

    if (/^home$/i.test(sub)) {
      const h = await getHome()
      const latest = h.latestUpdates.slice(0, 10).map((a, i) =>
        `${i + 1}. *${a.title}* ${a.subEpisode ? `(${a.subEpisode})` : ''}\n   ${a.url}`).join('\n')
      const trend = h.trending.slice(0, 5).map(a => `#${a.rank || '-'} ${a.title}`).join('\n')
      await m.reply(`🆕 *UPDATE TERBARU*\n\n${latest || '-'}\n\n🔥 *TRENDING*\n${trend || '-'}`)

    } else if (/^detail$/i.test(sub)) {
      if (!arg) return m.reply(`Contoh: *${p} detail https://animekai.com.ro/...*`)
      const d = await getAnimeDetail(arg)
      const eps = d.episodes.slice(0, 15).map(e => `• ${e.number ? 'Ep ' + e.number : e.title}\n  ${e.url}`).join('\n')
      const caption =
        `📺 *${d.title || '-'}*\n\n` +
        `- Tipe: ${d.type || '-'}\n- Status: ${d.status || '-'}\n- Rilis: ${d.released || '-'}\n` +
        `- Durasi: ${d.duration || '-'}\n- Total Eps: ${d.totalEpisodes || '-'}\n` +
        `- Genre: ${d.genres.join(', ') || '-'}\n\n` +
        `${(d.description || '-').slice(0, 500)}\n\n` +
        `*Episode (${d.episodes.length}):*\n${eps || '-'}` +
        (d.episodes.length > 15 ? `\n...dan ${d.episodes.length - 15} lainnya` : '')
      if (d.poster) await sock.sendMessage(m.chat, { image: { url: d.poster }, caption }, { quoted: m })
      else await m.reply(caption)

    } else if (/^(ep|episode)$/i.test(sub)) {
      if (!arg) return m.reply(`Contoh: *${p} ep https://animekai.com.ro/...episode-5...*`)
      const e = await getEpisode(arg)
      const servers = e.servers.map((s, i) => `${i + 1}. ${s.name} ${s.lang ? `[${s.lang}]` : ''}\n   ${s.embedUrl || '-'}`).join('\n')
      await m.reply(
        `🎬 *${e.title || '-'}*\n- Episode: ${e.episodeNumber || '-'}\n- Bahasa: ${e.lang || '-'}\n\n` +
        `*Player utama:*\n${e.mainEmbed || '-'}\n\n*Server:*\n${servers || '-'}\n\n` +
        `${e.prev ? '⬅️ ' + e.prev + '\n' : ''}${e.next ? '➡️ ' + e.next : ''}`.trim()
      )

    } else {
      const r = await searchAnime(text)
      if (!r.total) return m.reply(`❌ Anime "${text}" tidak ditemukan.`)
      const list = r.results.slice(0, 10).map((a, i) =>
        `${i + 1}. *${a.title}* ${a.type ? `(${a.type})` : ''}\n   ${a.url}`).join('\n')
      await m.reply(`🔎 *Hasil "${text}"* (${r.total})\n\n${list}\n\nLihat detail: *${p} detail <url>*`)
    }
    m.react('✅')
  } catch (e) {
    console.error('[AnimeKai] Error:', e)
    m.react('❌')
    m.reply(`❌ ${e.message}`)
  }
}

export default wrapPlugin(pluginConfig, handler)
