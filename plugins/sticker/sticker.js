// ───────── sticker ─────────
// Gabungan plugin: fstik, sticker, swm, toimg, tovideo

import axios from 'axios'
import { wrapClassic, config, te, wrapPlugin, mergePlugins } from '../../lib/plugin-engine.js'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { addExifToWebp } from '../../lib/plugin-engine.js'
import sharp from 'sharp'
import { webp2mp4, ffmpeg } from '../../lib/scraper.js'

// ── fstik ──
const _fstik = (() => {
const fstik = {
  api: {
    base: 'https://api.fstik.app',
    endpoints: {
      direct: '/getStickerSetByName',
      search: '/searchStickerSet'
    }
  },

  headers: {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json',
    origin: 'https://webapp.fstik.app',
    referer: 'https://webapp.fstik.app/',
    'user-agent': 'NB Android/1.0.0'
  },

  name: async (name) => {
    if (!name || typeof name !== 'string') {
      return {
        success: false,
        code: 400,
        result: { error: 'Inputnya kagak boleh kosong bree 🗿' }
      }
    }

    try {
      const res = await axios.post(
        fstik.api.base + fstik.api.endpoints.direct,
        { name, user_token: null },
        { headers: fstik.headers }
      )

      const set = res.data?.result
      if (!set) {
        return {
          success: false,
          code: 404,
          result: { error: `Sticker set "${name}" mah kagak ada bree... 🤙🏻` }
        }
      }

      return {
        success: true,
        code: 200,
        result: {
          source: 'database',
          id: set.id,
          title: set.title,
          name: set.name,
          description: set.description,
          tags: set.tags,
          kind: set.kind,
          type: set.type,
          public: set.public,
          safe: set.safe,
          verified: set.verified,
          reaction: set.reaction,
          installations: set.installations,
          stickerCount: set.stickers?.length || 0,
          stickers: set.stickers?.map((s, i) => {
            const file_id = s.file_id ?? s.fileid
            const thumb_id = s.thumb?.file_id ?? s.thumb?.fileid
            return {
              index: i + 1,
              file_id,
              thumb_id,
              size: `${s.width}x${s.height}`,
              image_url: thumb_id ? `${fstik.api.base}/file/${thumb_id}/sticker.webp` : null
            }
          })
        }
      }
    } catch (err) {
      return {
        success: false,
        code: err?.response?.status || 500,
        result: {
          error: 'Error bree 🫵🏻😂',
          details: err.message
        }
      }
    }
  },

  search: async ({ query = '', skip = 0, limit = 15, type = '', kind = 'regular' }) => {
    try {
      const payload = { query, skip, limit, type, kind, user_token: null }

      const res = await axios.post(
        fstik.api.base + fstik.api.endpoints.search,
        payload,
        { headers: fstik.headers }
      )

      const sets = res.data?.result?.stickerSets
      if (!sets || sets.length === 0) {
        return {
          success: false,
          code: 404,
          result: { error: 'Sticker setnya kagak ada bree.. coba lagi nanti yak 😂🫵🏻' }
        }
      }

      return {
        success: true,
        code: 200,
        result: sets.map((set, i) => ({
          index: i + skip + 1,
          id: set.id,
          name: set.name,
          title: set.title,
          description: set.description,
          tags: set.tags,
          kind: set.kind,
          type: set.type,
          public: set.public,
          safe: set.safe,
          verified: set.verified,
          reaction: set.reaction,
          installations: set.installations,
          stickerCount: set.stickers?.length || 0,
          stickers: set.stickers?.map((s, j) => {
            const file_id = s.file_id ?? s.fileid
            const thumb_id = s.thumb?.file_id ?? s.thumb?.fileid
            return {
              index: j + 1,
              file_id,
              thumb_id,
              size: `${s.width}x${s.height}`,
              image_url: thumb_id ? `${fstik.api.base}/file/${thumb_id}/sticker.webp` : null
            }
          })
        }))
      }
    } catch (err) {
      return {
        success: false,
        code: err?.response?.status || 500,
        result: {
          error: 'Kagak bisa nyari sticker nya bree.. 🤙🏻',
          details: err.message
        }
      }
    }
  },

  more: async (link, skip = 0, limit = 15) => {
    if (!link?.startsWith('https://t.me/addstickers/')) {
      return {
        success: false,
        code: 400,
        result: { error: 'Link telegramnya kagak valid bree 🗿' }
      }
    }

    const name = link.split('/addstickers/')[1]?.trim()
    if (!name) {
      return {
        success: false,
        code: 400,
        result: { error: 'Apenih, kagak ada nama sticker setnya 😏' }
      }
    }

    const i = await fstik.name(name)
    if (!i.success) return i

    return await fstik.search({
      query: [i.result.id],
      type: 'more',
      skip,
      limit
    })
  },

  lookup: async (input) => {
    if (!input || typeof input !== 'string') {
      return {
        success: false,
        code: 400,
        result: { error: 'Inputnya kagak boleh kosong bree 🗿' }
      }
    }

    let name = input.trim()
    const isLink = input.startsWith('https://t.me/addstickers/')
    if (isLink) {
      try {
        const url = new URL(name)
        name = url.pathname.replace('/addstickers/', '').trim()
        const direct = await fstik.name(name)
        if (direct.success) return direct
      } catch {
        return {
          success: false,
          code: 400,
          result: { error: 'Link telegramnya kagak valid bree... '}
        }
      }
    }

    return await fstik.search({
      query: name,
      type: '',
      kind: 'regular'
    })
  },

  request: async (query, mode = '', options = {}) => {
    if (!query || typeof query !== 'string') {
      return {
        success: false,
        code: 400,
        result: { error: 'Inputnya kagak boleh kosong bree 🗿' }
      }
    }

    const input = query.trim()

    switch (mode) {
      case 'lookup':
        return await fstik.lookup(input)

      case 'more':
        return await fstik.more(input, options.skip || 0, options.limit || 15)

      case 'name':
        return await fstik.name(input)

      case 'search':
      case '':
        return await fstik.search({
          query: input,
          skip: options.skip || 0,
          limit: options.limit || 15,
          type: options.type || '',
          kind: options.kind || 'regular'
        })

      default:
        return {
          success: false,
          code: 400,
          result: { error: `Mode "${mode}" mah kagak valid euy...` }
        }
    }
  }
}

let handler = async (m, { conn, args, command }) => {
  try {
    if (!args[0]) return m.reply('Masukkan query pencarian atau link sticker Telegram\n\nExample :\n.fstik bokepanak\n.fstik https://t.me/addstickers/pepe_memes')

    const query = args.join(' ')
    const isLink = query.startsWith('https://t.me/addstickers/')

    let result
    if (isLink) {
      result = await fstik.more(query)
    } else {
      result = await fstik.lookup(query)
    }

    if (!result.success) {
      return m.reply(result.result.error || 'Ertor Bang :v')
    }

    const sendInfo = async (set) => {
      let text = `INFO STICKER SET\n\n`
      text += `Nama : ${set.title}\n`
      text += `ID : ${set.id}\n`
      text += `Nama Set : ${set.name}\n`
      text += `Deskripsi : ${set.description || 'Tidak ada deskripsi'}\n`
      text += `Tags : ${set.tags?.join(', ') || 'Tidak ada tags'}\n`
      text += `Jenis : ${set.kind}\n`
      text += `Tipe : ${set.type}\n`
      text += `Public : ${set.public ? 'Ya' : 'Tidak'}\n`
      text += `Aman : ${set.safe ? 'Ya' : 'Tidak'}\n`
      text += `Terverifikasi : ${set.verified ? 'Ya' : 'Tidak'}\n`
      text += `Jumlah Sticker : ${set.stickerCount}\n`
      text += `Link : https://t.me/addstickers/${set.name}\n\n`

      await conn.sendMessage(m.chat, {
        image: { url: set.stickers?.[0]?.image_url },
        caption: text
      }, { quoted: m })

      for (let sticker of set.stickers) {
        if (!sticker.image_url) continue

        const res = await fetch(sticker.image_url)
        const buffer = await res.arrayBuffer()

        await conn.sendMessage(m.chat, {
          sticker: { url: sticker.image_url }
        }, { quoted: m })
        await delay(800)
      }
    }

    const delay = ms => new Promise(res => setTimeout(res, ms))

    if (Array.isArray(result.result)) {
      const firstSet = result.result[0]
      await sendInfo(firstSet)
    } else {
      const set = result.result
      await sendInfo(set)
    }

  } catch (e) {
    m.reply(e.message)
  }
}

handler.help = ['fstik']
handler.command = ['fstik']
handler.tags = ['tools']
handler.premium = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── sticker ──
const _sticker = (() => {
const execAsync = promisify(exec)

const pluginConfig = {
    name: 'sticker',
    alias: [],
    category: 'sticker',
    description: 'Membuat sticker dari gambar/video dengan opsi crop/resize',
    usage: '.sticker [--crop] [--resize WxH] [--circle] [--rounded]',
    example: '.sticker --crop\n.s --resize 256x256\n.s --circle\n.s --rounded',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

function parseOptions(args) {
    const options = {
        crop: false,
        resize: null,
        circle: false,
        rounded: false,
        packname: null,
        author: null
    }
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg === '--crop' || arg === '-c') {
            options.crop = true
        } else if (arg === '--resize' || arg === '-r') {
            if (args[i + 1] && /^\d+x\d+$/i.test(args[i + 1])) {
                options.resize = args[i + 1]
                i++
            }
        } else if (arg === '--circle') {
            options.circle = true
        } else if (arg === '--rounded') {
            options.rounded = true
        } else if (!arg.startsWith('-') && !options.packname) {
            options.packname = arg
        } else if (!arg.startsWith('-') && options.packname && !options.author) {
            options.author = arg
        }
    }
    
    return options
}

async function processImage(inputPath, outputPath, options) {
    let filters = []
    
    if (options.resize) {
        const [width, height] = options.resize.split('x').map(Number)
        filters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`)
        filters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`)
    }
    
    if (options.crop) {
        filters.push(`crop='min(iw,ih)':'min(iw,ih)'`)
        filters.push(`scale=512:512`)
    }
    
    if (options.circle) {
        filters.push(`format=rgba`)
        filters.push(`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gt(pow(X-W/2,2)+pow(Y-H/2,2),pow(min(W,H)/2,2)),0,255)'`)
    }
    
    if (options.rounded) {
        const radius = 50
        filters.push(`format=rgba`)
        filters.push(`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X,${radius})*lt(Y,${radius})*gt(pow(${radius}-X,2)+pow(${radius}-Y,2),pow(${radius},2)),0,if(gt(X,W-${radius})*lt(Y,${radius})*gt(pow(X-W+${radius},2)+pow(${radius}-Y,2),pow(${radius},2)),0,if(lt(X,${radius})*gt(Y,H-${radius})*gt(pow(${radius}-X,2)+pow(Y-H+${radius},2),pow(${radius},2)),0,if(gt(X,W-${radius})*gt(Y,H-${radius})*gt(pow(X-W+${radius},2)+pow(Y-H+${radius},2),pow(${radius},2)),0,255))))'`)
    }
    
    if (filters.length === 0) {
        fs.copyFileSync(inputPath, outputPath)
        return
    }
    
    const filterStr = filters.join(',')
    await execAsync(`ffmpeg -i "${inputPath}" -vf "${filterStr}" -y "${outputPath}"`)
}

async function processVideo(inputPath, outputPath, options) {
    let filters = []
    
    if (options.resize) {
        const [width, height] = options.resize.split('x').map(Number)
        filters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`)
        filters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`)
    }
    
    if (options.crop) {
        filters.push(`crop='min(iw,ih)':'min(iw,ih)'`)
        filters.push(`scale=512:512`)
    }
    
    if (filters.length === 0) {
        fs.copyFileSync(inputPath, outputPath)
        return
    }
    
    const filterStr = filters.join(',')
    await execAsync(`ffmpeg -i "${inputPath}" -vf "${filterStr}" -c:a copy -y "${outputPath}"`)
}

async function handler(m, { sock, config: botConfig }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    const isVideo = m.isVideo || (m.quoted && m.quoted.type === 'videoMessage')
    
    if (!isImage && !isVideo) {
        await m.reply(
            `🖼️ *sᴛɪᴄᴋᴇʀ ᴍᴀᴋᴇʀ*\n\n` +
            `Kirim/reply gambar atau video dengan caption:\n` +
            `\`${m.prefix}sticker\`\n\n` +
            `*ᴏᴘsɪ:*\n` +
            `> \`--crop\` - Crop jadi kotak\n` +
            `> \`--resize WxH\` - Resize ke ukuran\n` +
            `> \`--circle\` - Bentuk lingkaran\n` +
            `> \`--rounded\` - Sudut melengkung\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}sticker --crop\`\n` +
            `> \`${m.prefix}sticker --resize 256x256\`\n` +
            `> \`${m.prefix}sticker --circle\`\n` +
            `> \`${m.prefix}sticker PackName Author\``
        )
        return
    }
    
    await m.react('🕕')
    
    const options = parseOptions(m.args || [])
    
    try {
        let buffer
        if (m.quoted && m.quoted.isMedia) {
            buffer = await m.quoted.download()
        } else if (m.isMedia) {
            buffer = await m.download()
        }
        
        if (!buffer) {
            await m.reply('❌ Gagal mendownload media!')
            await m.react('❌')
            return
        }
        
        if (isVideo) {
            const tempDir = path.join(process.cwd(), 'temp')
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true })
            }
            
            const tempVideo = path.join(tempDir, `duration_check_${Date.now()}.mp4`)
            fs.writeFileSync(tempVideo, buffer)
            
            try {
                const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempVideo}"`)
                const duration = parseFloat(stdout.trim())
                
                if (duration > 10) {
                    await m.reply(`❌ Video terlalu panjang!\n\n> Durasi: ${duration.toFixed(1)} detik\n> Maksimal: 10 detik`)
                    await m.react('☢')
                    if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo)
                    return
                }
            } catch (e) {}
            
            if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo)
        }
        
        const packname = options.packname || botConfig.sticker?.packname || botConfig.bot?.name || 'Bot'
        const author = options.author || botConfig.sticker?.author || botConfig.owner?.name || 'Bot'
        
        const hasProcessing = options.crop || options.resize || options.circle || options.rounded
        
        if (hasProcessing) {
            const tempDir = path.join(process.cwd(), 'temp')
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true })
            }
            
            const ext = isVideo ? 'mp4' : 'png'
            const inputPath = path.join(tempDir, `sticker_in_${Date.now()}.${ext}`)
            const outputPath = path.join(tempDir, `sticker_out_${Date.now()}.${ext}`)
            
            fs.writeFileSync(inputPath, buffer)
            
            try {
                if (isImage) {
                    await processImage(inputPath, outputPath, options)
                } else if (isVideo) {
                    await processVideo(inputPath, outputPath, options)
                }
                buffer = fs.readFileSync(outputPath)
            } catch (e) {}
            
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
        }
        
        if (isImage) {
            await sock.sendImageAsSticker(m.chat, buffer, m, { packname, author })
        } else if (isVideo) {
            await sock.sendVideoAsSticker(m.chat, buffer, m, { packname, author })
        }
        
        await m.react('✅')
        
    } catch (error) {
        m.reply(te(m.prefix, m.command, m.pushName))
        await m.react('❌')
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── swm ──
const _swm = (() => {
const pluginConfig = {
    name: 'swm',
    alias: [],
    category: 'sticker',
    description: 'Mengganti packname dan author pada sticker',
    usage: '.swm <packname> atau .swm <packname>|<author>',
    example: '.swm BotName',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock, config: botConfig }) {
    const quoted = m.quoted
    
    if (!quoted) {
        return m.reply(
            `🖼️ *sᴛɪᴄᴋᴇʀ ᴡᴀᴛᴇʀᴍᴀʀᴋ*\n\n` +
            `> Reply sticker dengan caption:\n` +
            `> \`${m.prefix}swm packname\`\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}swm NamaPack\`\n` +
            `> \`${m.prefix}swm NamaPack|NamaAuthor\` _(packname + author)_`
        )
    }
    
    const isSticker = quoted.type === 'stickerMessage' || quoted.isSticker
    if (!isSticker) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Reply pesan sticker, bukan ${quoted.type?.replace('Message', '') || 'media lain'}`)
    }
    
    const input = m.text?.trim()
    if (!input) {
        return m.reply(
            `❌ *ɢᴀɢᴀʟ*\n\n` +
            `> Masukkan packname\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}swm NamaPack\`\n` +
            `> \`${m.prefix}swm NamaPack|NamaAuthor\` _(+ author)_`
        )
    }
    
    let packname, author
    
    if (input.includes('|')) {
        const parts = input.split('|')
        packname = parts[0]?.trim() || ''
        author = parts[1]?.trim() || ''
    } else {
        packname = input
        author = ''
    }
    
    m.react('🕕')
    
    try {
        const buffer = await quoted.download()
        
        if (!buffer || buffer.length === 0) {
            m.react('❌')
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Gagal mendownload sticker`)
        }
        
        const exifOpts = { packname, author, emojis: ['🤖'] }
        const riff = buffer.slice(0, 4).toString('ascii')
        const webpSig = buffer.length >= 12 ? buffer.slice(8, 12).toString('ascii') : ''
        const isWebp = riff === 'RIFF' && webpSig === 'WEBP'
        
        if (isWebp) {
            const stickerBuffer = await addExifToWebp(buffer, exifOpts)
            await sock.sendMessage(m.chat, {
                sticker: stickerBuffer,
                contextInfo: { isForwarded: true, forwardingScore: 1 }
            }, { quoted: m })
        } else {
            const isVideo = buffer.slice(0, 3).toString('hex') === '000000' ||
                            buffer.slice(4, 8).toString('ascii') === 'ftyp'
            
            if (isVideo) {
                await sock.sendVideoAsSticker(m.chat, buffer, m, exifOpts)
            } else {
                await sock.sendImageAsSticker(m.chat, buffer, m, exifOpts)
            }
        }
        
        m.react('✅')
        
    } catch (error) {
        console.error('[SWM] Error:', error.message)
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}


const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

// ── toimg ──
const _toimg = (() => {
let handler = async (m, { conn, usedPrefix, command }) => {
  if (!m.quoted) {
    return m.reply(`Reply sticker dengan command *${usedPrefix + command}*`)
  }

  let q = m.quoted
  let mime = q.mimetype || ''

  if (!/image\/webp/.test(mime)) {
    return m.reply('Itu bukan sticker')
  }

  try {
    let media = await q.download()

    let img = await sharp(media)
      .png({ quality: 100 })
      .toBuffer()

    await conn.sendFile(
      m.chat,
      img,
      'image.png',
      null,
      m
    )

  } catch (e) {
    console.error(e)
    m.reply('Gagal convert sticker ke image')
  }
}

handler.help = ['toimg']
handler.tags = ['sticker']
handler.command = ['toimg']

handler.register = true
handler.limit = true


const __plugin = wrapClassic(handler)

  return __plugin
})()

// ── tovideo ──
const _tovideo = (() => {
let handler = async (m, { conn, usedPrefix, command }) => {
	if (!m.quoted) throw `Balas stiker/audio yang ingin diubah menjadi video dengan perintah ${usedPrefix + command}`
	let mime = m.quoted.mimetype || ''
	if (!/webp|audio/.test(mime)) throw `Balas stiker/audio yang ingin diubah menjadi video dengan perintah ${usedPrefix + command}`
	let media = await m.quoted.download()
	let out = Buffer.alloc(0)
	if (/webp/.test(mime)) {
		out = await webp2mp4(media)
	} else if (/audio/.test(mime)) {
		out = await ffmpeg(media, [
			'-filter_complex', 'color',
			'-pix_fmt', 'yuv420p',
			'-crf', '51',
			'-c:a', 'copy',
			'-shortest'
		], 'mp3', 'mp4')
	}
	await conn.sendFile(m.chat, out, 'out.mp4', '*DONE*', m, 0, { thumbnail: out })
}

handler.help = ['tovideo']
handler.tags = ['sticker']

handler.command = ['tovideo']

handler.register = true
handler.limit = 2


const __plugin = wrapClassic(handler)

  return __plugin
})()

export default mergePlugins(
    'sticker',
    _fstik,
    _sticker,
    _swm,
    _toimg,
    _tovideo
)
