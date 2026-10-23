// ───────── social ─────────
// Gabungan plugin: facebook, facebookdl, pindl, pindl2, threaddl, twitter

import axios from 'axios'
import { wrapClassic, te, wrapPlugin, mergePlugins } from '../../lib/plugin-engine.js'
import { fbdown } from '../../lib/scraper.js'
import fs from 'fs'
import path from 'path'
import { queueFFmpeg, f } from '../../lib/plugin-engine.js'
import * as cheerio from 'cheerio'
import he from 'he'

// ── facebook ──
const _facebook = (() => {
/* 
Downloader Facebook
Source Scrape : https://whatsapp.com/channel/0029VbBJKfE0gcfCAJZEVh3R/125
*/


async function getToken() {
  const url = "https://fbdownloader.to/id";
  const { data: html } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    }
  });

  const regex = /k_exp="(.*?)".*?k_token="(.*?)"/s;
  const match = html.match(regex);
  if (!match) throw new Error("Token tidak ditemukan");

  return {
    k_exp: match[1],
    k_token: match[2]
  };
}

async function fbDownloader(fbUrl) {
  const { k_exp, k_token } = await getToken();

  const payload = new URLSearchParams({
    k_exp,
    k_token,
    p: "home",
    q: fbUrl,
    lang: "id",
    v: "v2",
    W: ""
  });

  const { data } = await axios.post("https://fbdownloader.to/api/ajaxSearch", payload, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0",
      "X-Requested-With": "XMLHttpRequest",
      "Origin": "https://fbdownloader.to",
      "Referer": "https://fbdownloader.to/id"
    }
  });

  if (!data || !data.data) throw new Error("Gagal mengambil data video");

  const html = data.data;
  const results = [];

  const rowRegex = /<td class="video-quality">(.*?)<\/td>[\s\S]*?(?:href="(.*?)"|data-videourl="(.*?)")/g;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const quality = match[1].trim();
    const url = match[2] || match[3];
    if (quality && url) results.push({ quality, url });
  }

  return results;
}

let handler = async (m, { conn, text }) => {
  if (!text) return m.reply("Masukkan link Facebook terlebih dahulu, contoh:\n.fb https://facebook.com/...");

  try {
    const results = await fbDownloader(text);
    if (!results.length) return m.reply("❌ Tidak ada video ditemukan.");

    const videoUrl = results[0].url;

    const { data: buffer } = await axios.get(videoUrl, { responseType: 'arraybuffer' });

    await conn.sendMessage(m.chat, { video: buffer, caption: `📥 Download dari Facebook\nKualitas: ${results[0].quality}` }, { quoted: m });
  } catch (e) {
    m.reply("❌ Gagal mengunduh video: " + e.message);
  }
};

handler.help = ['facebook <link>'];
handler.tags = ['downloader'];
handler.command = ['facebook']
handler.limit = true;

