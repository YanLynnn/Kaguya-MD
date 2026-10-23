/**

* YannRzy Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */

// ───────── instagram ─────────
// Gabungan plugin canvas: igstory, igstoryimg
// Port dari RIMURU-MD. Pesan keluar memakai sock.sendMessage / m.reply bawaan WhatsApp (tanpa tombol / kartu custom).

import axios from 'axios'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { wrapPlugin, mergePlugins, canvasDrawAvatar as drawAvatar } from '../../lib/plugin-engine.js'
// ── igstory ──
const _igstory = (() => {
const pluginConfig = {
    name: 'igstory',
    alias: [],
    category: 'canvas',
    description: 'Membuat gambar simulasi post Instagram Story dari foto profil dan gambarmu.',
    usage: '.igstory [kirim/reply gambar]',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true
}

const BG_URL     = 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/igstory/storyig.png'
const FONT_URL   = 'https://github.com/rsms/inter/raw/refs/heads/master/docs/font-files/Inter-Medium.woff2'

const ICON_URLS = {
  like:    'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/igstory/like.svg',
  comment: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/igstory/comment.svg',
  repost:  'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/igstory/repost.svg',
  share:   'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/igstory/share.svg',
  save:    'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/igstory/save.svg',
  verify:  'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/igstory/verifyig.svg',
}
const ICON_COLOR   = '#f9fdfe'
const VERIFY_COLOR = '#0095F6'

let fontsLoaded = false;
let bgImgBuffer = null;
let cachedIcons = null;

const CANVAS_W = 1080
const CANVAS_H = 1564         
const CANVAS_BG_COLOR = '#0c0f14'
const OUTPUT_HEIGHT = 1400    

const ICON_SIZE = 80         
const BOTTOM_BAR_Y_OFFSET = 17 
const ICON_Y    = 1264 + BOTTOM_BAR_Y_OFFSET
const GAP_ICON_TO_TEXT  = 24 
const GAP_TEXT_TO_ICON  = 43 
const DEFAULT_X = { like: 22, comment: 256, repost: 459, share: 688, save: 978 }

const COUNT_FONT   = '500 43px InterIG'
const COUNT_ZONE_Y = 1285 + BOTTOM_BAR_Y_OFFSET
const COUNT_ZONE_H = 48

const USERNAME_FONT   = '500 38px InterIG'
const USERNAME_X      = 159
const USERNAME_ZONE_Y = 58
const USERNAME_ZONE_H = 59
const VERIFY_SIZE      = 40
const VERIFY_Y          = 71
const GAP_USERNAME_VERIFY = 14

const AVATAR_CX = 83.5, AVATAR_CY = 85.5, AVATAR_R = 48.5
const AVATAR_DRAW = { x: 35, y: 37, w: 97, h: 97 }

const MAIN_PHOTO_ZONE = { x: -3, y: 157, w: 1089, h: 1089 }
const MAIN_PHOTO_BLUR = 28

async function download(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 5 })
  return Buffer.from(res.data)
}

async function setupEnv() {
  if (!bgImgBuffer) bgImgBuffer = await download(BG_URL)
  if (!fontsLoaded) {
    GlobalFonts.register(await download(FONT_URL), 'InterIG')
    fontsLoaded = true;
  }

  if (cachedIcons) return cachedIcons;

  const icons = {}
  for (const [name, url] of Object.entries(ICON_URLS)) {
    const targetSize = name === 'verify' ? VERIFY_SIZE : ICON_SIZE
    
    const svgBuffer = await download(url)
    const color = name === 'verify' ? VERIFY_COLOR : ICON_COLOR
    
    const svgImg = await loadImage(svgBuffer)
    const targetW = targetSize * 3
    const targetH = targetSize * 3
    const c = createCanvas(targetW, targetH)
    const cx = c.getContext('2d')
    cx.drawImage(svgImg, 0, 0, targetW, targetH)
    cx.globalCompositeOperation = 'source-in'
    cx.fillStyle = color
    cx.fillRect(0, 0, targetW, targetH)
    
    icons[name] = await loadImage(await c.encode('png'))
  }
  cachedIcons = icons;
  return icons
}

