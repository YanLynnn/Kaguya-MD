/**

* Kaguya Multi Device — WhatsApp & Tele Bot
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


import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import chokidar from 'chokidar'
import { AsyncLocalStorage } from 'async_hooks'
import { fileURLToPath, pathToFileURL } from 'url'
import { denyOptions, jidNumber, sleep, saveDB, isLidJid, resolvePhone, rbLibs, rbFeatures, rbDefine } from './core-system.js'
import { getMeta, isAdminJid } from './wa.js'
import './scraper.js'
import crypto from 'crypto'
import axios from 'axios'
import * as cheerio from 'cheerio'
import mime from 'mime-types'
import { createRequire } from 'module'
import ffmpeg from 'fluent-ffmpeg'
import { cpus, tmpdir } from 'os'
import { exec, spawn } from 'child_process'
import FormData from 'form-data'
import moment from 'moment-timezone'
import { request } from 'undici'
import { netguard as dioNetguard } from './scraper.js'

// ───────── dari file pecahan lain ─────────
import { dioLibs } from './plugin-libs.js'

// bot tetap menyala. ffmpeg memakai ffmpeg sistem (pkg install ffmpeg), fitur canvas saja yang nonaktif.
const _require = createRequire(import.meta.url)
let ffmpegBin = 'ffmpeg'
try { ffmpegBin = _require('@ffmpeg-installer/ffmpeg').path || 'ffmpeg' } catch {}
let createCanvas, loadImage
try {
    ({ createCanvas, loadImage } = _require('@napi-rs/canvas'))
} catch {
    createCanvas = loadImage = () => { throw new Error('@napi-rs/canvas tidak tersedia di perangkat ini') }
}


// ╔══════════════ [ command.js ] ══════════════╗
// Muat plugin dari folder plugins/, baca prefix & command, cocokkan plugin, kartu contoh, plugin pasif.

// ───────── loader ─────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginFolder = path.join(__dirname, '../plugins')

global.plugins = {}

const green = (t) => chalk.greenBright(t)
const red = (t) => chalk.red(t)
const blue = (t) => chalk.cyanBright(t)

async function scanDir(dir) {
    let entries = await fs.promises.readdir(dir, { withFileTypes: true })
    let files = await Promise.all(entries.map(entry => {
        let full = path.resolve(dir, entry.name)
        return entry.isDirectory() ? scanDir(full) : full
    }))
    return files.flat()
}

function keyFor(filename) {
    return filename.replace(pluginFolder, '').replace(/\\/g, '/')
}

async function loadPlugin(filename) {
    try {
        const module = await import(`${pathToFileURL(filename).href}?update=${Date.now()}`)
        return module.default || module
    } catch (e) {
        console.error(red(`[ ERROR ] Gagal memuat plugin ${path.basename(filename)}:`), e)
        return null
    }
}

export async function initPlugins() {
    try {
        // urut alfabet supaya command ganda selalu dimenangkan plugin yang sama di semua host
        let files = (await scanDir(pluginFolder)).filter(f => f.endsWith('.js')).sort()
        for (let file of files) {
            global.plugins[keyFor(file)] = await loadPlugin(file)
        }
        console.log(green(`[ SUCCESS ] Memuat ${countCommands().toLocaleString('id-ID')} plugin`))
    } catch (e) {
        console.error(red('[ ERROR ] Gagal inisialisasi folder plugin:'), e)
    }

    chokidar.watch(pluginFolder, { persistent: true, ignoreInitial: true, ignored: (f, st) => !!st?.isFile() && !f.endsWith('.js') })
        .on('add', async (filename) => {
            console.log(green(`[ BARU ] ${path.basename(filename)}`))
            global.plugins[keyFor(filename)] = await loadPlugin(filename)
        })
        .on('change', async (filename) => {
            console.log(blue(`[ UPDATE ] ${path.basename(filename)}`))
            global.plugins[keyFor(filename)] = await loadPlugin(filename)
        })
        .on('unlink', (filename) => {
            console.log(red(`[ HAPUS ] ${path.basename(filename)}`))
            delete global.plugins[keyFor(filename)]
        })
}


// Plugin gabungan (mergePlugins) membawa `commandGroups`: tiap anggota tampil sebagai
// entri menu sendiri. Plugin biasa dikembalikan apa adanya.
export function expandPlugins() {
    const out = []
    for (const plugin of new Set(Object.values(global.plugins))) {
        if (!plugin) continue
        if (Array.isArray(plugin.commandGroups)) {
            for (const group of plugin.commandGroups) out.push({ ...group, tags: group.tags || plugin.tags, disabled: plugin.disabled })
        } else {
            out.push(plugin)
        }
    }
    return out
}

// Total command (sama seperti `info.total` di plugins/main/menu.js)
export function countCommands() {
    let command = 0
    for (const h of expandPlugins()) {
        if (!h || !h.command || h.command instanceof RegExp || h.disabled) continue
        const hidden = Array.isArray(h.hide) ? h.hide : []
        command += (Array.isArray(h.command) ? h.command : [h.command])
            .map(String)
            .filter(c => c && !c.includes('_') && !hidden.includes(c)).length
    }
    return command
}
export function matchPlugin(plugin, command) {
    if (!plugin?.command) return false
    if (Array.isArray(plugin.command)) return plugin.command.includes(command)
    if (plugin.command instanceof RegExp) return plugin.command.test(command)
    return plugin.command === command
}

// ───────── prefix ─────────
const EMPTY_TOKENS = new Set(['""', "''", '“”', '‘’', '``', 'kosong', 'none', 'tanpa', 'empty'])
const MAX_PREFIX_LENGTH = 5

export function getPrefixes() {
    return Array.isArray(global.prefix) ? global.prefix.filter(p => typeof p === 'string') : ['.']
}

export function primaryPrefix() {
    return getPrefixes().find(p => p !== '') ?? ''
}

export function describePrefix(prefix) {
    return prefix === '' ? '(kosong)' : prefix
}

export function normalizePrefixToken(raw) {
    const token = String(raw ?? '').trim()
    if (!token) return null
    if (EMPTY_TOKENS.has(token.toLowerCase())) return ''

    const unquoted = token.replace(/^["'“‘`]+|["'”’`]+$/g, '')
    const value = unquoted || token

    if (/\s/.test(value) || value.length > MAX_PREFIX_LENGTH) return null
    return value
}

function isKnownCommand(name) {
    return Object.values(global.plugins || {}).some(plugin => matchPlugin(plugin, name))
}

function build(body, prefix) {
    const rest = body.slice(prefix.length).trimStart()
    const command = (rest.split(/\s+/)[0] || '').toLowerCase()
    const text = rest.slice(command.length).trim()
    return { isCmd: command !== '', prefix, command, text }
}

export function parseCommand(body) {
    const input = body || ''
    const configured = getPrefixes()
    const candidates = [...new Set(configured)]

    const explicit = candidates
        .filter(p => p !== '')
        .sort((a, b) => b.length - a.length)
        .find(p => input.startsWith(p))

    if (explicit !== undefined) {
        const parsed = build(input, explicit)
        if (parsed.isCmd) return parsed
    }

    if (candidates.includes('')) {
        const first = (input.trim().split(/\s+/)[0] || '').toLowerCase()
        if (first && isKnownCommand(first)) return build(input.trimStart(), '')
    }

    return { isCmd: false, prefix: undefined, command: '', text: input.trim() }
}

// ───────── card (gambar + teks, tanpa tombol) ─────────
// Urutan percobaan: gambar lokal -> gambar URL -> teks biasa.
// `buttons` lama (kalau masih ada yang memanggil) dibuang; tombol URL ditulis sebagai baris link.
export async function sendCard(sock, m, { body, footer, imageFile, imageUrl, buttons = [] }) {
    const links = buttons.filter(b => b.url).map(b => `${b.text}: ${b.url}`)
    const text = [body, footer, links.join('\n')].filter(Boolean).join('\n\n')

    const images = []
    if (imageFile && fs.existsSync(imageFile)) images.push(fs.readFileSync(imageFile))
    if (imageUrl) images.push({ url: imageUrl })

    for (const image of images) {
        try {
            return await sock.sendMessage(m.chat, { image, caption: text }, { quoted: m })
        } catch (e) {
            console.error('[CARD]', e.message)
        }
    }

    return sock.sendMessage(m.chat, { text }, { quoted: m })
}

// ───────── example ─────────
export async function sendExample(sock, m, { prefix, command, usage }) {
    await sock.sendMessage(m.chat, {
        text: `• *Contoh:* ${prefix}${command} ${usage}`,
        mentions: [m.sender]
    }, { quoted: m })
}

// ───────── passive plugins (customPrefix) ─────────
// Plugin dengan `handler.customPrefix = /regex/` dipanggil untuk pesan biasa (bukan command)
// yang cocok dengan regex-nya. Plugin boleh `return false` (atau diam tanpa membalas)
// supaya plugin berikutnya yang cocok ikut dicoba.
const responseTracker = new AsyncLocalStorage()

function trackResponses(sock) {
    if (sock.__tracked) return
    sock.__tracked = true
    const original = sock.sendMessage.bind(sock)
    sock.sendMessage = (...args) => {
        const store = responseTracker.getStore()
        if (store) store.responded = true
        return original(...args)
    }
}

export async function runPassivePlugins(sock, m, ctx) {
    const text = m.text || ctx.body || ''
    if (!text) return false

    const candidates = [...new Set(Object.values(global.plugins).filter(p => p?.customPrefix instanceof RegExp && !p.disabled))]
    const matched = [
        ...candidates.filter(p => p.customPrefix.source.startsWith('^') && p.customPrefix.test(text)),
        ...candidates.filter(p => !p.customPrefix.source.startsWith('^') && p.customPrefix.test(text))
    ]
    if (!matched.length) return false

    trackResponses(sock)

    for (const plugin of matched) {
        if (plugin.owner && !ctx.isOwner) continue
        if (plugin.premium && !ctx.isPremium) continue
        if (plugin.group && !m.isGroup) continue
        if (plugin.private && m.isGroup) continue

        const store = { responded: false }
        try {
            const result = await responseTracker.run(store, () => plugin(m, { ...ctx, args: [], text, command: '', prefix: '' }))
            if (result === false || (result === undefined && !store.responded)) continue
            return true
        } catch (e) {
            console.error(e)
            if (store.responded) return true
        }
    }

    return false
}

// ╔══════════════ [ sticker.js ] ══════════════╗
// Unduh & ubah gambar/video jadi stiker webp, kirim stiker, paket stiker, kirim media.

/**
 * Credits & Thanks to
 * Developer = Lucky Archz ( Zann )
 * Lead owner = HyuuSATAN
 * Owner = Keisya
 * Designer = Danzzz
 * Wileys = Penyedia baileys
 * Penyedia APIs
 * Penyedia Scrapers
 * 
 * JANGAN HAPUS/GANTI CREDITS & THANKS TO
 * JANGAN DIJUAL YA MEK
 * 
 */
// ───────── sticker ─────────
// Konversi gambar/video ke sticker (webp), penulisan exif (pack & author),
// sticker pack, dan helper kirim media gaya lama (sendMedia / sendFile).


ffmpeg.setFfmpegPath(ffmpegBin)

let webpmux;

async function initWebpmux() {
    if (!webpmux) {
        try {
            const mod = await import('node-webpmux');
            webpmux = mod.default || mod;
        } catch (e) {
            console.error('[EXIF] Failed to load node-webpmux:', e.message);
        }
    }
    return webpmux;
}

function getTempDir() {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
}

const DEFAULT_METADATA = {
    packname: 'Bot',
    author: 'Bot',
    packId: 'com.bot.sticker',
    emojis: ['🤖']
};

function createExif(options = {}) {
    const packname = options.packname ?? DEFAULT_METADATA.packname;
    const author = options.author ?? DEFAULT_METADATA.author;
    const packId = options.packId ?? DEFAULT_METADATA.packId;
    const emojis = options.emojis ?? DEFAULT_METADATA.emojis;
    
    const json = {
        'sticker-pack-id': packId,
        'sticker-pack-name': packname,
        'sticker-pack-publisher': author,
        'emojis': emojis,
        'is-avatar-sticker': 0,
        'android-app-store-link': '',
        'ios-app-store-link': ''
    };
    
    let exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00,
        0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57,
        0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00,
        0x00, 0x00
    ]);
    
    let jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
    let exif = Buffer.concat([exifAttr, jsonBuffer]);
    
    exif.writeUIntLE(jsonBuffer.length, 14, 4);
    
    return exif;
}

function imageToWebpFFmpeg(buffer) {
    return new Promise((resolve, reject) => {
        const tmpDir = getTempDir();
        const inputPath = path.join(tmpDir, `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.png`);
        const outputPath = path.join(tmpDir, `sticker_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`);
        
        fs.writeFileSync(inputPath, buffer);
        
        ffmpeg(inputPath)
            .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,setsar=1",
                '-loop', '0',
                '-preset', 'default',
                '-an',
                '-vsync', '0',
                '-quality', '80'
            ])
            .toFormat('webp')
            .on('end', () => {
                try {
                    const webpBuffer = fs.readFileSync(outputPath);
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                    resolve(webpBuffer);
                } catch (err) {
                    reject(err);
                }
            })
            .on('error', (err) => {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                reject(err);
            })
            .save(outputPath);
    });
}

function videoToWebpFFmpeg(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        const tmpDir = getTempDir();
        const isGif = buffer.slice(0, 4).toString("hex") === "47494638";
        const ext = isGif ? "gif" : "mp4";
        const inputPath = path.join(tmpDir, `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`);
        const outputPath = path.join(tmpDir, `animated_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`);
        
        fs.writeFileSync(inputPath, buffer);
        
        const duration = options.duration || 5;
        const fps = options.fps || 15;
        
        ffmpeg(inputPath)
            .inputOptions(['-y'])
            .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', `fps=${fps},scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,setsar=1`,
                '-loop', '0',
                '-ss', '0',
                '-t', String(duration),
                '-preset', 'default',
                '-an',
                '-vsync', '0'
            ])
            .toFormat('webp')
            .on('end', () => {
                try {
                    const webpBuffer = fs.readFileSync(outputPath);
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                    resolve(webpBuffer);
                } catch (err) {
                    reject(err);
                }
            })
            .on('error', (err) => {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                reject(err);
            })
            .save(outputPath);
    });
}

async function addExifToWebp(webpBuffer, options = {}) {
    await initWebpmux();
    
    if (!webpmux) {
        return addExifToWebpFallback(webpBuffer, options);
    }
    
    try {
        const exif = createExif(options);
        const img = new webpmux.Image();
        
        await img.load(webpBuffer);
        img.exif = exif;
        
        return await img.save(null);
    } catch (error) {
        console.error('[EXIF] webpmux error:', error.message);
        return addExifToWebpFallback(webpBuffer, options);
    }
}

async function createStickerFromImage(imageBuffer, options = {}) {
    const isWebp = imageBuffer.slice(0, 4).toString("hex") === "52494646";
    const webpBuffer = isWebp ? imageBuffer : await imageToWebpFFmpeg(imageBuffer);
    return await addExifToWebp(webpBuffer, options);
}

async function createStickerFromVideo(videoBuffer, options = {}) {
    const isWebp = videoBuffer.slice(0, 4).toString("hex") === "52494646";
    let webpBuffer;
    
    if (isWebp) {
        webpBuffer = videoBuffer;
    } else {
        webpBuffer = await videoToWebpFFmpeg(videoBuffer, {
            duration: options.duration || 5,
            fps: options.fps || 15
        });
    }
    return await addExifToWebp(webpBuffer, {
        packname: options.packname,
        author: options.author,
        emojis: options.emojis
    });
}

function addExifToWebpFallback(webpBuffer, options = {}) {
    const exif = createExif(options);
    const hasExif = webpBuffer.indexOf(Buffer.from('EXIF')) !== -1;
    
    if (hasExif) {
        return replaceExifInWebp(webpBuffer, exif);
    }
    const riffHeader = webpBuffer.slice(0, 4);
    const webpSignature = webpBuffer.slice(8, 12);
    const webpData = webpBuffer.slice(12);
    const exifChunkId = Buffer.from('EXIF');
    const exifSize = Buffer.alloc(4);
    exifSize.writeUInt32LE(exif.length);
    
    const exifChunk = Buffer.concat([exifChunkId, exifSize, exif]);
    const padding = exif.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0);
    const newWebpData = Buffer.concat([webpData, exifChunk, padding]);
    const newFileSize = Buffer.alloc(4);
    newFileSize.writeUInt32LE(4 + newWebpData.length);
    
    return Buffer.concat([riffHeader, newFileSize, webpSignature, newWebpData]);
}

function replaceExifInWebp(webpBuffer, newExif) {
    const exifIndex = webpBuffer.indexOf(Buffer.from('EXIF'));
    
    if (exifIndex === -1) {
        return addExifToWebpFallback(webpBuffer, {});
    }
    
    const oldExifSize = webpBuffer.readUInt32LE(exifIndex + 4);
    const padding = oldExifSize % 2 === 1 ? 1 : 0;
    
    const beforeExif = webpBuffer.slice(0, exifIndex);
    const afterExif = webpBuffer.slice(exifIndex + 8 + oldExifSize + padding);
    
    const exifChunkId = Buffer.from('EXIF');
    const exifSize = Buffer.alloc(4);
    exifSize.writeUInt32LE(newExif.length);
    
    const newPadding = newExif.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0);
    
    const newWebp = Buffer.concat([beforeExif, exifChunkId, exifSize, newExif, newPadding, afterExif]);
    
    const newFileSize = newWebp.length - 8;
    newWebp.writeUInt32LE(newFileSize, 4);
    
    return newWebp;
}

function readExifFromWebp(webpBuffer) {
    const exifIndex = webpBuffer.indexOf(Buffer.from('EXIF'));
    
    if (exifIndex === -1) {
        return null;
    }
    
    const exifSize = webpBuffer.readUInt32LE(exifIndex + 4);
    const exifData = webpBuffer.slice(exifIndex + 8, exifIndex + 8 + exifSize);
    
    try {
        const jsonStart = 22;
        const jsonData = exifData.slice(jsonStart);
        return JSON.parse(jsonData.toString('utf8'));
    } catch {
        return null;
    }
}

function isValidWebp(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
        return false;
    }
    
    const riff = buffer.slice(0, 4).toString('ascii');
    const webp = buffer.slice(8, 12).toString('ascii');
    
    return riff === 'RIFF' && webp === 'WEBP';
}

async function isAnimatedWebp(buffer) {
    if (!isValidWebp(buffer)) {
        return false;
    }
    
    return buffer.indexOf(Buffer.from('ANIM')) !== -1 || 
           buffer.indexOf(Buffer.from('ANMF')) !== -1;
}

function getWebpDimensions(buffer) {
    if (!isValidWebp(buffer)) {
        return null;
    }
    
    try {
        const vp8Index = buffer.indexOf(Buffer.from('VP8 '));
        if (vp8Index !== -1) {
            const width = buffer.readUInt16LE(vp8Index + 14) & 0x3FFF;
            const height = buffer.readUInt16LE(vp8Index + 16) & 0x3FFF;
            return { width, height };
        }
        const vp8lIndex = buffer.indexOf(Buffer.from('VP8L'));
        if (vp8lIndex !== -1) {
            const bits = buffer.readUInt32LE(vp8lIndex + 9);
            const width = (bits & 0x3FFF) + 1;
            const height = ((bits >> 14) & 0x3FFF) + 1;
            return { width, height };
        }
        const vp8xIndex = buffer.indexOf(Buffer.from('VP8X'));
        if (vp8xIndex !== -1) {
            const width = (buffer.readUIntLE(vp8xIndex + 12, 3) + 1);
            const height = (buffer.readUIntLE(vp8xIndex + 15, 3) + 1);
            return { width, height };
        }
        
        return null;
    } catch {
        return null;
    }
}

