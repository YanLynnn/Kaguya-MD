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
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import { runtime, footerText } from '../../lib/core-system.js'
import { primaryPrefix, expandPlugins, rpgStore, toPN } from '../../lib/plugin-engine.js'
import { operatorOf } from '../tools/cekoperator.js'
import { isIosId, chatIsIos, buttonsToText } from '../../lib/wa.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../../')

// ───────── pengaturan ─────────

// foto menu, audio menu, dan nama creator diatur di config.js
// (dibaca saat dipakai supaya ikut hot-reload)
const getMenuImage = () => global.thumb?.menu || global.thumb?.utama
const getAudioUrl = () => global.audioMenu || ''
const getCreator = () => global.creator || global.ownername || ''

const CATEGORIES = ['main', 'downloader', 'sticker', 'tools', 'search']

// iPhone hanya merender tombol reply / url / copy / call (tombol list tidak tampil di iOS, lihat plugins/main/list.js),
// jadi penerima iPhone dapat tombol reply berhalaman. Naikkan angka ini kalau iPhone-mu kuat menampilkan lebih banyak tombol.
const IOS_PER_PAGE = 2   // 2 kategori + (sebelumnya/berikutnya) + owner + script = maksimal 6 tombol

// baris di daftar pilihan Android per bagian
const ANDROID_ROWS_PER_SECTION = 10

// batas teks isi pesan tombol (foto + body)
const BODY_MAX = 1000

// batas caption foto saat info + daftar fitur digabung dalam satu pesan (lebih panjang dari ini dipecah)
const CAPTION_MAX = 3000

// yang dicek adalah PENERIMA: di chat pribadi dari pesan terakhir lawan bicara, di grup dari pengirim perintah
const isIosMessage = (m) => isIosId(m.key?.id) || (!m.isGroup && chatIsIos(m.chat))

// ───────── helper ─────────

const readPkg = file => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
        return null
    }
}

const chunk = (arr, n) => {
    const out = []
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
    return out
}

// ───────── hitung total command (sama seperti plugins/main/totalfitur.js) ─────────

function countCommands() {
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

// ───────── info script ─────────

function getScriptInfo() {
    const botPkg = readPkg(path.join(rootDir, 'package.json'))
    const libPkg = readPkg(path.join(rootDir, 'node_modules/@whiskeysockets/baileys/package.json'))

    let dbFiles = 0
    try {
        dbFiles = fs.readdirSync(path.join(rootDir, 'database')).filter(f => f.endsWith('.json')).length
    } catch {}

    return {
        botVersion: botPkg?.version || '1.0.0',
        isEsm: botPkg?.type === 'module',
        type: `plugins manager (${botPkg?.type === 'module' ? 'ESM' : 'CJS'})`,
        total: countCommands().toLocaleString('id-ID'),
        library: libPkg?.name || 'Baileys',
        version: libPkg?.version || '-',
        runtime: `NodeJS ${process.version}`,
        database: `LocalJSON (${dbFiles} file)`
    }
}

// ───────── category ─────────

const getCategory = h => {
    const tag = Array.isArray(h.tags) ? h.tags[0] : h.tags
    return tag ? String(tag).toLowerCase() : 'main'
}

// ───────── RPG helper ─────────

const fmtNum = n => Math.floor(Number(n) || 0).toLocaleString('id-ID')

// ───────── helper tampilan menu ─────────

// durasi panjang: "4 minutes, 34 seconds"
function longRuntime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0))
    const parts = [
        [Math.floor(sec / 86400), 'day'],
        [Math.floor((sec % 86400) / 3600), 'hour'],
        [Math.floor((sec % 3600) / 60), 'minute'],
        [sec % 60, 'second']
    ]
        .filter(([n], i, a) => n > 0 || i === a.length - 1)
        .map(([n, u]) => `${n} ${u}${n === 1 ? '' : 's'}`)
    return parts.join(', ')
}

// kotak bergaya ┌─「 JUDUL 」 ... └────
const infoBox = (title, rows) => [
    `┌─「 ${title} 」`,
    '│',
    ...rows.map(r => (r === null ? '│' : `│ ${r}`)),
    '│',
    '└────────────────────────'
].join('\n')