function computeBottomBarLayout(ctx, { like, comment, repost }) {
  ctx.font = COUNT_FONT
  const likeX = DEFAULT_X.like
  const likeTextX = likeX + ICON_SIZE + GAP_ICON_TO_TEXT
  const likeTextW = ctx.measureText(String(like)).width

  const minCommentX = likeTextX + likeTextW + GAP_TEXT_TO_ICON
  const commentX = Math.max(DEFAULT_X.comment, minCommentX)
  const commentTextX = commentX + ICON_SIZE + GAP_ICON_TO_TEXT
  const commentTextW = ctx.measureText(String(comment)).width

  const minRepostX = commentTextX + commentTextW + GAP_TEXT_TO_ICON
  const repostX = Math.max(DEFAULT_X.repost, minRepostX)
  const repostTextX = repostX + ICON_SIZE + GAP_ICON_TO_TEXT
  const repostTextW = ctx.measureText(String(repost)).width

  const minShareX = repostTextX + repostTextW + GAP_TEXT_TO_ICON
  const shareX = Math.max(DEFAULT_X.share, minShareX)

  return {
    like:    { iconX: likeX,    textX: likeTextX },
    comment: { iconX: commentX, textX: commentTextX },
    repost:  { iconX: repostX,  textX: repostTextX },
    share:   { iconX: shareX },
    save:    { iconX: DEFAULT_X.save },
  }
}

function computeUsernameLayout(ctx, username) {
  ctx.font = USERNAME_FONT
  const textW = ctx.measureText(username).width
  const verifyX = USERNAME_X + textW + GAP_USERNAME_VERIFY
  return { textX: USERNAME_X, verifyX }
}

function drawIcon(ctx, img, x, y, size) {
  ctx.drawImage(img, x, y, size, size)
}

function drawCountText(ctx, text, x) {
  ctx.save()
  ctx.font = COUNT_FONT
  ctx.fillStyle = '#f9fdfe'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(text), x, COUNT_ZONE_Y + COUNT_ZONE_H / 2)
  ctx.restore()
}

function drawUsernameText(ctx, text, x) {
  ctx.save()
  ctx.font = USERNAME_FONT
  ctx.fillStyle = '#f9fdfe'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, USERNAME_ZONE_Y + USERNAME_ZONE_H / 2)
  ctx.restore()
}

function drawAvatar(ctx, img) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_R, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  const sw = img.width, sh = img.height
  const crop = Math.min(sw, sh)
  const sx = (sw - crop) / 2
  const sy = (sh - crop) / 2
  ctx.drawImage(img, sx, sy, crop, crop, AVATAR_DRAW.x, AVATAR_DRAW.y, AVATAR_DRAW.w, AVATAR_DRAW.h)
  ctx.restore()
}

function drawMainPhoto(ctx, img, zone, blurPx = MAIN_PHOTO_BLUR) {
  const { x, y, w, h } = zone
  const imgRatio = img.width / img.height
  const boxRatio = w / h

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  let cw, ch
  if (imgRatio > boxRatio) {
    ch = h
    cw = ch * imgRatio
  } else {
    cw = w
    ch = cw / imgRatio
  }
  ctx.filter = `blur(${blurPx}px)`
  ctx.drawImage(img, x - (cw - w) / 2, y - (ch - h) / 2, cw, ch)
  ctx.filter = 'none'

  let fw, fh
  if (imgRatio > boxRatio) {
    fw = w
    fh = fw / imgRatio
  } else {
    fh = h
    fw = fh * imgRatio
  }
  ctx.drawImage(img, x + (w - fw) / 2, y + (h - fh) / 2, fw, fh)

  ctx.restore()
}