function generateStickerId() {
    return `sticker_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function cleanTempFiles(maxAge = 3600000) {
    const tmpDir = path.join(process.cwd(), 'tmp');
    
    if (!fs.existsSync(tmpDir)) {
        return;
    }
    
    const now = Date.now();
    const files = fs.readdirSync(tmpDir);
    
    for (const file of files) {
        if (file.startsWith('exif_') || file.startsWith('input_') || 
            file.startsWith('output_') || file.startsWith('img_') || 
            file.startsWith('vid_') || file.startsWith('sticker_') ||
            file.startsWith('animated_')) {
            const filePath = path.join(tmpDir, file);
            try {
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > maxAge) {
                    fs.unlinkSync(filePath);
                }
            } catch {
            }
        }
    }
}

const PRESETS = {
    default: {
        packname: 'Bot',
        author: 'Bot',
        emojis: ['🤖']
    },
    meme: {
        packname: 'Meme Pack',
        author: 'Bot',
        emojis: ['😂', '🤣']
    },
    love: {
        packname: 'Love Pack',
        author: 'Bot',
        emojis: ['❤️', '💕', '💖']
    },
    sad: {
        packname: 'Sad Pack',
        author: 'Bot',
        emojis: ['😢', '😭', '💔']
    },
    angry: {
        packname: 'Angry Pack',
        author: 'Bot',
        emojis: ['😠', '😡', '💢']
    }
};

export {
    createExif, addExifToWebp, addExifToWebpFallback, replaceExifInWebp, readExifFromWebp, initWebpmux,
    imageToWebpFFmpeg, videoToWebpFFmpeg,
    createStickerFromImage, createStickerFromVideo,
    isValidWebp, isAnimatedWebp, getWebpDimensions,
    generateStickerId, cleanTempFiles, getTempDir,
    ffmpeg,
    DEFAULT_METADATA, PRESETS
}

let _sharp = null
async function getSharp() {
    if (!_sharp) _sharp = (await import('sharp')).default
    return _sharp
}

const hex = (buf, n) => buf.slice(0, n).toString('hex')
const isWebpBuf = (buf) => hex(buf, 4) === '52494646'

export async function downloadBuffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    return Buffer.from(res.data)
}

export async function resolveInput(input) {
    if (Buffer.isBuffer(input)) return input
    if (typeof input === 'string') {
        if (/^https?:\/\//.test(input)) return downloadBuffer(input)
        if (fs.existsSync(input)) return fs.readFileSync(input)
    }
    if (input?.url && /^https?:\/\//.test(input.url)) return downloadBuffer(input.url)
    throw new Error('Input harus berupa Buffer, URL, atau path file')
}

export async function imageToWebp(buffer) {
    try {
        const sharp = await getSharp()
        return await sharp(buffer)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 80 })
            .toBuffer()
    } catch (e) {
        throw new Error('Gagal konversi gambar ke webp: ' + e.message)
    }
}

export function videoToWebp(buffer) {
    return new Promise((resolve, reject) => {
        if (!buffer || buffer.length < 1000) return reject(new Error('Buffer video tidak valid'))

        const dir = getTempDir()
        const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const ext = hex(buffer, 4) === '47494638' ? 'gif' : 'mp4'
        const input = path.join(dir, `in_${stamp}.${ext}`)
        const output = path.join(dir, `out_${stamp}.webp`)
        fs.writeFileSync(input, buffer)

        const cleanup = () => {
            for (const f of [input, output]) {
                try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch {}
            }
        }
        const timer = setTimeout(() => {
            cleanup()
            reject(new Error('Konversi video timeout'))
        }, 60000)

        ffmpeg(input)
            .inputOptions(['-y', '-t', '6'])
            .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', "fps=12,scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,setsar=1",
                '-loop', '0',
                '-preset', 'default',
                '-an',
                '-vsync', '0',
                '-q:v', '50'
            ])
            .toFormat('webp')
            .on('end', () => {
                clearTimeout(timer)
                try {
                    if (!fs.existsSync(output) || fs.statSync(output).size < 100) {
                        cleanup()
                        return reject(new Error('Hasil konversi kosong'))
                    }
                    const out = fs.readFileSync(output)
                    cleanup()
                    resolve(out)
                } catch (e) {
                    cleanup()
                    reject(e)
                }
            })
            .on('error', (e) => {
                clearTimeout(timer)
                cleanup()
                reject(new Error('FFmpeg error: ' + e.message))
            })
            .save(output)
    })
}

async function withExif(webp, options = {}) {
    try {
        return await addExifToWebp(webp, {
            packname: options.packname ?? DEFAULT_METADATA.packname,
            author: options.author ?? DEFAULT_METADATA.author,
            emojis: options.emojis || DEFAULT_METADATA.emojis
        })
    } catch (e) {
        console.log('[Sticker] EXIF gagal, kirim tanpa exif:', e.message)
        return webp
    }
}

// ───────── sticker ─────────
export async function sendImageAsSticker(sock, jid, input, quoted, options = {}) {
    const buffer = await resolveInput(input)
    let webp = isWebpBuf(buffer) ? buffer : await imageToWebp(buffer)
    webp = await withExif(webp, options)
    return sock.sendMessage(jid, { sticker: webp }, { quoted })
}

export async function sendVideoAsSticker(sock, jid, input, quoted, options = {}) {
    const buffer = await resolveInput(input)
    let webp = isWebpBuf(buffer) ? buffer : await videoToWebp(buffer)
    webp = await withExif(webp, options)
    return sock.sendMessage(jid, { sticker: webp }, { quoted })
}

async function toWebp(buffer) {
    if (isWebpBuf(buffer)) return buffer
    if (hex(buffer, 4) === '47494638') return videoToWebp(buffer)
    try {
        return await imageToWebp(buffer)
    } catch {
        return videoToWebp(buffer)
    }
}

export async function sendStickerPack(sock, jid, stickers, quoted, options = {}) {
    if (!stickers?.length) throw new Error('Tidak ada sticker')

    const name = options.name ?? options.packname ?? 'Sticker Pack'
    const publisher = options.publisher ?? options.author ?? global.namebot ?? 'Bot'
    const emojis = options.emojis || ['🎨']

    const list = []
    for (let i = 0; i < stickers.length; i++) {
        try {
            let item = stickers[i]
            if (typeof item === 'string') {
                if (/^https?:\/\//.test(item)) item = await downloadBuffer(item)
                else if (fs.existsSync(item)) item = fs.readFileSync(item)
            }
            if (!Buffer.isBuffer(item) || item.length < 100) continue
            list.push({ sticker: await toWebp(item), emojis, accessibilityLabel: '' })
        } catch (e) {
            console.log(`[StickerPack] sticker ${i + 1} dilewati:`, e.message)
        }
    }
    if (!list.length) throw new Error('Tidak ada sticker yang bisa disiapkan')

    try {
        return await sock.sendMessage(jid, {
            stickerPack: {
                packId: options.id || crypto.randomUUID(),
                name,
                publisher,
                description: options.description || '',
                cover: list[0].sticker,
                stickers: list
            }
        }, quoted ? { quoted } : {})
    } catch (e) {
        // Versi socket yang belum mengenal pesan stickerPack: kirim satu per satu.
        console.log('[StickerPack] stickerPack tidak didukung, kirim satuan:', e.message)
        let last
        for (const s of list) {
            const withMeta = await withExif(s.sticker, { packname: name, author: publisher, emojis })
            last = await sock.sendMessage(jid, { sticker: withMeta }, quoted ? { quoted } : {})
        }
        return last
    }
}

// ───────── media ─────────
export async function sendMedia(sock, jid, source, caption = '', quoted, options = {}) {
    if (source && typeof source === 'object' && !Buffer.isBuffer(source) &&
        (source.image || source.video || source.audio || source.document)) {
        return sock.sendMessage(jid, source, options.quoted || quoted ? { quoted: options.quoted || quoted } : {})
    }

    let data = source
    let mimetype = options.mimetype || 'application/octet-stream'
    let fileName = options.fileName || 'file'

    if (Buffer.isBuffer(source)) {
        // langsung dipakai
    } else if (typeof source === 'string' && /^https?:\/\//.test(source)) {
        data = { url: source }
    } else if (typeof source === 'string' && fs.existsSync(source)) {
        mimetype = options.mimetype || mime.lookup(source) || 'application/octet-stream'
        fileName = options.fileName || path.basename(source)
        data = fs.readFileSync(source)
    } else if (source && typeof source.url === 'string') {
        data = { url: source.url }
    } else {
        throw new Error('Source harus Buffer, URL, path file, { url }, atau payload media')
    }

    const type = options.type || options.mediaType
    const { type: _t, mediaType: _mt, quoted: _q, ...rest } = options
    const captionField = caption != null && caption !== '' ? { caption } : {}
    let payload

    if (type === 'image') payload = { image: data, ...captionField, ...rest }
    else if (type === 'video') payload = { video: data, ...captionField, ...rest }
    else if (type === 'audio') {
        payload = {
            audio: data,
            mimetype: mimetype !== 'application/octet-stream' ? mimetype : 'audio/mpeg',
            ptt: rest.ptt || false,
            ...rest
        }
    } else {
        payload = { document: data, mimetype, fileName, ...captionField, ...rest }
    }

    return sock.sendMessage(jid, payload, { quoted: options.quoted || quoted })
}

// Gaya Baileys-MD klasik: conn.sendFile(jid, input, filename, caption, quoted, ptt, options)
export async function sendFileClassic(sock, jid, input, filename = '', caption = '', quoted, ptt = false, options = {}) {
    let buffer
    if (Buffer.isBuffer(input)) buffer = input
    else if (typeof input === 'string' && /^https?:\/\//.test(input)) buffer = await downloadBuffer(input)
    else if (typeof input === 'string' && fs.existsSync(input)) buffer = fs.readFileSync(input)
    else if (typeof input === 'string' && /^data:.*?\/.*?;base64,/i.test(input)) buffer = Buffer.from(input.split(',')[1], 'base64')
    else throw new Error('Input sendFile tidak valid')

    let mimetype = options.mimetype || mime.lookup(filename) || ''
    if (!mimetype) {
        const { fileTypeFromBuffer } = await import('file-type')
        mimetype = (await fileTypeFromBuffer(buffer))?.mime || 'application/octet-stream'
    }

    const { mimetype: _m, asDocument, ...rest } = options
    let payload
    if (asDocument) payload = { document: buffer, mimetype, fileName: filename || 'file', caption }
    else if (mimetype === 'image/webp') payload = { sticker: buffer }
    else if (mimetype.startsWith('image/')) payload = { image: buffer, caption }
    else if (mimetype.startsWith('video/')) payload = { video: buffer, mimetype, caption }
    else if (mimetype.startsWith('audio/')) payload = { audio: buffer, mimetype: ptt ? 'audio/ogg; codecs=opus' : mimetype, ptt: !!ptt }
    else payload = { document: buffer, mimetype, fileName: filename || 'file', caption }

    return sock.sendMessage(jid, { ...payload, ...rest }, { quoted })
}

// ╔══════════════ [ plugin-kit.js ] ══════════════╗
// Alat bantu menulis plugin: konteks saluran, database, penyesuai sock/pesan, pembungkus plugin.

// ───────── plugin-kit ─────────
// Jembatan untuk plugin sticker / download / vps yang memakai format
//   1. gaya config   : const pluginConfig = {...}; async function handler(m, { sock })
//   2. gaya klasik   : handler.command = [...]; handler(m, { conn, usedPrefix, args })
// supaya bisa jalan di handler bot ini tanpa mengubah logika plugin.
//
// Isi file ini:
//   - config / te / saluranCtx / getDatabase : pengganti config, template error,
//     konteks saluran, dan database sesi sementara
//   - compatSock / enhanceMessage            : tambahan method pada `sock` dan `m`
//   - wrapPlugin / wrapClassic               : ubah plugin ke bentuk handler bot
//   - mergePlugins                           : gabung beberapa plugin jadi satu file
//
// Perbedaan penting yang dijembatani:
//   - `m.text` di plugin = teks SETELAH command (di bot = seluruh pesan), jadi plugin
//     menerima salinan `m` (Proxy) dengan `text` yang sudah disesuaikan. Objek `m`
//     asli tidak diubah.
//   - `m.prefix`, `m.command`, `m.args`, `m.react`, `m.isOwner` ditambahkan.
//   - `sock.sendMedia / sendImageAsSticker / sendVideoAsSticker / sendStickerPack /
//     sendButton / sendFile / reply` disediakan lewat Proxy, jadi method bawaan
//     socket dan luna-lib tidak tertimpa.


// ───────── config ─────────
const DEFAULT_ERROR_TEMPLATE =
    '☢ Kayaknya command `{prefix}{command}` lagi ada kendala\nSilahkan coba lagi nanti, {pushName}\n\n_Jika masalah berlanjut, silahkan hubungi owner bot_'

const config = {
    get bot() {
        return {
            name: global.namebot || 'Bot',
            version: global.versi || '1.0.0',
            developer: global.ownername || 'Owner'
        }
    },
    get sticker() {
        return {
            packname: global.stickerPack?.packname || global.namebot || 'Bot',
            author: global.stickerPack?.author || global.ownername || 'Owner'
        }
    },
    get saluran() {
        return {
            id: global.idSaluran || '',
            name: global.nameSaluran || global.namebot || 'Bot',
            link: global.linkSaluran || ''
        }
    },
    get errorTemplate() {
        return global.errorTemplate || DEFAULT_ERROR_TEMPLATE
    },
    // Asset lokal (dipakai getAssetBuffer). Kosong secara default, fitur
    // yang butuh gambar lokal otomatis jalan tanpa gambar.
    get assets() {
        return global.botAssets || {}
    },
    messages: {
        get wait() { return global.mess?.wait || 'Tunggu sebentar...' },
        error: 'Terjadi kesalahan'
    }
}

export { config }

// ───────── template error ─────────
// te(prefix, command, pushName) -> teks error seragam untuk plugin.
function te(prefix, command, pushName) {
    return String(config.errorTemplate)
        .replace(/\{prefix\}/g, prefix || '.')
        .replace(/\{command\}/g, command || '?')
        .replace(/\{pushName\}/g, pushName || 'User')
}

export { te }

// ───────── konteks saluran ─────────
// contextInfo "diteruskan dari saluran" (dipakai plugin aio dan ttmp3).
// Sengaja kosong (tanpa label diteruskan / info saluran). Fungsinya dipertahankan
// supaya plugin aio & tiktok yang masih memanggilnya tidak error.
export function saluranCtx() {
    return {}
}

// ───────── database sesi sementara ─────────
// Disimpan di memori saja (mis. pilihan hasil stickerly): datanya hidup beberapa menit,
// jadi tidak menyentuh database toko (global.db).
const users = new Map()

const keyOf = (jid) => String(jid || '').replace(/@.+/g, '').replace(/:\d+$/, '')

const database = {
    getUser(jid) {
        const key = keyOf(jid)
        if (!key) return null
        if (!users.has(key)) users.set(key, {})
        return users.get(key)
    },
    save() {}
}

export function getDatabase() {
    return database
}

// ───────── global yang dipakai plugin klasik ─────────
if (!global.APIs) global.APIs = { faa: 'https://api-faa.my.id', lol: 'https://api.lolhuman.xyz', deline: 'https://api.deline.web.id' }
if (!global.wait) global.wait = global.mess?.wait || '･ﾟ✦ Tunggu sebentar ya, lagi aku urus dulu...'
if (!global.fstatus) {
    global.fstatus = {
        key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
        message: { conversation: global.namebot || 'Bot' }
    }
}

// ───────── sock ─────────
function parseButtonParams(json) {
    try { return JSON.parse(json) } catch { return {} }
}

// Plugin lama memanggil sock.sendButton(...) dengan format tombol ({ name, buttonParamsJson }).
// Sekarang dikirim sebagai tombol native sungguhan (quick_reply, cta_url, cta_copy, cta_call,
// single_select, dll). Kalau WhatsApp menolak, otomatis turun ke teks daftar command.
async function sendButtonCompat(sock, jid, source, text, quoted, options = {}) {
    const buttons = options.buttons || []

    if (buttons.length) {
        try {
            const isVideo = options.type === 'video'
            return await sock.sendButtons(jid, {
                text,
                footer: options.footer,
                title: options.title,
                ...(source ? (isVideo ? { video: source } : { image: source }) : {}),
                buttons
            }, { quoted })
        } catch (e) {
            console.log(`[ BUTTON ] tombol native gagal (${e.message}), fallback ke teks`)
        }
    }

    const choices = []
    const links = []

    for (const button of buttons) {
        const params = parseButtonParams(button.buttonParamsJson)

        if (button.name === 'single_select') {
            for (const section of params.sections || []) {
                for (const row of section.rows || []) {
                    choices.push(`-▢ ${String(row.id || row.title).trim()}${row.description ? ` _(${row.description})_` : ''}`)
                }
            }
        } else if (button.name === 'quick_reply') {
            choices.push(`-▢ ${String(params.id || params.display_text).trim()}`)
        } else if (button.name === 'cta_url') {
            links.push(`${params.display_text}: ${params.url}`)
        } else if (button.name === 'cta_copy') {
            links.push(`${params.display_text}: ${params.copy_code}`)
        } else if (button.name === 'cta_call') {
            links.push(`${params.display_text}: ${params.phone_number}`)
        }
    }

    const caption = [
        text,
        choices.length ? choices.join('\n') : '',
        links.join('\n'),
        options.footer || ''
    ].filter(Boolean).join('\n\n') || ' '

    if (source) return sendMedia(sock, jid, source, caption, quoted, { type: options.type || 'image' })
    return sock.sendMessage(jid, { text: caption }, { quoted })
}

const sockProxies = new WeakMap()

export function compatSock(sock) {
    if (!sock) return sock
    if (sockProxies.has(sock)) return sockProxies.get(sock)

    const overrides = {
        sendMedia: (jid, source, caption, quoted, options) => sendMedia(sock, jid, source, caption, quoted, options),
        sendImageAsSticker: (jid, input, quoted, options) => sendImageAsSticker(sock, jid, input, quoted, options),
        sendVideoAsSticker: (jid, input, quoted, options) => sendVideoAsSticker(sock, jid, input, quoted, options),
        sendStickerPack: (jid, stickers, quoted, options) => sendStickerPack(sock, jid, stickers, quoted, options),
        sendButton: (jid, source, text, quoted, options) => sendButtonCompat(sock, jid, source, text, quoted, options),
        sendFile: (jid, input, filename, caption, quoted, ptt, options) => sendFileClassic(sock, jid, input, filename, caption, quoted, ptt, options),
        sendText: (jid, text, quoted, options = {}) => sock.sendMessage(jid, { text, ...options }, { quoted }),
        reply: (jid, text, quoted, options = {}) => sock.sendMessage(jid, { text: String(text), ...options }, { quoted })
    }

    const proxy = new Proxy(sock, {
        get(target, prop) {
            if (Object.prototype.hasOwnProperty.call(overrides, prop)) return overrides[prop]
            const value = Reflect.get(target, prop)
            return typeof value === 'function' ? value.bind(target) : value
        }
    })

    sockProxies.set(sock, proxy)
    return proxy
}

// ───────── pesan ─────────
function enhanceQuoted(quoted) {
    if (!quoted) return quoted
    const mtype = quoted.mtype
    const extra = {
        type: mtype,
        body: quoted.text,
        message: { [mtype]: quoted },
        isImage: mtype === 'imageMessage',
        isVideo: mtype === 'videoMessage',
        isSticker: mtype === 'stickerMessage',
        isAudio: mtype === 'audioMessage'
    }
    return new Proxy(quoted, {
        get(target, prop) {
            if (Object.prototype.hasOwnProperty.call(extra, prop) && target[prop] === undefined) return extra[prop]
            return Reflect.get(target, prop)
        }
    })
}

export function enhanceMessage(m, sock, ctx, { passive = false } = {}) {
    const text = passive ? (ctx.body || m.body || '') : (ctx.text || '')
    const args = text ? text.split(/\s+/).filter(Boolean) : []

    const extra = {
        text,
        args,
        prefix: ctx.prefix || '',
        command: ctx.command || '',
        isCommand: !passive && !!ctx.command,
        isOwner: !!ctx.isOwner,
        isAdmin: !!ctx.isAdmin,
        isPremium: !!ctx.isPremium,
        type: m.mtype,
        mimetype: m.msg?.mimetype,
        isImage: m.mtype === 'imageMessage',
        isVideo: m.mtype === 'videoMessage',
        isSticker: m.mtype === 'stickerMessage',
        isAudio: m.mtype === 'audioMessage',
        quoted: enhanceQuoted(m.quoted),
        react: (emoji) => sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } }).catch(() => null)
    }

    return new Proxy(m, {
        get(target, prop) {
            if (Object.prototype.hasOwnProperty.call(extra, prop)) return extra[prop]
            const value = Reflect.get(target, prop)
            return typeof value === 'function' ? value.bind(target) : value
        }
    })
}

// ───────── cooldown ─────────
const cooldowns = new Map()

function checkCooldown(seconds, sender, command, isOwner) {
    if (!seconds || isOwner) return 0
    const key = `${sender}:${command}`
    const now = Date.now()
    const until = cooldowns.get(key) || 0
    if (until > now) return Math.ceil((until - now) / 1000)
    cooldowns.set(key, now + seconds * 1000)
    if (cooldowns.size > 5000) {
        for (const [k, v] of cooldowns) if (v <= now) cooldowns.delete(k)
    }
    return 0
}

// ───────── gaya config + handler ─────────
export function wrapPlugin(pluginConfig, handler, extra = {}) {
    const names = [...[].concat(pluginConfig.name || []), ...[].concat(pluginConfig.alias || [])]
        .map(n => String(n).toLowerCase())

    const plugin = async (m, ctx) => {
        const passive = !ctx.command
        const sock = compatSock(ctx.sock)

        if (passive) {
            if (!extra.answerHandler) return false
            return extra.answerHandler(enhanceMessage(m, sock, ctx, { passive: true }), sock)
        }

        const wait = checkCooldown(pluginConfig.cooldown, ctx.sender, ctx.command, ctx.isOwner)
        if (wait) return ctx.reply(`Tunggu ${wait} detik lagi sebelum memakai *${ctx.prefix}${ctx.command}* lagi.`)

        return handler(enhanceMessage(m, sock, ctx), { ...ctx, sock, config })
    }

    plugin.command = pluginConfig.isEnabled === false ? [] : names
    plugin.disabled = pluginConfig.isEnabled === false
    plugin.tags = [pluginConfig.category || 'misc']
    plugin.help = [pluginConfig.usage || names[0]]
    plugin.description = pluginConfig.description
    plugin.example = pluginConfig.example
    plugin.owner = !!pluginConfig.isOwner
    plugin.premium = !!pluginConfig.isPremium
    plugin.group = !!pluginConfig.isGroup
    plugin.private = !!pluginConfig.isPrivate
    plugin.admin = !!pluginConfig.isAdmin

    if (extra.answerHandler) plugin.customPrefix = extra.answerRegex || /^(\d{1,3}|batal|cancel)$/i

    return plugin
}

// ───────── gaya klasik (export default handler) ─────────
// Command berbentuk regex sederhana seperti /^(play|putar)$/i diubah jadi array
// supaya muncul di menu. Regex yang rumit dibiarkan apa adanya (tetap jalan,
// hanya tidak tampil di daftar menu).
function normalizeCommand(command) {
    if (!(command instanceof RegExp)) return command
    const simple = command.source.match(/^\^\(?([a-z0-9_]+(?:\|[a-z0-9_]+)*)\)?\$$/i)
    if (!simple) return command
    return simple[1].split('|').map(c => c.toLowerCase())
}

// Tag klasik 'downloader' disamakan dengan kategori 'download'.
function normalizeTags(tags) {
    const list = [].concat(tags || ['misc'])
    return list.map(t => (String(t).toLowerCase() === 'downloader' ? 'download' : t))
}

export function wrapClassic(handler) {
    const plugin = async (m, ctx) => {
        if (!ctx.command) return false

        const sock = compatSock(ctx.sock)
        const mp = enhanceMessage(m, sock, ctx)

        return handler(mp, {
            ...ctx,
            sock,
            conn: sock,
            usedPrefix: ctx.prefix,
            args: mp.args,
            quoted: mp.quoted || mp,
            q: ctx.text
        })
    }

    plugin.command = normalizeCommand(handler.command)
    plugin.tags = normalizeTags(handler.tags)
    plugin.help = handler.help
    plugin.owner = !!(handler.owner || handler.rowner)
    plugin.premium = !!handler.premium
    plugin.group = !!handler.group
    plugin.private = !!handler.private
    plugin.admin = !!handler.admin

    return plugin
}

// ───────── gabung beberapa plugin jadi satu file ─────────
// Tiap plugin tetap utuh (flag, cooldown, handler sendiri); yang digabung hanya
// file-nya. Command yang sama di dua plugin dijalankan oleh plugin yang paling
// atas urutannya. Flag owner/premium/group/private/admin dicek per plugin,
// dan menu membaca `commandGroups` supaya tiap plugin tetap tampil sendiri-sendiri.
export function mergePlugins(...args) {
    // argumen pertama boleh berupa nama kategori menu (mis. 'download') yang berlaku untuk semua anggota
    const category = typeof args[0] === 'string' ? args.shift() : null
    const subs = args
    const list = subs.filter(s => typeof s === 'function' && [].concat(s.command || []).length > 0)

    for (const s of list) {
        if (s.command instanceof RegExp) throw new Error('mergePlugins: command regex tidak bisa digabung, ubah ke array')
    }

    const plugin = async (m, ctx) => {
        const sub = list.find(s => matchPlugin(s, ctx.command))
        if (!sub) return false

        const mess = global.mess || {}
        if (sub.owner && !ctx.isOwner) return ctx.reply(mess.owner, denyOptions())
        if (sub.premium && !ctx.isPremium) return ctx.reply(mess.premium, denyOptions())
        if (sub.group && !m.isGroup) return ctx.reply(mess.group, denyOptions())
        if (sub.admin && !ctx.isAdmin) return ctx.reply(mess.admin, denyOptions())
        if (sub.private && m.isGroup) return ctx.reply(mess.private, denyOptions())

        return sub(m, ctx)
    }

    plugin.command = [...new Set(list.flatMap(s => [].concat(s.command).map(String)))]
    plugin.tags = category ? [category] : (list[0]?.tags || ['misc'])
    plugin.commandGroups = list.map(s => ({
        command: [].concat(s.command).map(String),
        tags: category ? [category] : s.tags,
        owner: !!s.owner,
        premium: !!s.premium,
        desc: s.description
    }))

    return plugin
}

// ╔══════════════ [ helpers.js ] ══════════════╗
// Fungsi bantu umum: JSON aman, canvas (avatar, brat), upload file ke hosting sementara.

// ───────── helpers ─────────
// Kumpulan fungsi kecil untuk plugin sticker / download / vps:
// request http ringan, format waktu WIB, parser JSON aman, antrean ffmpeg,
// upload gambar, aset lokal, dan renderer brat (canvas).


// ───────── http ─────────
const REQUEST_TIMEOUT = 60_000

async function f(url, responseType = "json", method = "GET", headers = {}, body = null) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
        const response = await request(url, {
            method,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ...headers
            },
            body,
            signal: controller.signal
        })

        if (response.statusCode >= 400) {
            await response.body.dump()
            return null
        }

        if (responseType === "json") return await response.body.json()
        if (responseType === "text") return await response.body.text()
        if (responseType === "arrayBuffer") return await response.body.arrayBuffer()
        if (responseType === "buffer") return Buffer.from(await response.body.arrayBuffer())

        await response.body.dump()
        return null
    } catch (error) {
        if (controller.signal.aborted) return null
        return null
    } finally {
        clearTimeout(timeoutId)
    }
}

export { f }

// ───────── waktu ─────────
const TIMEZONE = 'Asia/Jakarta'

moment.locale('id')

function now() {
    return moment.tz(TIMEZONE)
}

function formatTime(format = 'HH:mm:ss') {
    return moment.tz(TIMEZONE).format(format)
}

function formatDate(format = 'DD-MM-YYYY') {
    return moment.tz(TIMEZONE).format(format)
}

function formatDateTime(format = 'DD-MM-YYYY HH:mm:ss') {
    return moment.tz(TIMEZONE).format(format)
}

function formatFull(format = 'dddd, DD MMMM YYYY HH:mm:ss') {
    return moment.tz(TIMEZONE).format(format)
}

function getHour() {
    return parseInt(moment.tz(TIMEZONE).format('HH'), 10)
}

function getMinute() {
    return parseInt(moment.tz(TIMEZONE).format('mm'), 10)
}

function getCurrentTimeString() {
    return moment.tz(TIMEZONE).format('HH:mm')
}

function fromTimestamp(timestamp, format = 'DD-MM-YYYY HH:mm:ss') {
    return moment(timestamp).tz(TIMEZONE).format(format)
}

function getLocalDateObject() {
    return moment.tz(TIMEZONE).toDate()
}

export { now, formatTime, formatDate, formatDateTime, formatFull, getHour, getMinute, getCurrentTimeString, fromTimestamp, getLocalDateObject, TIMEZONE }

// ───────── json aman ─────────
/**
 * Safe JSON response parser for external APIs.
 * Prevents raw "Unexpected token <" / invalid JSON errors when an API
 * returns HTML, empty content, or a non-JSON response.
 */
