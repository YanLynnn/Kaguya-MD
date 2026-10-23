// ───────── youtube ─────────
// Gabungan plugin: play, play2, yt5so, yta, ytmp3, ytmp4, yts, ytv

import axios from 'axios'
import yts from 'yt-search'
import { fallbackToMp3Buffer, ytdl } from '../../lib/scraper.js'
import { wrapClassic, wrapPlugin, mergePlugins } from '../../lib/plugin-engine.js'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import { safeJson } from '../../lib/plugin-engine.js'

// ── play ──
const _play = (() => {
async function getAudio(url) {
  try {
    const { data } = await axios.get(
      `https://my.izuka-api.xyz/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
      { timeout: 60000 }
    )

    const download = data?.result?.download_url || data?.result?.download
    if (download) return { download, title: data?.result?.title }
  } catch (e) {
    console.error('[PLAY API]', e.message)
  }

  const fallback = await ytdl(url, 'mp3')
  if (fallback?.status && fallback?.dl) {
    return { download: fallback.dl, title: fallback.title, fallback: true }
  }

  throw new Error(fallback?.mess || 'Gagal mendapatkan audio')
}

async function downloadAudio(url, fallback = false) {
  if (fallback) return fallbackToMp3Buffer(url)

  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: 100 * 1024 * 1024,
    maxBodyLength: 100 * 1024 * 1024,
  })

  const type = String(res.headers['content-type'] || '').toLowerCase()
  if (type.includes('text/html') || type.includes('application/json')) {
    throw new Error('URL download tidak mengembalikan audio')
  }

  return Buffer.from(res.data)
}

let handler = async (m, { conn, usedPrefix, command, text }) => {
  const query = (text || '').trim()

  if (!query) {
    return m.reply(`🎵 *PLAY*\n\nContoh:\n${usedPrefix + command} komang`)
  }

  await m.react('🕐')

  try {
    const search = await yts(query)
    if (!search.videos?.length) throw new Error('Lagu/video tidak ditemukan')

    const video = search.videos[0]
    const result = await getAudio(video.url)
    const audio = await downloadAudio(result.download, result.fallback)

    const caption =
      `🎵 *NOW PLAYING*\n\n` +
      `📌 *Judul:* ${video.title}\n` +
      `👤 *Channel:* ${video.author?.name || '-'}\n` +
      `⏱️ *Durasi:* ${video.timestamp || '-'}\n` +
      `👀 *Views:* ${formatNumber(video.views)}\n` +
      `📅 *Upload:* ${video.ago || '-'}\n\n` +
      `🔗 *YouTube:* ${video.url}`

    // Kirim thumbnail + link YouTube.
    await conn.sendMessage(m.chat, {
      image: { url: video.thumbnail },
      caption
    }, { quoted: m })

    // Lalu kirim audio hasil pencarian.
    await conn.sendMessage(m.chat, {
      audio,
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${video.title.replace(/[\\/:*?"<>|]/g, '_')}.mp3`
    }, { quoted: m })

    await m.react('✅')
  } catch (e) {
    console.error('[PLAY]', e)
    await m.react('❌')
    return m.reply(`❌ *PLAY GAGAL*\n\n${e?.message || 'Gagal mengambil audio.'}`)
  }
}

handler.help = ['play']
handler.tags = ['downloader']
handler.command = ['play']
handler.limit = true


const __plugin = wrapClassic(handler)
function formatNumber(num = 0) {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toString()
}

  return __plugin
})()