async function generateIgStory(profileBuffer, mainBuffer, username, like, comment, repost, outPath) {
  const icons = await setupEnv()

  const bgImg = await loadImage(bgImgBuffer)
  const avatarImg = await loadImage(profileBuffer)
  const photoImg = await loadImage(mainBuffer)

  const canvas = createCanvas(CANVAS_W, CANVAS_H)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = CANVAS_BG_COLOR
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.drawImage(bgImg, 0, 0, CANVAS_W, CANVAS_H)

  drawMainPhoto(ctx, photoImg, MAIN_PHOTO_ZONE)
  drawAvatar(ctx, avatarImg)

  const uLayout = computeUsernameLayout(ctx, username)
  drawUsernameText(ctx, username, uLayout.textX)
  drawIcon(ctx, icons.verify, uLayout.verifyX, VERIFY_Y, VERIFY_SIZE)

  const bar = computeBottomBarLayout(ctx, { like, comment, repost })
  drawIcon(ctx, icons.like, bar.like.iconX, ICON_Y, ICON_SIZE)
  drawCountText(ctx, like, bar.like.textX)
  drawIcon(ctx, icons.comment, bar.comment.iconX, ICON_Y, ICON_SIZE)
  drawCountText(ctx, comment, bar.comment.textX)
  drawIcon(ctx, icons.repost, bar.repost.iconX, ICON_Y, ICON_SIZE)
  drawCountText(ctx, repost, bar.repost.textX)
  drawIcon(ctx, icons.share, bar.share.iconX, ICON_Y, ICON_SIZE)
  drawIcon(ctx, icons.save, bar.save.iconX, ICON_Y, ICON_SIZE)

  const cropH = Math.min(OUTPUT_HEIGHT, CANVAS_H)
  const finalCanvas = createCanvas(CANVAS_W, cropH)
  const finalCtx = finalCanvas.getContext('2d')
  finalCtx.drawImage(canvas, 0, 0, CANVAS_W, cropH, 0, 0, CANVAS_W, cropH)

  await writeFile(outPath, await finalCanvas.encode('png'))
  return outPath
}

async function handler(m, { sock }) {
    try {
        let targetImgBuffer = null;
        try {
            if (m.quoted && typeof m.quoted.download === 'function') {
                targetImgBuffer = await m.quoted.download();
            } else if (typeof m.download === 'function' && (m.isMedia || m.mtype === 'imageMessage' || m.type === 'imageMessage')) {
                targetImgBuffer = await m.download();
            }
        } catch (e) {}

        if (!targetImgBuffer) {
            return m.reply(
                `📸 *FITUR IG STORY POST*\n\n` +
                `Sistem ini akan membuat simulasi gambar postingan Instagram Story menggunakan foto yang kamu kirimkan.\n\n` +
                `*CARA PENGGUNAAN:*\n` +
                `- Kirimkan gambar langsung dengan caption \`${m.prefix}igstory\`\n` +
                `- Atau balas (*reply*) pesan gambar yang sudah ada dengan perintah \`${m.prefix}igstory\`\n\n` +
                `_Bot akan otomatis memasukkan nama pengguna, foto profilmu, beserta detail interaksi seperti jumlah suka dan komentar secara acak!_`
            );
        }

        await m.react('🕕');

        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(m.sender, 'image');
        } catch (e) {
            ppUrl = 'https://i.ibb.co/3Fh9Q6M/empty-profile.png';
        }

        let ppBuffer;
        try {
            ppBuffer = await download(ppUrl);
        } catch (e) {
            ppBuffer = targetImgBuffer;
        }

        const username = m.pushName || 'Someone';
        const like = Math.floor(Math.random() * 900) + 100;
        const comment = Math.floor(Math.random() * 90) + 10;
        const repost = Math.floor(Math.random() * 50) + 1;

        const tempDir = join(process.cwd(), 'temp');
        if (!existsSync(tempDir)) await mkdir(tempDir, { recursive: true });
        
        const outPath = join(tempDir, `igstory_post_${Date.now()}.png`);
        
        await generateIgStory(ppBuffer, targetImgBuffer, username, like, comment, repost, outPath);

        await sock.sendMessage(m.chat, { image: { url: outPath } }, { quoted: m });

        if (existsSync(outPath)) unlinkSync(outPath);
        await m.react('✅');

    } catch (e) {
        bgImgBuffer = null;
        cachedIcons = null;
        fontsLoaded = false;
        console.error(e);
        await m.react('❌');
        m.reply(`❌ *GAGAL MEMPROSES GAMBAR*\n\nMaaf, terjadi kesalahan saat mencoba membuat gambar IG Story. Pastikan gambar yang dikirim valid dan coba lagi beberapa saat.`);
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── igstoryimg ──
const _igstoryimg = (() => {
const IGIMG_BG_URL = 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Image/igimg.png'
const FONT_SEMIBOLD_URL = 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2'
const FONT_REGULAR_URL = 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2'

let fontsLoaded = false;
let bgImgBuffer = null;

const BG_W = 898
const BG_H = 1600

const configLayout = {
  foto: { a: 136, b: 912, c: 38, d: 860, radius: 20 },
  edgeBlur: { width: 3, blur: 10 },
  pp: { x: 110, y: 82, size: 80 },
  namaTeks: { x: 170, y: 58, fontSize: 25, maxWidth: 500, minFontSize: 16, color: '#feffff' },
  usernameTeks: { x: 170, y: 90, fontSize: 17, color: '#8c8d91' }
}

const pluginConfig = {
    name: 'igstoryimg',
    alias: [],
    category: 'canvas',
    description: 'Membuat gambar layout Instagram Story dari gambarmu.',
    usage: '.igstoryimg [kirim/reply gambar]',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true
}

async function downloadData(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } })
  return Buffer.from(res.data)
}