export async function safeJson(response, fallback = null) {
  if (!response) return fallback;

  let text = "";
  try {
    if (typeof response.text === "function") text = await response.text();
    else if (typeof response.json === "function") return await response.json();
  } catch {
    return fallback;
  }

  if (!text || !text.trim()) return fallback;

  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// ───────── antrean ffmpeg ─────────
const CONCURRENCY = Math.max(2, cpus().length)
const TIMEOUT = 60_000

let queue = []
let running = 0

function runNext() {
    while (running < CONCURRENCY && queue.length > 0) {
        const task = queue.shift()
        running++
        task.execute()
            .then(task.resolve)
            .catch(task.reject)
            .finally(() => {
                running--
                runNext()
            })
    }
}

function queueFFmpeg(command) {
    return new Promise((resolve, reject) => {
        const execute = () => new Promise((res, rej) => {
            const child = exec(command, { maxBuffer: 50 * 1024 * 1024 })
            let timedOut = false
            let stderr = ''

            const timer = setTimeout(() => {
                timedOut = true
                child.kill('SIGKILL')
            }, TIMEOUT)

            child.stderr?.on('data', (chunk) => {
                stderr += chunk
                if (stderr.length > 2000) stderr = stderr.slice(-2000)
            })

            child.on('close', (code) => {
                clearTimeout(timer)
                if (timedOut) return rej(new Error(`FFmpeg timeout (${TIMEOUT / 1000}s)`))
                if (code !== 0) return rej(new Error(`FFmpeg exit code ${code}: ${stderr.split('\n').pop()}`))
                res()
            })

            child.on('error', (err) => {
                clearTimeout(timer)
                rej(err)
            })
        })

        queue.push({ execute, resolve, reject })
        runNext()
    })
}

function getQueueStats() {
    return {
        running,
        queued: queue.length,
        concurrency: CONCURRENCY
    }
}

export { queueFFmpeg, getQueueStats, CONCURRENCY }

// ───────── aset lokal ─────────
// Aset lokal (gambar) yang dipetakan lewat global.botAssets di config.js.
// Kosong secara default, fitur yang butuh gambar tetap jalan tanpa gambar.
const assetCache = {}

function getAssetBuffer(key) {
    if (assetCache[key]) return assetCache[key]

    const file = config.assets?.[key]
    if (!file || /^https?:/.test(file)) return null

    try {
        const full = path.resolve(process.cwd(), file)
        if (!fs.existsSync(full)) return null
        assetCache[key] = fs.readFileSync(full)
        return assetCache[key]
    } catch (e) {
        console.error(`[ASSET] Gagal membaca ${key}:`, e.message)
        return null
    }
}

// ───────── brat canvas ─────────
function getTokenWidth(ctx, token, fontSize) {
  if (token.type === "space") return ctx.measureText(" ").width;
  if (token.type === "emoji") return fontSize * 1.15;
  return ctx.measureText(token.value || "").width;
}

function buildLines(ctx, tokens, fontSize, maxW) {
  ctx.font = `bold ${fontSize}px sans-serif`;
  const lines = [];
  let line = [];
  let lineW = 0;

  for (const token of tokens) {
    const w = getTokenWidth(ctx, token, fontSize);

    if (token.type === "space") {
      if (line.length > 0) {
        line.push({ ...token, w });
        lineW += w;
      }
      continue;
    }

    if (line.length > 0 && lineW + w > maxW) {
      while (line.length > 0 && line[line.length - 1].type === "space") {
        lineW -= line[line.length - 1].w;
        line.pop();
      }
      lines.push({ items: line, width: lineW });
      line = [{ ...token, w }];
      lineW = w;
    } else {
      line.push({ ...token, w });
      lineW += w;
    }
  }

  if (line.length > 0) {
    while (line.length > 0 && line[line.length - 1].type === "space") {
      lineW -= line[line.length - 1].w;
      line.pop();
    }
    lines.push({ items: line, width: lineW });
  }

  return lines;
}

export function tokenize(text) {
  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
  const raw = [];
  let lastIndex = 0;
  let match;

  while ((match = emojiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      raw.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    raw.push({ type: "emoji", value: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    raw.push({ type: "text", value: text.slice(lastIndex) });
  }

  const tokens = [];
  for (const seg of raw) {
    if (seg.type === "emoji") {


    } else {
      const words = seg.value.split(/\s+/).filter(w => w.length > 0);
      words.forEach(w => {
        if (tokens.length > 0) tokens.push({ type: "space" });
        tokens.push({ type: "text", value: w });
      });
    }
  }
  return tokens;
}

export async function drawBrat({
  text,
  bgUrl,
  bgColor,
  width,
  height,
  centerX,
  centerY,
  maxWidth,
  maxHeight,
  rotationAngle = 0,
  maxFontSize = 130,
  minFontSize = 10,
  fontDecrement = 2,
  lineHeightMult = 1.2,
  textColor = "#000000",
  align = "center",
  textBaseline = "middle"
}) {
  let bg = null;
  if (bgUrl) {
    bg = await loadImage(bgUrl);
    width = width || bg.width;
    height = height || bg.height;
  }
  
  const canvas = createCanvas(width || 512, height || 512);
  const ctx = canvas.getContext("2d");

  if (bg) {
    ctx.drawImage(bg, 0, 0, width, height);
  } else if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  }

  const tokens = tokenize(text);
  let fontSize = maxFontSize;
  let lines = buildLines(ctx, tokens, fontSize, maxWidth);

  while (fontSize > minFontSize) {
    lines = buildLines(ctx, tokens, fontSize, maxWidth);
    const totalH = lines.length * fontSize * lineHeightMult;
    if (totalH <= maxHeight) break;
    fontSize -= fontDecrement;
  }

  const lineHeight = fontSize * lineHeightMult;
  const totalHeight = lines.length * lineHeight;

  const cx = typeof centerX === 'function' ? centerX(width, height) : (centerX || width / 2);
  const cy = typeof centerY === 'function' ? centerY(width, height) : (centerY || height / 2);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotationAngle);
  ctx.fillStyle = textColor;
  ctx.textBaseline = textBaseline;

  let startY = -(totalHeight / 2) + (lineHeight / 2);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const y = startY + i * lineHeight;
    ctx.font = `bold ${fontSize}px sans-serif`;

    let currentX = align === "center" ? -line.width / 2 : -(maxWidth / 2);

    for (const token of line.items) {
      if (token.type === "text") {
        ctx.fillText(token.value, currentX, y);
        currentX += token.w;
      } else if (token.type === "space") {
        currentX += token.w;
      }
    }
  }

  ctx.restore();
  return canvas.encode("png");
}

export { getAssetBuffer }


// ───────── canvas helpers ─────────
// Dipakai plugin canvas (plugins/canvas/*): avatar default, upload ke tmpfiles / catbox,
// dan potongan gambar yang sama di plugin fake story.

// Avatar kosong: pakai aset "pp-kosong" kalau ada, kalau tidak digambar sendiri (siluet abu-abu).
let defaultAvatarCache = null

export function defaultAvatar() {
    const asset = getAssetBuffer('pp-kosong')
    if (asset) return asset
    if (defaultAvatarCache) return defaultAvatarCache

    const size = 512
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#dfe5e7'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(size / 2, size * 0.38, size * 0.18, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(size / 2, size * 0.9, size * 0.34, size * 0.32, 0, Math.PI, Math.PI * 2)
    ctx.fill()

    defaultAvatarCache = canvas.toBuffer('image/png')
    return defaultAvatarCache
}

// Upload ke tmpfiles.org -> link download langsung (null kalau gagal)
export async function uploadToTmpFilesOrg(buffer) {
    try {
        const form = new FormData()
        form.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' })

        const response = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
            headers: form.getHeaders()
        })

        return response.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
    } catch (e) {
        console.log('Upload Error:', e)
        return null
    }
}

// Upload ke catbox.moe -> link file
export async function uploadToCatboxFile(buffer, filename = 'file.jpg') {
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', buffer, {
        filename,
        contentType: mime.lookup(filename) || 'image/jpeg'
    })

    const res = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
        timeout: 30000
    })

    const url = String(res.data || '').trim()
    if (!url.startsWith('http')) throw new Error('Invalid response')
    return url
}

export function canvasRoundedRectPath(ctx, x, y, width, height, radius) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
}

export function canvasDrawAvatar(ctx, img, x, y, size) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(img, x, y, size, size)
    ctx.restore()
}

export async function canvasDownloadImage(url) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
    return Buffer.from(res.data)
}

export async function canvasGetProfilePicture(sock, jid) {
    try {
        const pp = await sock.profilePictureUrl(jid, 'image')
        return pp || null
    } catch {
        return null
    }
}

// Foto profil -> Buffer; kalau tidak ada / privat dipakai avatar default
export async function canvasGetAvatarBuffer(sock, jid) {
    try {
        const ppUrl = await canvasGetProfilePicture(sock, jid)
        if (ppUrl) return await canvasDownloadImage(ppUrl)
    } catch {}
    return defaultAvatar()
}


// ╔══════════════ [ game.js ] ══════════════╗
// Helper game: data user, biaya & refund limit, hadiah, cek registrasi, ambil data soal (lokal/API).

// ───────── helper game (user rpg, limit, hadiah) ─────────
// Memakai data user rpg (global.db.rpgData.users) lewat ensureUser/persist di bagian rpg.
async function gameUser(sock, m) {
    return ensureUser({ sender: await toPN(sock, m.sender), pushName: m.pushName })
}

async function gameUserByJid(sock, jid) {
    const sender = await toPN(sock, jid)
    return ensureUser({ sender, pushName: String(sender).split('@')[0] })
}

const gamePrefix = (ctx) => ctx?.prefix || primaryPrefix()

// Potong limit (premium & owner gratis). false = limit tidak cukup (sudah dibalas).
async function gameSpendLimit(m, ctx, cost = 1) {
    if (ctx.isPremium || ctx.isOwner) return true
    const user = await gameUser(ctx.sock, m)
    if (user.limit < cost) {
        await ctx.reply(`[❗] Limit kamu habis, beli lewat *${gamePrefix(ctx)}buy limit*`)
        return false
    }
    user.limit -= cost
    persist()
    return true
}

async function gameRefundLimit(m, ctx, cost = 1) {
    if (ctx.isPremium || ctx.isOwner) return
    const user = await gameUser(ctx.sock, m)
    user.limit += cost
    persist()
}

async function gameNeedRegister(m, ctx) {
    const user = await gameUser(ctx.sock, m)
    if (user.registered) return true
    await ctx.reply(`Kamu belum terdaftar.\nDaftar dulu dengan *${gamePrefix(ctx)}daftar nama.umur*`)
    return false
}

// reward: { limit, exp, money } -> angka tetap atau [min, max]
async function gameGrant(sock, m, reward = {}, jid = null) {
    const user = jid ? await gameUserByJid(sock, jid) : await gameUser(sock, m)
    const val = (v) => Array.isArray(v) ? Math.floor(Math.random() * (v[1] - v[0] + 1)) + v[0] : (Number(v) || 0)
    const parts = []
    const limit = val(reward.limit), exp = val(reward.exp), money = val(reward.money)
    if (limit) { user.limit = (Number(user.limit) || 0) + limit; parts.push(`+${limit} Limit`) }
    if (exp) { user.exp = (Number(user.exp) || 0) + exp; parts.push(`+${exp.toLocaleString('id-ID')} XP`) }
    if (money) { user.money = (Number(user.money) || 0) + money; parts.push(`+${money.toLocaleString('id-ID')} Money`) }
    persist()
    return parts.length ? `🎁 Hadiah: ${parts.join(' • ')}` : ''
}

const gamePick = (list) => list[Math.floor(Math.random() * list.length)]
const gameRand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a

const gameJsonCache = new Map()
function gameLocalJson(name) {
    if (!gameJsonCache.has(name)) {
        const file = path.join(__dirname, '../plugins/game/data', `${name}.json`)
        gameJsonCache.set(name, JSON.parse(fs.readFileSync(file, 'utf-8')))
    }
    return gameJsonCache.get(name)
}

const gameRemoteCache = new Map()
async function gameRemoteJson(url) {
    const hit = gameRemoteCache.get(url)
    if (hit && Date.now() - hit.at < 3_600_000) return hit.data
    const { data } = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } })
    gameRemoteCache.set(url, { at: Date.now(), data })
    return data
}

// ───────── game tebak-tebakan ─────────
// Satu sesi aktif per chat. Jawaban diketik langsung di chat tanpa command (dicek lewat plugin
// pasif plugins/game/jawab.js → runGameAnswer). Semua balasan memakai reply & quote bawaan
// WhatsApp: tanpa tombol, tanpa contextInfo / preview kustom.
const _game = (() => {

const GAME_API = 'https://apiii-xrina.vercel.app/game'
const GAME_TIMEOUT_MS = 60 * 1000 // waktu menjawab

// global supaya sesi tidak hilang saat plugin di-reload (hot reload)
if (!global.gameSessions) global.gameSessions = new Map()
const sessions = global.gameSessions

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

function lev(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i])
    for (let j = 1; j <= b.length; j++) dp[0][j] = j
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            )
        }
    }
    return dp[a.length][b.length]
}

const similarity = (a, b) => {
    const max = Math.max(a.length, b.length)
    return max ? 1 - lev(a, b) / max : 1
}

// cocok longgar: jawaban ada di dalam tebakan, atau tebakan adalah sebagian besar jawaban
function looseMatch(guess, answer) {
    if (!guess || !answer) return false
    if (guess === answer) return true
    if (answer.length >= 3 && guess.includes(answer)) return true
    if (guess.length >= 3 && guess.length >= answer.length * 0.6 && answer.includes(guess)) return true
    return false
}

const normWords = (s) => String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()

function wordsMatch(input, answer) {
    const a = normWords(input), b = normWords(answer)
    if (!a || !b) return false
    if (a === b) return true
    const words = b.split(' ')
    return a.split(' ').every(w => words.includes(w))
}

const maskAnswer = (ans) => [...String(ans)].map((c, i) => c === ' ' ? ' ' : (i === 0 || Math.random() < 0.35 ? c : '_')).join(' ')

// key = nama command. API: build(data) → { question, image?, answer, extra? }
// lokal/remote: load() → { question, image?, audio?, answer, alt?, extra? }
// match: exact (bawaan) | loose | sim | words
const GAMES = {
    asahotak: {
        title: 'Asah Otak', emoji: '🧠',
        build: (d) => ({ question: d.soal, answer: d.jawaban })
    },
    caklontong: {
        title: 'Cak Lontong', emoji: '😹',
        build: (d) => ({ question: d.soal, answer: d.jawaban, extra: d.deskripsi })
    },
    kataacak: {
        title: 'Kata Acak', emoji: '🔀',
        build: (d) => ({ question: `Susun huruf ini jadi kata:\n*${d.soal}*`, answer: d.jawaban })
    },
    susunkata: {
        title: 'Susun Kata', emoji: '🔤',
        build: (d) => ({ question: `Susun huruf ini jadi kata:\n*${d.soal}*\nTipe: ${d.tipe || '-'}`, answer: d.jawaban })
    },
    tebakbendera: {
        title: 'Tebak Bendera', emoji: '🚩',
        build: (d) => ({ question: 'Bendera negara apakah ini?', image: d.img, answer: d.name })
    },
    tebakbuah: {
        title: 'Tebak Buah', emoji: '🍉',
        build: (d) => ({ question: d.soal, answer: d.jawaban })
    },
    tebakepep: {
        title: 'Tebak Karakter FF', emoji: '🔥',
        build: (d) => ({
            question: `Siapa karakter ini?${d.deskripsi ? `\nPetunjuk: ${d.deskripsi}` : ''}`,
            image: d.img || d.fullimg,
            answer: d.jawaban
        })
    },
    tebakgambar: {
        title: 'Tebak Gambar', emoji: '🖼️',
        build: (d) => ({ question: 'Tebak maksud gambar ini!', image: d.img, answer: d.jawaban, extra: d.deskripsi })
    },
    tebakhewan: {
        title: 'Tebak Hewan', emoji: '🐾',
        build: (d) => ({ question: d.soal, answer: d.jawaban })
    },
    tebakkalimat: {
        title: 'Tebak Kalimat', emoji: '📝',
        build: (d) => ({ question: `Lengkapi kalimat:\n*${d.soal}*`, answer: d.jawaban })
    },
    tebakkata: {
        title: 'Tebak Kata', emoji: '💬',
        build: (d) => ({ question: `Petunjuk: *${d.soal}*`, answer: d.jawaban })
    },
    tebakkimia: {
        title: 'Tebak Kimia', emoji: '⚗️',
        build: (d) => ({ question: `Apa lambang unsur *${d.unsur}*?`, answer: d.lambang })
    },
    tebaktebakan: {
        title: 'Tebak-tebakan', emoji: '🤣',
        build: (d) => ({ question: d.soal, answer: d.jawaban })
    },

    // ── game tambahan ──
    siapakahaku: {
        title: 'Siapakah Aku', emoji: '🕵️', match: 'words', reward: { limit: [1, 10] },
        load: async () => { const d = gamePick(gameLocalJson('siapakahaku')); return { question: d.soal, answer: d.jawaban } }
    },
    tebakanml: {
        title: 'Tebakan ML', emoji: '🎮', match: 'loose', reward: { limit: [1, 10] },
        load: async () => { const d = gamePick(gameLocalJson('tebakanml')); return { question: d.soal, answer: d.jawaban } }
    },
    tebakbenda: {
        title: 'Tebak Benda', emoji: '📦', match: 'sim', simWin: 0.9, simNear: 0.72, autoHint: 30000,
        reward: { exp: 1500, limit: 2 },
        load: async () => {
            const d = gamePick(gameLocalJson('tebakbenda'))
            const list = [].concat(d.answer ?? d.jawaban).map(String)
            return { question: d.question || d.soal, answer: list[0], alt: list.slice(1) }
        }
    },
    tebakgame: {
        title: 'Tebak Game', emoji: '🕹️', match: 'loose', reward: { limit: [1, 10] },
        load: async () => { const d = gamePick(gameLocalJson('tebakgame')); return { question: 'Tebak nama game dari gambar ini!', image: d.img, answer: d.jawaban } }
    },
    tebakheroml: {
        title: 'Tebak Hero ML', emoji: '⚔️', match: 'loose', reward: { limit: [1, 10] },
        load: async () => {
            const { data } = await axios.get('https://api.deline.web.id/game/tebakheroml', { timeout: 20000 })
            const r = data?.result
            if (!r?.jawaban || !r?.img) throw new Error('data hero tidak valid')
            return { question: `Lihat gambar berikut dan tebak heronya!${r.deskripsi ? `\nClue: ${r.deskripsi}` : ''}`, image: r.img, answer: r.jawaban }
        }
    },
    tebakjkt: {
        title: 'Tebak Member JKT48', emoji: '🎀', match: 'loose', reward: { limit: [1, 10] },
        load: async () => {
            const list = await gameRemoteJson('https://raw.githubusercontent.com/siputzx/tebak-jkt/main/tebak.json')
            const d = gamePick(list.filter(v => v.gambar && v.jawaban))
            if (!d) throw new Error('data JKT kosong')
            return { question: 'Siapakah member pada gambar ini?', image: d.gambar, answer: d.jawaban }
        }
    },
    tebaklagu: {
        title: 'Tebak Lagu', emoji: '🎵', match: 'sim', simWin: 0.72, simNear: 2, needRegister: true,
        reward: { limit: [1, 10] },
        load: async () => {
            const d = gamePick(gameLocalJson('tebaklagu'))
            return { question: 'Tebak judul lagu dari audio ini.', audio: d.lagu, audioMime: 'audio/mp4', answer: d.judul, extra: `Artis: ${d.artis}` }
        }
    },
    tebaklirik: {
        title: 'Tebak Lirik', emoji: '🎤', match: 'loose', reward: { limit: [1, 10] },
        load: async () => { const d = gamePick(gameLocalJson('tebaklirik')); return { question: d.soal, answer: d.jawaban } }
    },
    tebaklogo: {
        title: 'Tebak Logo', emoji: '🏷️', match: 'loose', reward: { limit: [1, 10] },
        load: async () => {
            const d = gamePick(gameLocalJson('tebaklogo'))
            return { question: `Tebak logo berikut${d.deskripsi ? `\nPetunjuk: ${d.deskripsi}` : ''}`, image: d.img, answer: d.jawaban }
        }
    },
    tebaksurah: {
        title: 'Tebak Surah', emoji: '📖', reward: { limit: [1, 10] },
        load: async () => {
            const rand = Math.floor(Math.random() * 6236) + 1
            const { data } = await axios.get(`https://api.alquran.cloud/v1/ayah/${rand}/ar.alafasy`, { timeout: 30000 })
            const ayah = data?.data
            const name = ayah?.surah?.englishName
            if (!ayah?.text || !name) throw new Error('data ayat tidak valid')
            const clean = name.toLowerCase().replace(/[^a-z ]/g, '')
            return {
                question: `Ayat:\n"${ayah.text}"\n\nIni dari surah apa?`,
                audio: ayah.audio, audioMime: 'audio/mpeg',
                answer: name, alt: [clean, clean.replace(/^al /, ''), clean.replace(/ /g, '')]
            }
        }
    },
    tebakwarna: {
        title: 'Tes Buta Warna', emoji: '🎨', reward: { limit: [1, 10] },
        load: async () => {
            const list = (await gameRemoteJson('https://raw.githubusercontent.com/siputzx/databasee/main/games/butawarna.json'))
                .filter(v => v.correct && v.image && String(v.image).startsWith('http'))
            const d = gamePick(list)
            if (!d) throw new Error('data warna kosong')
            return { question: 'Kamu melihat angka berapa pada gambar ini?', image: d.image, answer: String(d.correct) }
        }
    },
    tekateki: {
        title: 'Teka-Teki', emoji: '🧩', match: 'loose', reward: { limit: [1, 10] },
        load: async () => {
            const list = await gameRemoteJson('https://raw.githubusercontent.com/BochilTeam/database/master/games/tekateki.json')
            const d = gamePick(list.filter(v => v.soal && v.jawaban))
            if (!d) throw new Error('data teka-teki kosong')
            return { question: d.soal, answer: d.jawaban }
        }
    }
}

const GAME_NAMES = Object.keys(GAMES)

async function fetchQuestion(name) {
    const game = GAMES[name]
    let q
    if (game.load) {
        q = await game.load()
    } else {
        const { data } = await axios.get(`${GAME_API}/${name}`, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (!data || data.status === false || !data.data) throw new Error('API tidak mengembalikan soal')
        q = game.build(data.data)
    }
    if (!q.answer) throw new Error('Soal tidak punya jawaban')
    return q
}

function endSession(key) {
    const s = sessions.get(key)
    if (s?.timer) clearTimeout(s.timer)
    if (s?.hintTimer) clearTimeout(s.hintTimer)
    sessions.delete(key)
}

function revealText(s) {
    return `*${s.q.answer}*` + (s.q.extra ? `\n_${s.q.extra}_` : '')
}

function rewardInfo(r) {
    const one = (v) => Array.isArray(v) ? `${v[0]}-${v[1]}` : v
    const parts = []
    if (r.exp) parts.push(`${one(r.exp)} XP`)
    if (r.limit) parts.push(`${one(r.limit)} Limit`)
    if (r.money) parts.push(`${one(r.money)} Money`)
    return parts.join(' + ')
}

const gameReact = (sock, m, emoji) => sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } }).catch(() => null)

// Mulai game baru di chat ini.
async function runGame(name, m, ctx) {
    const { sock, jid = m.chat, reply, prefix } = ctx
    const game = GAMES[name]
    if (!game) return reply(`Fitur game "${name}" tidak ditemukan.`)
    const p = prefix ?? primaryPrefix()

    if (sessions.has(jid)) {
        const cur = sessions.get(jid)
        return reply(`Masih ada game *${GAMES[cur.name].title}* yang belum selesai di chat ini.\nJawab dulu, atau ketik *${p}nyerah* untuk menyerah.`)
    }
    if (game.needRegister && !(await gameNeedRegister(m, ctx))) return

    await gameReact(sock, m, '⏳')
    let q
    try {
        q = await fetchQuestion(name)
    } catch (e) {
        console.error(`[GAME:${name}]`, e?.message || e)
        await gameReact(sock, m, '❌')
        return reply(`Gagal mengambil soal ${game.title}: ${e?.message || e}\nCoba lagi sebentar lagi ya.`)
    }

    if (q.audio) {
        try {
            await sock.sendMessage(jid, { audio: { url: q.audio }, mimetype: q.audioMime || 'audio/mp4' }, { quoted: m })
        } catch (e) {
            console.error(`[GAME:${name}] gagal kirim audio:`, e?.message || e)
            await gameReact(sock, m, '❌')
            return reply('Gagal mengirim audio soal. Coba lagi sebentar lagi ya.')
        }
    }

    const caption =
        `${game.emoji} *${game.title.toUpperCase()}*\n\n${q.question}\n\n` +
        `⏱️ Waktu: ${GAME_TIMEOUT_MS / 1000} detik\n` +
        (game.reward ? `🎁 Hadiah: ${rewardInfo(game.reward)}\n` : '') +
        `💡 Ketik *${p}hint* untuk bantuan • *${p}nyerah* untuk menyerah`

    try {
        if (q.image) await sock.sendMessage(jid, { image: { url: q.image }, caption }, { quoted: m })
        else await sock.sendMessage(jid, { text: caption }, { quoted: m })
    } catch (e) {
        // gambar gagal dimuat → kirim teks saja supaya game tetap jalan
        console.error(`[GAME:${name}] gagal kirim gambar:`, e?.message || e)
        await sock.sendMessage(jid, { text: caption + (q.image ? `\n\nGambar: ${q.image}` : '') }, { quoted: m })
    }

    const session = { name, q, hints: 0, startedAt: Date.now() }
    session.timer = setTimeout(async () => {
        if (sessions.get(jid) !== session) return
        endSession(jid)
        try {
            await sock.sendMessage(jid, { text: `⌛ *Waktu habis!*\nJawabannya: ${revealText(session)}` }, { quoted: m })
        } catch { /* abaikan */ }
    }, GAME_TIMEOUT_MS)
    if (game.autoHint) {
        session.hintTimer = setTimeout(async () => {
            if (sessions.get(jid) !== session) return
            try { await sock.sendMessage(jid, { text: `💡 *Hint*\n${maskAnswer(q.answer)}` }, { quoted: m }) } catch { /* abaikan */ }
        }, game.autoHint)
    }
    sessions.set(jid, session)
    await gameReact(sock, m, '✅')
}

// Bantuan: tampilkan sebagian huruf jawaban.
async function runGameHint(m, ctx) {
    const jid = ctx.jid || m.chat
    const s = sessions.get(jid)
    if (!s) return ctx.reply('Tidak ada game yang sedang berjalan. Mulai dengan salah satu command game tebak-tebakan di menu.')
    s.hints = Math.min(s.hints + 1, 3)
    const ans = String(s.q.answer)
    const letters = [...ans].filter(c => /[a-z0-9]/i.test(c)).length
    const show = Math.max(1, Math.min(Math.ceil(letters * 0.25 * s.hints), letters - 1))
    let shown = 0
    const masked = [...ans].map(c => {
        if (!/[a-z0-9]/i.test(c)) return c
        return shown++ < show ? c : '_'
    }).join(' ')
    return ctx.reply(`💡 *Hint ${s.hints}/3*\n${masked}\n(${letters} huruf)`)
}

// Menyerah → tampilkan jawaban.
async function runGameGiveUp(m, ctx) {
    const jid = ctx.jid || m.chat
    const s = sessions.get(jid)
    if (!s) return ctx.reply('Tidak ada game yang sedang berjalan.')
    endSession(jid)
    return ctx.reply(`🏳️ Menyerah ya?\nJawabannya: ${revealText(s)}`)
}