// ── play2 ──
const _play2 = (() => {
let handler = async (m, { conn, text, usedPrefix, command }) => {
  await m.react('✨')

  if (!text) {
    return conn.reply(
      m.chat,
      `Example : ${usedPrefix + command} Swim chase atlantic`,
      m
    )
  }

  try {
    let api = `${global.APIs.faa}/faa/ytplay?query=${encodeURIComponent(text)}`
    let res = await fetch(api)
    let json = await res.json()

    if (!json.status) throw 'API error'

    let data = json.result

    await conn.sendMessage(m.chat, {
      audio: { url: data.mp3 },
      mimetype: 'audio/mpeg',
      fileName: `${data.title}.mp3`,
      contextInfo: {
        externalAdReplyOffOffOff: {
          title: data.title,
          body: `${data.author} • ${data.views} views`,
          thumbnailUrl: data.thumbnail,
          sourceUrl: data.url,
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: m })

  } catch (e) {
    console.error(e)
    conn.reply(m.chat, '⚠️ Gagal mengambil audio.', m)
  }
}

handler.help = ['play2 <judul lagu>']
handler.tags = ['downloader']
handler.command = ['play2']
handler.limit = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── yt5so ──
const _yt5so = (() => {
async function yt5sIo(url) {
    try {
        const form = new URLSearchParams();
        form.append("q", url);
        form.append("vt", "home");

        const response = await axios.post('https://yt5s.io/api/ajaxSearch', form, {
            headers: {
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        if (response.data.status === "ok") {
            const $ = cheerio.load(response.data.data);

            if (/^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/.+/i.test(url)) {
                const videoQualities = [];
                $('table tbody tr').each((index, element) => {
                    const quality = $(element).find('.video-quality').text().trim();
                    const downloadLink = $(element).find('a.download-link-fb').attr("href");
                    if (quality && downloadLink) {
                        videoQualities.push({ quality, downloadLink });
                    }
                });

                // Prioritize HD quality, fallback to SD
                const hdVideo = videoQualities.find(v => v.quality.toLowerCase().includes('hd'));
                const sdVideo = videoQualities.find(v => v.quality.toLowerCase().includes('sd'));
                const videoUrl = hdVideo ? hdVideo.downloadLink : sdVideo ? sdVideo.downloadLink : null;

                if (!videoUrl) throw new Error("Tidak ada link download yang tersedia.");
                return { videoUrl };

            } else if (/^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel)\/.+/i.test(url)) {
                const videoUrl = $('a[title="Download Video"]').attr("href");
                if (!videoUrl) throw new Error("Tidak ada link download yang tersedia.");
                return { videoUrl };

            } else {
                throw new Error("URL tidak valid. Harap masukkan URL Facebook atau Instagram.");
            }
        } else {
            throw new Error("Gagal mengambil video: " + response.data.message);
        }
    } catch (error) {
        throw error;
    }
}

const handler = async (m, { conn, text }) => {
    try {
        if (!text) throw "Masukkan URL Facebook Atau Instagram.";

        const result = await yt5sIo(text);

        if (result.videoUrl) {
            await conn.sendMessage(m.chat, { video: { url: result.videoUrl }, mimetype: 'video/mp4' }, { quoted: m });
        } else {
            throw "Gagal Download ";
        }
    } catch (error) {
        await conn.sendMessage(m.chat, { text: `Error: ${error.message || error}` }, { quoted: m });
    }
};

handler.help = ['yt5so <Url Ig/Facebook>']
handler.command = ['yt5so']
handler.tags = ['downloader']
handler.limit = true;


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── yta ──
const _yta = (() => {
/*
fitur: youtube download
cr: alfiXD
*/


let handler = async (m, { conn, usedPrefix, command, args }) => {
    const url = args[0]
    if (!url) {
        return m.reply(`
• ${usedPrefix}ytmp3 <url>
• ${usedPrefix}ytmp4 <url>`)
    }

    const isAudio = command.includes('mp3') || command === 'yta'
    const type = isAudio ? 'audio' : 'merge'
    const apikey = 'nbteam'
    const apiBase = 'https://youtubedl.siputzx.my.id'

        const { data: initialResponse } = await axios.get(`${apiBase}/download`, {
            params: { url, type, apikey }
        })

        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

        let finalData = initialResponse
        let attempts = 0
        const maxAttempts = 20
        while (finalData.status !== 'completed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000))
            const { data: checkData } = await axios.get(`${apiBase}/download`, {
                params: { url, type, apikey }
            })
            finalData = checkData
            attempts++

            if (finalData.status === 'error') throw new Error(finalData.error || 'API Error')
        }

        if (finalData.status !== 'completed') {
            throw new Error('Waktu tunggu habis. Silahkan coba lagi nanti.')
        }

        const downloadUrl = `${apiBase}${finalData.fileUrl}`
        if (isAudio) {
            await conn.sendMessage(m.chat, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mpeg'
            }, { quoted: m })
        } else {
            await conn.sendMessage(m.chat, {
                video: { url: downloadUrl },
                mimetype: 'video/mp4'
            }, { quoted: m })
        }

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
}

handler.help = ['ytmp3', 'ytmp4']
handler.tags = ['downloader']
handler.command = ['yta', 'ytv']
handler.limit = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── ytmp3 ──
const _ytmp3 = (() => {
const pluginConfig = {
  name: "ytmp3",
  alias: [],
  category: "download",
  description: "Download audio YouTube",
  usage: ".ytmp3 <url>",
  example: ".ytmp3 https://youtube.com/watch?v=xxx",
  cooldown: 20,
  energi: 2,
  isEnabled: true,
};

async function getAudioDownload(url) {
  try {
    const { data } = await axios.get(
      `https://my.izuka-api.xyz/api/downloader/ytmp3?url=${encodeURIComponent(url)}`, { timeout: 60000 }
    );
    const download = data?.result?.download_url;
    const title = data?.result?.title;
    if (download) {
      return { download, title };
    }
  } catch {}

  const fallback = await ytdl(url, "mp3");
  if (fallback?.status && fallback?.dl) {
    return { download: fallback.dl, title: fallback.title, isFallback: true };
  }

  throw new Error(fallback?.mess || "Gagal mendapatkan audio download URL");
}

async function handler(m, { sock }) {
  const url = m.text?.trim();
  if (!url)
    return m.reply(`Contoh: ${m.prefix}ytmp3 https://youtube.com/watch?v=xxx`);
  if (!url.includes("youtube.com") && !url.includes("youtu.be"))
    return m.reply("❌ URL harus YouTube");

  m.react("🕕");

  try {
    const result = await getAudioDownload(url);

    if (result.isFallback) {
      const mp3Buffer = await fallbackToMp3Buffer(result.download);
      await sock.sendMessage(
        m.chat,
        {
          audio: mp3Buffer,
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: `${result.title || "audio"}.mp3`,
        },
        { quoted: m },
      );
    } else {
      await sock.sendMedia(m.chat, result.download, null, m, {
        type: "audio",
        mimetype: "audio/mpeg",
        ptt: false,
        fileName: result.title || "audio.mp3",
      });
    }
    m.react("✅");
  } catch (err) {
    console.error("[YTMP3]", err);
    m.react("❌");
    m.reply("Gagal mengunduh audio.");
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── ytmp4 ──
const _ytmp4 = (() => {
const pluginConfig = {
  name: "ytmp4",
  alias: [],
  category: "download",
  description: "Download video YouTube",
  usage: ".ytmp4 <url>",
  example: ".ytmp4 https://youtube.com/watch?v=xxx",
  cooldown: 20,
  energi: 2,
  isEnabled: true,
};


async function getVideoDownloadUrl(url) {
  try {
    const { data } = await axios.get(
      `https://my.izuka-api.xyz/api/downloader/ytmp4?url=${encodeURIComponent(url)}`
    );

    if (data?.status && data?.result?.video_normal) {
      const videos = data.result.video_normal.filter(v => v.ext === "mp4");
      if (videos.length > 0) {
        videos.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
        if (videos[0] && videos[0].url) {
          return videos[0].url;
        }
      }
    }
  } catch (e) {
    console.error("[YTMP4 Izuka API Error]", e.message);
  }

  const fallback = await ytdl(url, "mp4");
  if (fallback?.status && fallback?.dl) {
    return fallback.dl;
  }

  throw new Error(fallback?.mess || "Gagal mendapatkan video download URL");
}

async function handler(m, { sock }) {
  const url = m.text?.trim();
  if (!url)
    return m.reply(`Contoh: ${m.prefix}ytmp4 https://youtube.com/watch?v=xxx`);
  if (!url.includes("youtube.com") && !url.includes("youtu.be"))
    return m.reply("❌ URL harus YouTube");

  m.react("🕕");

  try {
    const downloadUrl = await getVideoDownloadUrl(url);

    await sock.sendMedia(m.chat, downloadUrl, null, m, {
      type: "video",
    });
    m.react("✅");
  } catch (err) {
    console.error("[YTMP4]", err);
    m.react("❌");
    m.reply("Gagal mengunduh video.");
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── yts ──
const _yts = (() => {
let handler = async (m, { text, conn, usedPrefix, command }) => {
  if (!text) throw `Masukkan judul!

Contoh:
${usedPrefix + command} dj 30 detik`

  let search = await yts(text)
  let videos = search.videos.slice(0, 10)

  if (!videos.length) throw 'Video tidak ditemukan.'

  let caption = `✨ *YouTube Search*\n`
  caption += `Query: ${text}\n\n`

  for (let i = 0; i < videos.length; i++) {
    let v = videos[i]
    caption += `*${i + 1}. ${v.title}*\n`
    caption += `⏱ ${v.timestamp} | 🍓 ${v.views.toLocaleString()}\n`
    caption += `📎 ${v.url}\n\n`
  }

  await conn.sendMessage(m.chat, {
    text: caption,
    contextInfo: {
      externalAdReplyOffOffOff: {
        title: "YouTube Search",
        body: text,
        thumbnailUrl: videos[0].thumbnail,
        sourceUrl: videos[0].url,
        mediaType: 1,
        renderLargerThumbnail: true
      }
    }
  }, { quoted: m })
}

handler.help = ['yts', 'youtubesearch']
handler.tags = ['search']
handler.command = ['yts']
handler.limit = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── ytv ──
const _ytv = (() => {
let handler = async (m, { conn, text }) => {

   if (!text) throw `Contoh:\n.playvid dj remix|360\n.ytmp4 dj remix|720`

   await m.reply(global.wait)

   let [query, resolusi] = text.split('|')
   resolusi = resolusi || '360'

   let url = query

   if (!/^https?:\/\//.test(query)) {
      let search = await yts(query)
      let vid = search.videos[0]
      if (!vid) throw 'Video tidak ditemukan'
      url = vid.url
   }

   let api = `https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(url)}&resolusi=${resolusi}`

   let res = await fetch(api)
   let json = await safeJson(res, { status: false })

   if (!json.status) throw 'Gagal mengambil video'

   let data = json.result

   let caption = `🍉 *${data.title}*
🍓 Durasi: ${data.duration}s
🍊 Resolusi: ${data.resolusi}p
🍹 Nih videonya wok~`

   await conn.sendMessage(m.chat, {
      video: { url: data.url },
      caption
   }, { quoted: m })
}

handler.help = ['playvid', 'ytmp4']
handler.tags = ['downloader']
handler.command = ['playvid']
handler.limit = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

export default mergePlugins(
    'download',
    _play,
    _play2,
    _yt5so,
    _yta,
    _ytmp3,
    _ytmp4,
    _yts,
    _ytv
)