// satu baris "Label      : *nilai*"
const kv = (label, value) => `${label.padEnd(10)} : *${value}*`

// jumlah plugin yang termuat
const pluginCount = () => Object.values(global.plugins || {}).filter(Boolean).length

async function getRpgInfo(sock, m, { isOwner, isPremium }) {
    try {
        const pn = await toPN(sock, m.sender)
        const u = rpgStore().users[pn]
        if (!u) return null

        return {
            level: u.level ?? 1,
            role: u.role || 'Newbie',
            exp: fmtNum(u.exp),
            money: fmtNum(u.money),
            bank: fmtNum(u.bank),
            limit: isOwner || isPremium ? '∞' : fmtNum(u.limit),
            health: `${Math.floor(u.health ?? 100)}/${u.maxhealth ?? 100}`,
            registered: u.registered ? 'terdaftar' : 'belum daftar'
        }
    } catch {
        return null
    }
}

// ───────── kumpulkan semua command ─────────

function collectCommands({ isOwner, isPremium }) {
    const groups = new Map()

    for (const h of expandPlugins()) {
        if (!h || !h.command || h.command instanceof RegExp || h.disabled) continue

        const cmds = (Array.isArray(h.command) ? h.command : [h.command])
            .map(String)
            .filter(c => !c.includes('_') && !(h.hide || []).includes(c))

        if (!cmds.length) continue

        // plugin owner tetap masuk kategori dari h.tags-nya (mis. 'vercel'); kalau tidak punya tags baru jatuh ke 'owner'
        const hasTag = Array.isArray(h.tags) ? h.tags.length > 0 : !!h.tags
        const cat = hasTag ? getCategory(h) : (h.owner ? 'owner' : 'main')

        if ((h.owner || cat === 'owner') && !isOwner) continue
        if (h.premium && !isPremium) continue

        if (!groups.has(cat)) groups.set(cat, [])
        groups.get(cat).push([...new Set(cmds)])
    }

    const order = [
        ...CATEGORIES.filter(k => groups.has(k)),
        ...[...groups.keys()].filter(k => !CATEGORIES.includes(k) && k !== 'owner').sort(),
        ...(groups.has('owner') ? ['owner'] : [])
    ]

    return order.map(cat => ({
        cat,
        items: groups.get(cat).sort((a, b) => a[0].localeCompare(b[0])),
        // jumlah per command, bukan per file plugin (satu file bisa memuat banyak command, mis. vercel.js)
        total: groups.get(cat).reduce((n, cmds) => n + cmds.length, 0)
    }))
}

// ───────── convert audio ke opus ─────────

function toOpus(input) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', [
            '-v', 'error', '-i', 'pipe:0', '-vn', '-c:a', 'libopus',
            '-b:a', '64k', '-ac', '1', '-ar', '48000', '-f', 'ogg', 'pipe:1'
        ])

        const out = []
        let err = ''

        ff.stdout.on('data', d => out.push(d))
        ff.stderr.on('data', d => { err += d })
        ff.on('error', reject)
        ff.on('close', code => {
            const buf = Buffer.concat(out)
            if (code === 0 && buf.length) resolve(buf)
            else reject(new Error(err.trim() || `ffmpeg exit ${code}`))
        })
        ff.stdin.on('error', () => {})
        ff.stdin.end(input)
    })
}

// ───────── kirim VN ─────────