function judge(game, q, text, guess) {
    const answers = [q.answer, ...(q.alt || [])].map(a => ({ raw: String(a), n: norm(a) })).filter(a => a.n)
    switch (game.match) {
        case 'loose':
            if (answers.some(a => looseMatch(guess, a.n))) return 'win'
            break
        case 'sim': {
            let best = 0
            for (const a of answers) best = Math.max(best, similarity(guess, a.n))
            if (best >= (game.simWin ?? 0.9)) return 'win'
            if (best >= (game.simNear ?? 0.72)) return 'near'
            break
        }
        case 'words':
            if (answers.some(a => wordsMatch(text, a.raw))) return 'win'
            break
        default:
            if (answers.some(a => a.n === guess)) return 'win'
            // hampir benar (typo 1 huruf) untuk jawaban yang cukup panjang
            if (answers[0] && answers[0].n.length >= 5 && lev(guess, answers[0].n) === 1) return 'near'
    }
    return null
}

// Dipanggil plugin pasif untuk setiap pesan teks non-command.
// Return true kalau pesan dipakai sebagai jawaban (benar / hampir benar).
async function runGameAnswer(m, ctx) {
    const jid = ctx.jid || m.chat
    const text = String(ctx.text || m.text || '').trim()
    const s = sessions.get(jid)
    if (!text || !s) return false

    const guess = norm(text)
    if (!guess && GAMES[s.name].match !== 'words') return false

    const game = GAMES[s.name]
    const verdict = judge(game, s.q, text, guess)

    if (verdict === 'win') {
        endSession(jid)
        const sec = ((Date.now() - s.startedAt) / 1000).toFixed(1)
        const prize = game.reward ? await gameGrant(ctx.sock, m, game.reward).catch(() => '') : ''
        await ctx.sock.sendMessage(jid, {
            text: `🎉 *BENAR!* ${m.pushName || 'Kak'} menjawab dalam ${sec} detik.\nJawaban: ${revealText(s)}` +
                (prize ? `\n${prize}` : '') + `\n\nMau lagi? Ketik *${primaryPrefix()}${s.name}*`
        }, { quoted: m })
        return true
    }
    if (verdict === 'near') {
        await ctx.sock.sendMessage(jid, { text: 'Dikit lagi! Coba cek ejaannya.' }, { quoted: m })
        return true
    }
    return false
}

return { runGame, runGameHint, runGameGiveUp, runGameAnswer, GAME_NAMES }
})()

export const { runGame, GAME_NAMES } = _game

// ╔══════════════ [ game-extra.js ] ══════════════╗
// Game tambahan: jawab, hint, dan menyerah (runGameAnswer/Hint/GiveUp).
// Fondasi fitur tambahan: jam bahagia (pengali hadiah), misi harian, referral, penyimpanan kecil bersama.

// ───────── game bergiliran / bersesi ─────────
// akinator, gachapet, bomb, bonanza, family100, hangman, sambungkata, suitpvp, dadu,
// tictactoe, minesweeper, slot. Semua balasan memakai reply & quote bawaan WhatsApp
// (tanpa tombol, tanpa contextInfo / preview kustom).
const _gameExtra = (() => {

// global supaya sesi tidak hilang saat plugin di-reload
const S = (global.gameExtra ||= {})
for (const k of ['akinator', 'bomb', 'bonanza', 'family100', 'hangman', 'skata', 'suit', 'ttt', 'mines']) S[k] ||= {}

const say = (sock, m, text, mentions) =>
    sock.sendMessage(m.chat, mentions?.length ? { text, mentions } : { text }, { quoted: m })
const tag = (jid) => '@' + String(jid).split('@')[0]
const textOf = (m, ctx) => String(ctx?.text ?? m.text ?? '').trim()

// ═══════════════ AKINATOR ═══════════════
const AKI_BASE = 'https://id.akinator.com'
const AKI_THEMES = { 1: ['Karakter', 1], 2: ['Hewan', 14], 3: ['Benda', 2] }
const AKI_CHOICES = [['1', 'Ya', 0], ['2', 'Tidak', 1], ['3', 'Tidak tahu', 2], ['4', 'Mungkin', 3], ['5', 'Mungkin tidak', 4]]
const AKI_TTL = 20 * 60 * 1000
let akiGot

async function akiClient() {
    if (!akiGot) {
        try { akiGot = (await import('got-scraping')).gotScraping }
        catch { throw new Error('Modul got-scraping belum terpasang. Jalankan: npm install got-scraping') }
    }
    return akiGot
}

const akiCookie = (jar) => Object.entries(jar || {}).map(([k, v]) => `${k}=${v}`).join('; ')

function akiSave(jar, res) {
    if (!jar || !res?.headers?.['set-cookie']) return
    for (const cookie of res.headers['set-cookie']) {
        const [kv] = cookie.split(';')
        const i = kv.indexOf('=')
        if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim()
    }
}

async function akiPost(game, urlPath, form) {
    const got = await akiClient()
    const headers = {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        origin: AKI_BASE,
        referer: AKI_BASE + '/game'
    }
    if (Object.keys(game.cookies).length) headers.cookie = akiCookie(game.cookies)
    const res = await got({ url: AKI_BASE + urlPath, method: 'POST', form, headers, throwHttpErrors: false })
    akiSave(game.cookies, res)
    return res
}

function akiJson(body) {
    try { return JSON.parse(body) } catch { throw new Error('Response Akinator bukan JSON.') }
}

async function akiStart(game) {
    const got = await akiClient()
    akiSave(game.cookies, await got({ url: AKI_BASE + '/', throwHttpErrors: false }))
    const res = await akiPost(game, '/game', { sid: String(game.sid), cm: 'false' })
    const body = res.body
    const $ = cheerio.load(body)
    const session = body.match(/session:\s*'([^']+)'/)?.[1] || body.match(/name="session"[^>]*value="([^"]+)"/)?.[1]
    const identifiant = body.match(/localStorage\.setItem\('identifiant',\s*'([^']+)'\)/)?.[1] || body.match(/name="identifiant"[^>]*value="([^"]+)"/)?.[1] || ''
    const question = $('#question-label').text().trim()
    if (!session || !question) throw new Error('Gagal mengambil data dari Akinator.')
    Object.assign(game, {
        session, identifiant, question, num: 1, progression: 0, stepLastProposition: '',
        step: parseInt(body.match(/localStorage\.setItem\('step',\s*'(\d+)'\)/)?.[1] || '1')
    })
}

function akiHandle(game, data) {
    if (data.completion === 'KO') throw new Error('Sesi expired.')
    if (data.completion === 'SOUNDLIKE') return { lost: true }
    if (data.id_proposition) {
        game.step = parseInt(data.step ?? game.step)
        game.stepLastProposition = String(game.step)
        return { guess: { id: data.id_proposition, name: data.name_proposition, description: data.description_proposition, photo: data.photo } }
    }
    if (data.question) game.question = data.question
    if (data.step !== undefined) game.step = parseInt(data.step)
    if (data.progression !== undefined) game.progression = parseFloat(data.progression)
    return {}
}

async function akiAnswer(game, id) {
    const res = await akiPost(game, '/answer', {
        step: String(game.step), progression: String(game.progression), sid: String(game.sid), cm: 'false',
        answer: String(id), step_last_proposition: game.stepLastProposition, session: game.session
    })
    const r = akiHandle(game, akiJson(res.body))
    if (!r.guess && !r.lost) game.num++
    return r
}

async function akiBack(game) {
    const res = await akiPost(game, '/cancel_answer', {
        step: String(game.step), progression: String(game.progression), sid: String(game.sid), cm: 'false', session: game.session
    })
    akiHandle(game, akiJson(res.body))
    game.num = Math.max(1, game.num - 1)
}

async function akiExclude(game) {
    const res = await akiPost(game, '/exclude', {
        step: String(game.step), sid: String(game.sid), cm: 'false', progression: String(game.progression),
        session: game.session, forward_answer: '1'
    })
    const r = akiHandle(game, akiJson(res.body))
    if (!r.guess && !r.lost) game.num++
    return r
}

async function akiConfirm(game, guess) {
    try {
        await akiPost(game, '/choice', {
            sid: String(game.sid), pid: String(guess.id), identifiant: game.identifiant,
            charac_name: guess.name, charac_desc: guess.description, session: game.session, step: String(game.step)
        })
    } catch { /* abaikan */ }
}

const akiKey = (m) => `${m.chat}|${jidNumber(m.sender)}`
const akiNew = () => ({ sid: 1, session: '', identifiant: '', step: 1, num: 1, progression: 0, stepLastProposition: '', question: '', theme: '', cookies: {}, state: 'theme', guess: null, last: Date.now() })

const akiThemeText = (p) =>
    `╭─「 🎭 AKINATOR 」\n│\n│ Pilih tema permainan:\n│ 1. Karakter\n│ 2. Hewan\n│ 3. Benda\n│\n│ Balas dengan angka *1*, *2*, atau *3*\n│ Ketik *${p}akinator stop* untuk batal.\n╰──────────────`

function akiQuestionText(game) {
    game.state = 'question'
    return `╭─「 🧠 AKINATOR 」\n│\n│ 🎭 Tema: *${game.theme}*\n│ 📊 Progress: *${Math.round(game.progression)}%*\n│ ❓ Soal ke: *${game.num}*\n│\n│ ${game.question}\n│\n│ 1. Ya\n│ 2. Tidak\n│ 3. Tidak tahu\n│ 4. Mungkin\n│ 5. Mungkin tidak\n│\n│ 0. Kembali ke sebelumnya\n╰──────────────`
}

async function akiSendPhoto(sock, m, photo, text) {
    const url = global.thumb?.utama
    if (url) {
        try { return await sock.sendMessage(m.chat, { image: { url }, caption: text }, { quoted: m }) } catch { /* kirim teks */ }
    }
    return say(sock, m, text)
}

async function akiResult(sock, m, game, key, result) {
    if (result.lost) {
        delete S.akinator[key]
        return say(sock, m, '😵 Akinator menyerah! Aku tidak bisa menebak jawabanmu.')
    }
    if (result.guess) {
        game.guess = result.guess
        game.state = 'confirm'
        return akiSendPhoto(sock, m, result.guess.photo,
            `╭─「 🎯 TEBAKAN AKINATOR 」\n│\n│ 👤 *${result.guess.name}*\n│ 📝 ${result.guess.description || '-'}\n│\n│ Apakah tebakan ini benar?\n│ Balas dengan *1* (Ya) atau *2* (Tidak)\n╰──────────────`)
    }
    return say(sock, m, akiQuestionText(game))
}

async function akiBegin(sock, m, game, key, theme) {
    game.sid = AKI_THEMES[theme][1]
    game.theme = AKI_THEMES[theme][0]
    await say(sock, m, `⏳ Memulai Akinator...\n🎭 Tema: *${game.theme}*`)
    await akiStart(game)
    game.state = 'question'
    return say(sock, m, akiQuestionText(game))
}

async function runAkinator(m, ctx) {
    const { sock } = ctx
    const p = gamePrefix(ctx)
    const key = akiKey(m)
    const input = String(ctx.text || '').trim().toLowerCase()
    let game = S.akinator[key]
    if (game && Date.now() - game.last > AKI_TTL) game = S.akinator[key] = null

    if (input === 'stop') {
        if (game) { delete S.akinator[key]; return ctx.reply('✅ Game Akinator dihentikan.') }
        return ctx.reply('ℹ️ Tidak ada game Akinator yang sedang aktif.')
    }
    if (game) return ctx.reply(`⚠️ Selesaikan game kamu yang sedang berjalan, atau ketik *${p}akinator stop* untuk membatalkan.`)
    if (!(await gameSpendLimit(m, ctx, 1))) return

    game = S.akinator[key] = akiNew()
    if (AKI_THEMES[input]) {
        try { return await akiBegin(sock, m, game, key, input) } catch (e) {
            delete S.akinator[key]
            await gameRefundLimit(m, ctx, 1)
            return ctx.reply(`❌ Gagal memulai Akinator:\n${e.message}`)
        }
    }
    return ctx.reply(akiThemeText(p))
}

async function akinatorAnswer(m, ctx) {
    const { sock } = ctx
    const key = akiKey(m)
    const game = S.akinator[key]
    const input = textOf(m, ctx).toLowerCase()
    if (!game || !input) return false
    if (Date.now() - game.last > AKI_TTL) { delete S.akinator[key]; return false }
    game.last = Date.now()

    if (game.state === 'theme') {
        if (!AKI_THEMES[input]) return false
        try { await akiBegin(sock, m, game, key, input) } catch (e) {
            delete S.akinator[key]
            await say(sock, m, `❌ Gagal memulai Akinator: ${e.message}`)
        }
        return true
    }

    if (game.state === 'question') {
        if (input === '0') {
            if (game.num <= 1) { await say(sock, m, '⚠️ Belum ada soal sebelumnya.'); return true }
            try { await akiBack(game); await say(sock, m, akiQuestionText(game)) } catch (e) { await say(sock, m, `❌ Gagal kembali: ${e.message}`) }
            return true
        }
        const pick = AKI_CHOICES.find(c => c[0] === input)
        if (!pick) return false
        try { await akiResult(sock, m, game, key, await akiAnswer(game, pick[2])) } catch (e) {
            delete S.akinator[key]
            await say(sock, m, `❌ Terjadi kesalahan: ${e.message}`)
        }
        return true
    }

    if (game.state === 'confirm') {
        if (!['1', '2', 'y', 'n', 'ya', 'tidak'].includes(input)) return false
        if (['1', 'y', 'ya'].includes(input)) {
            await akiConfirm(game, game.guess)
            const g = game.guess, total = game.num
            delete S.akinator[key]
            await akiSendPhoto(sock, m, g.photo, `╭─「 🎯 HASIL AKINATOR 」\n│\n│ 👤 *${g.name}*\n│ 📝 ${g.description || '-'}\n│\n│ ❓ Total soal: ${total}\n╰──────────────`)
            return true
        }
        try {
            await say(sock, m, '❌ Bukan itu?\n🧠 Oke, Akinator lanjut mencari tahu...')
            await akiResult(sock, m, game, key, await akiExclude(game))
        } catch (e) {
            delete S.akinator[key]
            await say(sock, m, `❌ Gagal melanjutkan: ${e.message}`)
        }
        return true
    }
    return false
}

// ═══════════════ GACHA PET ═══════════════
const PET_POOL = [
    { type: 'Kucing', rarity: 'Common ⚪', element: 'Beast' },
    { type: 'Kelinci', rarity: 'Common ⚪', element: 'Beast' },
    { type: 'Baby Bebek', rarity: 'Common ⚪', element: 'Water' },
    { type: 'Fox', rarity: 'Rare 🔵', element: 'Beast' },
    { type: 'Baby Beruang', rarity: 'Rare 🔵', element: 'Earth' },
    { type: 'Baby Panda', rarity: 'Rare 🔵', element: 'Earth' },
    { type: 'Baby Naga', rarity: 'Mythic 🟣', element: 'Fire' },
    { type: 'Baby Pegasus', rarity: 'Mythic 🟣', element: 'Wind' },
    { type: 'Baby Unicorn', rarity: 'Mythic 🟣', element: 'Light' },
    { type: 'Baby Rubah Ekor 9 Es', rarity: 'Legendary 🟡', element: 'Legendary Ice' }
]

function rollPet() {
    const r = Math.random() * 100
    if (r <= 2) return PET_POOL[9]
    if (r <= 10) return PET_POOL[gameRand(6, 8)]
    if (r <= 40) return PET_POOL[gameRand(3, 5)]
    return PET_POOL[gameRand(0, 2)]
}

async function petSend(sock, m, pet, text) {
    const url = global.thumb?.utama
    if (!url) return say(sock, m, text)
    try { return await sock.sendMessage(m.chat, { image: { url }, caption: text }, { quoted: m }) }
    catch { return say(sock, m, text) }
}

// gachapet            → gacha pertama / lihat status pet
// gachapet reroll     → acak ulang pet (maks 3x)
async function runGachaPet(m, ctx) {
    const { sock } = ctx
    const p = gamePrefix(ctx)
    const arg = String(ctx.text || '').trim().toLowerCase()
    const user = await gameUser(sock, m)
    if (user.rerollCount === undefined) user.rerollCount = 3

    const roll = async (isReroll) => {
        const r = rollPet()
        user.rerollCount -= 1
        user.pet = { name: r.type, type: r.type, rarity: r.rarity, element: r.element, level: 1, exp: 0, maxExp: 100, hunger: 100, energy: 100, happiness: 100 }
        persist()
        return petSend(sock, m, r,
            `✨ *HASIL GACHA PET* ✨\n\n🐾 *Tipe Pet* : ${r.type}\n🌟 *Rarity*   : ${r.rarity}\n❄️ *Elemen*   : ${r.element}\n\n🔄 *Sisa Reroll*: ${user.rerollCount}/3\n\nKetik *${p}gachapet reroll* untuk mengacak ulang pet ini.\nKetik *${p}gachapet* untuk melihat status pet.`)
    }

    if (arg === 'reroll') {
        if (!user.pet) return ctx.reply(`Kamu belum punya pet. Ketik *${p}gachapet* dulu.`)
        if (user.rerollCount <= 0) return ctx.reply('❌ Kesempatan reroll kamu sudah habis! Pet terakhir sudah tersimpan permanen.')
        return roll(true)
    }
    if (!user.pet) return roll(false)

    const pet = user.pet
    const bar = (v) => '🟩'.repeat(Math.floor(v / 20)) + '⬜'.repeat(5 - Math.floor(v / 20))
    return petSend(sock, m, pet,
        `🐾 *${pet.name}* (${pet.type})\n⭐ Level ${pet.level} • EXP: ${pet.exp}/${pet.maxExp}\n✨ ${pet.rarity}\n\n╭─ VIRTUAL PET STATUS ────\n│ 🍖 Kenyang     : ${bar(pet.hunger)} (${pet.hunger}%)\n│ ⚡ Stamina     : ${bar(pet.energy)} (${pet.energy}%)\n│ ❤️ Kebahagiaan : ${bar(pet.happiness)} (${pet.happiness}%)\n╰─────────────────────────\n\n🔄 Sisa reroll: ${user.rerollCount}/3`)
}

// ═══════════════ BOM ═══════════════
const BOMB_TIMEOUT = 180000
const BOMB_NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

function bombText(board, { intro = true, status = '' } = {}) {
    let t = '乂  *B O M B*\n\n'
    if (intro) t += 'Balas pesan ini dengan angka *1* - *9* untuk membuka *9* kotak nomor di bawah ini :\n\n'
    for (let i = 0; i < 9; i += 3) t += board.slice(i, i + 3).map(v => v.state ? v.emot : v.number).join('') + '\n'
    t += `\nTimeout : [ *${BOMB_TIMEOUT / 60000} menit* ]\n`
    if (intro) t += 'Apabila mendapat kotak yang berisi bom maka XP akan dikurangi.\n'
    return (t + status).trim()
}

async function runBomb(m, ctx) {
    const { sock, jid } = ctx
    const cur = S.bomb[jid]
    if (cur) return sock.sendMessage(jid, { text: '*^ sesi ini belum selesai!*' }, { quoted: cur.msg })
    const emots = ['💥', '✅', '✅', '✅', '✅', '✅', '✅', '✅', '✅'].sort(() => Math.random() - 0.5)
    const board = emots.map((emot, i) => ({ emot, number: BOMB_NUM[i], position: i + 1, state: false }))
    const msg = await sock.sendMessage(jid, { text: bombText(board) }, { quoted: m })
    const room = { msg, key: msg.key, board }
    room.timer = setTimeout(() => {
        if (S.bomb[jid] !== room) return
        const b = board.find(v => v.emot === '💥')
        sock.sendMessage(jid, { text: `*Waktu habis!*, Bom berada di kotak nomor ${b.number}.` }, { quoted: msg }).catch(() => null)
        delete S.bomb[jid]
    }, BOMB_TIMEOUT)
    S.bomb[jid] = room
}

async function bombAnswer(m, ctx) {
    const { sock, jid } = ctx
    const room = S.bomb[jid]
    const body = textOf(m, ctx)
    if (!room || !/^\d+$/.test(body)) return false
    if (!m.quoted || m.quoted.id !== room.key.id) return false

    const box = room.board.find(v => v.position === Number(body))
    if (!box) { await say(sock, m, '🚩 Untuk membuka kotak kirim angka 1 - 9'); return true }
    if (box.state) { await say(sock, m, `🚩 Kotak ${box.number} sudah dibuka, pilih kotak yang lain.`); return true }

    const reward = gameRand(100, 80000)
    const user = await gameUser(sock, m)
    box.state = true

    if (box.emot === '💥') {
        clearTimeout(room.timer); delete S.bomb[jid]
        user.exp = Math.max(0, (Number(user.exp) || 0) - reward); persist()
        await say(sock, m, bombText(room.board, { intro: false, status: `*Permainan selesai!*, kotak berisi bom terbuka : (- *${reward.toLocaleString('id-ID')}* XP)` }))
        return true
    }
    user.exp = (Number(user.exp) || 0) + reward; persist()
    const open = room.board.filter(v => v.state && v.emot !== '💥').length
    if (open >= 8) {
        clearTimeout(room.timer); delete S.bomb[jid]
        await say(sock, m, bombText(room.board, { intro: false, status: `*Permainan selesai!* kotak berisi bom tidak terbuka : (+ *${reward.toLocaleString('id-ID')}* XP)` }))
    } else {
        const text = bombText(room.board, { status: `Kotak berisi bom tidak terbuka : (+ *${reward.toLocaleString('id-ID')}* XP)` })
        await sock.sendMessage(jid, { text, edit: room.key }).catch(() => say(sock, m, text))
    }
    return true
}

// ═══════════════ BONANZA (fruit spin) ═══════════════
async function runBonanza(m, ctx) {
    const { sock, jid } = ctx
    const p = gamePrefix(ctx)
    const args = String(ctx.text || '').split(/\s+/).filter(Boolean)
    if (args.length < 2) return ctx.reply(`Contoh: ${p}bonanza 10000 10`)
    const bet = parseInt(args[0]), spins = parseInt(args[1])
    if (!Number.isFinite(bet) || bet <= 0) return ctx.reply('Jumlah taruhan tidak valid.')
    if (!Number.isFinite(spins) || spins <= 0 || spins > 20) return ctx.reply('Jumlah spin harus antara 1 hingga 20.')
    if (!(await gameNeedRegister(m, ctx))) return

    const user = await gameUser(sock, m)
    const lock = jidNumber(m.sender)
    if (S.bonanza[lock]) return ctx.reply('Spin kamu sebelumnya masih berjalan.')
    if ((Number(user.money) || 0) < bet) return ctx.reply('Uang kamu tidak cukup untuk taruhan ini.')

    S.bonanza[lock] = true
    try {
        user.money -= bet
        persist()
        const single = bet / spins
        const fruits = ['🍌', '🍎', '🍇', '🍊', '🥭']
        const value = { '🍌': 100, '🍎': 50, '🍇': 90, '🍊': 70, '🥭': 40 }
        const patterns = [
            ...fruits.flatMap(f => [[f, f, f, f], [f, f, f]]),
            ['🥭', '🍌', '🍎'], ['🍎'], ['🥭'], ['🍇']
        ].sort((a, b) => b.length - a.length)
        const wins = { '🍌': 0, '🍎': 0, '🍇': 0, '🍊': 0, '🥭': 0 }
        let totalWin = 0, totalLoss = 0, scatter = 0

        const check = (grid) => {
            for (const pat of patterns) {
                for (const row of grid) {
                    if (row.join('').includes(pat.join(''))) {
                        totalWin += single * value[pat[0]]
                        wins[pat[0]]++
                        if (pat.length === 4) scatter++
                        return true
                    }
                }
            }
            return false
        }

        const name = m.pushName && m.pushName !== 'Unknown' ? m.pushName : tag(m.sender)
        const head = (count) => `╭──────────────────\n│ *👤nama*: ${name}\n│ *🎰spin*: ${count}\n│ *🪙bet*: ${bet}\n╰──────────────────\n           ❃𝗙𝗥𝗨𝗜𝗧 𝗦𝗣𝗜𝗡❃`
        const first = await sock.sendMessage(jid, { text: head(spins) }, { quoted: m })
        await sleep(2000)

        for (let i = 0; i < spins; i++) {
            const grid = Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => gamePick(fruits)))
            if (!check(grid)) totalLoss += single
            let text = `${head(spins - i)}\n${grid.map(r => `┃ ${r.join(' │ ')} ┃`).join('\n')}\n\n│ *Money*: ${Math.floor(user.money + totalWin).toLocaleString('id-ID')}`
            if (i === spins - 1) {
                text += `\n╭──────────────────\n│ *🏆win*: ${Math.floor(totalWin)}\n│➞ 🍎 Apel: ${wins['🍎']}\n│➞ 🍌 Pisang: ${wins['🍌']}\n│➞ 🍇 Anggur: ${wins['🍇']}\n│➞ 🍊 Jeruk: ${wins['🍊']}\n│➞ 🥭 Mangga: ${wins['🥭']}\n│ *Lose*: ${Math.floor(totalLoss)}\n│ *Scatter*: ${scatter}\n╰──────────────────`
            }
            await sock.sendMessage(jid, { text, edit: first.key }).catch(() => null)
            await sleep(1000)
        }
        user.money += Math.floor(totalWin)
        persist()
    } finally {
        delete S.bonanza[lock]
    }
}

// ═══════════════ FAMILY100 ═══════════════
const F100_WIN = 4999
const F100_BONUS = 15000
const F100_TIMEOUT = 5 * 60 * 1000
const f100Norm = (t = '') => String(t).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]/gu, '').trim()

