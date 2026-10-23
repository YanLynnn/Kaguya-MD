// ───────── instagram ─────────
// Gabungan plugin: ig, ig3, igaudio, instagramdl, instatiktok

import axios from 'axios'
import FormData from 'form-data'
import * as cheerio from 'cheerio'
import { wrapClassic, wrapPlugin, mergePlugins } from '../../lib/plugin-engine.js'
import { instagramDownloader } from '../../lib/scraper.js'

// ── ig ──
const _ig = (() => {
async function igdl(url, m) {
  m.reply('Wait')
  const form = new FormData()
  form.append("url", url)
  form.append("action", "post")

  const res = await axios.post("https://snapinsta.top/action.php", form, {
    headers: {
      ...form.getHeaders(),
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36",
      "accept": "*/*",
      "origin": "https://snapinsta.top",
      "referer": "https://snapinsta.top/"
    }
  })

  const $ = cheerio.load(res.data)
  const downloads = []

  $(".download-items__btn a").each((_, el) => {
    let path = $(el).attr("href")
    if (!path) return
    if (!path.startsWith("http")) path = "https://snapinsta.top" + path
    downloads.push(path)
  })

  return {
    status: downloads.length ? 200 : 404,
    download: downloads
  }
}

let handler = async (m, { conn, args, command }) => {
  try {
    if (!args[0]) return m.reply(`*Example:* .${command} https://www.instagram.com/p/xxxx/`)
    let res = await igdl(args[0], m)

    for (let url of res.download) {
      let buf = (await axios.get(url, { responseType: "arraybuffer" })).data
      buf = Buffer.from(buf)

      if (buf.slice(4, 8).toString() === "ftyp")
        await conn.sendMessage(m.chat, { video: buf }, { quoted: m })
      else
        await conn.sendMessage(m.chat, { image: buf }, { quoted: m })
    }

  } catch (e) {
    m.reply(e.message)
  }
}

handler.help = ['igdl','ig','instagram']
handler.command = ['igdl']
handler.tags = ['downloader']


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── ig3 ──
const _ig3 = (() => {
let handler = async (m, { conn, text, args, usedPrefix, command }) => {
  let input = clean(text || args?.[0])

  if (!input) {
    throw `Contoh:\n${usedPrefix + command} https://instagram.com/...`
  }

  await m.react('✨')

  try {

    let resApi = await fetch(
      `https://api.nexray.eu.cc/downloader/v2/instagram?url=${encodeURIComponent(input)}`
    )

    if (!resApi.ok) throw 'API error'

    let data = await resApi.json()

    if (!data.status || !data.result?.media?.length) {
      throw 'Media tidak ditemukan'
    }

    let res = data.result

    let caption = `
— instagram downloader —

❀ author : ${cleanText(res.username)}
❀ likes  : ${res.likes?.toLocaleString() || 0}

❀ title :
${cleanText(res.title || '-')}
`.trim()

    let annotations = [
      {
        polygonVertices: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 1000 },
          { x: 0, y: 1000 }
        ],

        shouldSkipConfirmation: true,

        embeddedContent: {
          embeddedMusic: {
            musicContentMediaId: "1409620227516822",
            songId: "244215252974958",
            author: "Elaina - MD",
            title: "\u200B",
            artistAttribution: "https://whatsapp.com/channel/0029VbAYjQgKrWQulDTYcg2K",
            countryBlocklist: "",
            isExplicit: false,
            artworkMediaKey: ""
          }
        },

        embeddedAction: true
      }
    ]

    let images = []
    let videos = []

    for (let item of res.media) {

      if (item.type === 'mp4') {
        videos.push(item.url)
      } else {
        images.push(item.url)
      }
    }

    if (images.length) {

      await conn.sendMessage(m.chat, {
        album: images.map((url, i) => ({
          image: { url },

          caption: i === 0 ? caption : '',

          annotations
        }))
      }, { quoted: m })
    }

    for (let url of videos) {

      await conn.sendMessage(m.chat, {
        video: { url },

        caption,

        annotations
      }, { quoted: m })
    }

    await m.react('✅')

  } catch (e) {
    console.log(e)

    await m.react('❌')

    m.reply('Error bang')
  }
}

handler.help = ['instagram3']
handler.tags = ['downloader']
handler.command = ['ig3']
handler.limit = true


const __plugin = wrapClassic(handler)
function clean(s) {
  return String(s || '').trim()
}

function cleanText(text = '') {
  return text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

  return __plugin
})()

// ── igaudio ──
const _igaudio = (() => {
let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) throw `Contoh:\n${usedPrefix + command} https://www.instagram.com/reel/xxxxx/`

  await m.react('🕒')

  try {
    let { data } = await axios.post(
      'https://reelsvideo.io/reel/',
      new URLSearchParams({
        id: text,
        locale: 'id',
        'cf-turnstile-response': '',
        tt: 'a66b23d8bfa4878536d788ac3d33d1a6',
        ts: Math.floor(Date.now() / 1000)
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'HX-Request': 'true',
          'HX-Trigger': 'main-form',
          'HX-Target': 'target',
          'HX-Current-URL': 'https://reelsvideo.io/id',
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://reelsvideo.io/id'
        }
      }
    )

    const $ = cheerio.load(data)
    const mp3Link = $('a.type_audio').attr('href')

    if (!mp3Link) throw 'Audio tidak tersedia di reel ini.'

    await conn.sendMessage(m.chat, {
      audio: { url: mp3Link },
      mimetype: 'audio/mpeg'
    }, { quoted: m })

  } catch (e) {
    m.reply(typeof e === 'string' ? e : '❌ Gagal mengambil audio Instagram.')
  }
}

handler.help = ['igaudio <url>', 'igmp3 <url>']
handler.tags = ['downloader']
handler.command = ['igaudio']
handler.limit = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── instagramdl ──
const _instagramdl = (() => {
const pluginConfig = {
  name: "instagramdl",
  alias: [],
  category: "download",
  description: "Download video/foto Instagram",
  usage: ".instagramdl <url>",
  example: ".instagramdl https://www.instagram.com/reel/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const IG_REGEX = /instagram\.com\/(p|reel|reels|stories|tv)\//i;

async function handler(m, { sock }) {
  const url = m.text?.trim();

  if (!url) {
    return m.reply(
      `📸 *ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n\n` +
        `> \`${m.prefix}igdl <url>\`\n\n` +
        `*ᴄᴏɴᴛᴏʜ:*\n` +
        `> \`${m.prefix}igdl https://www.instagram.com/reel/xxx\`\n` +
        `> \`${m.prefix}igdl https://www.instagram.com/p/xxx\``,
    );
  }

  if (!IG_REGEX.test(url)) {
    return m.reply(
      `❌ URL tidak valid. Gunakan link Instagram (reel/post/story).`,
    );
  }

  await m.react("🕕");

  try {
    const result = await instagramDownloader(url);

    if (!result?.media?.length) {
      await m.react("❌");
      return m.reply(`❌ Gagal mengambil media. Coba link lain.`);
    }

    const isStory = url.includes("/stories/");
    let caption = `📸 *Instagram ${isStory ? "Story" : "Downloader"}*\n\n`;
    if (result.username && result.username !== "-") {
      caption += `👤 *Author*: @${result.username}\n`;
    }
    if (result.caption) {
      caption += `📝 *Caption*:\n${result.caption}\n`;
    }
    caption = caption.trim();

    for (const item of result.media) {
      if (item.type === "video" || item.type === "mp4") {
        await sock.sendMessage(
          m.chat,
          { video: { url: item.url }, caption },
          { quoted: m },
        );
      } else {
        await sock.sendMessage(
          m.chat,
          { image: { url: item.url }, caption },
          { quoted: m },
        );
      }
      caption = "";
    }

    await m.react("✅");
  } catch (err) {
    await m.react("❌");
    return m.reply(`❌ *ɢᴀɢᴀʟ ᴍᴇɴɢᴜɴᴅᴜʜ*\n\n> ${err.message}`);
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── instatiktok ──
const _instatiktok = (() => {
/*
fitur : InstaTiktok download 
desk : support fb,ig,tiktok
source scarape : https://whatsapp.com/channel/0029VakezCJDp2Q68C61RH2C/3951
*/



let handler = async (m, { conn, args, usedPrefix, command }) => {
  if (args.length < 2) return m.reply(`Contoh:\n${usedPrefix + command} tiktok https://vt.tiktok.com/ZSBKKk4HS/`)

  const platform = args[0].toLowerCase()
  const inputUrl = args[1]

  if (!['instagram', 'tiktok', 'facebook'].includes(platform))
    return m.reply('Platform tidak valid! Gunakan: instagram, tiktok, atau facebook')

  const SITE_URL = 'https://instatiktok.com/'
  const form = new URLSearchParams()
  form.append('url', inputUrl)
  form.append('platform', platform)
  form.append('siteurl', SITE_URL)

  try {
    const res = await axios.post(`${SITE_URL}api`, form.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': SITE_URL,
        'Referer': SITE_URL,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })

    const html = res?.data?.html
    if (!html || res?.data?.status !== 'success') throw 'Gagal ambil data'

    const $ = cheerio.load(html)
    const links = []

    $('a.btn[href^="http"]').each((_, el) => {
      const link = $(el).attr('href')
      if (link && !links.includes(link)) links.push(link)
    })

    if (links.length === 0) throw 'Link download tidak ditemukan'

    let download
    if (platform === 'instagram') {
      download = links
    } else if (platform === 'tiktok') {
      download = links.find(link => /hdplay/.test(link)) || links[0]
    } else if (platform === 'facebook') {
      download = links.at(-1)
    }

    if (Array.isArray(download)) {
      for (let link of download) {
        await conn.sendFile(m.chat, link, 'media.mp4', `✅ Hasil download dari ${platform}`, m)
      }
    } else {
      await conn.sendFile(m.chat, download, 'media.mp4', `✅ Berhasil download dari ${platform}`, m)
    }

  } catch (e) {
    m.reply(`❌ Gagal: ${e.message || e}`)
  }
}

handler.help = ['dlit <platform> <url>']
handler.tags = ['downloader']
handler.command = ['dlit']
handler.limit = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

export default mergePlugins(
    'download',
    _ig,
    _ig3,
    _igaudio,
    _instagramdl,
    _instatiktok
)