async function sendVN(sock, jid, url, quoted) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download audio gagal (${res.status})`)

    const source = Buffer.from(await res.arrayBuffer())

    try {
        const opus = await toOpus(source)
        await sock.sendMessage(jid, { audio: opus, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted })
    } catch (e) {
        console.error('[MENU] Konversi VN gagal, kirim sebagai audio biasa:', e.message)
        await sock.sendMessage(jid, { audio: source, mimetype: 'audio/mpeg', ptt: false }, { quoted })
    }
}

// ───────── tombol ─────────

// emoji lucu per kategori (kategori lain dapat emoji dari daftar cadangan)
const CAT_EMOJI = {
    main: '🌸', downloader: '📥', download: '📥', sticker: '🎀', tools: '🧸', search: '🔎', owner: '👑',
    group: '👥', ai: '🤖', rpg: '⚔️', game: '🎮', fun: '🎈', maker: '🎨', convert: '🔄', islamic: '🕌',
    anime: '🍥', asisten: '📒', economy: '💰', relationship: '💞', store: '🛍️', info: '💡', live: '📡',
    nsfw: '🔞', premium: '💎', panel: '🖥️', canvas: '🖼️', audio: '🎧', github: '🐙', vercel: '▲'
}
const CUTE = ['🍓', '🍡', '🧁', '🌷', '🍰', '🦄', '🐰', '🍭', '☁️', '🐣']
const catEmoji = (cat) => {
    const key = String(cat).toLowerCase()
    if (CAT_EMOJI[key]) return CAT_EMOJI[key]
    let h = 0
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    return CUTE[h % CUTE.length]
}

// tombol pintasan: .owner dan .script
const quickButtons = (p) => [
    { type: 'reply', text: '👑 Owner', id: `${p}owner` },
    { type: 'reply', text: '📜 Script', id: `${p}script` }
]

// Android: satu tombol daftar pilihan berisi semua kategori (+ "Semua Fitur")
function androidButtons(groups, p) {
    const rows = [
        { title: '🍡 ALL', description: '✨ All Menu', id: `${p}menu all` },
        ...groups.map(g => ({
            title: `${catEmoji(g.cat)} ${g.cat.toUpperCase()}`,
            description: `${g.total} fitur`,
            id: `${p}menu ${g.cat}`
        }))
    ]
    const sections = chunk(rows, ANDROID_ROWS_PER_SECTION).map((rs, i) => ({
        title: i === 0 ? '🌸 Select Category Menu' : `🌸 Category Menu (${i + 1})`,
        rows: rs
    }))
    return [{ type: 'list', text: '🍓 Select Menu', sections }]
}

// iPhone: hanya tombol reply, kategori dibagi per halaman
function iosMainButtons(groups, p, page) {
    const pages = Math.max(1, Math.ceil(groups.length / IOS_PER_PAGE))
    const now = Math.min(Math.max(page, 1), pages)
    const buttons = groups
        .slice((now - 1) * IOS_PER_PAGE, now * IOS_PER_PAGE)
        .map(g => ({ type: 'reply', text: `${catEmoji(g.cat)} ${g.cat}`, id: `${p}menu ${g.cat}` }))
    if (now > 1) buttons.push({ type: 'reply', text: '🌷 Sebelumnya', id: `${p}menu hal${now - 1}` })
    if (now < pages) buttons.push({ type: 'reply', text: 'Berikutnya 🍭', id: `${p}menu hal${now + 1}` })
    buttons.push(...quickButtons(p))
    return { buttons, page: now, pages }
}

// iPhone, di halaman kategori: sebelumnya / menu utama / berikutnya
function iosCategoryButtons(groups, cat, p) {
    const i = groups.findIndex(g => g.cat === cat)
    const prev = groups[(i - 1 + groups.length) % groups.length]
    const next = groups[(i + 1) % groups.length]
    const buttons = []
    if (groups.length > 1) buttons.push({ type: 'reply', text: `◀ ${catEmoji(prev.cat)} ${prev.cat}`, id: `${p}menu ${prev.cat}` })
    buttons.push({ type: 'reply', text: '🏡 Menu Utama', id: `${p}menu` })
    if (groups.length > 2) buttons.push({ type: 'reply', text: `${catEmoji(next.cat)} ${next.cat} ▶`, id: `${p}menu ${next.cat}` })
    buttons.push(...quickButtons(p))
    return buttons
}

const newsletterOpt = () =>
    global.idSaluran ? { newsletter: { name: global.nameSaluran, jid: global.idSaluran } } : {}

// ───────── plugin ─────────

let handler = async (m, { sock, jid, prefix, isOwner, isPremium, text: argText, args }) => {
    const p = prefix || primaryPrefix() || '.'
    const pushname = m.pushName || 'No Name'
    const ios = isIosMessage(m)
    const info = getScriptInfo()
    const rpg = await getRpgInfo(sock, m, { isOwner, isPremium })
    const allGroups = collectCommands({ isOwner, isPremium })

    // ───────── argumen menu ─────────
    const query = String(argText ?? (Array.isArray(args) ? args.join(' ') : '') ?? '').trim().toLowerCase()
    const pageMatch = query.match(/^(?:hal|halaman|page)\s*(\d+)$/)
    const showAll = query === 'all'
    const showMain = !query || !!pageMatch

    let category = null
    if (!showMain && !showAll) {
        category = allGroups.find(g => g.cat === query)
        if (!category) {
            return sock.sendMessage(jid, {
                text:
                    `kategori *${query}* tidak ditemukan\n\n` +
                    `tersedia: ${allGroups.map(g => g.cat).join(', ')}\n\n` +
                    `ketik *${p}menu* untuk lihat daftar menu`
            }, { quoted: m })
        }
    }

    const access = isOwner ? 'Owner' : isPremium ? 'Premium' : 'Free'
    // m.sender di WhatsApp bisa berupa LID; ubah ke nomor telepon asli dulu
    const senderPn = await toPN(sock, m.sender).catch(() => m.sender)
    const number = String(senderPn || '').split('@')[0].split(':')[0].replace(/\D/g, '') || '-'
    const bot = global.namebot || 'Bot'
    const mode = global.selfmode ? 'self' : 'public'

    // ───────── HEADER (ringkas) ─────────
    const intro = [
        '╭━━━━━━━━━━━━━━━━━━━╮',
        `   🌸 *Hi, ${pushname}!* 🌸`,
        `   Aku *${bot}*, asisten pribadimu ✨`,
        '╰━━━━━━━━━━━━━━━━━━━╯'
    ].join('\n')

    const botBox = [
        '┌─「 🤖 *BOT* 」',
        `│ ⏳ Runtime  : *${longRuntime(process.uptime())}*`,
        `│ 🧸 Commands : *${info.total}*`,
        `│ 🌐 Mode     : *${mode}*`,
        '└──────────────'
    ].join('\n')

    const youBox = [
        '┌─「 👤 *KAMU* 」',
        `│ 🌷 Nama     : *${pushname}*`,
        `│ 📱 Operator : *${operatorOf(number)}*`,
        `│ 🎀 Akses    : *${access}*`,
        `│ ⭐ Level    : *${rpg?.level ?? 0}${rpg?.role ? ` • ${rpg.role}` : ''}*`,
        `│ 🎫 Limit    : *${rpg?.limit ?? 0}*`,
        `│ 💰 Saldo    : *Rp ${rpg?.money ?? 0}*`,
        '└──────────────'
    ].join('\n')

    const header = [intro, botBox, youBox].join('\n\n')
    const headerShort = header
    const footer = footerText()

    const listOf = (groups) =>
        groups
            .map(({ cat, items }) => [
                `╭─〔 ${catEmoji(cat)} *${cat.toUpperCase()}* 〕`,
                ...items.flat().map(c => `│ ✦ ${p}${c}`),
                '╰──────────────'
            ].join('\n'))
            .join('\n\n')

    // ───────── DAFTAR KATEGORI SEBAGAI TEKS (dipakai kalau tombol gagal terkirim) ─────────
    const categoryText = [
        '— *KATEGORI MENU*',
        ...allGroups.map(g => `-▢ ${p}menu ${g.cat}  (${g.total})`),
        `-▢ ${p}menu all  (semua fitur)`
    ].join('\n')

    const sendMainVN = async () => {
        if (!/^https?:\/\//i.test(getAudioUrl())) return
        try {
            await sendVN(sock, jid, getAudioUrl(), m)
        } catch (e) {
            console.error('[MENU] Gagal kirim VN:', e.message)
        }
    }

    // foto dari global.thumb.menu + info + daftar fitur dalam SATU pesan (semua jadi caption foto).
    // Kalau caption terlalu panjang (mis. `.menu all`) atau gagal terkirim, dipecah: foto + info, lalu daftar fitur sebagai teks.
    const sendPhotoMenu = async (listText) => {
        const img = getMenuImage()
        const photo = img ? (typeof img === 'string' ? { url: img } : img) : null
        const full = [header, listText, footer].filter(Boolean).join('\n\n')

        if (photo && full.length <= CAPTION_MAX) {
            try {
                return await sock.sendMessage(jid, { image: photo, caption: full, mentions: [m.sender] }, { quoted: m })
            } catch (e) {
                console.error('[MENU] Gagal kirim foto+daftar dalam satu pesan, dipecah:', e.message)
            }
        }

        let photoSent = false
        if (photo) {
            try {
                await sock.sendMessage(jid, { image: photo, caption: header.length > BODY_MAX ? headerShort : header, mentions: [m.sender] }, { quoted: m })
                photoSent = true
            } catch (e) {
                console.error('[MENU] Gagal kirim foto menu, pakai teks:', e.message)
            }
        }
        const parts = photoSent ? [listText, footer] : [header, listText, footer]
        await sock.sendMessage(jid, { text: parts.filter(Boolean).join('\n\n') }, photoSent ? undefined : { quoted: m })
    }

    // ───────── SEMUA FITUR: info + seluruh fitur dalam satu teks ─────────
    if (showAll) {
        await sendPhotoMenu(listOf(allGroups))
        return sendMainVN()
    }

    // ───────── SATU KATEGORI: info + fitur kategori itu dalam satu teks ─────────
    if (category) {
        await sendPhotoMenu(listOf([category]))

        try {
            await sock.sendButtons(jid, {
                text: '🌸 Pilih kategori lain ya~ 👇',
                footer: global.namebot || 'Bot',
                buttons: ios
                    ? iosCategoryButtons(allGroups, category.cat, p)
                    : [...androidButtons(allGroups, p), { type: 'reply', text: '🏡 Menu Utama', id: `${p}menu` }, ...quickButtons(p)]
            }, { quoted: m })
        } catch (e) {
            console.error('[MENU] Gagal kirim tombol kategori:', e.message)
        }
        return
    }

    // ───────── MENU UTAMA DENGAN TOMBOL ─────────
    const page = pageMatch ? Number(pageMatch[1]) : 1
    let buttons
    let body

    if (ios) {
        const r = iosMainButtons(allGroups, p, page)
        buttons = r.buttons
        body = `${header}\n\n_Halaman ${r.page}/${r.pages}. Pilih kategori di bawah, atau ketik ${p}menu all untuk semua fitur._`
        if (body.length > BODY_MAX) body = `${headerShort}\n\n_Halaman ${r.page}/${r.pages}. Pilih kategori di bawah, atau ketik ${p}menu all untuk semua fitur._`
    } else {
        buttons = [...androidButtons(allGroups, p), ...quickButtons(p)]
        body = `${header}`
        if (body.length > BODY_MAX) body = `${headerShort}`
    }

    try {
        await sock.sendButtons(jid, {
            image: getMenuImage(),
            text: body,
            footer: `${global.namebot} By YannRzy`,
            mentions: [m.sender],
            ...(ios ? {} : { ...newsletterOpt(), business: true }),
            buttons
        }, { quoted: m })
    } catch (e) {
        console.error('[MENU] Gagal kirim tombol menu, pakai teks:', e.message)

        // fallback: header + daftar kategori sebagai teks biasa
        const fallback = [header, categoryText, footer].filter(Boolean).join('\n\n')
        const short = fallback.length <= 1000
        try {
            await sock.sendMessage(jid, { image: { url: getMenuImage() }, caption: short ? fallback : header }, { quoted: m })
            if (!short) await sock.sendMessage(jid, { text: [categoryText, footer].filter(Boolean).join('\n\n') })
        } catch {
            await sock.sendMessage(jid, { text: fallback }, { quoted: m })
        }
    }

    // VN hanya dikirim di halaman pertama menu utama
    if (!pageMatch || page === 1) return sendMainVN()
}

handler.command = ['menu', 'help']
handler.tags = ['main']

export default handler