async function runFamily100(m, ctx) {
    const { sock, jid } = ctx
    const cur = S.family100[jid]
    if (cur) return sock.sendMessage(jid, { text: '⚠️ Masih ada game Family100 yang belum selesai di chat ini.' }, { quoted: cur.msg })
    try {
        const { data } = await axios.get('https://api.siputzx.my.id/api/games/family100', { timeout: 20000 })
        if (!data?.status || !data?.data) throw new Error('Gagal mengambil soal.')
        const json = data.data
        const answers = json.jawaban.map(v => String(v).trim()).sort(() => Math.random() - 0.5)
        const caption = `🎮 *FAMILY100*\n\n❓ *Soal:*\n${json.soal}\n\n📦 Jumlah Jawaban: *${answers.length}*\n` +
            (answers.some(v => v.includes(' ')) ? '📝 Beberapa jawaban mengandung spasi.\n' : '') +
            `\n💡 Ketik *${gamePrefix(ctx)}hint* untuk bantuan\n⏳ Waktu: *5 Menit*\n📌 *Cara menjawab: balas (reply) pesan ini dengan jawaban kamu!*\n\n🏆 Hadiah:\n+${F100_WIN} XP / jawaban\n🎁 Bonus selesai: +${F100_BONUS} XP`
        const msg = await sock.sendMessage(jid, { text: caption }, { quoted: m })
        const room = { msg, soal: json.soal, jawaban: answers, normal: answers.map(f100Norm), terjawab: Array(answers.length).fill(false), hint: 3, hinted: [] }
        room.timer = setTimeout(async () => {
            if (S.family100[jid] !== room) return
            delete S.family100[jid]
            await sock.sendMessage(jid, { text: `⏰ *Waktu 5 menit telah habis!*\n\n📖 *Jawaban Family100:*\n\n${answers.map((v, i) => `${i + 1}. ${v}`).join('\n')}` }, { quoted: msg }).catch(() => null)
        }, F100_TIMEOUT)
        S.family100[jid] = room
    } catch (e) {
        console.error('[FAMILY100]', e?.message || e)
        return ctx.reply('❌ Gagal mengambil soal Family100.')
    }
}

function family100Hint(m, ctx) {
    const room = S.family100[ctx.jid || m.chat]
    if (!room) return false
    if (room.hint <= 0) { ctx.reply('❌ Hint sudah habis!'); return true }
    const idx = room.jawaban.findIndex((v, i) => !room.terjawab[i] && !room.hinted.includes(i))
    if (idx < 0) { ctx.reply('Semua jawaban sudah ditemukan.'); return true }
    room.hinted.push(idx)
    room.hint--
    const clue = [...room.jawaban[idx]].map((c, i, a) => (i === 0 || i === a.length - 1 || c === ' ' ? c : '_')).join('')
    ctx.reply(`💡 *Hint Family100*\n\n📝 ${clue}\n\nSisa hint: ${room.hint}`)
    return true
}

async function family100Answer(m, ctx) {
    const { sock, jid } = ctx
    const room = S.family100[jid]
    const body = textOf(m, ctx)
    if (!room || !body || !m.quoted) return false
    const q = m.quoted
    const isGameMsg = q.id === room.msg?.key?.id || (q.fromMe && q.text?.includes('FAMILY100') && q.text.includes(room.soal))
    if (!isGameMsg) return false

    const text = f100Norm(body)
    if (!text) return false
    if (room.normal.some((v, i) => room.terjawab[i] && v === text)) { await say(sock, m, '⚠️ Jawaban itu sudah ditemukan!'); return true }
    const index = room.normal.findIndex((v, i) => !room.terjawab[i] && v === text)
    if (index < 0) { await say(sock, m, `❌ *Jawaban salah!*\n\n💭 "${body}" bukan jawaban yang ada.\nSilakan coba lagi!`); return true }

    room.terjawab[index] = m.sender
    await gameGrant(sock, m, { exp: F100_WIN }).catch(() => null)
    const done = room.terjawab.every(Boolean)
    const board = room.jawaban.map((v, i) => room.terjawab[i] ? `✅ ${i + 1}. ${v}` : `⬜ ${i + 1}. ${'_'.repeat(v.length)}`).join('\n')
    await say(sock, m, `🎮 *FAMILY100*\n\n${board}\n\n🎉 ${tag(m.sender)} menjawab dengan benar!\n\n🏆 Hadiah:\n+${F100_WIN} XP`, [m.sender])
    if (done) {
        clearTimeout(room.timer); delete S.family100[jid]
        await gameGrant(sock, m, { exp: F100_BONUS }).catch(() => null)
        await say(sock, m, `🏆 *FAMILY100 SELESAI!*\n\nSemua jawaban berhasil ditemukan 🎉\n\n🎁 Bonus selesai:\n+${F100_BONUS} XP`)
    }
    return true
}

// ═══════════════ HANGMAN ═══════════════
const HANG_STAGES = [
    '```\n==========\n|    |\n|      \n|      \n|      \n|      \n|      \n==========',
    '```\n==========\n|    |\n|   💀\n|      \n|      \n|      \n|      \n==========',
    '```\n==========\n|    |\n|   💀\n|   |\n|      \n|      \n|      \n==========',
    '```\n==========\n|    |\n|   💀\n|  /|\n|      \n|      \n|      \n==========',
    '```\n==========\n|    |\n|   💀\n|  /|\\ \n|      \n|      \n|      \n==========',
    '```\n==========\n|    |\n|   💀\n|  /|\\ \n|  /   \n|      \n|      \n==========',
    '```\n==========\n|    |\n|   💀\n|  /|\\ \n|  / \\ \n|      \n|      \n=========='
]

class Hangman {
    constructor(id) { this.sessionId = id; this.guesses = []; this.stage = 0; this.quest = {}; this.max = 0 }
    async init() {
        const data = await gameRemoteJson('https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakkata.json')
        const q = gamePick(data.filter(v => v?.soal && v?.jawaban))
        if (!q) throw new Error('Data hangman kosong')
        this.quest = { clue: q.soal, word: String(q.jawaban).toLowerCase() }
        this.max = Math.min(this.quest.word.length + 2, HANG_STAGES.length - 1)
    }
    board() { return `${HANG_STAGES[Math.min(this.stage, HANG_STAGES.length - 1)]}\n\`\`\`\n*Clue:* ${this.quest.clue}` }
    word() { return [...this.quest.word].map(c => (this.guesses.includes(c) || !/[a-z]/.test(c)) ? c : '__').join(' ') }
    guess(letter) {
        if (!/^[a-zA-Z]$/.test(letter)) return 'invalid'
        letter = letter.toLowerCase()
        if (this.guesses.includes(letter)) return 'repeat'
        this.guesses.push(letter)
        if (!this.quest.word.includes(letter)) this.stage++
        if (this.stage >= this.max) return 'over'
        return [...new Set(this.quest.word)].filter(c => /[a-z]/.test(c)).every(c => this.guesses.includes(c)) ? 'win' : 'continue'
    }
}

async function runHangman(m, ctx) {
    const { jid } = ctx
    const p = gamePrefix(ctx)
    const [action, input] = String(ctx.text || '').trim().split(/\s+/)
    const room = S.hangman[jid]
    switch ((action || '').toLowerCase()) {
        case 'end':
            if (!room) return ctx.reply('Tidak ada sesi Hangman yang sedang berlangsung.')
            delete S.hangman[jid]
            return ctx.reply('Berhasil keluar dari sesi Hangman. 👋')
        case 'start': {
            if (room) return ctx.reply(`Sesi Hangman sudah berlangsung. Gunakan ${p}hangman *end* untuk mengakhiri sesi.`)
            if (!(await gameSpendLimit(m, ctx, 1))) return
            const g = new Hangman(m.sender)
            try { await g.init() } catch (e) {
                await gameRefundLimit(m, ctx, 1)
                return ctx.reply(`Gagal memulai Hangman: ${e.message}`)
            }
            S.hangman[jid] = g
            return ctx.reply(`Sesi Hangman dimulai. 🎉\n\n${g.board()}\n\n*Tebakan Kata:*\n${g.word()}\n\nKirim huruf untuk menebak, contoh: *${p}hangman guess a*`)
        }
        case 'guess': {
            if (!room) return ctx.reply(`Tidak ada sesi Hangman yang sedang berlangsung. Gunakan *${p}hangman start* untuk memulai.`)
            if (!input) return ctx.reply(`Masukkan huruf yang ingin ditebak. Contoh: *${p}hangman guess a*`)
            const r = room.guess(input)
            const msgs = {
                invalid: 'Masukkan huruf yang valid.',
                repeat: 'Kamu sudah menebak huruf ini sebelumnya. Coba huruf lain.',
                continue: `*Huruf yang Sudah Ditebak:*\n${room.guesses.join(', ')}\n${room.board()}\n\n*Tebakan Kata:*\n${room.word()}\n\n*Sisa kesempatan:* ${room.max - room.stage}`,
                over: `Game Over! Kamu kalah. Kata yang benar adalah *${room.quest.word}*. 💀`,
                win: 'Selamat! Kamu menang dalam permainan Hangman. 🎉'
            }
            if (r === 'over' || r === 'win') delete S.hangman[jid]
            return ctx.reply(msgs[r])
        }
        case 'hint':
            return room ? ctx.reply(`*Hint:* ${room.quest.word}`) : ctx.reply(`Tidak ada sesi Hangman yang sedang berlangsung. Gunakan *${p}hangman start* untuk memulai.`)
        default:
            return ctx.reply(`🎮 *Hangman Game* 🎮\n\n*Perintah:*\n- *${p}hangman start* : mulai permainan\n- *${p}hangman end* : keluar dari sesi\n- *${p}hangman guess [huruf]* : menebak huruf\n- *${p}hangman hint* : petunjuk kata`)
    }
}

// ═══════════════ SAMBUNG KATA ═══════════════
const SK_TITLE = `╔══「 *Kata Bersambung* 」\n╟ Game Kata Bersambung adalah\n║ permainan yang dimana setiap\n║ pemainnya diharuskan membuat\n║ kata dari akhir kata yang\n║ berasal dari kata sebelumnya.\n╚═════`
const SK_RULES = `╔══「 *PERATURAN* 」\n╟ Jawaban merupakan kata dasar\n╟ Tidak mengandung spasi/imbuhan\n╟ Kata terpakai tidak boleh diulang\n╟ Setiap pemain diberi *3 Nyawa*\n╟ Ketik *nyerah* untuk keluar\n╚═════`
const SK_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
const skValid = new Set(), skInvalid = new Set()
const SK_STARTERS = ['buku', 'ayam', 'kucing', 'mobil', 'motor', 'sepeda', 'kapal', 'pesawat', 'meja', 'kursi', 'gelas', 'piring', 'sendok', 'garpu', 'pisau', 'pintu', 'jendela', 'atap', 'lantai', 'dinding', 'lampu', 'kipas', 'kasur', 'bantal', 'guling', 'selimut', 'lemari', 'kertas', 'pensil', 'penghapus', 'penggaris', 'sepatu', 'sandal', 'baju', 'celana', 'topi', 'jaket', 'kacamata', 'jam']

async function skScrapeHtml(word) {
    const { data: html } = await axios.get(`https://kbbi.web.id/${word}`, { headers: { 'User-Agent': SK_UA }, timeout: 10000 })
    const $ = cheerio.load(html)
    const def = $('article .container .row .col-md-8 .body-content').find('p').text().trim()
    if (def && !def.includes('Entri tidak ditemukan')) return true
    const mm = String(html).match(/var\s+data\s*=\s*(\[[\s\S]*?\]);/)
    if (mm) { try { const d = JSON.parse(mm[1]); if (Array.isArray(d) && d.length) return true } catch { /* abaikan */ } }
    return false
}

async function skCekKbbi(word) {
    const w = word.trim().toLowerCase()
    try {
        const { data } = await axios.get(`https://kbbi.web.id/${w}/ajax_53mk5`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': SK_UA, Referer: `https://kbbi.web.id/${w}` }, timeout: 10000
        })
        if (Array.isArray(data) && data.length) return true
        return await skScrapeHtml(w)
    } catch {
        try { return await skScrapeHtml(w) } catch { return false }
    }
}

// ambil suku kata akhir
function skAkhir(text) {
    const mati = ['q', 'w', 'r', 't', 'y', 'p', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'z', 'x', 'c', 'v', 'b', 'n', 'm']
    if (text.length < 3) return text
    if (/([qwrtypsdfghjklzxcvbnm][qwrtypsdfhjklzxcvbnm])$/.test(text)) return /([qwrtypsdfhjklzxcvbnm])$/.exec(text)[0]
    if (/([qwrtypsdfghjklzxcvbnm][aiueo]ng)$/.test(text)) return /([qwrtypsdfghjklzxcvbnm][aiueo]ng)$/.exec(text)[0]
    if (/([aiueo][aiueo]([qwrtypsdfghjklzxcvbnm]|ng)?)$/i.test(text)) {
        if (/(ng)$/i.test(text)) return text.substring(text.length - 3)
        if (/([qwrtypsdfghjklzxcvbnm])$/i.test(text)) return text.substring(text.length - 2)
        return text.substring(text.length - 1)
    }
    if (/n[gy]([aiueo]([qwrtypsdfghjklzxcvbnm])?)$/.test(text)) {
        const ny = /n[gy]/i.exec(text)[0]
        const parts = text.split(ny)
        return ny + parts[parts.length - 1]
    }
    const res = Array.from(text).filter(v => mati.includes(v))
    let result = res[res.length - 1]
    for (const h of mati) if (text.endsWith(h)) result = res[res.length - 2]
    const parts = text.split(result)
    if (text.endsWith(result)) return result + parts[parts.length - 2] + result
    return result + parts[parts.length - 1]
}

async function skTurn(sock, m, room) {
    clearTimeout(room.waktu)
    await sock.sendMessage(room.id, {
        text: `Giliran ${tag(room.curr)}\nNyawa: ❤️ ${room.lives[room.curr]}\n\nKata Sebelumnya:\n*${room.kata.toUpperCase()}*\n\nLanjut:\n*${skAkhir(room.kata).toUpperCase()}...*\n\nKetik *nyerah* untuk menyerah.`,
        mentions: [room.curr]
    }, { quoted: m })
    room.waktu = setTimeout(() => skTimeout(sock, m, room), 45000)
}

// kurangi 1 nyawa pemain giliran; return true kalau game selesai
async function skLoseLife(sock, m, room, who, reason) {
    room.lives[who] -= 1
    const idx = room.player.indexOf(who)
    if (room.lives[who] <= 0) {
        await sock.sendMessage(room.id, { text: `💀 ${tag(who)} tereliminasi! ${reason} dan nyawa habis.`, mentions: [who] }, { quoted: m })
        room.player = room.player.filter(v => v !== who)
        delete room.lives[who]
        if (room.player.length <= 1) return skWin(sock, m, room)
        room.curr = room.player[idx] || room.player[0]
    } else {
        await sock.sendMessage(room.id, { text: `❌ ${reason}! Nyawa ${tag(who)} sisa ${room.lives[who]}.`, mentions: [who] }, { quoted: m })
        room.curr = room.player[(idx + 1) % room.player.length]
    }
    return false
}

async function skWin(sock, m, room) {
    clearTimeout(room.waktu)
    delete S.skata[room.id]
    if (room.player[0]) await sock.sendMessage(room.id, { text: `🏆 ${tag(room.player[0])} memenangkan permainan!`, mentions: room.player }, { quoted: m })
    return true
}

async function skTimeout(sock, m, room) {
    if (S.skata[room.id] !== room || room.status !== 'play') return
    const who = room.curr
    if (await skLoseLife(sock, m, room, who, '⏱️ Waktu habis')) return
    skTurn(sock, m, room).catch(() => null)
}

async function runSambungKata(m, ctx) {
    const { sock, jid } = ctx
    const p = gamePrefix(ctx)
    const me = await toPN(sock, m.sender)
    const text = String(ctx.text || '').trim().toLowerCase()
    const list = (room) => room.player.map((v, i) => `╟ ${i + 1}. ${tag(v)}`).join('\n')
    const how = `Ketik:\n*${p}sambungkata* → join\n*${p}sambungkata start* → mulai`
    let room = S.skata[jid]

    if (!room) {
        room = S.skata[jid] = { id: jid, player: [me], status: 'wait', curr: '', kata: '', waktu: null, usedWords: [], lives: {} }
        return say(sock, m, `${SK_TITLE}\n\n${SK_RULES}\n\n╔═〘 Daftar Player 〙\n${list(room)}\n╚════\n\n${how}`, room.player)
    }
    if (room.status !== 'wait') return ctx.reply('Permainan sedang berjalan.')

    if (text === 'start') {
        if (!room.player.includes(me)) return ctx.reply('Kamu belum join dalam permainan ini.')
        if (room.player.length < 2) return ctx.reply('Permainan membutuhkan minimal 2 player.')
        room.status = 'play'
        room.curr = room.player[0]
        room.kata = gamePick(SK_STARTERS)
        room.usedWords = [room.kata]
        room.player.forEach(v => { room.lives[v] = 3 })
        return skTurn(sock, m, room)
    }
    if (room.player.includes(me)) return ctx.reply('Kamu sudah join.')
    room.player.push(me)
    return say(sock, m, `╔═〘 Daftar Player 〙\n${list(room)}\n╚════\n\n${how}`, room.player)
}

async function sambungKataAnswer(m, ctx) {
    const { sock, jid } = ctx
    const room = S.skata[jid]
    const jawab = textOf(m, ctx).toLowerCase()
    if (!room || room.status !== 'play' || !jawab || /\s/.test(jawab)) return false
    const me = await toPN(sock, m.sender)
    if (me !== room.curr) return false
    if (!jawab.startsWith(skAkhir(room.kata).toLowerCase())) return false

    clearTimeout(room.waktu)
    if (room.usedWords.includes(jawab)) {
        if (!(await skLoseLife(sock, m, room, me, `Kata *"${jawab}"* sudah dipakai`))) await skTurn(sock, m, room)
        return true
    }
    let valid
    if (skInvalid.has(jawab)) valid = false
    else if (skValid.has(jawab)) valid = true
    else { valid = await skCekKbbi(jawab); (valid ? skValid : skInvalid).add(jawab) }

    if (!valid) {
        if (!(await skLoseLife(sock, m, room, me, `Kata *"${jawab}"* tidak ada di KBBI`))) await skTurn(sock, m, room)
        return true
    }
    room.usedWords.push(jawab)
    room.curr = room.player[(room.player.indexOf(me) + 1) % room.player.length]
    room.kata = jawab
    await skTurn(sock, m, room)
    return true
}

async function sambungKataGiveUp(m, ctx) {
    const { sock, jid } = ctx
    const room = S.skata[jid]
    if (!room) return false
    if (room.status === 'wait') { delete S.skata[jid]; await ctx.reply('Sesi Sambung Kata dibatalkan.'); return true }
    const me = await toPN(sock, m.sender)
    if (me !== room.curr) return false
    clearTimeout(room.waktu)
    const idx = room.player.indexOf(me)
    room.player = room.player.filter(v => v !== me)
    delete room.lives[me]
    await sock.sendMessage(jid, { text: `${tag(me)} menyerah!`, mentions: [me] }, { quoted: m })
    if (room.player.length <= 1) { await skWin(sock, m, room); return true }
    room.curr = room.player[idx] || room.player[0]
    await skTurn(sock, m, room)
    return true
}

// ═══════════════ SUIT PVP ═══════════════
const SUIT_TIMEOUT = 60000
const SUIT_WIN = 500
const SUIT_LOSE = 100
const SUIT_ACCEPT = /^(acc(ept)?|terima|gas|oke?|tolak|gamau|nanti|ga(k.)?bisa)/i
const SUIT_REJECT = /^(tolak|gamau|nanti|ga(k.)?bisa)/i

async function runSuitPvp(m, ctx) {
    const { sock, jid } = ctx
    const me = await toPN(sock, m.sender)
    const target = m.mentionedJid?.[0] || m.quoted?.sender
    if (!target) return ctx.reply(`_Siapa yang ingin kamu tantang?_\nTag orangnya. Contoh:\n\n${gamePrefix(ctx)}suitpvp @user`)
    const who = await toPN(sock, target)
    if (who === me) return ctx.reply('Kamu tidak bisa menantang diri sendiri.')
    const rooms = Object.values(S.suit)
    if (rooms.some(r => [r.p, r.p2].includes(me))) return ctx.reply('Selesaikan suit sebelumnya terlebih dahulu.')
    if (rooms.some(r => [r.p, r.p2].includes(who))) return ctx.reply('Orang yang kamu tantang sedang bermain suit bersama orang lain :(')

    const id = 'suit_' + Date.now()
    const room = S.suit[id] = { id, group: jid, p: me, p2: who, status: 'wait' }
    room.waktu = setTimeout(() => {
        if (S.suit[id]) sock.sendMessage(jid, { text: '_Waktu suit habis_' }, { quoted: m }).catch(() => null)
        delete S.suit[id]
    }, SUIT_TIMEOUT)
    await say(sock, m, `_*SUIT PvP*_\n\n${tag(me)} menantang ${tag(who)} untuk bermain suit.\n\nSilakan ${tag(who)}.\n\nKetik "terima/ok/gas" untuk memulai suit\nKetik "tolak/gabisa/nanti" untuk menolak.`, [me, who])
}

const suitWin = (a, b) => (a === 'batu' && b === 'gunting') || (a === 'gunting' && b === 'kertas') || (a === 'kertas' && b === 'batu')

async function suitAnswer(m, ctx) {
    const { sock } = ctx
    const rooms = Object.values(S.suit)
    if (!rooms.length) return false
    const me = await toPN(sock, m.sender)
    const room = rooms.find(r => [r.p, r.p2].includes(me))
    if (!room) return false
    const text = textOf(m, ctx)

    // lawan menjawab tantangan di grup
    if (room.status === 'wait') {
        if (me !== room.p2 || !m.isGroup || m.chat !== room.group || !SUIT_ACCEPT.test(text)) return false
        if (SUIT_REJECT.test(text)) {
            delete S.suit[room.id]; clearTimeout(room.waktu)
            await sock.sendMessage(m.chat, { text: `${tag(room.p2)} menolak suit, suit dibatalkan`, mentions: [room.p2] }, { quoted: m })
            return true
        }
        room.status = 'play'
        clearTimeout(room.waktu)
        const botNum = String(sock.user?.id || '').split('@')[0].split(':')[0]
        await sock.sendMessage(m.chat, { text: `Suit telah dikirimkan ke chat\n${tag(room.p)} dan\n${tag(room.p2)}\n\nSilakan pilih suit di chat pribadi masing-masing\nklik wa.me/${botNum}`, mentions: [room.p, room.p2] }, { quoted: m })
        const ask = `[S U I T  P V P]\nMenang: +${SUIT_WIN} XP\nKalah: -${SUIT_LOSE} XP\n\nSilakan pilih *batu / gunting / kertas*`
        await sock.sendMessage(room.p, { text: ask }).catch(() => null)
        await sleep(1500)
        await sock.sendMessage(room.p2, { text: ask }).catch(() => null)
        room.waktuPilih = setTimeout(async () => {
            if (S.suit[room.id] !== room) return
            delete S.suit[room.id]
            if (!room.pilih && !room.pilih2) return sock.sendMessage(room.group, { text: 'Kedua pemain tidak niat main,\nSuit dibatalkan' }).catch(() => null)
            const win = room.pilih ? room.p : room.p2, lose = room.pilih ? room.p2 : room.p
            await sock.sendMessage(room.group, { text: `${tag(lose)} tidak memilih suit, game berakhir`, mentions: [lose] }).catch(() => null)
            await gameGrant(sock, m, { exp: SUIT_WIN }, win).catch(() => null)
        }, SUIT_TIMEOUT)
        return true
    }

    // pilihan di chat pribadi
    if (m.isGroup) return false
    const pick = /^(gunting|batu|kertas)/i.exec(text)?.[0]?.toLowerCase()
    if (!pick) return false
    const mine = me === room.p ? 'pilih' : 'pilih2'
    const other = me === room.p ? 'pilih2' : 'pilih'
    if (room[mine]) return false
    room[mine] = pick
    await say(sock, m, `Kamu telah memilih ${pick}${room[other] ? '' : '\n\nMenunggu lawan memilih'}`)
    if (!room[other]) await sock.sendMessage(me === room.p ? room.p2 : room.p, { text: '_Lawan sudah memilih_\nSekarang giliran kamu' }).catch(() => null)
    if (!(room.pilih && room.pilih2)) return true

    clearTimeout(room.waktuPilih)
    delete S.suit[room.id]
    const tie = room.pilih === room.pilih2
    const win = tie ? '' : (suitWin(room.pilih, room.pilih2) ? room.p : room.p2)
    const lose = win === room.p ? room.p2 : room.p
    const line = (who, c) => `${tag(who)} (${c}) ${tie ? '' : who === win ? `Menang\n+${SUIT_WIN} XP` : `Kalah\n-${SUIT_LOSE} XP`}`
    await sock.sendMessage(room.group, { text: `_*Hasil Suit*_${tie ? '\nSERI' : ''}\n\n${line(room.p, room.pilih)}\n${line(room.p2, room.pilih2)}`.trim(), mentions: [room.p, room.p2] })
    if (!tie) {
        await gameGrant(sock, m, { exp: SUIT_WIN }, win).catch(() => null)
        const lu = await gameUserByJid(sock, lose)
        lu.exp = Math.max(0, (Number(lu.exp) || 0) - SUIT_LOSE)
        const wu = await gameUserByJid(sock, win)
        wu.win = (Number(wu.win) || 0) + 1
        persist()
    }
    return true
}