async function setup() {
  if (!bgImgBuffer) bgImgBuffer = await downloadData(IGIMG_BG_URL);
  if (!fontsLoaded) {
      GlobalFonts.register(await downloadData(FONT_SEMIBOLD_URL), 'InterSemiBold')
      GlobalFonts.register(await downloadData(FONT_REGULAR_URL), 'InterRegular')
      fontsLoaded = true;
  }
}

function roundedBottomClipPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y)
  ctx.closePath()
}

function roundedBottomOuterPath(ctx, x, y, w, h, r, bw) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.rect(x - bw, y, bw, h - radius)
  ctx.rect(x + w, y, bw, h - radius)
  ctx.moveTo(x - bw, y + h - radius)
  ctx.lineTo(x, y + h - radius)
  ctx.quadraticCurveTo(x, y + h, x + radius, y + h)
  ctx.lineTo(x + radius, y + h + bw)
  ctx.quadraticCurveTo(x - bw, y + h + bw, x - bw, y + h - radius)
  ctx.closePath()
  ctx.moveTo(x + w + bw, y + h - radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + w - radius, y + h + bw)
  ctx.quadraticCurveTo(x + w + bw, y + h + bw, x + w + bw, y + h - radius)
  ctx.closePath()
  ctx.rect(x + radius, y + h, w - radius * 2, bw)
}

function getContainSize(img, w, h) {
  const imgRatio = img.width / img.height
  const boxRatio = w / h
  let fw, fh
  if (imgRatio > boxRatio) {
    fw = w
    fh = fw / imgRatio
  } else {
    fh = h
    fw = fh * imgRatio
  }
  return { fw, fh }
}

function getCoverSize(img, w, h) {
  const imgRatio = img.width / img.height
  const boxRatio = w / h
  let fw, fh
  if (imgRatio > boxRatio) {
    fh = h
    fw = fh * imgRatio
  } else {
    fw = w
    fh = fw / imgRatio
  }
  return { fw, fh }
}

async function drawFoto(ctx, img, zone) {
  const { a, b, c, d, radius } = zone
  const x = c
  const y = a
  const w = d - c
  const h = b - a
  ctx.save()
  roundedBottomClipPath(ctx, x, y, w, h, radius ?? 0)
  ctx.clip()
  ctx.filter = 'blur(28px)'
  ctx.drawImage(img, x - 40, y - 40, w + 80, h + 80)
  ctx.filter = 'none'
  const { fw, fh } = getContainSize(img, w, h)
  ctx.drawImage(img, x + (w - fw) / 2, y + (h - fh) / 2, fw, fh)
  ctx.restore()
}

async function drawEdgeBlur(ctx, img, zone, edgeBlur) {
  const { a, b, c, d, radius } = zone
  const x = c
  const y = a
  const w = d - c
  const h = b - a
  const { fw, fh } = getCoverSize(img, w, h)
  const imgX = x + (w - fw) / 2
  const imgY = y + (h - fh) / 2
  ctx.save()
  roundedBottomOuterPath(ctx, x, y, w, h, radius ?? 0, edgeBlur.width)
  ctx.clip()
  ctx.filter = `blur(${edgeBlur.blur}px)`
  ctx.drawImage(img, imgX, imgY, fw, fh)
  ctx.filter = 'none'
  ctx.restore()
}

async function drawPP(ctx, img, pp) {
  const { x, y, size } = pp
  const r = size / 2
  const dim = Math.min(img.width, img.height)
  const sx = (img.width - dim) / 2
  const sy = (img.height - dim) / 2
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(img, sx, sy, dim, dim, x - r, y - r, size, size)
  ctx.restore()
}

