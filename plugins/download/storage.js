// ───────── storage ─────────
// Gabungan plugin: gdrive, githubdl, gitclone, googledrive, mediafire, mediafiredl, sfile, terabox

import { wrapPlugin, te, wrapClassic, mergePlugins } from '../../lib/plugin-engine.js'
import { createRequire } from 'node:module'
import path from 'path'
import fs, { writeFileSync } from 'fs'
import axios from 'axios'
import os, { tmpdir } from 'os'
import * as cheerio from 'cheerio'
import { mediafire, TeraBoxDL } from '../../lib/scraper.js'

import { sfileSearch, sfileDownload } from '../../lib/scraper.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
// ── gdrive ──
const _gdrive = (() => {
const require = createRequire(import.meta.url);
const axios = require('axios')
const pluginConfig = {
    name: 'gdrive',
    alias: [],
    category: 'download',
    description: 'Download file dari Google Drive',
    usage: '.gdrive <url>',
    example: '.gdrive https://drive.google.com/file/d/xxx/view',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B'
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i]
}

async function drive(url) {
    let id
    let res = { error: true }
    
    if (!url || !url.match(/drive\.google/i)) return res
    
    try {
        id = (url.match(/\/?id=(.+)/i) || url.match(/\/d\/(.*?)\//))[1]
        if (!id) throw new Error("ID Not Found")
        
        const response = await axios.post(
            `https://drive.google.com/uc?id=${id}&authuser=0&export=download`,
            {},
            {
                headers: {
                    'accept-encoding': 'gzip, deflate, br',
                    'content-length': 0,
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    'origin': 'https://drive.google.com',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36',
                    'x-client-data': 'CKG1yQEIkbbJAQiitskBCMS2yQEIqZ3KAQioo8oBGLeYygE=',
                    'x-drive-first-party': 'DriveWebUi',
                    'x-json-requested': 'true'
                }
            }
        )
        
        const data = JSON.parse(response.data.slice(4))
        const { fileName, sizeBytes, downloadUrl } = data
        
        if (!downloadUrl) throw new Error("Link Download Limit!")
        
        return {
            downloadUrl: downloadUrl,
            fileName: fileName,
            fileSize: formatSize(sizeBytes),
            mimetype: 'application/octet-stream'
        }
        
    } catch (e) {
        console.error('[Drive] Error:', e.message)
        return res
    }
}

async function handler(m, { sock }) {
    const url = m.text?.trim() || m.args[0]
    
    if (!url) {
        return m.reply(
            `💕 *ɢᴏᴏɢʟᴇ ᴅʀɪᴠᴇ* 💕\n\n` +
            `╭━━━━━━━━━━━━━━━━━━━━━⬣\n` +
            `┃ ✦ *Cara Pakai*\n` +
            `┃\n` +
            `┃   ${m.prefix}gdrive <url>\n` +
            `┃\n` +
            `┃ ✦ *Contoh*\n` +
            `┃\n` +
            `┃   ${m.prefix}gdrive https://drive.google.com/file/d/xxx/view\n` +
            `┃\n` +
            `┃ 💗 *${global.namebot || 'Bot'}:* Mau download file dari Google Drive apa darling~?\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━⬣`
        )
    }
    
    if (!url.match(/drive\.google/i)) {
        return m.reply(
            `💔 *ᴇʀʀᴏʀ*\n\n` +
            `> URL tidak valid. Kirim link Google Drive yang bener darling~ 🥺`
        )
    }
    
    m.react('💕')
    await m.reply(`⏳ *ᴘʀᴏᴄᴇꜱꜱɪɴɢ...*\n\n💗 *${global.namebot || 'Bot'}:* Lagi mengambil file dari Google Drive darling~ tunggu sebentar yaa 📁`)
    
    try {
        const data = await drive(url)
        
        if (data.error || !data.downloadUrl) {
            m.react('💔')
            return m.reply(
                `💔 *ɢᴀɢᴀʟ*\n\n` +
                `> File tidak dapat diakses atau link limit darling~ 🥺`
            )
        }
        
        await sock.sendMessage(m.chat, {
            document: { url: data.downloadUrl },
            fileName: data.fileName,
            mimetype: data.mimetype,
            caption: `💕 *ɢᴏᴏɢʟᴇ ᴅʀɪᴠᴇ* 💕\n\n` +
                    `╭━━━━━━━━━━━━━━━━━━━━━⬣\n` +
                    `┃ 📄 *ɴᴀᴍᴀ*: ${data.fileName}\n` +
                    `┃ 📦 *ᴜᴋᴜʀᴀɴ*: ${data.fileSize}\n` +
                    `┃\n` +
                    `┃ 💗 *${global.namebot || 'Bot'}:* Ini file nya darling~ 📂\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━⬣`
        }, { quoted: m })
        
        m.react('✅')
        
    } catch (err) {
        console.error('[GDrive] Error:', err)
        m.react('💔')
        return m.reply(
            `💔 *ᴇʀʀᴏʀ*\n\n` +
            `> ${err.message}\n\n` +
            `> Coba lagi ya darling~ 🥺`
        )
    }
}

const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── githubdl ──
const _githubdl = (() => {
const pluginConfig = {
    name: 'githubdl',
    alias: [],
    category: 'download',
    description: 'Download repository GitHub sebagai ZIP',
    usage: '.githubdl <user> <repo> <branch>',
    example: '.githubdl niceplugin NiceBot main',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const args = m.args || []
    let username, repo, branch
    
    if (args[0]?.includes('github.com')) {
        const urlMatch = args[0].match(/github\.com\/([^\/]+)\/([^\/]+)/i)
        if (urlMatch) {
            username = urlMatch[1]
            repo = urlMatch[2].replace(/\.git$/, '')
            branch = args[1] || 'main'
        }
    } else {
        username = args[0]
        repo = args[1]
        branch = args[2] || 'main'
    }
    
    if (!username) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}githubdl <user> <repo> <branch>\`\n\n` +
            `> Contoh:\n` +
            `> \`${m.prefix}githubdl niceplugin NiceBot main\`\n` +
            `> \`${m.prefix}githubdl https://github.com/user/repo\``
        )
    }
    
    if (!repo) {
        return m.reply(`❌ *ʀᴇᴘᴏ ᴅɪʙᴜᴛᴜʜᴋᴀɴ*\n\n> Masukkan nama repository`)
    }
    
    await m.react('🕕')

    try {
        const repoInfo = await fetch(`https://api.github.com/repos/${username}/${repo}`)
        
        if (!repoInfo.ok) {
            await m.react('❌')
            return m.reply(`❌ *ʀᴇᴘᴏ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n> \`${username}/${repo}\` tidak ada`)
        }
        
        const repoData = await repoInfo.json()
        const defaultBranch = repoData.default_branch || 'main'
        branch = branch || defaultBranch
        
        const zipUrl = `https://github.com/${username}/${repo}/archive/refs/heads/${branch}.zip`
        
        const checkRes = await fetch(zipUrl, { method: 'HEAD' })
        if (!checkRes.ok) {
            await m.react('❌')
            return m.reply(`❌ *ʙʀᴀɴᴄʜ ᴛɪᴅᴀᴋ ᴀᴅᴀ*\n\n> Branch \`${branch}\` tidak ditemukan\n> Default: \`${defaultBranch}\``)
        }
        
        await sock.sendMedia(m.chat, zipUrl, null, m, {
            type: 'document',
            fileName: `${repo} - Branch: ${branch}.zip`,
            mimetype: 'application/zip',
            contextInfo: {
                forwardingScore: 99,
                isForwarded: true
            }
        })
        
        await m.react('✅')
        
    } catch (e) {
        await m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── gitclone ──
const _gitclone = (() => {
const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i
var handler = async (m, { conn, args, usedPrefix, command }) => {
    if (!args[0]) throw `Example user ${usedPrefix}${command} https://github.com/ImYanXiao/Elaina-MultiDevice`
    if (!regex.test(args[0])) throw 'Url Tidak Valid! '
    let [_, user, repo] = args[0].match(regex) || []
    repo = repo.split(/[\/?#]/)[0].replace(/\.git$/, '')
    let url = `https://api.github.com/repos/${user}/${repo}/zipball`
    let head = await fetch(url, { method: 'HEAD' })
    let disposition = head.headers.get('content-disposition')
    if (!head.ok || !disposition) throw 'Repo tidak ditemukan atau bersifat private!'
    let filename = disposition.match(/attachment; filename=(.*)/)?.[1] || `${repo}.zip`
    await m.reply(`D o w n l o a d i n g. . .`)
    await conn.sendFile(m.chat, url, filename, null, m)
}
handler.help = ['gitclone'].map(v => v + ' <url>')
handler.tags = ['downloader']
handler.command = ['gitclone']

handler.limit = true

const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── googledrive ──
const _googledrive = (() => {
/*
Fitur: Downloader Google Drive
Info: Mengunduh File dari link Drive
Type: Plugins
By: SkyWalker
[ `Sumber` ]
https://whatsapp.com/channel/0029Vb1NWzkCRs1ifTWBb13u

[ `Sumber Scrape` ]
https://whatsapp.com/channel/0029Vb2mOzL1Hsq0lIEHoR0N/346
*/

/*
const axios = require('axios')
const { writeFileSync } = require('fs')
const { tmpdir } = require('os')
const path = require('path')
*/

let handler = async (m, { args, usedPrefix, command, conn }) => {
  const url = args[0]
  if (!url) throw `Contoh: ${usedPrefix + command} https://drive.google.com/file/d/xxxxxxxxx/view`

  const fileId = await extractGDrive(url)
  if (!fileId) throw 'URL Google Drive tidak valid!'

  try {
    const apiKey = 'AIzaSyAA9ERw-9LZVEohRYtCWka_TQc6oXmvcVU'
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,size,mimeType&key=${apiKey}`
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`

    const metadata = await axios.get(metaUrl)
    const { name, size, mimeType } = metadata.data

    m.reply(`Mendownload file...\n\n• Nama: ${name}\n• Ukuran: ${await formatSize(size)}\n• Tipe: ${mimeType}`)

    const res = await axios.get(downloadUrl, { responseType: 'arraybuffer' })

    if (res.status !== 200) {
      throw `Gagal mengunduh file: ${res.status} ${res.statusText}`
    }

    const buffer = Buffer.from(res.data, 'binary')
    const tmpPath = path.join(tmpdir(), name)
    writeFileSync(tmpPath, buffer)

    await conn.sendMessage(m.chat, {
      document: { url: tmpPath },
      fileName: name,
      mimetype: mimeType || 'application/octet-stream',
      caption: `File berhasil diunduh!\n\n• Nama: ${name}\n• Ukuran: ${await formatSize(size)}`
    }, { quoted: m })

  } catch (err) {
    console.error(err)
    throw typeof err === 'string' ? err : `Terjadi kesalahan: ${err.response?.status} ${err.response?.statusText}`
  }
}

handler.help = ['gdrive <url>']
handler.tags = ['downloader']
handler.command = ['drivedl']

const __plugin = wrapClassic(handler)
//module export= handler
async function extractGDrive(url) {
  const match = url.match(/\/d\/([^/]+)|open\?id=([^&]+)/)
  return match ? (match[1] || match[2]) : null
}

async function formatSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]
}

  return __plugin
})()

// ── mediafire ──
const _mediafire = (() => {
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.mediafire.com/',
  'Upgrade-Insecure-Requests': '1'
}

function sizeToMB(size) {
  if (!size) return 0
  let s = size.toUpperCase()
  if (s.includes('GB')) return parseFloat(s) * 1024
  if (s.includes('MB')) return parseFloat(s)
  if (s.includes('KB')) return parseFloat(s) / 1024
  return 0
}

async function mediafiredl(url) {
  const res = await axios.get(url, { headers, maxRedirects: 5 })
  const $ = cheerio.load(res.data)

  const download = $('#download_link > a.input.popsok').attr('href') || null
  const filename = $('.dl-btn-label').first().text().trim() || 'file'
  const filesize = $('#download_link > a.input.popsok')
    .text()
    .match(/\(([^)]+)\)/)?.[1] || '-'
  const filetype = $('.dl-info .filetype span').first().text().trim() || '-'
  const uploaded = $('.details li').eq(1).find('span').text().trim() || '-'

  return { filename, filetype, filesize, uploaded, download }
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) throw `Contoh:\n${usedPrefix + command} https://www.mediafire.com/file/xxxxx`

  await m.react('🕒')

  try {
    let res = await mediafiredl(text)
    if (!res.download) throw 'Link download tidak ditemukan.'

    let sizeMB = sizeToMB(res.filesize)
    if (sizeMB > 100) {
      return m.reply(`❌ File terlalu besar (${res.filesize})\nBatas maksimal: 100 MB`)
    }

    let ext = res.download.split('.').pop().split('?')[0]
    let fileName = res.filename.includes('.') ? res.filename : `${res.filename}.${ext}`

    await conn.sendMessage(m.chat, {
      document: { url: res.download },
      mimetype: `application/${ext}`,
      fileName,
      caption:
`📦 MediaFire Downloader
📝 Nama: ${res.filename}
📁 Tipe: ${res.filetype}
📏 Ukuran: ${res.filesize}
📅 Upload: ${res.uploaded}`
    }, { quoted: m })

  } catch (e) {
    m.reply(typeof e === 'string' ? e : '❌ Gagal mengambil file MediaFire.')
  }
}

handler.help = ['mediafire']
handler.tags = ['downloader']
handler.command = ['mediafire']
handler.limit = true

const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── mediafiredl ──
const _mediafiredl = (() => {
const pluginConfig = {
  name: "mediafiredl",
  alias: [],
  category: "download",
  description: "Download file dari MediaFire",
  usage: ".mediafiredl <url>",
  example: ".mediafiredl https://www.mediafire.com/file/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

function getFileName(result) {
  const directName = result?.meta?.title?.trim();
  const urlName = decodeURIComponent(
    result?.download?.link_download?.split("/").pop()?.split("?")[0] || "",
  );
  const extension = urlName.includes(".") ? `.${urlName.split(".").pop()}` : "";
  if (directName && extension && !directName.includes("."))
    return `${directName}${extension}`;
  return directName || urlName || `mediafire_${Date.now()}${extension}`;
}

async function handler(m, { sock }) {
  const url = m.text?.trim();

  if (!url) {
    return m.reply(
      `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
        `> \`${m.prefix}mediafiredl <url>\`\n\n` +
        `> Contoh:\n` +
        `> \`${m.prefix}mediafiredl https://www.mediafire.com/file/xxx\``,
    );
  }

  if (!url.match(/mediafire\.com/i)) {
    return m.reply(`❌ *URL tidak valid. Gunakan link MediaFire.*`);
  }
  await m.react("🕕");

  try {
    const result = await mediafire(url);
    await sock.sendMessage(
      m.chat,
      {
        document: { url: result.download.link_download },
        fileName: getFileName(result),
        mimetype: result.download.mimetype,
        contextInfo: {
          forwardingScore: 99,
          isForwarded: true,
        },
      },
      { quoted: m },
    );
  } catch (err) {
    return m.reply(te(m.prefix, m.command, m.pushName));
  }
}

const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── sfile ──
const _sfile = (() => {
let handler = async (m, { conn, text, command }) => {
  if (!text) throw 'Masukkan query atau link!'

  if (command === 'sfile') {
    const results = await sfileSearch(text)

    if (!results.length) throw 'File tidak ditemukan'

    let msg = '🔎 Hasil pencarian:\n\n'

    results.slice(0, 10).forEach((v, i) => {
      msg += `${i + 1}. ${v.title}\n`
      msg += `📦 ${v.size}\n`
      msg += `🔗 ${v.link}\n\n`
    })

    m.reply(msg)
  }

  if (command === 'sfiledl') {
    if (!text.includes('sfile.co')) throw 'Link tidak valid'

    const { metadata, download } = await sfileDownload(text, true)

    const caption = `📄 Nama: ${metadata.filename}
📦 Tipe: ${metadata.mimetype}
⬇️ Download: ${metadata.download_count}
👤 Author: ${metadata.author_name}`

    await conn.sendFile(m.chat, download, metadata.filename, caption, m)
  }
}

handler.help = ['sfile <query>', 'sfiledl <link>']
handler.tags = ['downloader']
handler.command = ['sfile', 'sfiledl']
handler.limit = true

const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── terabox ──
const _terabox = (() => {
const exec = promisify(execFile);

const pluginConfig = {
  name: "terabox",
  alias: [],
  category: "download",
  description: "Download video/file dari TeraBox",
  usage: ".terabox <url>",
  example: ".terabox https://terabox.com/s/xxx",
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
      `📦 *TeraBox Downloader*\n\n` +
        `Download video atau file dari TeraBox.\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}terabox <link>*\n\n` +
        `*CONTOH:*\n` +
        `> *${m.prefix}terabox https://terabox.com/s/xxx*\n\n` +
        `_File dikirim sebagai dokumen, mungkin agak lama_`,
    );
  }

  m.react("🕕");

  try {
    const result = await TeraBoxDL(text);

    if (!result.status) {
      m.react("☢");
      return m.reply(`❌ *TeraBox Gagal*\n\n> ${result.error}`);
    }

    let caption =
      `📦 *TeraBox*\n\n` +
      `> 📌 ${result.file_name}\n` +
      `> 📏 Size: ${result.file_size}\n` +
      `> ⏱️ Durasi: ${result.duration}`;

    if (result.thumbnail) {
      await sock.sendMedia(m.chat, result.thumbnail, caption, m, {
        type: "image",
      });
    }

    if (result.stream_url && result.stream_url.endsWith(".m3u8")) {
      const tmpFile = path.join(os.tmpdir(), `tb_${Date.now()}.mp4`);

      await exec(
        "ffmpeg",
        [
          "-y",
          "-i",
          result.stream_url,
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
            (result.file_name || "video").replace(/[<>:"/\\|?*]/g, "") + ".mp4",
          caption,
        },
        { quoted: m },
      );
    } else if (result.download_url) {
      const res = await axios.get(result.download_url, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 200 * 1024 * 1024,
      });

      const ext = result.extension || ".mp4";
      const fileName =
        (result.file_name || "file").replace(/[<>:"/\\|?*]/g, "") + ext;

      await sock.sendMessage(
        m.chat,
        {
          document: Buffer.from(res.data),
          mimetype: "application/zip",
          fileName,
          caption,
        },
        { quoted: m },
      );
    }

    m.react("✅");
  } catch (e) {
    console.error(e);
    m.react("☢");
    m.reply("❌ Gagal mengambil data TeraBox, coba lagi nanti");
  }
}

const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

export default mergePlugins(
    'download',
    _gdrive,
    _githubdl,
    _gitclone,
    _googledrive,
    _mediafire,
    _mediafiredl,
    _sfile,
    _terabox
)