// ═══════════════ DADU ═══════════════
async function runDadu(m, ctx) {
    const { sock, jid } = ctx
    const n = gameRand(1, 6)
    try {
        await sendImageAsSticker(sock, jid, `https://www.random.org/dice/dice${n}.png`, m)
    } catch {
        await ctx.reply(`🎲 Hasil dadu: *${n}*`)
    }
}

// ═══════════════ TIC TAC TOE ═══════════════
const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
const TTT_REWARD = 300

const tttWinner = (b) => { for (const [x, y, z] of TTT_LINES) if (b[x] && b[x] === b[y] && b[y] === b[z]) return b[x]; return null }
function tttBoard(b) {
    const cell = (i) => b[i] === 'X' ? '❌' : b[i] === 'O' ? '⭕' : BOMB_NUM[i]
    return [0, 3, 6].map(r => `${cell(r)}${cell(r + 1)}${cell(r + 2)}`).join('\n')
}
function tttBot(b) {
    const find = (s) => { for (const l of TTT_LINES) { const v = l.map(i => b[i]); if (v.filter(c => c === s).length === 2 && v.includes(null)) return l[v.indexOf(null)] } return -1 }
    let i = find('O'); if (i < 0) i = find('X')
    if (i >= 0) return i
    if (!b[4]) return 4
    const free = b.map((v, k) => v ? -1 : k).filter(k => k >= 0)
    return gamePick(free)
}

async function runTicTacToe(m, ctx) {
    const { sock, jid } = ctx
    const arg = String(ctx.text || '').trim().toLowerCase()
    const cur = S.ttt[jid]
    if (arg === 'stop' || arg === 'end') {
        if (!cur) return ctx.reply('Tidak ada permainan Tic Tac Toe di chat ini.')
        delete S.ttt[jid]
        return ctx.reply('Permainan Tic Tac Toe dihentikan.')
    }
    if (cur) return ctx.reply(`Masih ada permainan Tic Tac Toe di chat ini.\nKetik *${gamePrefix(ctx)}tictactoe stop* untuk menghentikan.`)

    const me = await toPN(sock, m.sender)
    const target = m.mentionedJid?.[0] || m.quoted?.sender
    const opp = target ? await toPN(sock, target) : 'bot'
    if (opp === me) return ctx.reply('Kamu tidak bisa melawan diri sendiri.')
    S.ttt[jid] = { board: Array(9).fill(null), X: me, O: opp, turn: 'X', last: Date.now() }
    const who = opp === 'bot' ? 'Bot' : tag(opp)
    return say(sock, m, `⭕❌ *TIC TAC TOE*\n\n${tag(me)} (❌) vs ${who} (⭕)\n\n${tttBoard(S.ttt[jid].board)}\n\nGiliran ${tag(me)}. Kirim angka *1-9* untuk memilih kotak.`, opp === 'bot' ? [me] : [me, opp])
}

async function ticTacToeAnswer(m, ctx) {
    const { sock, jid } = ctx
    const g = S.ttt[jid]
    const body = textOf(m, ctx)
    if (!g || !/^[1-9]$/.test(body)) return false
    if (Date.now() - g.last > 30 * 60 * 1000) { delete S.ttt[jid]; return false }
    const me = await toPN(sock, m.sender)
    if (me !== g[g.turn]) return false
    const i = Number(body) - 1
    if (g.board[i]) { await say(sock, m, '🚩 Kotak itu sudah terisi, pilih yang lain.'); return true }
    g.board[i] = g.turn
    g.last = Date.now()

    const finish = async (win) => {
        delete S.ttt[jid]
        let extra = ''
        if (win) {
            const w = g[win]
            if (w !== 'bot') extra = await gameGrant(sock, m, { exp: TTT_REWARD }, w).catch(() => '')
        }
        const res = win ? (g[win] === 'bot' ? '🤖 Bot menang!' : `🏆 ${tag(g[win])} menang!`) : '🤝 Permainan seri!'
        await say(sock, m, `⭕❌ *TIC TAC TOE*\n\n${tttBoard(g.board)}\n\n${res}${extra ? `\n${extra}` : ''}`, [g.X, g.O].filter(v => v !== 'bot'))
    }

    let win = tttWinner(g.board)
    if (win) { await finish(win); return true }
    if (g.board.every(Boolean)) { await finish(null); return true }
    g.turn = g.turn === 'X' ? 'O' : 'X'

    if (g[g.turn] === 'bot') {
        g.board[tttBot(g.board)] = 'O'
        win = tttWinner(g.board)
        if (win) { await finish(win); return true }
        if (g.board.every(Boolean)) { await finish(null); return true }
        g.turn = 'X'
    }
    await say(sock, m, `⭕❌ *TIC TAC TOE*\n\n${tttBoard(g.board)}\n\nGiliran ${tag(g[g.turn])}.`, [g[g.turn]])
    return true
}

// ═══════════════ MINESWEEPER ═══════════════
const MINE_SIZE = 6
const MINE_COUNT = 6
const MINE_REWARD = 1000
const MINE_COLS = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫']

function mineNeighbors(i) {
    const r = Math.floor(i / MINE_SIZE), c = i % MINE_SIZE, out = []
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue
        const nr = r + dr, nc = c + dc
        if (nr >= 0 && nr < MINE_SIZE && nc >= 0 && nc < MINE_SIZE) out.push(nr * MINE_SIZE + nc)
    }
    return out
}

function mineRender(g, reveal = false) {
    const rows = [`⬛${MINE_COLS.join('')}`]
    for (let r = 0; r < MINE_SIZE; r++) {
        let line = BOMB_NUM[r]
        for (let c = 0; c < MINE_SIZE; c++) {
            const i = r * MINE_SIZE + c
            if (g.mines && g.mines.has(i) && (reveal || g.open.has(i))) line += g.hit === i ? '💥' : '💣'
            else if (g.open.has(i)) line += g.count[i] ? BOMB_NUM[g.count[i] - 1] : '🟦'
            else line += '⬜'
        }
        rows.push(line)
    }
    return rows.join('\n')
}

async function runMinesweeper(m, ctx) {
    const { sock, jid } = ctx
    const arg = String(ctx.text || '').trim().toLowerCase()
    const cur = S.mines[jid]
    if (arg === 'stop' || arg === 'end') {
        if (!cur) return ctx.reply('Tidak ada permainan Minesweeper di chat ini.')
        delete S.mines[jid]
        return ctx.reply(`Permainan dihentikan. Posisi bom:\n\n${mineRender(cur, true)}`)
    }
    if (cur) return ctx.reply(`Masih ada permainan Minesweeper di chat ini.\nKetik *${gamePrefix(ctx)}minesweeper stop* untuk menyerah.`)
    const g = S.mines[jid] = { owner: await toPN(sock, m.sender), open: new Set(), mines: null, count: [], hit: -1, last: Date.now() }
    return say(sock, m, `💣 *MINESWEEPER* ${MINE_SIZE}x${MINE_SIZE} • ${MINE_COUNT} bom\n\n${mineRender(g)}\n\nKetik koordinat untuk membuka kotak, contoh: *B3* (kolom B, baris 3).\nBuka semua kotak aman untuk menang. Klik pertama selalu aman.`)
}

async function minesweeperAnswer(m, ctx) {
    const { sock, jid } = ctx
    const g = S.mines[jid]
    const mt = /^([a-f])([1-6])$/i.exec(textOf(m, ctx))
    if (!g || !mt) return false
    if (Date.now() - g.last > 30 * 60 * 1000) { delete S.mines[jid]; return false }
    if ((await toPN(sock, m.sender)) !== g.owner) return false
    g.last = Date.now()
    const i = (Number(mt[2]) - 1) * MINE_SIZE + (mt[1].toLowerCase().charCodeAt(0) - 97)
    if (g.open.has(i)) { await say(sock, m, '🚩 Kotak itu sudah terbuka.'); return true }

    if (!g.mines) {
        const safe = new Set([i, ...mineNeighbors(i)])
        const pool = Array.from({ length: MINE_SIZE * MINE_SIZE }, (_, k) => k).filter(k => !safe.has(k)).sort(() => Math.random() - 0.5)
        g.mines = new Set(pool.slice(0, MINE_COUNT))
        g.count = Array.from({ length: MINE_SIZE * MINE_SIZE }, (_, k) => mineNeighbors(k).filter(n => g.mines.has(n)).length)
    }
    if (g.mines.has(i)) {
        g.hit = i
        delete S.mines[jid]
        await say(sock, m, `💥 *BOOM!* Kamu menginjak bom.\n\n${mineRender(g, true)}`)
        return true
    }
    const stack = [i]
    while (stack.length) {
        const k = stack.pop()
        if (g.open.has(k) || g.mines.has(k)) continue
        g.open.add(k)
        if (!g.count[k]) stack.push(...mineNeighbors(k))
    }
    if (g.open.size >= MINE_SIZE * MINE_SIZE - MINE_COUNT) {
        delete S.mines[jid]
        const prize = await gameGrant(sock, m, { exp: MINE_REWARD }).catch(() => '')
        await say(sock, m, `🎉 *MENANG!* Semua kotak aman terbuka.\n\n${mineRender(g, true)}${prize ? `\n\n${prize}` : ''}`)
        return true
    }
    await say(sock, m, `💣 *MINESWEEPER*\n\n${mineRender(g)}\n\nKotak aman terbuka: ${g.open.size}/${MINE_SIZE * MINE_SIZE - MINE_COUNT}`)
    return true
}

// ═══════════════ SLOT ═══════════════
const SLOT_ICONS = ['🍒', '🍋', '🍇', '🍉', '🔔', '7️⃣']

async function runSlot(m, ctx) {
    const { sock, jid } = ctx
    const bet = parseInt(String(ctx.text || '').trim().split(/\s+/)[0])
    if (!Number.isFinite(bet) || bet <= 0) return ctx.reply(`Contoh: ${gamePrefix(ctx)}slot 1000\n\n3 simbol sama = x5 (7️⃣ x10)\n2 simbol sama = x2`)
    const user = await gameUser(sock, m)
    if ((Number(user.money) || 0) < bet) return ctx.reply('Uang kamu tidak cukup untuk taruhan ini.')
    user.money -= bet

    const reels = [gamePick(SLOT_ICONS), gamePick(SLOT_ICONS), gamePick(SLOT_ICONS)]
    const uniq = new Set(reels).size
    const mult = uniq === 1 ? (reels[0] === '7️⃣' ? 10 : 5) : uniq === 2 ? 2 : 0
    const prize = bet * mult
    user.money += prize
    persist()

    const first = await sock.sendMessage(jid, { text: '🎰 *SLOT*\n\n[ 🎰 | 🎰 | 🎰 ]\n\nMemutar...' }, { quoted: m })
    await sleep(1200)
    const text = `🎰 *SLOT*\n\n[ ${reels.join(' | ')} ]\n\n` +
        (mult ? `🎉 Menang x${mult}! +${(prize - bet).toLocaleString('id-ID')} Money` : `😢 Kalah! -${bet.toLocaleString('id-ID')} Money`) +
        `\n💰 Money: ${Math.floor(user.money).toLocaleString('id-ID')}`
    await sock.sendMessage(jid, { text, edit: first.key }).catch(() => say(sock, m, text))
}

// ═══════════════ penghubung (jawab / hint / nyerah) ═══════════════
const answerers = [akinatorAnswer, bombAnswer, family100Answer, sambungKataAnswer, suitAnswer, ticTacToeAnswer, minesweeperAnswer]

async function answer(m, ctx) {
    for (const fn of answerers) {
        try { if (await fn(m, ctx)) return true } catch (e) { console.error('[GAME]', fn.name, e?.message || e) }
    }
    return false
}

async function hint(m, ctx) {
    return family100Hint(m, ctx)
}

async function giveUp(m, ctx) {
    const { jid } = ctx
    const reveal = async (text) => { await ctx.reply(text); return true }

    const bomb = S.bomb[jid]
    if (bomb) {
        clearTimeout(bomb.timer); delete S.bomb[jid]
        const b = bomb.board.find(v => v.emot === '💥')
        return reveal(`🏳️ Menyerah ya?\nBom berada di kotak nomor ${b.number}.`)
    }
    const f = S.family100[jid]
    if (f) {
        clearTimeout(f.timer); delete S.family100[jid]
        return reveal(`🏳️ Menyerah ya?\n\n📖 *Jawaban Family100:*\n\n${f.jawaban.map((v, i) => `${i + 1}. ${v}`).join('\n')}`)
    }
    const h = S.hangman[jid]
    if (h) { delete S.hangman[jid]; return reveal(`🏳️ Menyerah ya?\nJawabannya: *${h.quest.word}*`) }
    if (await sambungKataGiveUp(m, ctx)) return true
    if (S.mines[jid]) {
        const g = S.mines[jid]; delete S.mines[jid]
        return reveal(`🏳️ Menyerah ya?\n\n${mineRender(g, true)}`)
    }
    if (S.ttt[jid]) { delete S.ttt[jid]; return reveal('🏳️ Permainan Tic Tac Toe dihentikan.') }
    return false
}

return { runAkinator, runGachaPet, runBomb, runBonanza, runFamily100, runHangman, runSambungKata, runSuitPvp, runDadu, runTicTacToe, runMinesweeper, runSlot, answer, hint, giveUp }
})()

export const { runAkinator, runGachaPet, runBomb, runBonanza, runFamily100, runHangman, runSambungKata, runSuitPvp, runDadu, runTicTacToe, runMinesweeper, runSlot } = _gameExtra

// hint, nyerah, dan jawaban dipakai bersama oleh semua game (tebak-tebakan & game bersesi)
export async function runGameHint(m, ctx) {
    if (await _gameExtra.hint(m, ctx)) return
    return _game.runGameHint(m, ctx)
}

export async function runGameGiveUp(m, ctx) {
    if (await _gameExtra.giveUp(m, ctx)) return
    return _game.runGameGiveUp(m, ctx)
}

export async function runGameAnswer(m, ctx) {
    if (await _gameExtra.answer(m, ctx)) return true
    return _game.runGameAnswer(m, ctx)
}

// ╔══════════════ [ tools-media.js ] ══════════════╗
// Pemrosesan media untuk plugin tools: enc, compress, compressvid, voice, toptv, sprem.

// ───────── tools-media ─────────
// Pemrosesan media untuk plugin tools: enc, compress, compressvid, voice, toptv, sprem.
// sharp & javascript-obfuscator dimuat saat dipakai saja, jadi bot tetap jalan walau belum terpasang.

const _toolsMedia = (() => {
    const tmpFile = (ext = '') => path.join(tmpdir(), `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`)
    const friendly = (message) => Object.assign(new Error(message), { friendly: true })

    // ── enc : obfuscate JavaScript ──
    async function obfuscateJs(code) {
        let JavaScriptObfuscator
        try {
            JavaScriptObfuscator = (await import('javascript-obfuscator')).default
        } catch {
            throw friendly('Modul javascript-obfuscator belum terpasang. Jalankan: npm i javascript-obfuscator')
        }

        return JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 1,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 1,
            stringArray: true,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 1
        }).getObfuscatedCode()
    }

    // ── compress : gambar -> jpeg kecil 480px ──
    async function compressImageSmall(buffer) {
        const sharp = await getSharp()
        return sharp(buffer)
            .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
            .sharpen({ sigma: 1.2, m1: 1.0, m2: 1.4, x1: 1.0, y2: 2.4, y3: 3.2 })
            .jpeg({
                quality: 35,
                mozjpeg: true,
                chromaSubsampling: '4:2:0',
                optimiseScans: true,
                trellisQuantisation: true,
                overshootDeringing: true
            })
            .toBuffer()
    }

    // ── compressvid : gambar / video, mode auto | hd | ultra ──
    async function compressMedia(buffer, mimetype, mode = 'auto') {
        if (/image/.test(mimetype)) {
            let quality = 80
            if (mode === 'hd') quality = 95
            if (mode === 'ultra') quality = 40

            const sharp = await getSharp()
            const out = await sharp(buffer).jpeg({ quality, mozjpeg: true }).toBuffer()
            return { type: 'image', buffer: out, fileName: 'compressed.jpg', mimetype: 'image/jpeg' }
        }

        if (/video/.test(mimetype)) {
            const input = tmpFile('.mp4')
            const output = tmpFile('_compressed.mp4')
            fs.writeFileSync(input, buffer)

            let crf = 28
            let scale = '640:-2'
            if (mode === 'hd') { crf = 23; scale = '854:-2' }
            if (mode === 'ultra') { crf = 35; scale = '480:-2' }

            try {
                await new Promise((resolve, reject) => {
                    ffmpeg(input)
                        .outputOptions([
                            `-crf ${crf}`,
                            '-preset veryfast',
                            '-vcodec libx264',
                            '-acodec aac',
                            '-b:a 96k',
                            `-vf scale=${scale}`
                        ])
                        .save(output)
                        .on('end', resolve)
                        .on('error', reject)
                })
                return { type: 'video', buffer: fs.readFileSync(output), fileName: 'compressed.mp4', mimetype: 'video/mp4' }
            } finally {
                for (const file of [input, output]) {
                    try { fs.unlinkSync(file) } catch {}
                }
            }
        }

        throw friendly('Format tidak didukung')
    }

    // ── voice : audio / video -> opus + waveform asli ──
    function runFfmpegPcm(input) {
        return new Promise((resolve, reject) => {
            const proc = spawn('ffmpeg', [
                '-hide_banner', '-loglevel', 'error', '-i', input,
                '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1'
            ], { stdio: ['ignore', 'pipe', 'pipe'] })

            const chunks = []
            const errors = []
            proc.stdout.on('data', chunk => chunks.push(chunk))
            proc.stderr.on('data', chunk => errors.push(chunk))
            proc.on('error', reject)
            proc.on('close', code => {
                if (code !== 0) return reject(new Error(Buffer.concat(errors).toString().slice(-3000)))
                resolve(Buffer.concat(chunks))
            })
        })
    }

    function runFfmpegOpus(input, output) {
        return new Promise((resolve, reject) => {
            const proc = spawn('ffmpeg', [
                '-hide_banner', '-loglevel', 'error',
                '-i', input,
                '-vn', '-map_metadata', '-1',
                '-ac', '1', '-ar', '48000',
                '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on',
                '-application', 'voip',
                '-f', 'ogg', '-y', output
            ], { stdio: ['ignore', 'pipe', 'pipe'] })

            let stderr = ''
            proc.stderr.on('data', data => { stderr += data.toString() })
            proc.on('error', reject)
            proc.on('close', code => {
                if (code === 0) resolve()
                else reject(new Error(`FFmpeg keluar dengan code ${code}\n${stderr.slice(-3000)}`))
            })
        })
    }

    // PCM -> waveform WhatsApp (Uint8Array, nilai 0-100)
    function generateWaveform(pcm, bars = 64) {
        const waveform = new Uint8Array(bars)
        const samples = pcm?.length ? Math.floor(pcm.length / 2) : 0
        if (samples <= 0) return waveform

        const samplesPerBar = Math.max(1, Math.floor(samples / bars))

        let maxAmplitude = 1
        for (let i = 0; i < samples; i++) {
            const value = Math.abs(pcm.readInt16LE(i * 2))
            if (value > maxAmplitude) maxAmplitude = value
        }

        for (let bar = 0; bar < bars; bar++) {
            const start = bar * samplesPerBar
            const end = Math.min(samples, start + samplesPerBar)

            let peak = 0
            let sum = 0
            let count = 0
            for (let i = start; i < end; i++) {
                const value = Math.abs(pcm.readInt16LE(i * 2))
                if (value > peak) peak = value
                sum += value
                count++
            }
            if (!count) continue

            const level = (sum / count) * 0.35 + peak * 0.65
            let normalized = (level / maxAmplitude) * 100
            normalized = Math.sqrt(Math.max(0, normalized) / 100) * 100
            waveform[bar] = Math.max(0, Math.min(100, Math.round(normalized)))
        }

        return waveform
    }

    async function buildVoiceNote(buffer, mimetype = '') {
        const input = tmpFile(mimetype.startsWith('video/') ? '.mp4' : '.audio')
        const opus = tmpFile('.opus')

        try {
            fs.writeFileSync(input, buffer)
            await runFfmpegOpus(input, opus)
            const pcm = await runFfmpegPcm(opus)
            return { audio: fs.readFileSync(opus), waveform: generateWaveform(pcm, 64) }
        } finally {
            for (const file of [input, opus]) {
                try { if (fs.existsSync(file)) fs.unlinkSync(file) } catch {}
            }
        }
    }

    // ── toptv : kirim media sebagai video bulat (PTV) ──
    async function sendPtv(sock, jid, buffer, quoted) {
        const { generateWAMessageContent } = await import('@whiskeysockets/baileys')
        const content = await generateWAMessageContent({ video: buffer }, { upload: sock.waUploadToServer })
        return sock.relayMessage(jid, { ptvMessage: content.videoMessage }, { quoted })
    }

    // ── sprem : sticker dengan atribut premium / avatar ──
    function buildStickerExif(metadata) {
        const json = Buffer.from(JSON.stringify(metadata), 'utf-8')
        const exif = Buffer.concat([
            Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00]),
            Buffer.alloc(4),
            Buffer.from([0x16, 0x00, 0x00, 0x00]),
            json
        ])
        exif.writeUInt32LE(json.length, 14)
        return exif
    }

    function makeWebpChunk(type, data) {
        const sizeBuffer = Buffer.alloc(4)
        sizeBuffer.writeUInt32LE(data.length, 0)
        const padding = data.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0)
        return Buffer.concat([Buffer.from(type), sizeBuffer, data, padding])
    }

    function setWebpExif(webp, metadata) {
        if (webp.slice(0, 4).toString() !== 'RIFF' || webp.slice(8, 12).toString() !== 'WEBP') {
            throw friendly('File bukan WEBP valid.')
        }

        const chunks = []
        let offset = 12
        while (offset + 8 <= webp.length) {
            const type = webp.slice(offset, offset + 4).toString()
            const size = webp.readUInt32LE(offset + 4)
            const chunkEnd = offset + 8 + size + (size % 2)
            if (chunkEnd > webp.length) break
            if (type !== 'EXIF') chunks.push(webp.slice(offset, chunkEnd))
            offset = chunkEnd
        }

        const body = Buffer.concat([...chunks, makeWebpChunk('EXIF', buildStickerExif(metadata))])
        const header = Buffer.alloc(12)
        header.write('RIFF', 0)
        header.writeUInt32LE(body.length + 4, 4)
        header.write('WEBP', 8)
        return Buffer.concat([header, body])
    }

    async function sendPremiumSticker(sock, jid, stickerBuffer, { isAnimated = false, quoted } = {}) {
        const { generateWAMessageFromContent, prepareWAMessageMedia } = await import('@whiskeysockets/baileys')

        const metadata = {
            'sticker-pack-id': '2be7e369-b5ce-4706-a3d4-f78805a20328',
            'sticker-pack-name': 'OMAK',
            'sticker-pack-publisher': 'HAI',
            'accessibility-text': 'MR ALOC',
            'android-app-store-link': 'https://whatsapp.com',
            'ios-app-store-link': 'https://whatsapp.com/ios',
            emojis: ['🦸', '😴', '😌'],
            'is-from-sticker-maker': 0,
            'is-avatar-sticker': 1,
            'avatar-sticker-template-id': 'whatsapp',
            'is-ai-sticker': 1,
            'is-avatar-country-sticker': 1,
            'is-avatar-instant-sticker': 1,
            'sticker-maker-source-type': 4,
            'is-avatar-social-sticker': 1,
            'avatar-sticker-style': 'whatsapp',
            'avatar-sticker-revision-id': '2026',
            'is-from-user-created-pack': 1,
            'origin-pack-id': 'whatsapp',
            'is-text-sticker': 1,
            premium: 1
        }

        const media = await prepareWAMessageMedia(
            { sticker: setWebpExif(stickerBuffer, metadata) },
            { upload: sock.waUploadToServer }
        )

        const msg = await generateWAMessageFromContent(jid, {
            messageContextInfo: {
                limitSharingV2: {
                    sharingLimited: true,
                    trigger: 'CHAT_SETTING',
                    limitSharingSettingTimestamp: Date.now().toString(),
                    initiatedByMe: true
                }
            },
            stickerMessage: {
                ...media.stickerMessage,
                isAnimated: !!isAnimated,
                isAvatar: true,
                isAiSticker: true,
                isLottie: false
            }
        }, { quoted, userJid: sock.user.id })

        return sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
    }

    return { obfuscateJs, compressImageSmall, compressMedia, buildVoiceNote, sendPtv, sendPremiumSticker }
})()

export const { obfuscateJs, compressImageSmall, compressMedia, buildVoiceNote, sendPtv, sendPremiumSticker } = _toolsMedia


// ╔══════════════ [ rpg.js ] ══════════════╗
// Sistem RPG: data user, level, hadiah, lamar/pacaran, cooldown, milestone.

// ───────── rpg: economy, relationship, rpg ─────────
// Jembatan untuk plugin economy / relationship / rpg. Plugin-nya ditulis dengan gaya
// `(m, { conn, usedPrefix, args, ... })`, `global.db.data.users`, `handler.limit`,
// `handler.register`, `handler.before`. Bagian ini menerjemahkannya ke handler di sini:
//   • adapt(handler, opts)  -> bungkus plugin jadi plugin handler ini
//   • global.db.data        -> alias ke global.db.rpgData (tersimpan di db/db.json)
//   • conn.reply / getName / parseMention / user.jid tersedia di sock
//   • limit, register, exp per command, dan `before` (jawaban Iya/Tidak) dijalankan di sini

