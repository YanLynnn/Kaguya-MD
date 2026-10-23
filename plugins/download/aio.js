// ───────── aio ─────────
// Gabungan plugin: aio, aio2

import { aiodl } from '../../lib/scraper.js'
import { te, saluranCtx, wrapPlugin, wrapClassic, mergePlugins } from '../../lib/plugin-engine.js'
import fetch from 'node-fetch'

// ── aio ──
const _aio = (() => {
const pluginConfig = {
  name: "aio",
  alias: [],
  category: "downloader",
  description:
    "All in one downloader (IG, TikTok, FB, Twitter, YouTube, Pinterest, CapCut, dll)",
  usage: ".aio <url>",
  example: ".aio https://instagram.com/p/xxx",
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
      `📥 *ᴀʟʟ ɪɴ ᴏɴᴇ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n\n` +
        `> Download dari berbagai platform!\n\n` +
        `╭┈┈⬡「 🌐 *ᴘʟᴀᴛꜰᴏʀᴍ* 」\n` +
        `┃ • Instagram\n` +
        `┃ • TikTok\n` +
        `┃ • Facebook\n` +
        `┃ • Twitter/X\n` +
        `┃ • YouTube\n` +
        `┃ • Pinterest\n` +
        `┃ • CapCut\n` +
        `┃ • Threads / Reddit\n` +
        `╰┈┈┈┈┈┈┈┈⬡\n\n` +
        `> *Contoh:* ${m.prefix}aio https://instagram.com/p/xxx`,
    );
  }

  if (!url.startsWith("http")) {
    return m.reply(`❌ URL tidak valid! Harus dimulai dengan http/https`);
  }

  await m.react("🕕");

  try {
    const result = await aiodl(url);

    if (!result?.media?.length) {
      await m.react("❌");
      return m.reply(`❌ Gagal mengambil media. Pastikan URL valid.`);
    }

    const ctxInfo = saluranCtx();

    for (const item of result.media) {
      if (item.type === "video") {
        await sock.sendMedia(m.chat, item.url, result.title || null, m, {
          type: "video",
          contextInfo: ctxInfo,
        });
      } else if (item.type === "audio") {
        await sock.sendMessage(
          m.chat,
          {
            audio: { url: item.url },
            mimetype: "audio/mpeg",
            contextInfo: ctxInfo,
          },
          { quoted: m },
        );
      } else {
        await sock.sendMedia(m.chat, item.url, result.title || null, m, {
          type: "image",
          contextInfo: ctxInfo,
        });
      }
      break;
    }

    await m.react("✅");
  } catch (error) {
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── aio2 ──
const _aio2 = (() => {
let handler = async (m, { conn, text, usedPrefix, command }) => {
  await m.react('✨')

  if (!text) {
    return conn.reply(
      m.chat,
      `Example : ${usedPrefix + command} https://vt.tiktok.com/xxxx`,
      m
    )
  }

  try {
    let api = `${global.APIs.faa}/faa/aio?url=${encodeURIComponent(text)}`
    let res = await fetch(api)
    let json = await res.json()

    if (!json.status) throw 'Gagal mengambil data.'

    let data = json.result
    let videoUrl = data.download_url

    await conn.sendMessage(m.chat, {
      video: { url: videoUrl },
      caption: data.title || 'Video berhasil diunduh'
    }, { quoted: m })

  } catch (e) {
    console.error(e)
    conn.reply(m.chat, '⚠️ Gagal mengambil video.', m)
  }
}

handler.help = ['aio2 <url>']
handler.tags = ['downloader']
handler.command = ['aio2']
handler.limit = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

export default mergePlugins(
    'download',
    _aio,
    _aio2
)
