// ───────── video ─────────
// Gabungan plugin: Xhs, alightmotion, blibili, capcut, capcutdl, cocofundl, dailymotiondl, douyin, douyindl, likeedl, rednotedl, shopeedl, snackvideodl

import axios from 'axios'
import { wrapClassic, config, te, wrapPlugin, mergePlugins } from '../../lib/plugin-engine.js'
import * as cheerio from 'cheerio'
import { exec, execFile } from 'child_process'
import fsp from 'fs/promises'
import { promisify } from 'util'
import { capcut, cocofun, snackvideo } from 'btch-downloader'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { DailymotionDL, likee, RedNoteDL } from '../../lib/scraper.js'
import fetch from 'node-fetch'
import { f } from '../../lib/plugin-engine.js'

// ── Xhs ──
const _Xhs = (() => {
async function redNote(url) {
    try {
        const { data } = await axios.get(url);

        const extractMeta = (pattern) => (data.match(pattern) || [])[1]?.trim() || "";

        const noteId = extractMeta(/<meta\s+name="og:url"\s+content="(.*?)"/i).split('/').pop();
        const nickname = extractMeta(/<meta\s+name="og:title"\s+content="(.*?)"/i).split(" - ")[0];
        const title = extractMeta(/<title>(.*?)<\/title>/i);
        const description = extractMeta(/<meta\s+name="description"\s+content="(.*?)"/i);
        const keywords = extractMeta(/<meta\s+name="keywords"\s+content="(.*?)"/i);
        const duration = extractMeta(/<meta\s+name="og:videotime"\s+content="(.*?)"/i);
        const videoUrl = extractMeta(/<meta\s+name="og:video"\s+content="(.*?)"/i);
        const likes = extractMeta(/<meta\s+name="og:xhs:note_like"\s+content="(.*?)"/i);
        const comments = extractMeta(/<meta\s+name="og:xhs:note_comment"\s+content="(.*?)"/i);
        const collects = extractMeta(/<meta\s+name="og:xhs:note_collect"\s+content="(.*?)"/i);

        const images = [...data.matchAll(/<meta\s+name="og:image"\s+content="(.*?)"/gi)].map((match) => match[1]?.trim());

        return {
            metadata: {
                noteId,
                nickname,
                title,
                description,
                keywords,
                duration,
                likes,
                comments,
                collects,
            },
            media: {
                videoUrl,
                images,
            },
        };
    } catch (err) {
        console.error("Failed to fetch data:", err.message);
        return null;
    }
}

let handler = async (m, { text, conn }) => {
    if (!text) return m.reply("Mana Url Nyah!");

    const result = await redNote(text);
    if (!result) return m.reply("Terkadi Kesalahan Pastikan URL valid!");

    let { media } = result;

    await conn.sendMessage(m.chat, {
        sticker: { url: "https://files.catbox.moe/0ksa1n.webp" }
    }, { quoted: m });

    if (media.videoUrl) {
        await conn.sendMessage(m.chat, {
            video: { url: media.videoUrl }
        });
    } else if (media.images.length > 0) {
        for (let img of media.images) {
            await conn.sendMessage(m.chat, {
                image: { url: img }
            });
        }
    } else {
        m.reply("Terjadi Error");
    }
};

handler.help = ['xhs'];
handler.tags = ['downloader']
handler.command = ['xhs'];
handler.limit = true;


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── alightmotion ──
const _alightmotion = (() => {
const pluginConfig = {
    name: "alightmotiondl",
    alias: [],
    category: "downloader",
    description: "Download project/preset Alight Motion",
    usage: ".alightmotiondl <link>",
    example: ".alightmotiondl https://alight.link/...",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 2,
    isEnabled: true,
};

async function handler(m, { sock, text }) {
    if (!text) {
        let help = `📥 *ALIGHT MOTION DOWNLOADER*\n\n`
        help += `Fitur ini membantumu mengunduh project atau preset dari Alight Motion dengan mudah!\n\n`
        help += `*Cara Penggunaan:*\n`
        help += `- Ketik *${m.prefix}alightmotiondl <link_alight_motion>*\n\n`
        help += `*Contoh:* ${m.prefix}alightmotiondl https://alight.link/xxxxx`
        return m.reply(help);
    }

    await m.react("🕕");

    try {
        const targetUrl = text.trim();

        const apiUrl = `https://kyzznekoo.zone.id/api/alightmotion/download?url=${encodeURIComponent(targetUrl)}`;

        const response = await axios.get(apiUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
                "Content-Type": "application/json"
            },
            data: {},
            timeout: 60000
        });

        const data = response.data;

        if (!data || !data.status || !data.data || !data.data.url) {
            await m.react("❌");
            return m.reply(`Maaf, link Alight Motion tersebut tidak valid atau project sudah dihapus.`);
        }

        const downloadUrl = data.data.url;

        await sock.sendMessage(m.chat, {
            document: { url: downloadUrl },
            mimetype: "application/zip",
            fileName: `AlightMotion_${config.bot.name}.zip`,
            caption: `✅ Berhasil mengunduh preset Alight Motion!`
        }, { quoted: m });

        await m.react("✅");

    } catch (error) {
        console.error("[AMDL Plugin Error]", error);
        await m.react("☢");
        m.reply(te(m.prefix, m.command, m.pushName));
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── blibili ──
const _blibili = (() => {
/*─────────────────────────────────────────────
   📺 Fitur   : Bilibili Downloader
   📦 Tipe    : Plugin ESM
   🔍 Scrape  : https://nekolabs.my.id/code
   👤 Author  : Hilman
──────────────────────────────────────────────*/






const execPromise = promisify(exec)

async function bilibilidl(url, quality = '480P') {
  try {
    let aid = /\/video\/(\d+)/.exec(url)?.[1]
    if (!aid) throw new Error('ID Video tidak ditemukan')

    const appInfo = await axios.get(url).then(res => res.data)
    const $ = cheerio.load(appInfo)
    const title = $('meta[property="og:title"]').attr('content')?.split('|')[0].trim()
    const description = $('meta[property="og:description"]').attr('content')
    const type = $('meta[property="og:video:type"]').attr('content')
    const cover = $('meta[property="og:image"]').attr('content')
    const like = $('.interactive__btn.interactive__like .interactive__text').text()
    const views = $('.bstar-meta__tips-left .bstar-meta-text').first().text().replace(' Ditonton', '')

    const response = await axios.get('https://api.bilibili.tv/intl/gateway/web/playurl', {
      params: {
        's_locale': 'id_ID',
        'platform': 'web',
        'aid': aid,
        'qn': '64',
        'type': '0',
        'device': 'wap',
        'tf': '0',
        'spm_id': 'bstar-web.ugc-video-detail.0.0',
        'from_spm_id': 'bstar-web.homepage.trending.all',
        'fnval': '16',
        'fnver': '0',
      }
    }).then(res => res.data)

    const selectedVideo = response.data.playurl.video.find(v => v.stream_info.desc_words === quality)
    if (!selectedVideo) throw new Error('Video tidak ditemukan dengan kualitas itu')

    const videoUrl = selectedVideo.video_resource.url || selectedVideo.video_resource.backup_url[0]
    const audioUrl = response.data.playurl.audio_resource[0].url || response.data.playurl.audio_resource[0].backup_url[0]

    async function downloadBuffer(url) {
      let buffers = []
      let start = 0
      let end = 5 * 1024 * 1024
      let fileSize = 0

      while (true) {
        const range = `bytes=${start}-${end}`
        const response = await axios.get(url, {
          headers: {
            'DNT': '1',
            'Origin': 'https://www.bilibili.tv',
            'Referer': `https://www.bilibili.tv/video/`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            Range: range
          },
          responseType: 'arraybuffer'
        })

        if (fileSize === 0) {
          const contentRange = response.headers['content-range']
          if (contentRange) fileSize = parseInt(contentRange.split('/')[1])
        }

        buffers.push(Buffer.from(response.data))
        if (end >= fileSize - 1) break

        start = end + 1
        end = Math.min(start + 5 * 1024 * 1024 - 1, fileSize - 1)
      }

      return Buffer.concat(buffers)
    }

    const videoBuffer = await downloadBuffer(videoUrl)
    const audioBuffer = await downloadBuffer(audioUrl)

    const tempVideoPath = 'temp_video.mp4'
    const tempAudioPath = 'temp_audio.mp3'
    const tempOutputPath = 'temp_output.mp4'

    await fsp.writeFile(tempVideoPath, videoBuffer)
    await fsp.writeFile(tempAudioPath, audioBuffer)

    await execPromise(`ffmpeg -i "${tempVideoPath}" -i "${tempAudioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -f mp4 "${tempOutputPath}"`)
    const mergedBuffer = await fsp.readFile(tempOutputPath)

    await Promise.all([
      fsp.unlink(tempVideoPath).catch(() => {}),
      fsp.unlink(tempAudioPath).catch(() => {}),
      fsp.unlink(tempOutputPath).catch(() => {})
    ])

    return { title, description, type, cover, views, like, videoBuffer: mergedBuffer }
  } catch (error) {
    throw new Error(error.message)
  }
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
  if (!args[0]) throw `Contoh: ${usedPrefix + command} https://www.bilibili.tv/video/4793817472438784`

  m.reply('✨ wait...')
  try {
    let result = await bilibilidl(args[0], '480P')
    await conn.sendMessage(m.chat, {
      video: result.videoBuffer,
      caption: `🎬 *${result.title}*\n📝 ${result.description}\n👀 ${result.views} tayangan | ❤️ ${result.like}`
    }, { quoted: m })
  } catch (e) {
    throw `🍬 yahh error: ${e.message}`
  }
}

handler.help = ['bilibili <url>']
handler.tags = ['downloader']
handler.command = ['bilibili']
handler.limit = true
handler.register = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── capcut ──
const _capcut = (() => {
/**
 * Fitur   : CapCut Downloader
 * Base    : capdownloader.com
 * Type    : Plugin ESM
 * Channel : https://whatsapp.com/channel/0029VbAYjQgKrWQulDTYcg2K
 * Creator : Hilman
 */

async function getCapcutVideo(url) {
  const res = await fetch(
    "https://capdownloader.com/wp-json/aio-dl/video-data/",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "origin": "https://capdownloader.com",
        "referer": "https://capdownloader.com/",
        "user-agent": "Mozilla/5.0"
      },
      body: JSON.stringify({ url })
    }
  )

  if (!res.ok) throw "Server tidak merespon"

  const data = await res.json().catch(() => ({}))
  const video = data?.medias?.[0]?.url

  if (!video) throw "Media tidak tersedia"

  return video
}

let handler = async (m, { text, conn }) => {
  if (!text) throw "Masukkan link CapCut"
  if (!/capcut\.com/.test(text)) throw "Link tidak valid"

  await m.react("✨")

  try {
    const videoUrl = await getCapcutVideo(text)

    await conn.sendMessage(
      m.chat,
      { video: { url: videoUrl } },
      { quoted: m }
    )

    await m.react("✅")

  } catch (e) {
    console.log(e)
    await m.react("❌")
    m.reply("Gagal mengambil video")
  }
}

handler.help = ["capcut <link>"]
handler.tags = ["downloader"]
handler.command = ['capcut']
handler.limit = true
handler.register = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── capcutdl ──
const _capcutdl = (() => {
const pluginConfig = {
    name: 'capcutdl',
    alias: [],
    category: 'download',
    description: 'Download video CapCut',
    usage: '.capcutdl <url>',
    example: '.capcutdl https://www.capcut.com/t/xxx',
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
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}capcutdl <url>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}capcutdl https://www.capcut.com/t/xxx\``
        )
    }

    if (!url.match(/capcut\.com/i)) {
        return m.reply(`❌ URL tidak valid. Gunakan link CapCut.`)
    }

    await m.react('🕕')

    try {
        const data = await capcut(url)

        if (!data?.status || !data?.originalVideoUrl) {
            return m.reply(`❌ Gagal mengambil video. Coba link lain.`)
        }

        await sock.sendMedia(m.chat, data.originalVideoUrl, null, m, {
            type: 'video',
            contextInfo: {
                forwardingScore: 99,
                isForwarded: true
            }
        })

    } catch (err) {
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── cocofundl ──
const _cocofundl = (() => {
const pluginConfig = {
    name: 'cocofundl',
    alias: [],
    category: 'download',
    description: 'Download video CocoFun',
    usage: '.cocofundl <url>',
    example: '.cocofundl https://www.cocofun.com/share/post/xxx',
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
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}cocofundl <url>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}cocofundl https://www.cocofun.com/share/post/xxx\``
        )
    }
    
    if (!url.match(/cocofun\.com/i)) {
        return m.reply(`❌ URL tidak valid. Gunakan link CocoFun.`)
    }
    
    await m.react('🕕')
    
    try {
        const data = await cocofun(url)
        
        if (!data?.status || !data?.result) {
            return m.reply(`❌ Gagal mengambil video. Coba link lain.`)
        }
        
        const result = data.result
        const videoUrl = result.no_watermark || result.watermark
        
        if (!videoUrl) {
            return m.reply(`❌ Video tidak ditemukan.`)
        }
        
        await sock.sendMedia(m.chat, videoUrl, null, m, {
            type: 'video',
            contextInfo: {
                forwardingScore: 99,
                isForwarded: true
            }
        })
        
    } catch (err) {
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── dailymotiondl ──
const _dailymotiondl = (() => {
const exec = promisify(execFile);

const pluginConfig = {
  name: "dailymotiondl",
  alias: [],
  category: "download",
  description: "Download video dari Dailymotion",
  usage: ".dailymotiondl <url>",
  example: ".dailymotiondl https://www.dailymotion.com/video/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 2,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = m.text?.trim();
  if (!text) {
    m.react("❌");
    return m.reply(
      `🎬 *Dailymotion Downloader*\n\n` +
        `Download video dari Dailymotion, otomatis dikonversi ke MP4.\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}dailymotiondl <link>*\n\n` +
        `*CONTOH:*\n` +
        `> *${m.prefix}dailymotiondl https://www.dailymotion.com/video/xxx*\n\n` +
        `_Proses konversi mungkin agak lama_`,
    );
  }

  m.react("🕕");

  try {
    const result = await DailymotionDL(text);

    if (!result.status) {
      m.react("☢");
      return m.reply(`❌ *Dailymotion Gagal*\n\n> ${result.error}`);
    }

    let caption =
      `🎬 *Dailymotion*\n\n` +
      `> 📌 ${result.title}\n` +
      `> ⏱️ Durasi: ${result.duration}\n` +
      `> 📺 Kualitas: ${result.quality}`;

    if (result.thumbnail) {
      await sock.sendMedia(m.chat, result.thumbnail, caption, m, {
        type: "image",
      });
    }

    if (result.video) {
      const tmpFile = path.join(os.tmpdir(), `dm_${Date.now()}.mp4`);

      await exec(
        "ffmpeg",
        [
          "-y",
          "-i",
          result.video,
          "-c",
          "copy",
          "-bsf:a",
          "aac_adtstoasc",
          tmpFile,
        ],
        { timeout: 120000 },
      );

      const buffer = fs.readFileSync(tmpFile);
      fs.unlinkSync(tmpFile);

      await sock.sendMessage(
        m.chat,
        {
          document: buffer,
          mimetype: "video/mp4",
          fileName:
            (result.title || "video").replace(/[<>:"/\\|?*]/g, "") + ".mp4",
          caption,
        },
        { quoted: m },
      );
    }

    m.react("✅");
  } catch (e) {
    console.error(e);
    m.react("☢");
    m.reply("❌ Gagal mengambil data Dailymotion, coba lagi nanti");
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── douyin ──
const _douyin = (() => {
// Douyin downloader 
// API : https://api-faa.my.id

let handler = async (m, { conn, args }) => {
  if (!args[0]) {
    return m.reply('Masukkan link Douyin!\n\nContoh:\n.douyin https://v.douyin.com/xxxxx')
  }

  try {
    let url = encodeURIComponent(args[0])
    let api = `https://api-faa.my.id/faa/douyin-down?url=${url}`

    let res = await fetch(api)
    let json = await res.json()

    if (!json.status || !json.result) {
      throw 'Gagal mengambil data Douyin'
    }

    let data = json.result
    let title = data.title || '-'
    let thumbnail = data.thumbnail
    let medias = data.medias || []

    let video = medias.find(v => v.type === 'video')

    if (!video?.url) {
      return m.reply('Video tidak ditemukan')
    }

    let caption = `
✨ *DOUYIN DOWNLOADER*

📌 *Judul:* ${title}
`.trim()

    let thumbBuffer = null
    if (thumbnail) {
      let t = await fetch(thumbnail)
      thumbBuffer = await t.buffer()
    }

    await conn.sendMessage(m.chat, {
      video: { url: video.url },
      caption,
      jpegThumbnail: thumbBuffer
    }, { quoted: m })

  } catch (e) {
    console.error(e)
    m.reply('Terjadi kesalahan saat mengambil video')
  }
}

handler.help = ['douyin <url>']
handler.tags = ['downloader']
handler.command = ['douyin']
handler.limit = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── douyindl ──
const _douyindl = (() => {
const pluginConfig = {
  name: "douyindl",
  alias: [],
  category: "download",
  description: "Download video/audio dari Douyin (TikTok China)",
  usage: ".douyindl <url>",
  example: ".douyindl https://v.douyin.com/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function douyinFetch(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(`https://api.azbry.com/api/downloader/douyin?url=${encodeURIComponent(url)}`, { timeout: 30000 });
      if (res.data?.status && res.data?.result) {
        return res.data;
      }
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error("Gagal mengambil data dari server");
}

async function handler(m, { sock }) {
  const text = m.text?.trim();
  if (!text) {
    m.react("❌");
    return m.reply(
      `🎵 *Douyin Downloader*\n\n` +
        `Download video atau audio dari Douyin (TikTok China).\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}douyindl <link>*\n\n` +
        `*CONTOH:*\n` +
        `> *${m.prefix}douyindl https://v.douyin.com/xxx*`,
    );
  }

  m.react("🕕");

  try {
    const data = await douyinFetch(text);
    const result = data.result;

    let caption = `🎵 *${result.platform || "Douyin"}*\n\n${result.title || ""}`;

    if (result.video) {
      await sock.sendMedia(m.chat, result.video, caption, m, {
        type: "video",
      });
    }

    if (result.audio) {
      await sock.sendMedia(m.chat, result.audio, null, m, {
        type: "audio",
      });
    }

    m.react("✅");
  } catch (e) {
    console.error(e);
    m.react("☢");
    m.reply("❌ Gagal mengambil data Douyin, coba lagi nanti");
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── likeedl ──
const _likeedl = (() => {
const pluginConfig = {
    name: 'likeedl',
    alias: [],
    category: 'download',
    description: 'Download video Likee',
    usage: '.likeedl <url>',
    example: '.likeedl https://likee.video/@xxx',
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
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}likeedl <url>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}likeedl https://likee.video/@xxx\``
        )
    }
    
    if (!url.match(/likee\.(video|com)/i)) {
        return m.reply(`❌ URL tidak valid. Gunakan link Likee.`)
    }
    
    await m.react('🕕')
    
    try {
        const data = await likee(url)
        
        if (!data) {
            return m.reply(`❌ Gagal mengambil video. Coba link lain.`)
        }
        
        const videoUrl = data.without_watermark || data.with_watermark
        
        if (!videoUrl) {
            return m.reply(`❌ Video tidak ditemukan.`)
        }
        
        await sock.sendMedia(m.chat, videoUrl, null, m, {
            type: 'video',
            contextInfo: {
                forwardingScore: 99,
                isForwarded: true
            }
        })
        
        await m.react('✅')
        
    } catch (err) {
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── rednotedl ──
const _rednotedl = (() => {
const pluginConfig = {
  name: "rednotedl",
  alias: [],
  category: "download",
  description: "Download video/foto dari RedNote (XiaoHongShu)",
  usage: ".rednotedl <url>",
  example: ".rednotedl https://www.xiaohongshu.com/xxx",
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
  if (!text) {
    m.react("❌");
    return m.reply(
      `📕 *RedNote Downloader*\n\n` +
        `Download video atau foto dari XiaoHongShu (RedNote).\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}rednotedl <link>*\n\n` +
        `*CONTOH:*\n` +
        `> *${m.prefix}rednotedl https://www.xiaohongshu.com/xxx*`,
    );
  }

  m.react("🕕");

  try {
    const result = await RedNoteDL(text);

    if (!result.status) {
      m.react("☢");
      return m.reply(`❌ *RedNote Gagal*\n\n> ${result.error}`);
    }

    if (result.type === "video" && result.results?.[0]) {
      await sock.sendMedia(m.chat, result.results[0], result.title, m, {
        type: "video",
      });
    } else if (result.results?.length > 0) {
      for (let i = 0; i < Math.min(result.results.length, 5); i++) {
        await sock.sendMedia(m.chat, result.results[i], "", m, {
          type: "image",
        });
      }
      if (result.results.length > 5) {
        await m.reply(
          `_Masih ada ${result.results.length - 5} foto lagi, maksimal 5_`,
        );
      }
    }

    m.react("✅");
  } catch (e) {
    console.error(e);
    m.react("☢");
    m.reply("❌ Gagal mengambil data RedNote, coba lagi nanti");
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── shopeedl ──
const _shopeedl = (() => {
const pluginConfig = {
  name: "shopeedl",
  alias: [],
  category: "download",
  description: "Download video dari Shopee",
  usage: ".shopeedl <url>",
  example: ".shopeedl https://shopee.co.id/universal-link/video/...",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 2,
  isEnabled: true,
};

const BASE_URL = "https://shopeenowatermark.com";

async function extract(url) {
  const form = new FormData();
  form.append("url", url);

  const res = await fetch(`${BASE_URL}/api/extract`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Extraction failed");
  return data;
}

function bestStream(streams) {
  const order = ["V1080P", "V720P", "V540P", "V360P", "V1080P_H265", "V720P_H265", "V540P_H265", "V360P_H265"];
  for (const q of order) {
    const s = streams.find(s => s.quality === q);
    if (s) return s;
  }
  return streams[0];
}

async function handler(m, { sock }) {
  const url = m.args[0] || m.text?.trim();

  if (!url || !url.includes("shopee")) {
    return m.reply("❌ Masukkan link video Shopee yang valid.\n\nContoh: `.shopeedl https://shopee.co.id/...`");
  }

  await m.react("🕕");

  try {
    const data = await extract(url);
    if (!data || !data.streams_array || data.streams_array.length === 0) {
      await m.react("❌");
      return m.reply("⚠️ Gagal mengekstrak video. Pastikan link video Shopee sudah benar dan bersifat publik.");
    }

    const best = bestStream(data.streams_array);
    const videoUrl = best.stream_url;

    let caption = `🛍️ *SHOPEE VIDEO DOWNLOADER* 🛍️\n\n`;
    if (data.username) caption += `*Username:* ${data.username}\n`;
    caption += `*Kualitas:* ${best.quality}\n`;
    caption += `\n> Dibuat oleh bot kesayanganmu`;

    await sock.sendMessage(m.chat, {
      video: { url: videoUrl },
      caption: caption
    }, { quoted: m });

    await m.react("✅");

  } catch (error) {
    console.error("[Shopee DL]", error.message);
    await m.react("☢");
    m.reply("😔 Gagal mengunduh video dari Shopee.");
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── snackvideodl ──
const _snackvideodl = (() => {
const pluginConfig = {
    name: 'snackvideodl',
    alias: [],
    category: 'download',
    description: 'Download video SnackVideo',
    usage: '.snackvideodl <url>',
    example: '.snackvideodl https://www.snackvideo.com/@xxx/video/xxx',
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
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}snackvideodl <url>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}snackvideodl https://www.snackvideo.com/@xxx/video/xxx\``
        )
    }
    
    if (!url.match(/snackvideo\.com/i)) {
        return m.reply(`❌ URL tidak valid. Gunakan link SnackVideo.`)
    }
    
    await m.react('🕕')
    
    try {
        const data = await snackvideo(url)
        
        if (!data?.status || !data?.result?.videoUrl) {
            return m.reply(`❌ Gagal mengambil video. Coba link lain.`)
        }
        
        const result = data.result
        
        await sock.sendMedia(m.chat, result.videoUrl, null, m, {
            type: 'video',
            contextInfo: {
                forwardingScore: 99,
                isForwarded: true
            }
        })
        
    } catch (err) {
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

export default mergePlugins(
    'download',
    _Xhs,
    _alightmotion,
    _blibili,
    _capcut,
    _capcutdl,
    _cocofundl,
    _dailymotiondl,
    _douyin,
    _douyindl,
    _likeedl,
    _rednotedl,
    _shopeedl,
    _snackvideodl,
)