// ───────── global bawaan rpg ─────────
global.multiplier ??= 38
global.rpg ??= {
    emoticon(string) {
        string = string.toLowerCase();
        let emot = {
            level: '📊',
            limit: '🎫',
            health: '❤️',
            stamina: '🔋',
            exp: '✨',
            money: '💹',
            bank: '🏦',
            potion: '🥤',
            diamond: '💎',
            common: '📦',
            uncommon: '🛍️',
            mythic: '🎁',
            legendary: '🗃️',
            superior: '💼',
            pet: '🔖',
            trash: '🗑',
            armor: '🥼',
            sword: '⚔️',
            pickaxe: '⛏️',
            fishingrod: '🎣',
            wood: '🪵',
            rock: '🪨',
            string: '🕸️',
            horse: '🐴',
            cat: '🐱',
            dog: '🐶',
            fox: '🦊',
            petFood: '🍖',
            iron: '⛓️',
            gold: '🪙',
            emerald: '❇️',
            upgrader: '🧰',
        };
        let results = Object.keys(emot)
            .map((v) => [v, new RegExp(v, 'gi')])
            .filter((v) => v[1].test(string));
        if (!results.length) return '';
        else return emot[results[0][0]];
    },
};

// ───────── helper prototype bawaan rpg ─────────
// Dipakai rpg-mining: [..].getRandom() dan (ms).toTimeString(). Non-enumerable supaya
// for..in di kode lain tidak terpengaruh, dan tidak menimpa kalau sudah ada.
function definePrototype(target, name, value) {
    if (Object.prototype.hasOwnProperty.call(target, name)) return
    Object.defineProperty(target, name, { value, writable: true, configurable: true, enumerable: false })
}
function getRandom() {
    if (Array.isArray(this) || this instanceof String) return this[Math.floor(Math.random() * this.length)]
    return Math.floor(Math.random() * this)
}
definePrototype(Array.prototype, 'getRandom', getRandom)
definePrototype(String.prototype, 'getRandom', getRandom)
definePrototype(Number.prototype, 'getRandom', getRandom)
definePrototype(Number.prototype, 'toTimeString', function toTimeString() {
    const seconds = Math.floor((this / 1000) % 60)
    const minutes = Math.floor((this / (60 * 1000)) % 60)
    const hours = Math.floor((this / (60 * 60 * 1000)) % 24)
    const days = Math.floor(this / (24 * 60 * 60 * 1000))
    return ((days ? `${days} hari ` : '') + (hours ? `${hours} jam ` : '') + (minutes ? `${minutes} menit ` : '') + (seconds ? `${seconds} detik` : '')).trim()
})

// ───────── data user default (disalin dari lib/database.js rpg) ─────────
export function makeDefaultUser(name) {
    return {
        name,
        exp: 0,
        money: 0,
        level: 1,
        limit: 20,
        age: -1,
        regTime: -1,
        afk: -1,
        afkReason: '',
        warn: 0,
        role: 'Newbie',
        premium: false,
        premiumTime: 0,
        registered: false,
        banned: false,
        autolevelup: false,
    
        // Bibit
        bibitapel: 0,
        bibitjeruk: 0,
        bibitdurian: 0,
        bibitmangga: 0,
        bibitpisang: 0,
    
        // Buah
        apel: 0,
        jeruk: 0,
        durian: 0,
        mangga: 0,
        pisang: 0,
    
        // Hewan
        banteng: 0,
        harimau: 0,
        gajah: 0,
        kambing: 0,
        panda: 0,
        buaya: 0,
        kerbau: 0,
        sapi: 0,
        monyet: 0,
        babihutan: 0,
        babi: 0,
        ayam: 0,
    
        // Ikan
        ikan: 0,
        lele: 0,
        nila: 0,
        bawal: 0,
        udang: 0,
        paus: 0,
        kepiting: 0,
    
        // Tools
        sword: 0,
        pickaxe: 0,
        axe: 0,
        fishingrod: 0,
        armor: 0,
        atm: 0,
    
        // Durability
        sworddurability: 0,
        pickaxedurability: 0,
        axedurability: 0,
        fishingroddurability: 0,
        armordurability: 0,
        fullatm: 0,
    
        // Items
        potion: 0,
        string: 0,
        wood: 0,
        rock: 0,
        coal: 0,
        iron: 0,
        diamond: 0,
        emerald: 0,
        trash: 0,
        common: 0,
        uncommon: 0,
        mythic: 0,
        legendary: 0,
    
        // Food
        ayambakar: 0,
        ayamgoreng: 0,
        oporayam: 0,
        gulaiayam: 0,
        steak: 0,
        rendang: 0,
        babipanggang: 0,
        ikanbakar: 0,
        lelebakar: 0,
        nilabakar: 0,
        bawalbakar: 0,
        udangbakar: 0,
        pausbakar: 0,
        kepitingbakar: 0,
    
        // Cooldown
        lastadventure: 0,
        lastbansos: 0,
        lastberburu: 0,
        lastdagang: 0,
        lastduel: 0,
        lastrampok: 0,
        lastmining: 0,
        lastnebang: 0,
        lastnguli: 0,
        lastclaim: 0,
        lastweekly: 0,
        lastmonthly: 0,
        lastenergy: 0,
        lastmulung: 0,
        lastngocok: 0,
        lastwarnet: 0,
        lastquest: 0,
        lastberkebon: 0,
        lastfishing: 0,
        lasthunt: 0,

        // Tambahan (dipakai berkebon & mulung)
        anggur: 0,
        bibitanggur: 0,
        tiketcoin: 0,
        botol: 0,
        kaleng: 0,
        kardus: 0,
    
        // Player Status
        health: 100,
        maxhealth: 100,
        stamina: 100,
        mana: 50,
        energy: 100,
    
        // Currency
        gold: 0,
        bank: 0,
    
        // Pet
        horse: 0,
        horseexp: 0,
    
        // Fishing / Farming
        bait: 0,
        fertilizer: 0,
    }
    
}

// ───────── penyimpanan ─────────
// Semua data plugin rpg disimpan di global.db.rpgData = { users, chats, settings }
export function rpgStore() {
    const db = global.db
    if (!db.rpgData) db.rpgData = { users: {}, chats: {}, settings: {} }
    const s = db.rpgData
    s.users ||= {}
    s.chats ||= {}
    s.settings ||= {}
    return s
}

// global.db.data.users -> global.db.rpgData.users (tidak ikut tersimpan dobel: non-enumerable)
function installDbShim() {
    const db = global.db
    if (!db || Object.prototype.hasOwnProperty.call(db, 'data')) return
    Object.defineProperty(db, 'data', { enumerable: false, configurable: true, get: rpgStore })
}

// Perubahan di dalam objek user (user.money += 5) tidak lewat Proxy, jadi simpan manual.
let lateSave = null
function persist() {
    try { saveDB(global.db) } catch {}
    // plugin yang memakai setTimeout (hunt, dungeon, dst) mengubah data setelah handler selesai
    if (lateSave) return
    lateSave = setTimeout(() => {
        lateSave = null
        try { saveDB(global.db) } catch {}
    }, 60_000)
    lateSave.unref?.()
}

// ───────── jid ─────────
// Plugin rpg memakai jid @s.whatsapp.net sebagai kunci user. Di grup, WhatsApp bisa
// mengirim @lid, jadi diubah ke nomor telepon kalau bisa.
export async function toPN(sock, jid) {
    if (!jid) return jid
    const id = sock.decodeJid ? sock.decodeJid(jid) : jid
    if (!isLidJid(id)) return id
    const number = await resolvePhone(sock, id).catch(() => null)
    return number ? `${number}@s.whatsapp.net` : id
}

const rpgNames = new Map() // jid -> pushName terakhir (untuk conn.getName)

async function wrapMessage(sock, m) {
    const pm = Object.create(m)
    pm.sender = await toPN(sock, m.sender)
    pm.mentionedJid = await Promise.all((m.mentionedJid || []).map(j => toPN(sock, j)))
    if (m.quoted) {
        const q = Object.create(m.quoted)
        q.sender = await toPN(sock, m.quoted.sender)
        pm.quoted = q
    }
    if (m.pushName && m.pushName !== 'Unknown') rpgNames.set(pm.sender, m.pushName)
    // m.edit(teks, key): edit pesan bot yang sebelumnya dikirim (key dari hasil m.reply)
    pm.edit = (text, key) => sock.sendMessage(pm.chat, { text: String(text ?? ''), edit: key?.key || key })
    return pm
}

// ───────── conn.* gaya rpg ─────────
// conn yang diberikan ke plugin rpg: selalu punya reply / getName / parseMention walaupun
// sock aslinya tidak punya (tidak bergantung pada flag shim di sock).
function makeConn(sock, pm) {
    const helpers = {
        reply: (jid, text, quoted, options = {}) => {
            const q = quoted?.key ? quoted : (jid === pm.chat ? pm : undefined)
            return sock.sendMessage(jid, { text: String(text ?? ''), ...(options || {}) }, q ? { quoted: q } : {})
        },
        getName: (jid) => {
            const id = sock.decodeJid ? sock.decodeJid(jid) : jid
            return rpgStore().users[id]?.name || rpgNames.get(id) || String(id || '').split('@')[0]
        },
        parseMention: (text = '') => [...String(text).matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
    }
    return new Proxy(sock, {
        get(target, prop) {
            const value = Reflect.get(target, prop, target)
            if (typeof value !== 'function' && Object.prototype.hasOwnProperty.call(helpers, prop)) return helpers[prop]
            return value
        }
    })
}

function installShims(sock) {
    if (sock.__rpgShim) return
    sock.__rpgShim = true

    if (typeof sock.reply !== 'function') {
        sock.reply = (jid, text, quoted, options = {}) => {
            const q = quoted?.key ? quoted : undefined // global.fstatus (kutipan palsu) diabaikan
            return sock.sendMessage(jid, { text: String(text ?? ''), ...(options || {}) }, q ? { quoted: q } : {})
        }
    }
    if (typeof sock.getName !== 'function') {
        // sinkron (plugin rpg kadang memanggilnya tanpa await); sender sudah berupa nomor telepon
        sock.getName = (jid) => {
            const id = sock.decodeJid ? sock.decodeJid(jid) : jid
            return rpgStore().users[id]?.name || rpgNames.get(id) || String(id || '').split('@')[0]
        }
    }
    if (typeof sock.parseMention !== 'function') {
        sock.parseMention = (text = '') =>
            [...String(text).matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
    }
}

// conn.user.jid dipakai beberapa plugin (Baileys hanya punya user.id)
function ensureBotJid(sock) {
    if (sock.user && !sock.user.jid) {
        sock.user.jid = sock.decodeJid ? sock.decodeJid(sock.user.id) : String(sock.user.id || '').replace(/:\d+@/, '@')
    }
}

// ───────── user ─────────
function ensureUser(pm) {
    const users = rpgStore().users
    const base = makeDefaultUser(pm.pushName && pm.pushName !== 'Unknown' ? pm.pushName : String(pm.sender).split('@')[0])
    let user = users[pm.sender]
    if (!user) {
        user = users[pm.sender] = base
    } else {
        for (const key in base) if (!(key in user)) user[key] = base[key]
    }
    // nilai angka yang rusak (NaN/null akibat field yang dulu belum ada) dipulihkan ke default
    for (const key in base) if (typeof base[key] === 'number' && !Number.isFinite(Number(user[key]))) user[key] = base[key]
    if (!Number.isFinite(Number(user.exp))) user.exp = 0
    if (!Number.isFinite(Number(user.limit))) user.limit = 20
    if (!Number.isFinite(Number(user.money))) user.money = 0
    return user
}

// ───────── regex command -> daftar nama ─────────
// Menu YannRzy hanya menampilkan command bertipe string/array. Regex sederhana seperti
// /^(casino|csn)$/i atau /^unreg(ister)?$/i diurai jadi ['casino', 'csn'] / ['unreg', 'unregister'].
function expandRegex(re) {
    if (!(re instanceof RegExp)) return null
    const src = re.source.replace(/^\^/, '').replace(/\$$/, '')
    let i = 0

    const parseAlt = () => {
        const out = [...parseSeq()]
        while (src[i] === '|') { i++; out.push(...parseSeq()) }
        return out
    }
    const parseSeq = () => {
        let acc = ['']
        while (i < src.length && src[i] !== '|' && src[i] !== ')') {
            let options
            const c = src[i]
            if (c === '(') {
                i++
                if (src.startsWith('?:', i)) i += 2
                options = parseAlt()
                if (src[i] !== ')') throw new Error('grup tidak ditutup')
                i++
            } else if (/[a-zA-Z0-9_-]/.test(c)) {
                options = [c]
                i++
            } else {
                throw new Error('regex terlalu rumit')
            }
            if (src[i] === '?') { options = ['', ...options]; i++ }
            acc = acc.flatMap(a => options.map(o => a + o))
            if (acc.length > 100) throw new Error('terlalu banyak kombinasi')
        }
        return acc
    }

    try {
        const list = parseAlt()
        if (i !== src.length) return null
        const names = [...new Set(list.map(s => s.toLowerCase()).filter(Boolean))]
        return names.length ? names : null
    } catch {
        return null
    }
}

// ───────── couple: sistem pasangan terpadu ─────────
// SUMBER DATA TUNGGAL: global.db.fun.pacar  (dipakai .tembak / .terima / .putus / .cekpacar / .addpasangan)
//   pacar:  { <nomor>: { with: <jid pasangan>, since: <ms> } }   (dua arah)
// DATA TAMBAHAN (love point, level, tabungan, dll) disimpan di global.db.fun.couple:
//   couple: { "<nomorA>_<nomorB>" (urut): { since, status, love, tabungan, ... } }
//   Record dibuat otomatis saat pertama dipakai. Kalau `since` beda dengan data pacar,
//   record dianggap milik hubungan lama dan dibuat ulang.
// Uang memakai field `money` milik user RPG (lihat rpgStore).
// Dipakai plugin: plugins/relationship/{pasanganku,addpasangan,putuspasangan,couple-*}.js
// <<COUPLE-START>>
export const MS = { HOUR: 3_600_000, DAY: 86_400_000 }
export const WIB = 7 * MS.HOUR

// ───────── konfigurasi ─────────
export const LEVELS = {
    pacaran:  { label: 'Pacaran',  icon: '💕', mult: 1 },
    tunangan: { label: 'Tunangan', icon: '💍', mult: 1.5 },
    menikah:  { label: 'Menikah',  icon: '👰', mult: 2 }
}

// syarat naik level (biaya dibayar pengaju saat pasangan menerima)
export const LAMAR_RULES = {
    tunangan: { from: 'pacaran',  love: 150, cost: 10_000, bonus: 2_000 },
    menikah:  { from: 'tunangan', love: 600, cost: 50_000, bonus: 10_000 }
}

export const GIFTS = {
    bunga:  { name: 'Bunga',  icon: '🌹', price: 500,    love: 10 },
    coklat: { name: 'Coklat', icon: '🍫', price: 1_500,  love: 35 },
    boneka: { name: 'Boneka', icon: '🧸', price: 5_000,  love: 120 },
    cincin: { name: 'Cincin', icon: '💍', price: 25_000, love: 700 }
}

export const PENDING_TTL = MS.HOUR            // lamar & tarik tabungan berlaku 1 jam
export const DATE_COOLDOWN = 20 * MS.HOUR
export const MILESTONES = [30, 100, 180, 365, 500, 730, 1000] // hari; setelah itu tiap 365 hari

// ───────── format ─────────
export const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString('id-ID')
export const tag = (jid) => '@' + jidNumber(jid)
export const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a

export function formatDuration(ms) {
    if (!ms || ms < 60_000) return 'Baru jadian 💖'
    const hari = Math.floor(ms / MS.DAY)
    const jam = Math.floor((ms % MS.DAY) / MS.HOUR)
    const menit = Math.floor((ms % MS.HOUR) / 60_000)
    const out = []
    if (hari) out.push(`${hari} Hari`)
    if (jam) out.push(`${jam} Jam`)
    if (!hari && menit) out.push(`${menit} Menit`)
    return out.join(' ') || 'Baru jadian 💖'
}

export const formatRemaining = (ms) => {
    const h = Math.floor(ms / MS.HOUR)
    const m = Math.ceil((ms % MS.HOUR) / 60_000)
    return h ? `${h} jam ${m} menit` : `${m} menit`
}

/** "5000", "5k", "5rb", "2jt", "all"/"semua". Mengembalikan 0 kalau tidak valid. */
export function parseAmount(input, max = 0) {
    const s = String(input || '').toLowerCase().replace(/[.,_\s]/g, '')
    if (s === 'all' || s === 'semua') return Math.floor(max)
    const m = s.match(/^(\d+)(k|rb|jt)?$/)
    if (!m) return 0
    const n = Number(m[1]) * (m[2] === 'jt' ? 1_000_000 : m[2] ? 1000 : 1)
    return Number.isSafeInteger(n) ? n : 0
}

export function loveBar(love, size = 10) {
    const steps = [0, 150, 600, 1500, 4000]
    const next = steps.find(v => v > love) ?? steps[steps.length - 1]
    const prev = [...steps].reverse().find(v => v <= love) ?? 0
    const ratio = next === prev ? 1 : Math.min(1, (love - prev) / (next - prev))
    const fill = Math.round(ratio * size)
    return '█'.repeat(fill) + '░'.repeat(size - fill)
}

// ───────── penyimpanan ─────────
export function funStore() {
    if (!global.db) throw new Error('Database belum siap')
    const existed = !!global.db.fun
    const fun = global.db.fun || {}
    fun.pacar ||= {}
    fun.tembak ||= {}
    fun.couple ||= {}
    if (!existed) global.db.fun = fun
    return fun
}

/** assign ke global.db.fun memicu penyimpanan otomatis (Proxy initDatabase) */

/** User RPG (dibuat minimal kalau belum ada; ensureUser melengkapi sisanya nanti). */
export function rpgUser(jid) {
    const users = rpgStore().users
    if (!users[jid]) users[jid] = { money: 0, exp: 0, limit: 20 }
    const u = users[jid]
    if (!Number.isFinite(Number(u.money))) u.money = 0
    return u
}

// ───────── identitas ─────────
/** Semua nomor yang mungkin dipakai pengirim (nomor telepon dan LID) sebagai kunci pacar. */
export function senderNums(m) {
    const out = new Set()
    const add = (j) => { const n = jidNumber(j); if (n) out.add(n) }
    add(m?.sender)
    try { add(Object.getPrototypeOf(m)?.sender) } catch {}
    return [...out]
}

const pairKey = (a, b) => [a, b].sort().join('_')

const newRecord = (since) => ({
    since, status: 'pacaran', love: 0, tabungan: 0, kontribusi: {},
    date: {}, comboAt: 0, cd: {}, cheat: {}, annivSent: {}, bday: {},
    acct: {}, chat: '', lamar: null, tarik: null
})

/** Pindahkan data lama (users[].relationship dari addpasangan versi lama) ke sistem baru. */
function migrateLegacy(fun, jid) {
    const users = rpgStore().users
    const old = users[jid]?.relationship
    const partner = old?.pasangan
    if (!partner) return null

    const back = users[partner]?.relationship
    const clear = (u) => { if (u?.relationship) u.relationship = { pasangan: '', pending: '', dari: '', sejak: 0 } }

    if (!back || back.pasangan !== jid) { clear(users[jid]); return null }

    const a = jidNumber(jid), b = jidNumber(partner)
    if (fun.pacar[a] || fun.pacar[b]) return null // sudah punya hubungan di sistem baru

    const since = old.sejak || Date.now()
    fun.pacar[a] = { with: partner, since }
    fun.pacar[b] = { with: jid, since }
    clear(users[jid]); clear(users[partner])
    return { num: a, entry: fun.pacar[a] }
}

/**
 * Ambil data hubungan milik pengirim pesan. null kalau tidak punya pasangan.
 * @returns {{fun, key, rec, meNum, pNum, me, partner, since}|null}
 */
export function getCouple(m, { touch = true } = {}) {
    const fun = funStore()
    let hit = null
    for (const n of senderNums(m)) {
        if (fun.pacar[n]) { hit = { num: n, entry: fun.pacar[n] }; break }
    }
    if (!hit) hit = migrateLegacy(fun, m.sender)
    if (!hit) return null

    const pNum = jidNumber(hit.entry.with)
    const back = fun.pacar[pNum]
    if (!back || jidNumber(back.with) !== hit.num) {
        delete fun.pacar[hit.num] // data menggantung (pasangan sudah punya hubungan lain)
        return null
    }

    const key = pairKey(hit.num, pNum)
    let rec = fun.couple[key]
    if (!rec || rec.since !== hit.entry.since) rec = fun.couple[key] = newRecord(hit.entry.since)

    if (touch) {
        if (m.sender && !isLidJid(m.sender)) rec.acct[hit.num] = m.sender
        if (m.isGroup && m.chat) rec.chat = m.chat
    }
    return { fun, key, rec, meNum: hit.num, pNum, me: m.sender, partner: hit.entry.with, since: hit.entry.since }
}

/** JID nomor telepon pasangan (untuk akun RPG). */
export async function partnerJid(sock, c) {
    const known = c.rec.acct[c.pNum]
    if (known) return known
    const p = c.partner
    if (isLidJid(p)) {
        const n = await resolvePhone(sock, p).catch(() => null)
        if (n) {
            const pn = `${n}@s.whatsapp.net`
            c.rec.acct[c.pNum] = pn
            return pn
        }
    }
    return p
}

export const statusOf = (rec) => LEVELS[rec.status] || LEVELS.pacaran

// ───────── putus / pasangkan ─────────
/** Bagi dua tabungan bersama ke kedua akun, lalu hapus record. Dipanggil sebelum hubungan dihapus. */
export function settleBreakup(fun, numA, entry) {
    const numB = jidNumber(entry.with)
    const key = pairKey(numA, numB)
    const rec = fun.couple?.[key]
    if (!rec) return null
    delete fun.couple[key]
    if (rec.since !== entry.since) return null

    const total = Math.floor(rec.tabungan || 0)
    if (total > 0) {
        const half = Math.floor(total / 2)
        const jidA = rec.acct?.[numA] || `${numA}@s.whatsapp.net`
        const jidB = rec.acct?.[numB] || `${numB}@s.whatsapp.net`
        rpgUser(jidA).money += half
        rpgUser(jidB).money += total - half
    }
    return { rec, refund: total }
}

/** Putuskan hubungan milik nomor `numA`. */
export function endCouple(fun, numA) {
    const entry = fun.pacar[numA]
    if (!entry) return null
    const res = settleBreakup(fun, numA, entry)
    const numB = jidNumber(entry.with)
    delete fun.pacar[numA]
    if (fun.pacar[numB] && jidNumber(fun.pacar[numB].with) === numA) delete fun.pacar[numB]
    return { entry, refund: res?.refund || 0 }
}

/** Semua kunci nomor yang mungkin milik sebuah jid (termasuk alias dari record). */
export function numsForJid(fun, jid) {
    const out = new Set([jidNumber(jid)])
    for (const rec of Object.values(fun.couple || {})) {
        for (const [num, pn] of Object.entries(rec.acct || {})) {
            if (pn === jid) out.add(num)
        }
    }
    return [...out]
}

/** Pasangkan dua jid (memutus hubungan lama masing-masing). */
export function linkCouple(fun, jidA, jidB) {
    for (const j of [jidA, jidB]) {
        for (const n of numsForJid(fun, j)) if (fun.pacar[n]) endCouple(fun, n)
    }
    const since = Date.now()
    fun.pacar[jidNumber(jidA)] = { with: jidB, since }
    fun.pacar[jidNumber(jidB)] = { with: jidA, since }
    return since
}

export const say = (conn, m, text, mentions = []) =>
    conn.reply(m.chat, text, m, { mentions })

// ───────── pengingat otomatis (anniversary & ultah) ─────────
function pickMilestone(days, sent) {
    const cands = new Set(MILESTONES)
    for (let y = 3; y * 365 <= days; y++) cands.add(y * 365)
    return [...cands]
        .filter(d => d <= days && days - d <= 3 && !sent[d])
        .sort((a, b) => b - a)[0] || null
}

function milestoneLabel(d) {
    if (d % 365 === 0) return `${d / 365} tahun`
    return `${d} hari`
}

function findBirthday(rec, num) {
    const users = rpgStore().users
    const keys = [rec.acct?.[num], `${num}@s.whatsapp.net`].filter(Boolean)
    for (const k of keys) {
        const b = users[k]?.birthday
        if (b) {
            const [d, mo] = String(b).split('-').map(Number)
            if (d && mo) return { d, mo }
        }
    }
    return null
}

/** Kirim ke grup terakhir pasangan; kalau tidak ada, DM ke penerima. */
async function deliver(sock, rec, recipients, text, mentions) {
    if (rec.chat) {
        const ok = await sock.sendMessage(rec.chat, { text, mentions }).then(() => true).catch(() => false)
        if (ok) return true
        rec.chat = '' // grup tidak bisa dijangkau, coba DM
    }
    let sent = false
    for (const to of recipients) {
        const ok = await sock.sendMessage(to, { text, mentions }).then(() => true).catch(() => false)
        sent = sent || ok
        await sleep(2000)
    }
    return sent
}

async function remindOnce(getSock) {
    const sock = getSock()
    if (!sock?.user || !global.db?.fun?.pacar) return
    const fun = funStore()
    const now = Date.now()
    const wib = new Date(now + WIB)
    const hour = wib.getUTCHours()
    const today = { d: wib.getUTCDate(), mo: wib.getUTCMonth() + 1, y: wib.getUTCFullYear() }
    const tmr = new Date(now + WIB + MS.DAY)
    const tomorrow = { d: tmr.getUTCDate(), mo: tmr.getUTCMonth() + 1 }

    const seen = new Set()
    let changed = false

    for (const [numA, entry] of Object.entries({ ...fun.pacar })) {
        const numB = jidNumber(entry.with)
        const back = fun.pacar[numB]
        if (!back || jidNumber(back.with) !== numA) continue
        const key = pairKey(numA, numB)
        if (seen.has(key)) continue
        seen.add(key)

        let rec = fun.couple[key]
        if (!rec || rec.since !== entry.since) { rec = fun.couple[key] = newRecord(entry.since); changed = true }

        const jid = { [numA]: back.with, [numB]: entry.with }
        const dm = { [numA]: rec.acct[numA] || jid[numA], [numB]: rec.acct[numB] || jid[numB] }
        const both = [jid[numA], jid[numB]]

        // ── anniversary ──
        const days = Math.floor((now - rec.since) / MS.DAY)
        const ms = pickMilestone(days, rec.annivSent)
        if (ms) {
            const bonus = Math.min(ms * 20, 20_000)
            const text =
                `🎉 *ANNIVERSARY* 🎉\n\n${tag(jid[numA])} 💞 ${tag(jid[numB])}\n` +
                `Hari ini kalian genap *${milestoneLabel(ms)}* bersama!\n\n` +
                `🎁 Hadiah: +${fmt(bonus)} 💰 untuk masing-masing & +${ms >= 365 ? 100 : 50} Love Point`
            if (await deliver(sock, rec, [dm[numA], dm[numB]], text, both)) {
                rec.annivSent[ms] = true
                rec.love += ms >= 365 ? 100 : 50
                rpgUser(dm[numA]).money += bonus
                rpgUser(dm[numB]).money += bonus
                changed = true
                await sleep(3000)
            }
        }

        // ── ultah pasangan ──
        for (const num of [numA, numB]) {
            const other = num === numA ? numB : numA
            const bd = findBirthday(rec, num)
            if (!bd) continue

            // H-1: ingatkan pasangannya (jam 08.00-22.00 WIB)
            if (bd.d === tomorrow.d && bd.mo === tomorrow.mo && hour >= 8 && hour <= 22 && rec.bday[`${num}:h1`] !== today.y) {
                const text =
                    `⏰ *PENGINGAT ULTAH*\n\n${tag(jid[other])}, besok ${tag(jid[num])} ulang tahun!\n` +
                    `Siapkan kejutan 🎁 — coba .kasih boneka atau .kasih cincin`
                if (await deliver(sock, rec, [dm[other]], text, [jid[other], jid[num]])) {
                    rec.bday[`${num}:h1`] = today.y
                    changed = true
                    await sleep(3000)
                }
            }

            // H-0: ucapan (jam 06.00 WIB ke atas)
            if (bd.d === today.d && bd.mo === today.mo && hour >= 6 && rec.bday[`${num}:h0`] !== today.y) {
                const text =
                    `🎂 *HAPPY BIRTHDAY* 🎂\n\nHari ini ${tag(jid[num])} berulang tahun!\n` +
                    `${tag(jid[other])}, jangan lupa ucapkan selamat ya 💖\n\n+25 Love Point untuk kalian berdua`
                if (await deliver(sock, rec, [dm[num], dm[other]], text, both)) {
                    rec.bday[`${num}:h0`] = today.y
                    rec.love += 25
                    changed = true
                    await sleep(3000)
                }
            }
        }
    }

    if (changed) saveDB(global.db)
}

let reminderTimer = null

/** Jalankan pengingat tiap jam. Aman dipanggil berulang (tiap reconnect) - timer hanya satu. */
export function startCoupleReminder(getSock) {
    if (reminderTimer) return
    setTimeout(() => remindOnce(getSock).catch(() => {}), 45_000)
    reminderTimer = setInterval(() => remindOnce(getSock).catch(() => {}), MS.HOUR)
    reminderTimer.unref?.()
}
// <<COUPLE-END>>

// ───────── adapt ─────────
/**
 * Bungkus plugin rpg jadi plugin YannRzy.
 * @param handler  fungsi plugin gaya rpg (m, { conn, args, usedPrefix, command, text })
 * @param opts.category      nama kategori di menu (economy | relationship | rpg)
 * @param opts.customPrefix  regex pesan biasa yang diteruskan ke handler.before
 */
export function adapt(handler, opts = {}) {
    const limitCost = handler.limit === true ? 1 : Number(handler.limit) || 0
    const needRegister = handler.register === true
    const expGain = 'exp' in handler ? parseInt(handler.exp) || 0 : 17
    // data grup hanya diambil kalau plugin memintanya (mis. rpg-ngocok)
    const wantsGroup = /\b(groupMetadata|participants)\b/.test(Function.prototype.toString.call(handler))

    const plugin = async (m, ctx) => {
        const { sock } = ctx
        installDbShim()
        installShims(sock)
        ensureBotJid(sock)

        const pm = await wrapMessage(sock, m)
        const prefix = ctx.prefix || primaryPrefix() || '.'
        const text = ctx.text || ''
        const extra = {
            ...ctx,
            conn: makeConn(sock, pm),
            usedPrefix: prefix,
            args: text ? text.split(/\s+/) : [],
            text,
            sender: pm.sender,
            isPrems: !!ctx.isPremium,
            isROwner: !!ctx.isOwner,
            isOwner: !!ctx.isOwner
        }

        if (wantsGroup) {
            const meta = m.isGroup ? await getMeta(sock, ctx.jid).catch(() => null) : null
            extra.groupMetadata = meta || { id: ctx.jid, participants: [] }
            extra.participants = (extra.groupMetadata.participants || []).map(p => ({ ...p, id: p.phoneNumber || p.id }))
        }

        // pesan biasa (bukan command): hanya untuk handler.before, mis. jawaban Iya/Tidak
        if (!ctx.command) {
            if (typeof handler.before !== 'function') return false
            ensureUser(pm)
            try {
                const result = await handler.before.call(sock, pm, extra)
                return result === true
            } finally {
                persist()
            }
        }

        const user = ensureUser(pm)

        if (needRegister && !user.registered) {
            return ctx.reply(`Kamu belum terdaftar.\nDaftar dulu dengan *${prefix}daftar nama.umur*`)
        }
        if (limitCost && !ctx.isPremium && user.limit < limitCost) {
            return ctx.reply(`🍅 Limit kamu habis, beli lewat *${prefix}buy limit* ya~`)
        }

        try {
            await handler.call(sock, pm, extra)
            user.exp = (Number(user.exp) || 0) + (expGain > 0 && expGain <= 200 ? expGain : 0)
            await notifyLevelUp(sock, pm, user, ctx.jid).catch(() => null)
            if (limitCost && !ctx.isPremium) {
                user.limit = Math.max(0, user.limit - limitCost)
                await ctx.reply(`🍓 ${limitCost} limit terpakai`).catch(() => null)
            }
        } finally {
            persist()
        }
    }

    // sifat yang dibaca handler & menu YannRzy
    for (const key of ['help', 'group', 'owner', 'premium', 'admin', 'private', 'disabled']) {
        if (key in handler) plugin[key] = handler[key]
    }
    plugin.tags = [opts.category || (Array.isArray(handler.tags) ? handler.tags[0] : handler.tags) || 'rpg']
    plugin.command = expandRegex(handler.command) || handler.command
    if (opts.customPrefix) plugin.customPrefix = opts.customPrefix

    return plugin
}

// cek limit user sebelum fitur jalan. Mengembalikan fungsi "bayar" kalau masih cukup, null kalau habis
export async function cekLimit(sock, m, biaya, ctx) {
    const user = ensureUser(await wrapMessage(sock, m))
    if (user.limit < biaya) {
        await ctx.reply(`🍅 Limit kamu habis!\n\n🍰 Sisa limit : ${user.limit}\n🍡 Dibutuhkan : ${biaya}\n\n🧃 Beli lewat *${ctx.prefix}buy limit* atau tunggu limit direset ya~`).catch(() => null)
        return null
    }
    return () => {
        user.limit = Math.max(0, user.limit - biaya)
        persist()
    }
}

// Format sisa waktu cooldown, contoh "1 jam 5 menit 3 detik" (dipakai plugin rpg)
export function clockString(ms) {
    const total = Number(ms)
    if (!Number.isFinite(total) || total <= 0) return '0 detik'
    const sec = Math.ceil(total / 1000)
    const d = Math.floor(sec / 86400), h = Math.floor(sec / 3600) % 24, m = Math.floor(sec / 60) % 60, c = sec % 60
    return [d && `${d} hari`, h && `${h} jam`, m && `${m} menit`, c && `${c} detik`].filter(Boolean).join(' ')
}

// ───────── levelling ─────────
export const growth = Math.pow(Math.PI / Math.E, 1.618) * Math.E * 0.75;
export function xpRange(level, multiplier = global.multiplier || 1) {
	if (level < 0) throw new TypeError('level cannot be negative value');
	level = Math.floor(level);
	let min = level === 0 ? 0 : Math.round(Math.pow(level, growth) * multiplier) + 1;
	let max = Math.round(Math.pow(++level, growth) * multiplier);
	return {
		min,
		max,
		xp: max - min,
	};
}
export function findLevel(xp, multiplier = global.multiplier || 1) {
	if (xp === Infinity) return Infinity;
	if (isNaN(xp)) return NaN;
	if (xp <= 0) return -1;
	let level = 0;
	do level++;
	while (xpRange(level, multiplier).min <= xp);
	return --level;
}
export function canLevelUp(level, xp, multiplier = global.multiplier || 1) {
	if (level < 0) return false;
	if (xp === Infinity) return true;
	if (isNaN(xp)) return false;
	if (xp <= 0) return false;
	return level < findLevel(xp, multiplier);
}

/**
 * Notifikasi naik level di grup. Default MATI; nyalakan dengan `.notiflevel on` / `.enable notiflevel`
 * (pengaturan ada di plugins/group/guard.js, disimpan di global.db.groups[jid].notiflevel).
 * Dipanggil setelah EXP user bertambah. Kalau EXP sudah cukup, level dinaikkan
 * otomatis lalu bot mengirim pesan ke grup.
 */
export async function notifyLevelUp(sock, pm, user, chat) {
    if (!chat || !String(chat).endsWith('@g.us')) return false
    if (!global.db?.groups?.[chat]?.notiflevel?.on) return false

    const before = Math.max(0, Math.floor(Number(user.level) || 0))
    user.level = before
    while (canLevelUp(user.level, user.exp, global.multiplier)) user.level++
    if (user.level === before) return false

    const jid = pm.sender
    const tag = String(jid).split('@')[0]
    const { min, xp } = xpRange(user.level, global.multiplier)
    const text = `╭─▣「 *LEVEL UP!* 」▣─╮\n` +
        `┃ 🎉 Selamat @${tag}!\n` +
        `┃ ⭐ Level : ${before} ➜ *${user.level}*\n` +
        `┃ ✨ EXP   : ${Math.max(0, user.exp - min)}/${xp}\n` +
        `╰─────────────➤`
    await sock.sendMessage(chat, { text, mentions: [jid] }, { quoted: pm }).catch(() => null)
    return true
}

// ╔══════════════ [ afk.js ] ══════════════╗
// Fitur AFK: set status AFK dan beri tahu saat user AFK ditandai.
// .afk [alasan]  -> user ditandai AFK (data di global.db.afk[nomor@s.whatsapp.net] = { since, reason })
// Pesan apa pun dari user itu -> keluar dari AFK + bot memberi tahu lama AFK dan alasannya.
// Di grup, kalau ada yang menandai / membalas pesan user AFK, bot memberi tahu bahwa dia sedang AFK.
// Command-nya di plugins/group/afk.js; afkCheck() dipanggil dari handler.js untuk setiap pesan.
const AFK_IGNORED = new Set(['protocolMessage', 'reactionMessage', 'senderKeyDistributionMessage'])
const AFK_NOTICE_COOLDOWN = 20_000
const afkNoticed = new Map() // `${chat}|${afkUser}` -> waktu notifikasi terakhir

const afkStore = () => (global.db.afk ||= {})
const afkTag = (jid) => String(jid || '').split('@')[0].split(':')[0]

function afkDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000))
    const d = Math.floor(total / 86400)
    const h = Math.floor((total % 86400) / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const parts = []
    if (d) parts.push(`${d} hari`)
    if (h) parts.push(`${h} jam`)
    if (m) parts.push(`${m} menit`)
    if (s || !parts.length) parts.push(`${s} detik`)
    return parts.join(' ')
}

