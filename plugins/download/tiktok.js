// ───────── tiktok ─────────
// Gabungan plugin: tiktok, tiktokdl, tiktokdl2, ttimg, ttmp3, ttmusic

import axios from 'axios'
import { wrapClassic, wrapPlugin, te, mergePlugins } from '../../lib/plugin-engine.js'
import * as cheerio from 'cheerio'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { generateWAMessage, generateWAMessageFromContent, jidNormalizedUser } from '@whiskeysockets/baileys'
import { ttdown } from '../../lib/scraper.js'
import ffmpeg from 'fluent-ffmpeg'
import { createRequire } from 'module'

// ── tiktok ──
const _tiktok = (() => {
async function searchTikTok(query) {
  const { data } = await axios.get(
    'https://tikwm.com/api/feed/search',
    {
      params: {
        keywords: query,
        count: 1
      },
      timeout: 20000
    }
  )

  if (!data || data.code !== 0 || !data.data?.videos?.length) {
    throw 'Hasil tidak ditemukan'
  }

  const v = data.data.videos[0]
  return `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`
}

async function getTikTok(url) {
  const { data } = await axios.get(
    'https://tikwm.com/api/',
    {
      params: { url, hd: 1 },
      timeout: 20000
    }
  )

  if (!data || data.code !== 0) {
    throw 'Gagal mengambil data TikTok'
  }

  return data.data
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  await m.react('✨')

  const input = m.quoted ? m.quoted.text : text
  if (!input) {
    return m.reply(
      `Contoh:\n` +
      `${usedPrefix + command} https://vt.tiktok.com/xxxx\n` +
      `${usedPrefix + command} kaguya edit`
    )
  }

  try {
    let url = input

    if (!/^https?:\/\//i.test(input)) {
      url = await searchTikTok(input)
    }

    const res = await getTikTok(url)

    const title = (res.title || '-').replace(/\s+/g, ' ').trim()
    const uploader = res.author?.nickname || res.author?.unique_id || '-'
    const duration = formatDuration(res.duration)
    const views = formatNumber(res.play_count || res.play || res.views || 0)

    const caption = `
— DOWNLOADER TIKTOK —

❀ Judul : ${title.length > 80 ? title.slice(0, 80) + '...' : title}
❀ Uploader : ${uploader}
❀ Durasi : ${duration}
❀ Views : ${views}
`.trim()

    if (Array.isArray(res.images) && res.images.length > 0) {
      await conn.sendMessage(
        m.chat,
        {
          album: res.images.map((img, i) => ({
            image: { url: img },
            caption: i === 0 ? caption : ''
          }))
        },
        { quoted: m }
      )

      if (res.music) {
        await conn.sendMessage(
          m.chat,
          {
            audio: { url: res.music },
            mimetype: 'audio/mpeg'
          },
          { quoted: m }
        )
      }

      await m.react('✅')
      return
    }

    if (res.play) {
      await conn.sendMessage(
        m.chat,
        {
          video: { url: res.play },
          caption
        },
        { quoted: m }
      )
    }

    if (res.music) {
      await conn.sendMessage(
        m.chat,
        {
          audio: { url: res.music },
          mimetype: 'audio/mpeg'
        },
        { quoted: m }
      )
    }

    await m.react('✅')
  } catch (e) {
    await m.react('❌')
    throw String(e)
  }
}

handler.help = ['tt', 'tiktok']
handler.tags = ['downloader']
handler.command = ['tt', 'tiktok']
handler.limit = true
handler.register = false


const __plugin = wrapClassic(handler)
function formatNumber(num = 0) {
  return Number(num).toLocaleString()
}

function formatDuration(sec = 0) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

  return __plugin
})()