const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── facebookdl ──
const _facebookdl = (() => {
const pluginConfig = {
    name: 'facebookdl',
    alias: [],
    category: 'download',
    description: 'Download video Facebook',
    usage: '.facebookdl <url>',
    example: '.facebookdl https://www.facebook.com/watch?v=xxx',
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
            `⚠️ *CARA PAKAI*\n\n` +
            `- \`${m.prefix}facebookdl <url>\`\n\n` +
            `*Contoh:*\n` +
            `- \`${m.prefix}facebookdl https://www.facebook.com/watch?v=xxx\``
        )
    }
    
    if (!url.match(/facebook\.com|fb\.watch|fb\.com/i)) {
        return m.reply(`❌ URL tidak valid. Gunakan link Facebook.`)
    }
    
    await m.react('🕕')
    
    try {
        const data = await fbdown(url)
        
        if (!data?.status || !data.result || !data.result.medias || data.result.medias.length === 0) {
            await m.react('❌')
            return m.reply(`❌ Gagal mengambil video. Coba link lain atau pastikan postingan bersifat publik.\n\n_Catatan: Sistem saat ini belum mendukung download foto Facebook, hanya video._`)
        }
        
        // Find HD if available, else SD, else first item
        let video = data.result.medias.find(m => m.quality === "hd") || 
                    data.result.medias.find(m => m.quality === "sd") || 
                    data.result.medias[0];
        
        if (!video || !video.url) {
            await m.react('❌')
            return m.reply(`❌ Video tidak ditemukan di link tersebut.\n\n_Catatan: Sistem saat ini belum mendukung download foto Facebook, hanya video._`)
        }
        
        let caption = `🎥 *FACEBOOK DOWNLOADER*\n\n`
        caption += `*Judul:* ${data.result.title || "Video Facebook"}\n`
        caption += `*Kualitas:* ${video.quality ? video.quality.toUpperCase() : "Normal"}\n`
        if (video.formattedSize) {
            caption += `*Ukuran:* ${video.formattedSize}\n`
        }
        caption += `\n_Catatan: Fitur ini tidak mensupport postingan foto._`

        await sock.sendMedia(m.chat, video.url, caption, m, {
            type: 'video',
            contextInfo: {
                forwardingScore: 99,
                isForwarded: true
            }
        })
        
        await m.react('✅')
    } catch (err) {
        await m.react('❌')
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── pindl ──
const _pindl = (() => {
const pluginConfig = {
  name: "pindl",
  alias: [],
  category: "download",
  description: "Download gambar/video dari Pinterest",
  usage: ".pindl <url>",
  example: ".pindl https://pin.it/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};
async function handler(m, { sock }) {
  const url = m.text?.trim();
  if (!url) {
    return m.reply(
      `📌 *ᴘɪɴᴛᴇʀᴇsᴛ ᴅᴏᴡɴʟᴏᴀᴅ*\n\n` +
        `> Download gambar/video dari Pinterest\n\n` +
        `*ᴄᴏɴᴛᴏʜ:*\n` +
        `> \`${m.prefix}pindl https://pin.it/xxx\`\n` +
        `> \`${m.prefix}pindl https://pinterest.com/pin/xxx\``,
    );
  }
  if (!url.includes("pinterest") && !url.includes("pin.it")) {
    return m.reply("❌ URL tidak valid. Gunakan link Pinterest.");
  }
  m.react("🕕");
  try {
    const res = await axios.get(`https://api.azbry.com/api/download/pinterest?url=${encodeURIComponent(url)}`);
    if (!res.data || !res.data.status || !res.data.result) {
      throw new Error("Gagal mengambil data dari API Pinterest.");
    }

    const data = res.data.result;
    const mediaList = [];

    if (data.type === 'video') {
        const vidUrl = data.videos?.[0]?.url || data.download;
        if (vidUrl) mediaList.push({ type: 'video', url: vidUrl });
    }

    if (data.images && data.images.length > 0) {
        const orig = data.images.find(img => img.name === 'orig') || data.images[data.images.length - 1];
        if (orig && orig.url) mediaList.push({ type: 'image', url: orig.url });
    } else if (data.type === 'image' && data.download) {
        mediaList.push({ type: 'image', url: data.download });
    }

    if (mediaList.length === 0) {
      throw new Error("Tidak ada media ditemukan");
    }

    for (const media of mediaList) {
      if (media.type === "video") {
        let masterUrl = media.url;
        if (masterUrl.includes('.mp4')) {
            masterUrl = masterUrl.replace(/720p|480p|360p|240p/g, 'hls').replace('.mp4', '.m3u8');
        }

        const tempDir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const timestamp = Date.now();
        const videoTemp = path.join(tempDir, `${timestamp}_v.mp4`);
        const audioTemp = path.join(tempDir, `${timestamp}_a.mp4`);
        const outputFile = path.join(tempDir, `${timestamp}_final.mp4`);

        try {
            const resHls = await axios.get(masterUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.pinterest.com/'
                }
            });
            const text = resHls.data;
            const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

            const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
            let videoStreamUrl = null;
            let audioStreamUrl = null;
            let lastBandwidth = 0;

            for (let i = 0; i < lines.length; i++) {
              if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
                const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
                const bw = bwMatch ? parseInt(bwMatch[1]) : 0;
                if (bw > lastBandwidth) {
                  lastBandwidth = bw;
                  const u = lines[i + 1];
                  videoStreamUrl = u?.startsWith("http") ? u : baseUrl + u;
                }
              }
              if (lines[i].startsWith("#EXT-X-MEDIA") && lines[i].includes("TYPE=AUDIO")) {
                const mUrl = lines[i].match(/URI="([^"]+)"/);
                if (mUrl) audioStreamUrl = mUrl[1].startsWith("http") ? mUrl[1] : baseUrl + mUrl[1];
              }
            }

            const ffmpegHdr = `-user_agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -headers "Referer: https://www.pinterest.com/"`;

            if (!videoStreamUrl) {
                await queueFFmpeg(`ffmpeg -y ${ffmpegHdr} -i "${masterUrl}" -c copy "${outputFile}"`);
            } else {
                await queueFFmpeg(`ffmpeg -y ${ffmpegHdr} -i "${videoStreamUrl}" -c copy "${videoTemp}"`);
                if (audioStreamUrl) {
                    await queueFFmpeg(`ffmpeg -y ${ffmpegHdr} -i "${audioStreamUrl}" -c copy "${audioTemp}"`);
                    await queueFFmpeg(`ffmpeg -y -i "${videoTemp}" -i "${audioTemp}" -c copy "${outputFile}"`);
                } else {
                    fs.renameSync(videoTemp, outputFile);
                }
            }
            
            await sock.sendMedia(m.chat, fs.readFileSync(outputFile), null, m, {
                type: "video",
                contextInfo: { forwardingScore: 99, isForwarded: true }
            });

        } catch (err) {
            console.error("[PinDL HLS Error]:", err.message);
            try {
                // Fallback: Pinterest memblokir generic axios (403), jadi download manual pakai User-Agent
                const fallbackBuffer = await axios.get(media.url, { 
                    responseType: 'arraybuffer',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://www.pinterest.com/'
                    }
                });
                await sock.sendMedia(m.chat, Buffer.from(fallbackBuffer.data), null, m, {
                  type: "video",
                  contextInfo: { forwardingScore: 99, isForwarded: true },
                });
            } catch (fallbackErr) {
                console.error("[PinDL Fallback Error]:", fallbackErr.message);
            }
        } finally {
            if (fs.existsSync(videoTemp)) fs.unlinkSync(videoTemp);
            if (fs.existsSync(audioTemp)) fs.unlinkSync(audioTemp);
            if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        }
      } else if (media.type === "image") {
        if (media.url.includes("gif")) {
          const tempPath = path.join(process.cwd(), "temp");
          if (!fs.existsSync(tempPath))
            fs.mkdirSync(tempPath, { recursive: true });
          const id = Date.now();
          const gifPath = path.join(tempPath, `pin-${id}.gif`);
          const mp4Path = path.join(tempPath, `pin-${id}.mp4`);
          try {
            const raw = await f(media.url, "buffer");
            if (!raw) throw new Error("Gagal download GIF");
            fs.writeFileSync(gifPath, raw);
            await queueFFmpeg(
              `ffmpeg -y -ignore_loop 0 -i "${gifPath}" -t 30 -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags faststart -preset ultrafast -an "${mp4Path}"`,
            );
            if (!fs.existsSync(mp4Path)) throw new Error("Gagal convert GIF");
            await sock.sendMedia(m.chat, fs.readFileSync(mp4Path), null, m, {
              type: "video",
              gifPlayback: true,
              contextInfo: {
                forwardingScore: 99,
                isForwarded: true,
              },
            });
          } catch (gifErr) {
            console.error("[PinDL] GIF convert error:", gifErr.message);
            await sock.sendMedia(m.chat, media.url, null, m, {
              type: "image",
              contextInfo: { forwardingScore: 99, isForwarded: true },
            });
          } finally {
            if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
            if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);
          }
        } else {
          await sock.sendMedia(m.chat, media.url, null, m, {
            type: "image",
            contextInfo: {
              forwardingScore: 99,
              isForwarded: true,
            },
          });
        }
      }
    }
    m.react("✅");
  } catch (error) {
    console.error("[PinDL] Error:", error);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── pindl2 ──
const _pindl2 = (() => {
let handler = async (m, { conn, args }) => {
  try {
    if (!args[0]) return m.reply('Mana link Pinnya?')
    let pinterestUrl = args[0]
    
    let { csrfToken, cookies } = await getSnappinToken()
    let { data } = await axios.post('https://snappin.app/', { url: pinterestUrl }, {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        Cookie: cookies,
        Referer: 'https://snappin.app',
        Origin: 'https://snappin.app',
        'User-Agent': 'Mozilla/5.0'
      }
    })

    let $ = cheerio.load(data)
    let downloadLinks = $('a.button.is-success').map((_, el) => $(el).attr('href')).get()

    let mediaUrl = null
    for (let link of downloadLinks) {
      let fullLink = link.startsWith('http') ? link : 'https://snappin.app' + link
      let head = await axios.head(fullLink).catch(() => null)
      let contentType = head?.headers?.['content-type'] || ''
      
      if (contentType.includes('video')) {
        mediaUrl = { url: fullLink, type: 'video' }
        break
      } else if (contentType.includes('image')) {
        mediaUrl = { url: fullLink, type: 'image' }
      }
    }

    if (mediaUrl.type === 'video') {
      await conn.sendMessage(m.chat, { video: { url: mediaUrl.url } }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, { image: { url: mediaUrl.url } }, { quoted: m })
    }
  } catch (e) {
    m.reply(e.message)
  }
}

async function getSnappinToken() {
  let { headers, data } = await axios.get('https://snappin.app/')
  let cookies = headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
  let $ = cheerio.load(data)
  let csrfToken = $('meta[name="csrf-token"]').attr('content')
  return { csrfToken, cookies }
}

handler.help = ['pindl2']
handler.command = ['pindl2']
handler.tags = ['downloader']
handler.limit = true;


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── threaddl ──
const _threaddl = (() => {
const BASE_URL = "https://workers-playground-cool-wood-c008.accoutydusra.workers.dev";

function cleanText(text) {
  return he.decode(String(text || "")).replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function uniqueByUrl(list = []) {
  const seen = new Set();
  const result = [];
  for (const item of list) {
    if (!item?.url || seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }
  return result;
}

function normalizeResult(data = {}) {
  const result = [];
  
  const videoQualities = uniqueByUrl(data.video?.qualities || []);
  for (const item of videoQualities) {
    result.push({
      Type: "video",
      Quality: item.quality || null,
      Result_url: item.url
    });
  }
  
  const images = uniqueByUrl(data.images?.urls || []);
  for (const item of images) {
    result.push({
      Type: "image",
      Result_url: item.url
    });
  }
  
  return result;
}

const pluginConfig = {
  name: "threaddl",
  alias: [],
  category: "download",
  description: "Download foto dan video dari postingan Threads tanpa repot!",
  usage: ".threaddl <url>",
  example: ".threaddl https://www.threads.net/@xxx/post/xxx",
  cooldown: 10,
  energi: 1,
  isEnabled: true
};

async function handler(m, { sock }) {
  const url = m.text?.trim();
  
  if (!url || !/threads/i.test(url)) {
    return m.reply("❌ *Waduh, Link Threads-nya mana nih?*\n\nKamu harus memasukkan tautan (link) dari postingan Threads yang ingin diunduh. Pastikan linknya benar ya! \n\nContoh: `.threaddl https://www.threads.net/@zuck/post/xxx`");
  }

  await m.react("🕕");

  try {
    const res = await axios.get(BASE_URL, {
      timeout: 60000,
      validateStatus: () => true,
      params: { url: url, action: "info" },
      headers: {
        "sec-ch-ua-platform": `"Android"`,
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
        "accept": "application/json",
        "sec-ch-ua": `"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"`,
        "content-type": "application/json",
        "sec-ch-ua-mobile": "?1",
        "origin": "https://threadsvid.com",
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "referer": "https://threadsvid.com/",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "priority": "u=1, i"
      }
    });

    const data = res.data || {};
    const info = data.data || {};
    const result = normalizeResult(info);

    if (res.status >= 300 || data.success !== true || result.length === 0) {
      await m.react("❌");
      return m.reply(`⚠️ *Aduh, gagal mengambil data dari Threads!*\n\nMungkin postingan ini bersifat privat, sudah dihapus, atau link yang kamu berikan kurang tepat.\n\nAlasan sistem: ${data.message || data.error || "Tidak diketahui"}`);
    }

    const captionText = `✨ *THREADS DOWNLOADER* ✨

Halo! Ini hasil unduhan Threads yang kamu minta:

👤 *Pembuat*: ${info.author || "Unknown"}
📝 *Teks Postingan*: ${cleanText(info.title) || cleanText(info.description) || "Tidak ada deskripsi."}
📊 *Jumlah File Media*: ${result.length} file

*Semoga bermanfaat ya!* Jangan lupa mampir lagi kalau mau download yang lain. 🚀`;

    const mediaList = [];
    for (const item of result) {
      if (item.Type === "image") {
        mediaList.push({ image: { url: item.Result_url } });
      } else if (item.Type === "video") {
        mediaList.push({ video: { url: item.Result_url } });
      }
    }

    if (mediaList.length > 1) {
      await sock.sendMessage(m.chat, { text: captionText }, { quoted: m });
      for (const media of mediaList) {
        await sock.sendMessage(m.chat, media, { quoted: m });
      }
    } else if (mediaList.length === 1) {
      const media = mediaList[0];
      media.caption = captionText;
      await sock.sendMessage(m.chat, media, { quoted: m });
    }

    await m.react("✅");

  } catch (err) {
    console.error("[ThreadsDL]", err.message);
    await m.react("☢");
    m.reply("😔 *Sepertinya ada gangguan di sistemku.* \n\nTerjadi kesalahan fatal saat mencoba memproses link Threads tersebut. Silakan coba lagi nanti ya!");
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── twitter ──
const _twitter = (() => {
/**
 ╔══════════════════════
      ⧉  [Twitter] — [downloader]
╚══════════════════════

  ✺ Type     : Plugin ESM
  ✺ Source   : https://whatsapp.com/channel/0029VbAXhS26WaKugBLx4E05
  ✺ Creator  : SXZnightmare
  ✺ Scrape      : 
  [ https://gist.github.com/ZenzzXD/d6223d6e9ead8f013be12c75754c00e9 ]
  [ https://whatsapp.com/channel/0029Vap84RE8KMqfYnd0V41A/3420 ]
  ✺ Scrape Maker : [ Zenz ]
  ✺ Note    : Only Video download
*/

let handler = async (m, { conn, text, usedPrefix, command }) => {
    try {
        if (!text) {
            return m.reply(`*Contoh: ${usedPrefix + command} https://x.com/...*`);
        }

        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

        const body = new URLSearchParams({
            q: text,
            lang: 'id',
            cftoken: ''
        });

        const res = await fetch('https://savetwitter.net/api/ajaxSearch', {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://savetwitter.net',
                'Referer': 'https://savetwitter.net/id3'
            },
            body
        });

        const json = await res.json();
        const html = json?.data;

        if (!html) {
            return m.reply('*Gagal mengambil data video 🍂*');
        }

        const title = html.match(/<h3>(.*?)<\/h3>/)?.[1]?.trim() || 'Twitter Video';
        const duration = html.match(/<p>(\d+:\d+)<\/p>/)?.[1] || '-';
        const thumbnail = html.match(/<img src="([^"]+)"/)?.[1];

        const mp4 = [...html.matchAll(/href="(https:\/\/dl\.snapcdn\.app\/get\?token=[^"]+)".*?MP4\s*\(([^)]+)\)/g)]
            .map(v => ({
                quality: v[2],
                url: v[1]
            }));

        if (!mp4.length) {
            return m.reply('*Video tidak ditemukan 🍂*');
        }

        const best = mp4[0];

        let caption = `*🐦 Twitter Downloader*\n\n`;
        caption += `*📌 Judul:* ${title}\n`;
        caption += `*⏱️ Durasi:* ${duration}\n`;
        caption += `*🎞️ Kualitas:* ${best.quality}\n`;

        await conn.sendMessage(
            m.chat,
            {
                video: { url: best.url },
                caption,
                jpegThumbnail: thumbnail ? await (await fetch(thumbnail)).arrayBuffer() : null
            },
            { quoted: m }
        );

    } catch (e) {
        await m.reply(`*Terjadi kesalahan saat memproses video 🍂*\n\n${e.message}`);
    } finally {
        await conn.sendMessage(m.chat, { react: { text: '', key: m.key } });
    }
};

handler.help = ['twitter'];
handler.tags = ['downloader'];
handler.command = ['twitter'];
handler.limit = true;
handler.register = false; // true kan jika ada fitur register atau daftar di bot mu.


const __plugin = wrapClassic(handler)

  return __plugin
})()

export default mergePlugins(
    'download',
    _facebook,
    _facebookdl,
    _pindl,
    _pindl2,
    _threaddl,
    _twitter
)