export const afkCleanReason = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 100)

export async function setAfk(sock, m, reason) {
    const key = await toPN(sock, m.sender)
    afkStore()[key] = { since: Date.now(), reason: afkCleanReason(reason) }
    saveDB(global.db)
}

export async function afkCheck(sock, m, { skip = false } = {}) {
    try {
        const data = global.db?.afk
        if (!data || !Object.keys(data).length) return // jalur cepat: tidak ada yang AFK
        if (AFK_IGNORED.has(m.mtype)) return

        const senderKey = await toPN(sock, m.sender)

        // 1) yang AFK kembali (kirim pesan apa pun)
        const mine = data[senderKey]
        if (mine && !skip) {
            delete data[senderKey]
            saveDB(global.db)
            await sock.sendMessage(m.chat, {
                text: `╭─▣「 *KEMBALI DARI AFK* 」▣─╮\n` +
                    `┃ 👤 @${afkTag(m.sender)}\n` +
                    `┃ ⏱️ Lama AFK : ${afkDuration(Date.now() - mine.since)}\n` +
                    `┃ 📝 Alasan   : ${mine.reason || 'Tanpa alasan'}\n` +
                    `╰─────────────➤`,
                mentions: [m.sender]
            }, { quoted: m })
        }

        // 2) ada yang menandai / membalas user AFK (hanya di grup)
        if (!m.isGroup) return
        const targets = [...new Set([...(m.mentionedJid || []), m.quoted?.sender].filter(Boolean))]
        for (const jid of targets) {
            const key = await toPN(sock, jid)
            const info = data[key]
            if (!info || key === senderKey) continue

            const cdKey = `${m.chat}|${key}`
            if (Date.now() - (afkNoticed.get(cdKey) || 0) < AFK_NOTICE_COOLDOWN) continue
            afkNoticed.set(cdKey, Date.now())
            if (afkNoticed.size > 500) afkNoticed.delete(afkNoticed.keys().next().value)

            await sock.sendMessage(m.chat, {
                text: `💤 @${afkTag(jid)} sedang AFK\n` +
                    `⏱️ Sudah : ${afkDuration(Date.now() - info.since)}\n` +
                    `📝 Alasan : ${info.reason || 'Tanpa alasan'}`,
                mentions: [jid]
            }, { quoted: m })
        }
    } catch (e) {
        console.error('[AFK]', e.message)
    }
}

// ╔══════════════ [ extra-features.js ] ══════════════╗
// Kumpulan fitur tambahan (bagian terbesar): rbRun/dio — ratusan command ringkas.

// ───────── extra: fitur tambahan ─────────
// Logika fitur tambahan didaftarkan lazy lewat rbDefine (dimuat saat pertama dipakai), jadi paket yang
// belum terpasang hanya mematikan fitur terkait. Tiap file di plugins/ menyimpan logika fiturnya sendiri dan mendaftarkannya lewat rbRegister(id, feature, libs).
// Bagian ini menerjemahkan konteks plugin (m, sock, ctx) ke gaya `(m, { conn, usedPrefix, args, ... })`,
// menjalankan flag limit / register / botadmin, dan menyediakan global.* yang dibutuhkan fitur tersebut.

const rbAls = new AsyncLocalStorage()
const rbAlbumCache = new Map()

const rbG = new Proxy({}, {
    get(_, p) {
        switch (p) {
            case 'mainSock': case 'conn': return rbAls.getStore()?.sock || global.sock
            case 'namaBot': case 'botName': return global.namebot
            case 'botCreator': return global.ownername || global.creator || global.namebot
            case 'owner': return global.owners || []
            case 'prefix': return global.prefix
            case 'albumCache': return rbAlbumCache
            case 'Button': case 'AIRich': case 'db': return undefined
            default: return global[p]
        }
    },
    set(_, p, v) { global[p] = v; return true }
})

const rbEnv = { rbG, rbLib }

function rbLoad(map, name, kind) {
    const rec = map.get(name)
    if (!rec) throw new Error(`${kind} tidak ditemukan: ${name}`)
    if (!rec.value) {
        rec.value = Promise.resolve(rec.factory(rbEnvFor(rec))).catch(e => { rec.value = null; throw e })
    }
    return rec.value
}
// lib yang hanya dipakai satu fitur ikut ditulis di file plugin-nya (rbRegister(id, feature, libs))
function rbEnvFor(rec) {
    if (!rec.libs) return rbEnv
    const cache = {}
    const rbLibLocal = (name) => {
        const f = rec.libs[name]
        if (!f) return rbLib(name)
        return cache[name] ||= Promise.resolve(f({ rbG, rbLib: rbLibLocal })).catch(e => { delete cache[name]; throw e })
    }
    return { rbG, rbLib: rbLibLocal }
}
function rbLib(name) { return rbLoad(rbLibs, name, 'lib') }
const rbFeature = (id) => rbLoad(rbFeatures, id, 'fitur')

// dipanggil tiap file plugin saat dimuat: daftarkan logika fitur miliknya sendiri
export function rbRegister(id, factory, libs) {
    rbFeatures.set(id, { factory, value: null, libs: libs || null })
}

function rbSock(sock0, m) {
    return new Proxy(sock0, {
        get(t, p) {
            if (p === 'getFakeQuoted') return () => m
            const v = Reflect.get(t, p)
            return typeof v === 'function' ? v.bind(t) : v
        }
    })
}

function rbMessage(pm, sock, ctx, raw) {
    const enhanced = enhanceMessage(pm, sock, ctx)
    let qCache = null
    return new Proxy(enhanced, {
        get(t, p) {
            if (p === 'raw') return raw
            if (p === 'quoted') {
                const q = Reflect.get(t, 'quoted')
                if (!q) return q
                return qCache ||= new Proxy(q, {
                    get(qt, qp) {
                        if (qp === 'key') return Reflect.get(qt, 'fakeKey')
                        if (qp === 'msg') return qt
                        return Reflect.get(qt, qp)
                    }
                })
            }
            const v = Reflect.get(t, p)
            return typeof v === 'function' ? v.bind(t) : v
        }
    })
}

let rbTmpReady = false

export async function rbRun(id, m, ctx) {
    if (!rbTmpReady) {
        rbTmpReady = true
        try { fs.mkdirSync('tmp', { recursive: true }) } catch {}
    }
    const handler = await rbFeature(id)
    const sock0 = compatSock(ctx.sock)
    const sock = rbSock(sock0, m)
    const pm = await wrapMessage(sock0, m)
    const prefix = ctx.prefix || primaryPrefix() || '.'
    const text = ctx.text || ''

    let user = null
    if (handler.register || handler.limit) {
        installDbShim()
        installShims(sock0)
        ensureBotJid(sock0)
        user = ensureUser(pm)
    }
    const cost = handler.limit === true ? 1 : Number(handler.limit) || 0
    if (handler.register && !ctx.isOwner && !user.registered) {
        return ctx.reply(`Kamu belum terdaftar.\nDaftar dulu dengan *${prefix}daftar nama.umur*`)
    }
    if (cost && !ctx.isPremium && !ctx.isOwner && user.limit < cost) {
        return ctx.reply(`🍅 Limit kamu habis, beli lewat *${prefix}buy limit* ya~`)
    }
    if (handler.noJadiBot && sock0.isJadiBot) return ctx.reply('Fitur ini tidak bisa dipakai di sesi jadibot.')

    let meta = null
    const wantsMeta = m.isGroup && (handler.botadmin || /\b(groupMetadata|participants)\b/.test(Function.prototype.toString.call(handler)))
    if (wantsMeta) meta = await getMeta(sock0, ctx.jid).catch(() => null)
    if (handler.botadmin) {
        const me = [sock0.user?.id, sock0.user?.lid].filter(Boolean)
        if (!meta || !me.some(j => isAdminJid(meta, j))) return ctx.reply('Bot harus jadi admin grup untuk menjalankan fitur ini.')
    }

    const args = text ? text.split(/\s+/).filter(Boolean) : []
    const mp = rbMessage(pm, sock, { ...ctx, prefix, text }, m)
    const extra = {
        ...ctx,
        sock, conn: sock, text, args, prefix, usedPrefix: prefix,
        isUserAdmin: !!ctx.isAdmin,
        isBotAdmin: !!meta && [sock0.user?.id, sock0.user?.lid].filter(Boolean).some(j => isAdminJid(meta, j)),
        groupMetadata: meta,
        participants: (meta?.participants || []).map(p => ({ ...p, id: p.phoneNumber || p.id })),
        reply: (t, o) => m.reply(t, o),
        react: (e) => sock.sendMessage(m.chat, { react: { text: e, key: m.key } }).catch(() => null)
    }

    try {
        await rbAls.run({ sock, m }, () => handler(mp, extra))
        if (cost && user && !ctx.isPremium && !ctx.isOwner) {
            user.limit = Math.max(0, user.limit - cost)
            await ctx.reply(`${cost} Limit terpakai ✔️`).catch(() => null)
        }
    } finally {
        if (user) persist()
    }
}


const dioStore = () => (global.db.dio ||= { praktis: {}, profile: {} })
const dioSave = () => { try { saveDB(global.db) } catch {} }
const dioCache = new Map()
const dioRegistry = new Map()

// dipanggil tiap file plugin saat dimuat: daftarkan logika fitur + lib lokalnya
export function dioRegister(id, fn, libs) {
    dioRegistry.set(id, { fn, libs: libs || null, mod: null, cache: new Map() })
}

// require ala CommonJS untuk kode port: lib lokal fitur dicari dulu, lalu dioLibs bersama, sisanya paket npm
function dioRequireFor(owner) {
    const req = (name) => {
        const key = String(name).replace(/^(\.\.?\/)+(lib\/)?/, '')
        if (key === 'netguard') return dioNetguard
        if (key.startsWith('live/') && dioRegistry.has(key)) return dioModule(key)
        const local = owner?.libs?.[key]
        if (local) {
            if (!owner.cache.has(key)) {
                const mod = { exports: {} }
                owner.cache.set(key, mod)
                local(mod, mod.exports, req)
            }
            return owner.cache.get(key).exports
        }
        if (dioLibs[key]) {
            if (!dioCache.has(key)) {
                const mod = { exports: {} }
                dioCache.set(key, mod)
                dioLibs[key](mod, mod.exports, dioRequireFor(null))
            }
            return dioCache.get(key).exports
        }
        return _require(name)
    }
    return req
}

function dioModule(id) {
    const rec = dioRegistry.get(id)
    if (!rec) throw new Error(`fitur tidak ditemukan: ${id}`)
    if (!rec.mod) {
        rec.mod = { exports: {} }
        rec.fn(rec.mod, rec.mod.exports, dioRequireFor(rec))
    }
    return rec.mod.exports
}

const dioWib = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

async function dioContext(m, ctx, { withMeta = true } = {}) {
    const sock0 = compatSock(ctx.sock)
    const sock = rbSock(sock0, m)
    const pm = await wrapMessage(sock0, m)
    const prefix = ctx.prefix || primaryPrefix() || '.'
    const text = ctx.text || ''
    const body = ctx.body || m.text || m.body || text
    let meta = null
    if (withMeta && m.isGroup) meta = await getMeta(sock0, ctx.jid || m.chat).catch(() => null)
    const mp = rbMessage(pm, sock, { ...ctx, prefix, text }, m)
    const botIds = [sock0.user?.id, sock0.user?.lid].filter(Boolean)
    const pushname = m.pushName && m.pushName !== 'Unknown' ? m.pushName : ''
    return {
        sock, m: mp, body, budy: body, text, q: text, args: text ? text.split(/\s+/).filter(Boolean) : [],
        command: ctx.command || '', prefix, usedPrefix: prefix, pushname, pushName: pushname,
        reply: (t, o) => m.reply(t, o), from: m.chat, isGroup: !!m.isGroup,
        isCreator: !!ctx.isOwner, isOwner: !!ctx.isOwner, isDev: !!ctx.isOwner, isPremium: !!ctx.isPremium,
        isAdmins: !!ctx.isAdmin, isBotAdmins: !!meta && botIds.some(j => isAdminJid(meta, j)),
        groupMetadata: meta && { ...meta, participants: (meta.participants || []).map(p => ({ ...p, id: p.phoneNumber || p.id })) },
        groupAdmins: meta ? (meta.participants || []).filter(p => p.admin).map(p => p.phoneNumber || p.id) : []
    }
}

// dipanggil plugins/dunia/* dan plugins/fun/* untuk command
export async function dioRun(id, m, ctx) {
    const mod = dioModule(id)
    return mod.run(await dioContext(m, ctx))
}

const DIO_BEFORE = ['fun/tebak', 'fun/cepatketik', 'fun/hilo', 'fun/hitungbenda', 'fun/icebreaker', 'fun/mastermind']
export async function dioBefore(m, ctx) {
    if (!(ctx.body || m.text)) return false
    let dctx = null
    for (const id of DIO_BEFORE) {
        const mod = dioModule(id)
        if (typeof mod.before !== 'function') continue
        dctx ||= await dioContext(m, ctx, { withMeta: false })
        try { if (await mod.before(dctx)) return true } catch (e) { console.error('[DIO before]', id, e?.message || e) }
    }
    return false
}


// ───────── ekspor internal (dipakai file pecahan lain) ─────────
export { dioSave, dioStore, dioWib, ffmpegBin, persist }