// ── tiktokdl ──
const _tiktokdl = (() => {
async function tiktokDl(url) {
  function formatNumber(integer) {
    let numb = parseInt(integer);
    return Number(numb).toLocaleString().replace(/,/g, ".");
  }

  function formatDate(n, locale = "en") {
    let d = new Date(n);
    return d.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
  }

  let data = [];
  const domain = "https://www.tikwm.com/api/";
  const res = (
    await axios.post(
      domain,
      {},
      {
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Origin: "https://www.tikwm.com",
          Referer: "https://www.tikwm.com/",
          "Sec-Ch-Ua": '"Not)A;Brand" ;v="24" , "Chromium" ;v="116"',
          "Sec-Ch-Ua-Mobile": "?1",
          "Sec-Ch-Ua-Platform": "Android",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
          "X-Requested-With": "XMLHttpRequest",
        },
        params: { url, count: 12, cursor: 0, web: 1, hd: 1 },
      },
    )
  ).data.data;

  if (res?.duration == 0) {
    res.images.forEach((v) => data.push({ type: "photo", url: v }));
  } else {
    data.push(
      {
        type: "watermark",
        url: "https://www.tikwm.com" + res?.wmplay || "/undefined",
      },
      {
        type: "nowatermark",
        url: "https://www.tikwm.com" + res?.play || "/undefined",
      },
      {
        type: "nowatermark_hd",
        url: "https://www.tikwm.com" + res?.hdplay || "/undefined",
      },
    );
  }

  return {
    status: true,
    title: res.title,
    taken_at: formatDate(res.create_time).replace("1970", ""),
    region: res.region,
    id: res.id,
    durations: res.duration,
    duration: res.duration + " Seconds",
    cover: "https://www.tikwm.com" + res.cover,
    size_wm: res.wm_size,
    size_nowm: res.size,
    size_nowm_hd: res.hd_size,
    data,
    music_info: {
      id: res.music_info.id,
      title: res.music_info.title,
      author: res.music_info.author,
      album: res.music_info.album || null,
      url: "https://www.tikwm.com" + res.music || res.music_info.play,
    },
    stats: {
      views: formatNumber(res.play_count),
      likes: formatNumber(res.digg_count),
      comment: formatNumber(res.comment_count),
      share: formatNumber(res.share_count),
      download: formatNumber(res.download_count),
    },
    author: {
      id: res.author.id,
      fullname: res.author.unique_id,
      nickname: res.author.nickname,
      avatar: "https://www.tikwm.com" + res.author.avatar,
    },
  };
}

const pluginConfig = {
  name: "tiktokdl",
  alias: [],
  category: "download",
  description: "Download video/slide TikTok tanpa watermark",
  usage: ".tiktok <url>",
  example: ".tiktok https://vt.tiktok.com/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = m.text?.trim();
  const prefix = m.prefix;
  const command = m?.command;
  if (!text) {
    m.react("❌");
    return m.reply(
      `📌 Contoh: *${prefix + command} https://vt.tiktok.com/...*`,
    );
  }
  m.react("🕕");
  try {
    const result = await tiktokDl(text);

    if (result.durations > 0 && result.duration !== "0 Seconds") {
      const videoItem = result.data.find(
        (e) => e.type === "nowatermark_hd" || e.type === "nowatermark",
      ) || result.data[0];

      const caption =
        `🎵 *𝗧 𝗜 𝗞 𝗧 𝗢 𝗞  -  𝗗 𝗢 𝗪 𝗡 𝗟 𝗢 𝗔 𝗗 𝗘 𝗥*\n\n` +
        `- Author: *${result.author.nickname}* (${result.author.fullname})\n` +
        `- Caption: ${result.title || "-"}\n` +
        `- Music: ${result.music_info.title} - ${result.music_info.author}\n` +
        `- Duration: ${result.duration}\n` +
        `- Uploaded: ${result.taken_at}\n` +
        `- Region: ${result.region}\n\n` +
        `*Statistik Video:*\n` +
        `- Views: *${result.stats.views}*\n` +
        `- Likes: *${result.stats.likes}*\n` +
        `- Comments: *${result.stats.comment}*\n` +
        `- Shares: *${result.stats.share}*\n` +
        `- Downloads: *${result.stats.download}*`;

      await sock.sendMessage(
        m.chat,
        {
          video: { url: videoItem.url },
          caption: `${caption}\n\n🎵 Ambil music: *${prefix}ttmp3 ${text}*`,
        },
        { quoted: m },
      );
    } else {
      const caption =
        `📸 *𝗧 𝗜 𝗞 𝗧 𝗢 𝗞  -  𝗗 𝗢 𝗪 𝗡 𝗟 𝗢 𝗔 𝗗 𝗘 𝗥*\n\n` +
        `- Author: *${result.author.nickname}* (${result.author.fullname})\n` +
        `- Caption: ${result.title || "-"}\n` +
        `- Music: ${result.music_info.title} - ${result.music_info.author}\n` +
        `- Uploaded: ${result.taken_at}\n` +
        `- Region: ${result.region}\n\n` +
        `*Statistik Konten:*\n` +
        `- Views: *${result.stats.views}*\n` +
        `- Likes: *${result.stats.likes}*\n` +
        `- Comments: *${result.stats.comment}*\n` +
        `- Shares: *${result.stats.share}*\n` +
        `- Downloads: *${result.stats.download}*`;

      const slides = result.data?.filter(zan => zan?.url) || [];
      for (let idx = 0; idx < slides.length; idx++) {
        await sock.sendMessage(
          m.chat,
          {
            image: { url: slides[idx].url },
            caption: idx === 0 ? caption : "",
          },
          { quoted: m },
        );
      }

      await sock.sendMessage(
        m.chat,
        { text: `📸 Slide berhasil dikirim!\nKetik *${prefix}ttmp3 ${text}* untuk ambil music.` },
        { quoted: m },
      );
    }
    m.react("✅");
  } catch (e) {
    console.error(e);
    m.react("❌");
    m.reply("Coba lagi nanti, atau bisa coba " + m.prefix + "tiktok2");
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── tiktokdl2 ──
const _tiktokdl2 = (() => {
const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    Origin: 'https://savett.cc',
    Referer: 'https://savett.cc/en1/download',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
}

async function getToken() {
    const res = await axios.get('https://savett.cc/en1/download')
    return {
        csrf: res.data.match(/name="csrf_token" value="([^"]+)"/)?.[1],
        cookie: res.headers['set-cookie'].map(v => v.split(';')[0]).join('; ')
    }
}

async function fetchTikTok(url, csrf, cookie) {
    const res = await axios.post(
        'https://savett.cc/en1/download',
        `csrf_token=${encodeURIComponent(csrf)}&url=${encodeURIComponent(url)}`,
        { headers: { ...headers, Cookie: cookie } }
    )
    return res.data
}

function parseResponse(html) {
    const $ = cheerio.load(html)

    const stats = []
    $('#video-info .my-1 span').each((_, el) => {
        stats.push($(el).text().trim())
    })

    const data = {
        username: $('#video-info h3').first().text().trim(),
        views: stats[0] || null,
        likes: stats[1] || null,
        bookmarks: stats[2] || null,
        comments: stats[3] || null,
        shares: stats[4] || null,
        duration: $('#video-info p.text-muted').first().text().replace(/Duration:/i, '').trim() || null,
        type: null,
        downloads: { nowm: [], wm: [] },
        mp3: [],
        slides: []
    }

    const slides = $('.carousel-item[data-data]')

    if (slides.length) {
        data.type = 'photo'
        slides.each((_, el) => {
            try {
                const json = JSON.parse($(el).attr('data-data').replace(/&quot;/g, '"'))
                if (Array.isArray(json.URL)) {
                    json.URL.forEach(url => {
                        data.slides.push({ index: data.slides.length + 1, url })
                    })
                }
            } catch {}
        })
        return data
    }

    data.type = 'video'

    $('#formatselect option').each((_, el) => {
        const label = $(el).text().toLowerCase()
        const raw = $(el).attr('value')
        if (!raw) return

        try {
            const json = JSON.parse(raw.replace(/&quot;/g, '"'))
            if (!json.URL) return

            if (label.includes('mp4') && !label.includes('watermark')) {
                data.downloads.nowm.push(...json.URL)
            }
            if (label.includes('watermark')) {
                data.downloads.wm.push(...json.URL)
            }
            if (label.includes('mp3')) {
                data.mp3.push(...json.URL)
            }
        } catch {}
    })

    return data
}

async function savett(url) {
    const { csrf, cookie } = await getToken()
    const html = await fetchTikTok(url, csrf, cookie)
    return parseResponse(html)
}

const pluginConfig = {
    name: 'tiktok2',
    alias: [],
    category: 'download',
    description: 'Download video/slide TikTok tanpa watermark',
    usage: '.tiktok2 <url>',
    example: '.tiktok2 https://vt.tiktok.com/xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const url = m.text?.trim()

    if (!url) {
        return m.reply(
            `╭┈┈⬡「 🎵 *ᴛɪᴋᴛᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅ* 」\n` +
            `┃ ㊗ ᴜsᴀɢᴇ: \`${m.prefix}tiktok2 <url>\`\n` +
            `╰┈┈⬡\n\n` +
            `> Contoh: ${m.prefix}tiktok2 https://vt.tiktok.com/xxx`
        )
    }

    if (!url.match(/tiktok\.com|vt\.tiktok/i)) {
        return m.reply('❌ URL tidak valid. Gunakan link TikTok.')
    }

    m.react('⏱️')

    try {
        const result = await savett(url)

        const caption =
            `✅ *Done kak*\n\n` +
            `👤 *${result.username || '-'}*\n` +
            `👁️ Views: ${result.views || '-'} | ❤️ Likes: ${result.likes || '-'}\n` +
            `� Comments: ${result.comments || '-'} | 🔗 Shares: ${result.shares || '-'}\n` +
            `⏱️ Duration: ${result.duration || '-'}`

        if (result.type === 'video' && result.downloads.nowm.length > 0) {
            const videoRes = await axios.get(result.downloads.nowm[0], {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                    'Referer': 'https://www.tiktok.com/'
                }
            })

            await sock.sendMessage(
                m.chat,
                {
                    video: Buffer.from(videoRes.data),
                    mimetype: 'video/mp4',
                    caption,
                },
                { quoted: m }
            )

            m.react('✅')
            return
        }

        if (result.type === 'photo' && result.slides.length > 0) {
            await m.reply(`📸 *Mengirim ${result.slides.length} slide...*`)

            const mediaList = []
            for (let i = 0; i < result.slides.length; i++) {
                const imgUrl = result.slides[i].url
                if (!imgUrl) continue

                try {
                    const res = await axios.get(imgUrl, {
                        responseType: 'arraybuffer',
                        timeout: 30000
                    })
                    mediaList.push({
                        image: Buffer.from(res.data),
                        caption: i === 0 ? caption : ''
                    })
                } catch (e) {
                    console.error(`[TikTok2] Failed to download slide ${i}:`, e.message)
                }
            }

            if (mediaList.length === 0) {
                throw new Error('Gagal mengunduh gambar slide')
            }

            const opener = generateWAMessageFromContent(
                m.chat,
                {
                    messageContextInfo: { messageSecret: crypto.randomBytes(32) },
                    albumMessage: {
                        expectedImageCount: mediaList.length,
                        expectedVideoCount: 0
                    }
                },
                {
                    userJid: jidNormalizedUser(sock.user.id),
                    quoted: m,
                    upload: sock.waUploadToServer
                }
            )

            await sock.relayMessage(opener.key.remoteJid, opener.message, {
                messageId: opener.key.id
            })

            for (const content of mediaList) {
                const msg = await generateWAMessage(
                    opener.key.remoteJid,
                    content,
                    { upload: sock.waUploadToServer }
                )

                msg.message.messageContextInfo = {
                    messageSecret: crypto.randomBytes(32),
                    messageAssociation: {
                        associationType: 1,
                        parentMessageKey: opener.key
                    }
                }

                await sock.relayMessage(msg.key.remoteJid, msg.message, {
                    messageId: msg.key.id
                })
            }

            if (result.mp3.length > 0) {
                await sock.sendMessage(
                    m.chat,
                    {
                        audio: { url: result.mp3[0] },
                        mimetype: 'audio/mpeg'
                    },
                    { quoted: m }
                )
            }

            m.react('✅')
            return
        }

        if (result.mp3.length > 0) {
            m.reply(`🍀 *NOTE*\n> Konten ini tidak memiliki video/slide, mengirim audio saja...`)
            await sock.sendMessage(
                m.chat,
                {
                    audio: { url: result.mp3[0] },
                    mimetype: 'audio/mpeg'
                },
                { quoted: m }
            )
            m.react('✅')
            return
        }

        throw new Error('Tidak ada media yang dapat diunduh')

    } catch (err) {
        console.error('[TikTokDL2] Error:', err)
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── ttimg ──
const _ttimg = (() => {
/**
 * Fitur   : TikTok Slide Downloader
 * Base    : tikwm.com
 * Type    : Plugin ESM
 * Channel : https://whatsapp.com/channel/0029VbAYjQgKrWQulDTYcg2K
 * Creator : Hilman
 */


async function getSlide(url) {
  const res = await fetch(`https://www.tikwm.com/api/?url=${url}&hd=1`)
  const json = await res.json()
  return json?.data
}

let handler = async (m, { text, usedPrefix, command, conn }) => {
  if (!text) {
    return m.reply(`Contoh:\n${usedPrefix + command} https://vt.tiktok.com/xxxx`)
  }

  await m.react('✨')

  try {
    const regex = /(https:\/\/(vt|vm)\.tiktok\.com\/[^\s]+|https:\/\/www\.tiktok\.com\/@[\w.-]+\/video\/\d+)/
    const url = text.match(regex)?.[0]

    if (!url) return m.reply('❌ Link TikTok tidak valid.')

    const data = await getSlide(url)
    if (!data) return m.reply('❌ Gagal mengambil data.')

    const images = data.images || []
    if (!images.length) return m.reply('❌ Post ini bukan slideshow foto.')

    const link = `https://www.tiktok.com/@${data.author.unique_id || 'user'}/video/${data.video_id}`
    const caption =
`✨ *TIKTOK PHOTO*

Judul: ${data.title || '-'}
Uploader: ${data.author.nickname}
Total: ${images.length}
Link: ${link}`

    const slides = images.slice(0, 6)
    for (let i = 0; i < slides.length; i++) {
      await conn.sendMessage(
        m.chat,
        { image: { url: slides[i] }, caption: i === 0 ? caption : '' },
        { quoted: m }
      )
    }

  } catch (e) {
    console.error(e)
    m.reply('❌ Gagal mengambil slide.')
  }
}

handler.help = ['ttimg', 'tiktokimg']
handler.tags = ['downloader']
handler.command = ['ttimg']
handler.limit = true
handler.register = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── ttmp3 ──
const _ttmp3 = (() => {
let ffmpegBin = 'ffmpeg'; // Termux & sejenisnya: pakai ffmpeg sistem kalau binary bawaan tidak ada
try { ffmpegBin = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path || 'ffmpeg' } catch {}
ffmpeg.setFfmpegPath(ffmpegBin);

const pluginConfig = {
  name: ["ttmp3"],
  alias: [],
  category: "download",
  description: "Download audio TikTok",
  usage: ".ttmp3 <url>",
  example: ".ttmp3 https://vt.tiktok.com/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

function getTempDir() {
  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

async function extractAudioFromVideo(videoUrl) {
  const tmpDir = getTempDir();
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const inputFile = path.join(tmpDir, `ttmp3_${stamp}.mp4`);
  const outputFile = path.join(tmpDir, `ttmp3_${stamp}.mp3`);

  const res = await axios.get(videoUrl, {
    responseType: "arraybuffer",
    timeout: 60000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      Referer: "https://www.tiktok.com/",
    },
  });

  fs.writeFileSync(inputFile, Buffer.from(res.data));

  await new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .noVideo()
      .audioCodec("libmp3lame")
      .format("mp3")
      .on("end", resolve)
      .on("error", reject)
      .save(outputFile);
  });

  if (!fs.existsSync(outputFile) || fs.statSync(outputFile).size <= 0) {
    throw new Error("Gagal mengekstrak audio TikTok");
  }

  return {
    buffer: fs.readFileSync(outputFile),
    files: [inputFile, outputFile],
  };
}

async function handler(m, { sock }) {
  const url = m.text?.trim();
  let cleanupFiles = [];

  const cleanupTempFiles = () => {
    for (const file of cleanupFiles) {
      if (!file) continue;
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {}
    }
    cleanupFiles = [];
  };

  if (!url) {
    return m.reply(
      `╭┈┈⬡「 🎵 *ᴛɪᴋᴛᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅ* 」
┃ ㊗ ᴜsᴀɢᴇ: \`${m.prefix}ttmp3 <url>\`
╰┈┈⬡

> Contoh: ${m.prefix}ttmp3 https://vt.tiktok.com/xxx`,
    );
  }

  if (!url.match(/tiktok\.com|vt\.tiktok/i)) {
    return m.reply("❌ URL tidak valid. Gunakan link TikTok.");
  }

  m.react("🕕");

  try {
    const result = await ttdown(url);
    const audioDownload = result.downloads.find((d) => d.type === "mp3");
    let audioSource = audioDownload?.url || null;

    if (!audioSource) {
      const videoDownload =
        result.downloads.find((d) => d.type === "nowatermark_hd") ||
        result.downloads.find((d) => d.type === "nowatermark");

      if (!videoDownload?.url) {
        throw new Error("Audio TikTok tidak ditemukan.");
      }

      const extractedAudio = await extractAudioFromVideo(videoDownload.url);
      cleanupFiles = extractedAudio.files;
      audioSource = extractedAudio.buffer;
    }

    await sock.sendMedia(m.chat, audioSource, null, m, {
      type: "audio",
      mimetype: "audio/mpeg",
      fileName: `TikTok_Audio_${Date.now()}.mp3`,
    });

    m.react("✅");

    // cleanup
    cleanupTempFiles();
  } catch (err) {
    cleanupTempFiles();
    console.error("[TikTokDL] Error:", err);
    m.react("❌");
    m.reply(`❌ *ɢᴀɢᴀʟ ᴍᴇɴɢᴜɴᴅᴜʜ*\n\n> ${err.message}`);
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── ttmusic ──
const _ttmusic = (() => {
async function searchTikTok(query) {
  const { data } = await axios.get(
    'https://tikwm.com/api/feed/search',
    {
      params: {
        keywords: query,
        count: 1
      },
      timeout: 20000
    }
  )

  if (!data || data.code !== 0 || !data.data?.videos?.length) {
    throw 'Hasil tidak ditemukan'
  }

  const v = data.data.videos[0]
  return `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`
}

async function getTikTok(url) {
  const { data } = await axios.get(
    'https://tikwm.com/api/',
    {
      params: { url, hd: 1 },
      timeout: 20000
    }
  )

  if (!data || data.code !== 0) {
    throw 'Gagal mengambil data TikTok'
  }

  return data.data
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  await m.react('🎵')

  const input = m.quoted ? m.quoted.text : text

  if (!input) {
    return m.reply(
      `Contoh:\n` +
      `${usedPrefix + command} https://vt.tiktok.com/xxxx\n` +
      `${usedPrefix + command} kurumi edit`
    )
  }

  try {
    let url = input

    if (!/^https?:\/\//i.test(input)) {
      url = await searchTikTok(input)
    }

    const res = await getTikTok(url)

    if (!res.music) {
      throw 'Audio TikTok tidak ditemukan'
    }

    const title = (res.title || '-').replace(/\s+/g, ' ').trim()
    const uploader = res.author?.nickname || res.author?.unique_id || '-'
    const duration = formatDuration(res.duration)

    const caption = `
— TIKTOK MUSIC —

❀ Judul : ${title.length > 80 ? title.slice(0, 80) + '...' : title}
❀ Uploader : ${uploader}
❀ Durasi : ${duration}
`.trim()

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: res.music },
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`
      },
      { quoted: m }
    )

    await m.reply(caption)
    await m.react('✅')

  } catch (e) {
    await m.react('❌')
    throw String(e)
  }
}

handler.help = ['tiktokmusic', 'ttmusic', 'ttmp3']
handler.tags = ['downloader']
handler.command = ['ttmusic']
handler.limit = true


const __plugin = wrapClassic(handler)
function formatDuration(sec = 0) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

  return __plugin
})()

export default mergePlugins(
    'download',
    _tiktok,
    _tiktokdl,
    _tiktokdl2,
    _ttimg,
    _ttmp3,
    _ttmusic
)