function resolveFontSize(ctx, cfg, text, fontFamily) {
  const { maxWidth, fontSize, minFontSize = 10 } = cfg
  if (!maxWidth) return fontSize
  const words = text.split(' ')
  let size = fontSize
  while (size > minFontSize) {
    ctx.font = `${size}px ${fontFamily}`
    const totalWidth = ctx.measureText(text).width
    if (totalWidth <= maxWidth) break
    const slotPerWord = maxWidth / words.length
    const overflow = words.some(w => ctx.measureText(w).width > slotPerWord * 1.5)
    if (!overflow && totalWidth <= maxWidth) break
    size -= 1
  }
  return Math.max(size, minFontSize)
}

function drawTeksNama(ctx, cfg, text, fontFamily) {
  ctx.save()
  const size = resolveFontSize(ctx, cfg, text, fontFamily)
  ctx.font = `${size}px ${fontFamily}`
  ctx.fillStyle = cfg.color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(text, cfg.x, cfg.y)
  ctx.restore()
}

function drawTeks(ctx, cfg, text, fontFamily) {
  ctx.save()
  ctx.font = `${cfg.fontSize}px ${fontFamily}`
  ctx.fillStyle = cfg.color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(text, cfg.x, cfg.y)
  ctx.restore()
}

async function generateIgimg(photoBuffer, ppBuffer, nama, username, outPath) {
  await setup()
  const canvas = createCanvas(BG_W, BG_H)
  const ctx = canvas.getContext('2d')
  const bgImg = await loadImage(bgImgBuffer)
  ctx.drawImage(bgImg, 0, 0, BG_W, BG_H)
  const photoImg = await loadImage(photoBuffer)
  const ppImg = await loadImage(ppBuffer)
  await drawFoto(ctx, photoImg, configLayout.foto)
  await drawEdgeBlur(ctx, photoImg, configLayout.foto, configLayout.edgeBlur)
  await drawPP(ctx, ppImg, configLayout.pp)
  drawTeksNama(ctx, configLayout.namaTeks, nama, 'InterSemiBold')
  drawTeks(ctx, configLayout.usernameTeks, username, 'InterRegular')
  await writeFile(outPath, await canvas.encode('png'))
  return outPath
}

async function handler(m, { sock }) {
    try {
        let targetImgBuffer = null;
        try {
            if (m.quoted && typeof m.quoted.download === 'function') {
                targetImgBuffer = await m.quoted.download();
            } else if (typeof m.download === 'function' && (m.isMedia || m.mtype === 'imageMessage' || m.type === 'imageMessage')) {
                targetImgBuffer = await m.download();
            }
        } catch (e) {}

        if (!targetImgBuffer) {
            return m.reply(
                `📸 *FITUR IG STORY IMAGE*\n\n` +
                `Fitur ini memungkinkan kamu untuk menyulap foto biasamu menjadi tampilan ala Instagram Story yang estetik dan kekinian.\n\n` +
                `*CARA PENGGUNAAN:*\n` +
                `- Kirimkan gambar langsung dengan caption \`${m.prefix}igstoryimg\`\n` +
                `- Atau balas (*reply*) pesan gambar yang sudah ada dengan perintah \`${m.prefix}igstoryimg\`\n\n` +
                `_Bot akan otomatis memasang foto profil dan namamu di dalam gambarnya!_`
            );
        }

        await m.react('🕕');

        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(m.sender, 'image');
        } catch (e) {
            ppUrl = 'https://i.ibb.co/3Fh9Q6M/empty-profile.png';
        }

        let ppBuffer;
        try {
            ppBuffer = await downloadData(ppUrl);
        } catch (e) {
            ppBuffer = targetImgBuffer;
        }

        const nama = m.pushName || 'Someone';
        const username = '@' + m.sender.split('@')[0];

        const tempDir = join(process.cwd(), 'temp');
        if (!existsSync(tempDir)) await mkdir(tempDir, { recursive: true });
        
        const outPath = join(tempDir, `igstory_${Date.now()}.png`);
        
        await generateIgimg(targetImgBuffer, ppBuffer, nama, username, outPath);

        await sock.sendMessage(m.chat, { image: { url: outPath } }, { quoted: m });

        if (existsSync(outPath)) unlinkSync(outPath);
        await m.react('✅');

    } catch (e) {
        bgImgBuffer = null;
        fontsLoaded = false;
        await m.react('❌');
        m.reply(`❌ *GAGAL MEMPROSES GAMBAR*\n\nMaaf, terjadi kesalahan saat mencoba membuat gambar IG Story. Pastikan gambar yang dikirim valid dan coba lagi beberapa saat.`);
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

export default mergePlugins(
    'canvas',
    _igstory,
    _igstoryimg,
)
