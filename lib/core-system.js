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
import os from 'os'
import path from 'path'
import { monitorEventLoopDelay, performance } from 'perf_hooks'
import util from 'util'
import { exec } from 'child_process'
import v8 from 'v8'
import vm from 'vm'
import chalk from 'chalk'

// ╔══════════════ [ optimizer: RAM, anti-delay, stabilisasi ] ══════════════╗
// Pengaturan lewat config.js: global.optimizer = { maxMsgAgeSec, memSoftRatio, ... }
const OPT_DEFAULTS = {
    memSoftRatio: 0.70,          // heapUsed / heap limit -> bersihkan cache ringan
    memHardRatio: 0.85,          // heapUsed / heap limit -> bersihkan semua cache
    rssHardRatio: 0.65,          // rss / total RAM server -> bersihkan semua cache
    memIntervalMs: 60_000,
    lagWarnMs: 800,              // event loop lag p99 yang dianggap lambat
    maxMsgAgeSec: 60,            // pesan lebih tua dari ini (backlog setelah offline) dilewati
    maxPendingPerChat: 3,        // maks pesan diproses bersamaan per chat (anti flood)
    connectStuckMs: 90_000,      // "connecting" lebih lama dari ini = macet
    deadSocketMs: 45_000,        // status open tapi websocket mati selama ini = macet
    tmpMaxAgeMs: 30 * 60_000,    // file temp lebih tua dari ini dihapus
    quiet: false
}

// ambil pengaturan optimizer
export const opt = () => ({ ...OPT_DEFAULTS, ...(global.optimizer || {}) })

// jam untuk log
const optStamp = () => new Date().toLocaleTimeString('id-ID')
// cetak log berwarna
const log = (color, tag, msg) => { if (!opt().quiet) console.log(color(`[ ${tag} ] ${msg}`)) }
// ubah byte jadi MB
const mb = (n) => `${(n / 1024 / 1024).toFixed(0)}MB`

// ───────── TTL cache kecil (kompatibel dengan interface cache Baileys) ─────────
export class TTLCache {
    constructor({ max = 500, ttl = 5 * 60_000 } = {}) {
        this.max = max
        this.ttl = ttl
        this.map = new Map()
    }
    get(key) {
        const hit = this.map.get(key)
        if (!hit) return undefined
        if (hit.exp < Date.now()) { this.map.delete(key); return undefined }
        return hit.value
    }
    set(key, value) {
        this.map.delete(key)
        this.map.set(key, { value, exp: Date.now() + this.ttl })
        if (this.map.size > this.max) this.map.delete(this.map.keys().next().value)
        return true
    }
    del(key) { return this.map.delete(key) }
    has(key) { return this.get(key) !== undefined }
    flushAll() { this.map.clear() }
    prune() {
        const now = Date.now()
        for (const [k, v] of this.map) if (v.exp < now) this.map.delete(k)
    }
    get size() { return this.map.size }
}

// ───────── registry pembersih cache ─────────
const cleaners = new Map()

/** Daftarkan fungsi pembersih. level: 'soft' (ringan) atau 'hard' (semua). */
export function registerCleaner(name, fn, level = 'soft') {
    cleaners.set(name, { fn, level })
}

// jalankan semua pembersih (soft/hard)
export function runCleaners(level = 'soft') {
    for (const [name, { fn, level: lv }] of cleaners) {
        if (level === 'soft' && lv === 'hard') continue
        try { fn(level) } catch (e) { log(chalk.yellow, 'OPTIMIZER', `cleaner ${name} gagal: ${e.message}`) }
    }
}

// ───────── GC ─────────
export function enableGc() {
    if (typeof global.gc === 'function') return true
    try {
        v8.setFlagsFromString('--expose-gc')
        global.gc = vm.runInNewContext('gc')
        return true
    } catch {
        return false
    }
}

// panggil garbage collector
export const collectGarbage = () => { try { global.gc?.() } catch {} }

// ───────── tulis JSON: debounce + atomic + non-blocking ─────────
// Sebelumnya setiap perubahan database menjalankan writeFileSync + JSON pretty-print,
// yang memblokir event loop. Sekarang digabung dan ditulis di belakang layar.
const writers = new Map()

// tulis satu file JSON yang tertunda
async function flushOne(file) {
    const w = writers.get(file)
    if (!w) return
    w.timer = null
    w.first = 0
    if (w.writing) { w.dirty = true; return }
    w.writing = true
    try {
        const json = JSON.stringify(w.data)
        const tmp = `${file}.tmp`
        await fs.promises.writeFile(tmp, json)
        await fs.promises.rename(tmp, file)
    } catch (e) {
        console.error(`Gagal save ${file}:`, e.message)
    } finally {
        w.writing = false
        if (w.dirty) { w.dirty = false; flushOne(file) }
    }
}

// tunda & gabungkan tulis JSON agar hemat disk
export function scheduleJsonWrite(file, data, { delay = 800, maxWait = 4000 } = {}) {
    let w = writers.get(file)
    if (!w) {
        w = { timer: null, first: 0, data, writing: false, dirty: false }
        writers.set(file, w)
    }
    w.data = data
    const now = Date.now()
    if (!w.first) w.first = now
    clearTimeout(w.timer)
    const wait = Math.max(0, Math.min(delay, w.first + maxWait - now))
    w.timer = setTimeout(() => flushOne(file), wait)
}

// tulis semua JSON tertunda sekarang (saat bot mati)
export function flushAllSync() {
    for (const [file, w] of writers) {
        if (!w.timer && !w.dirty && !w.writing) continue
        clearTimeout(w.timer)
        w.timer = null
        try {
            const tmp = `${file}.sync.tmp`
            fs.writeFileSync(tmp, JSON.stringify(w.data))
            fs.renameSync(tmp, file)
            w.dirty = false
        } catch {}
    }
}

// ───────── penjaga flood per chat (tetap paralel, tidak saling menunggu) ─────────
// Perintah lambat (AI, download) tidak menahan perintah lain. Yang dibatasi hanya jumlah
// pesan yang sedang diproses bersamaan per chat, supaya spam tidak membuat bot kewalahan.
export function createFloodGuard({ max } = {}) {
    const inflight = new Map()

    return async (key, task) => {
        const limit = max ?? opt().maxPendingPerChat
        const n = inflight.get(key) || 0
        if (n >= limit) return
        inflight.set(key, n + 1)
        try {
            await task()
        } catch (e) {
            console.log(chalk.red(`[ ERROR ] ${String(key).slice(0, 24)}: ${e?.message || e}`))
        } finally {
            const left = (inflight.get(key) || 1) - 1
            if (left <= 0) inflight.delete(key)
            else inflight.set(key, left)
        }
    }
}

// ───────── penyimpan pesan terkirim (untuk retry/dekripsi ulang) ─────────
const sentStore = new TTLCache({ max: 400, ttl: 15 * 60_000 })
// simpan pesan terkirim (untuk retry/dekripsi ulang)
export const rememberMessage = (id, message) => { if (id && message) sentStore.set(id, message) }
// ambil pesan yang tersimpan
export const recallMessage = (id) => sentStore.get(id)
registerCleaner('sentStore', (level) => level === 'hard' ? sentStore.flushAll() : sentStore.prune())

// ───────── pembersih file temp ─────────
const TMP_PATTERN = /^(\d{13}-[0-9a-f]{10}|bratvid-|brat-|vid-|vid-out-|overlay-)/

// hapus file sementara yang sudah lama
export async function cleanTmp(maxAgeMs = opt().tmpMaxAgeMs) {
    const dir = os.tmpdir()
    let removed = 0
    try {
        for (const name of await fs.promises.readdir(dir)) {
            if (!TMP_PATTERN.test(name)) continue
            const full = path.join(dir, name)
            try {
                const st = await fs.promises.stat(full)
                if (Date.now() - st.mtimeMs < maxAgeMs) continue
                await fs.promises.rm(full, { recursive: true, force: true })
                removed++
            } catch {}
        }
    } catch {}
    return removed
}

// ───────── guard RAM + event loop ─────────
let memTimer = null
let lagTimer = null
let tmpTimer = null
let started = false

// mulai pemantau RAM, lag, dan pembersih tmp
export function startOptimizer() {
    if (started) return
    started = true

    const gcOk = enableGc()
    const heapLimit = v8.getHeapStatistics().heap_size_limit
    const totalRam = os.totalmem()

    // sharp (sticker/gambar) menyimpan cache native yang tidak terlihat di heap JS
    import('sharp').then(m => {
        const sharp = m.default || m
        sharp.cache({ memory: 32, files: 0, items: 40 })
        sharp.concurrency(2)
    }).catch(() => {})

    let tick = 0
    memTimer = setInterval(() => {
        tick++
        const c = opt()
        const { heapUsed, rss } = process.memoryUsage()
        const heapRatio = heapUsed / heapLimit
        const rssRatio = rss / totalRam

        if (heapRatio > c.memHardRatio || rssRatio > c.rssHardRatio) {
            runCleaners('hard')
            collectGarbage()
            log(chalk.yellow, 'RAM', `tinggi (heap ${mb(heapUsed)}, rss ${mb(rss)}) -> cache dibersihkan`)
        } else if (heapRatio > c.memSoftRatio) {
            runCleaners('soft')
            collectGarbage()
            log(chalk.yellow, 'RAM', `heap ${mb(heapUsed)} -> pembersihan ringan`)
        } else if (tick % 10 === 0) {
            runCleaners('soft') // rutin tiap ~10 menit: buang entri kedaluwarsa
            collectGarbage()
        }
    }, OPT_DEFAULTS.memIntervalMs)
    memTimer.unref()

    // deteksi event loop macet (penyebab utama bot "delay")
    const histogram = monitorEventLoopDelay({ resolution: 20 })
    histogram.enable()
    let lastWarn = 0
    lagTimer = setInterval(() => {
        const p99 = histogram.percentile(99) / 1e6
        histogram.reset()
        if (p99 > opt().lagWarnMs && Date.now() - lastWarn > 5 * 60_000) {
            lastWarn = Date.now()
            log(chalk.yellow, 'LAG', `event loop lambat (p99 ${p99.toFixed(0)}ms) pukul ${optStamp()}`)
            runCleaners('soft')
        }
    }, 30_000)
    lagTimer.unref()

    // bersih-bersih temp tiap 15 menit + saat start
    cleanTmp().catch(() => {})
    tmpTimer = setInterval(() => cleanTmp().catch(() => {}), 15 * 60_000)
    tmpTimer.unref()

    // simpan database sebelum proses berhenti
    const bye = (code) => () => { flushAllSync(); if (code !== null) process.exit(code) }
    process.on('SIGINT', bye(0))
    process.on('SIGTERM', bye(0))
    process.on('beforeExit', bye(null))
    process.on('exit', () => flushAllSync())

    log(chalk.greenBright, 'OPTIMIZER', `aktif (heap limit ${mb(heapLimit)}, gc ${gcOk ? 'ya' : 'tidak'})`)
}

// ───────── watchdog koneksi (online 24 jam tanpa intervensi) ─────────
// getState() -> { state: 'connecting'|'open'|'closed', since, sock, registered, reconnectPending }
export function startConnectionWatchdog({ getState, onStuck, intervalMs = 15_000 }) {
    let fixing = false
    const timer = setInterval(async () => {
        if (fixing) return
        const s = getState()
        if (!s) return
        const c = opt()
        const age = Date.now() - s.since
        let reason = null

        if (s.state === 'open') {
            if (s.sock?.ws && s.sock.ws.isOpen === false && age > c.deadSocketMs) reason = 'websocket mati padahal status open'
        } else if (s.state === 'connecting') {
            if (s.registered && age > c.connectStuckMs) reason = 'macet saat menyambung'
        } else if (s.state === 'closed') {
            if (!s.reconnectPending && !s.halted && age > 30_000) reason = 'terputus dan tidak ada jadwal reconnect'
        }

        if (!reason) return
        fixing = true
        try {
            log(chalk.yellow, 'WATCHDOG', `${reason} -> menyambung ulang`)
            await onStuck(reason)
        } catch (e) {
            log(chalk.red, 'WATCHDOG', `gagal memulihkan: ${e.message}`)
        } finally {
            fixing = false
        }
    }, intervalMs)
    timer.unref()
    return () => clearInterval(timer)
}

/** Jeda reconnect eksponensial: 5s, 10s, 20s ... maksimal 5 menit (+ jitter).
 *  Reconnect beruntun yang terlalu cepat terbaca WhatsApp sebagai perilaku tidak wajar. */
export function backoffDelay(attempt) {
    const base = Math.min(5 * 60_000, 5000 * 2 ** Math.min(attempt, 6))
    return base + Math.floor(Math.random() * 3000)
}

// ───────── antrean kirim pesan (anti-ban) ─────────
// Semua pesan keluar lewat satu antrean: ada jeda minimum acak antar pesan (global),
// jeda lebih panjang untuk pesan ke chat yang sama berturut-turut, dan batas per menit.
// Pesan ke diri sendiri / status tidak ditahan.
// Atur lewat config.js -> global.antiban = { minDelayMs, maxDelayMs, perMinute, perChatPerMinute }
const AB_DEFAULTS = { minDelayMs: 1200, maxDelayMs: 3200, perMinute: 20, perChatPerMinute: 10 }
// pengaturan anti-ban (jeda kirim pesan)
export const antiban = () => ({ ...AB_DEFAULTS, ...(global.antiban || {}) })

// antrean kirim pesan dengan jeda acak
export function createSendQueue() {
    let tail = Promise.resolve()
    let lastSent = 0
    const globalLog = []
    const chatLog = new Map()

    const prune = (arr, now) => { while (arr.length && now - arr[0] > 60_000) arr.shift() }

    async function waitTurn(jid) {
        const c = antiban()
        // jeda minimum acak sejak pesan terakhir
        const gap = c.minDelayMs + Math.random() * Math.max(0, c.maxDelayMs - c.minDelayMs)
        const sinceLast = Date.now() - lastSent
        if (sinceLast < gap) await sleep(gap - sinceLast)

        // batas global per menit
        for (;;) {
            const now = Date.now()
            prune(globalLog, now)
            const cl = chatLog.get(jid) || []
            prune(cl, now)
            chatLog.set(jid, cl)
            if (globalLog.length < c.perMinute && cl.length < c.perChatPerMinute) break
            const oldest = Math.min(globalLog.length >= c.perMinute ? globalLog[0] : Infinity, cl.length >= c.perChatPerMinute ? cl[0] : Infinity)
            await sleep(Math.max(500, 60_000 - (now - oldest)) + Math.random() * 1000)
        }
        const t = Date.now()
        lastSent = t
        globalLog.push(t)
        chatLog.get(jid).push(t)
        if (chatLog.size > 200) chatLog.delete(chatLog.keys().next().value)
    }

    /** jalankan fn() setelah giliran kirim untuk jid tiba */
    return (jid, fn, { skip = false } = {}) => {
        if (skip) return fn()
        const run = tail.then(() => waitTurn(jid)).then(fn)
        tail = run.catch(() => {})
        return run
    }
}


// ╔══════════════ [ utils.js ] ══════════════╗

// ───────── utils ─────────
global.lidowners = global.lidowners || []

// owner dari config.js + owner tambahan lewat .addowner (disimpan di database)
export function getOwners() {
    const fromConfig = Array.isArray(global.owners) ? global.owners : []
    const fromDb = Array.isArray(global.db?.owners) ? global.db.owners : []
    return [...fromConfig, ...fromDb]
}

// nomor yang dipercaya (owner + nomor bot)
function trustedNumbers() {
    return [...new Set([...getOwners(), global.nomorbot].filter(Boolean).map(n => n.replace(/\D/g, '')))]
}

// cari LID dari nomor owner
async function resolveLidFor(sock, number) {
    let jid = number.replace(/\D/g, '') + '@s.whatsapp.net'
    let lid = await sock.signalRepository.lidMapping.getLIDForPN(jid).catch(() => null)
    if (!lid) return null
    let lidNumber = lid.split('@')[0]
    if (!global.lidowners.includes(lidNumber)) global.lidowners.push(lidNumber)
    return lidNumber
}

// siapkan LID semua owner saat tersambung
export async function initLidOwners(sock) {
    for (let num of trustedNumbers()) {
        await resolveLidFor(sock, num)
    }
    return global.lidowners
}

// ───────── auto follow saluran (newsletter) ─────────
const NEWSLETTER_FOLLOW = [
    '120363290012666602@newsletter',
    '120363333401130891@newsletter'
]
// catatan saluran yang sudah di-follow per akun
const newsletterDone = new Set()

export async function followNewsletters(sock, list = NEWSLETTER_FOLLOW) {
    if (typeof sock?.newsletterFollow !== 'function') return []
    const result = []
    const me = jidNumber(sock.user?.id) // catat per akun, supaya jadibot tetap follow
    for (const target of list) {
        const jid = target
        const mark = `${me}:${jid}`
        if (newsletterDone.has(mark)) continue
        try {
            await sock.newsletterFollow(jid)
            newsletterDone.add(mark)
            result.push(jid)
        } catch (e) {
            if (/already|subscribed|exist/i.test(String(e?.message))) newsletterDone.add(mark)
        }
        await sleep(2000)
    }
    return result
}

// cek apakah nomor/LID adalah owner
export async function isOwnerNumber(sock, number) {
    if (!number) return false
    const trusted = trustedNumbers()

    if (trusted.includes(number)) return true
    if (global.lidowners.includes(number)) return true

    for (let num of trusted) {
        let resolved = await resolveLidFor(sock, num)
        if (resolved === number) return true
    }

    return false
}

// ubah detik jadi teks lama aktif
export const runtime = (seconds) => {
    seconds = Number(seconds)
    let d = Math.floor(seconds / (3600 * 24))
    let h = Math.floor((seconds % (3600 * 24)) / 3600)
    let m = Math.floor((seconds % 3600) / 60)
    let s = Math.floor(seconds % 60)
    return `${d}day ${h}hours ${m}minute ${s}second`
}

// teks footer bot
export const footerText = () => `© ${new Date().getFullYear()} Powered By ${global.namebot}`

// tunggu beberapa milidetik
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// format waktu WIB
export function formatWib(timestamp) {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })
}

// ───────── identity ─────────
const phoneCache = new Map()
registerCleaner('phoneCache', (level) => { if (level === 'hard' || phoneCache.size > 2000) phoneCache.clear() })

// ambil angka nomor dari JID
export const jidNumber = (jid) => String(jid || '').split('@')[0].split(':')[0]
// ambil bagian server dari JID
export const jidServer = (jid) => String(jid || '').split('@')[1] || ''
// cek apakah JID berformat LID
export const isLidJid = (jid) => jidServer(jid) === 'lid'

// rapikan tampilan nomor HP
export function formatPhone(number) {
    const digits = String(number || '').replace(/\D/g, '')
    if (!digits) return '-'

    if (digits.startsWith('62') && digits.length >= 10) {
        const local = digits.slice(2)
        const parts = [local.slice(0, 3), local.slice(3, 7), local.slice(7)].filter(Boolean)
        return `+62 ${parts.join('-')}`
    }

    return `+${digits}`
}

// cari nomor HP asli dari JID/LID
export async function resolvePhone(sock, jid) {
    if (!jid) return null
    if (jidServer(jid) === 's.whatsapp.net') return jidNumber(jid)
    if (!isLidJid(jid)) return null
    if (phoneCache.has(jid)) return phoneCache.get(jid)

    let pn = null
    try {
        pn = await sock.signalRepository?.lidMapping?.getPNForLID(jid)
    } catch {
        pn = null
    }

    const number = pn ? jidNumber(pn) : null
    if (number) phoneCache.set(jid, number)
    return number
}

// ambil nama user dari database
export function userName(userid) {
    return global.db?.users?.[userid]?.name || 'Customer'
}

// ───────── media ─────────
export function isType(m, type) {
    return m.mtype === type || m.quoted?.mtype === type
}

// ambil node media dari pesan
export function mediaNode(m, type) {
    if (m.mtype === type) return { node: m.msg, download: m.download }
    if (m.quoted?.mtype === type) return { node: m.quoted, download: m.quoted.download }
    return null
}

// ───────── quote ─────────
export function quoteContext(m, mentions = []) {
    if (!m?.key) return mentions.length ? { mentionedJid: mentions } : {}

    return {
        stanzaId: m.key.id,
        participant: m.sender || m.key.participant || m.chat,
        remoteJid: m.chat,
        quotedMessage: m.message,
        ...(mentions.length ? { mentionedJid: mentions } : {})
    }
}

// ───────── contextInfo ─────────
// Sengaja kosong: balasan bot pakai teks reply biasa, tanpa label "Diteruskan"
// dan tanpa info saluran/newsletter.
export function forwardInfo() {
    return {}
}

// info preview link/thumbnail
export function previewInfo({ thumbnail, title, description, sourceUrl, largerThumbnail = false } = {}) {
    if (!thumbnail) return null

    return {
        previewThumbnail: {
            title: title || global.namebot,
            description: description ?? footerText(),
            thumbnail: typeof thumbnail === 'string' ? { url: thumbnail } : thumbnail,
            ...(sourceUrl ? { sourceUrl } : {}),
            largerThumbnail
        }
    }
}

// gabungkan forward + preview jadi contextInfo
export function buildContextInfo({ forward = false, ...preview } = {}) {
    return {
        ...(forward ? forwardInfo() : {}),
        ...(previewInfo(preview) || {})
    }
}

// opsi tambahan untuk pesan penolakan (saat ini hanya meneruskan extra)
export function denyOptions(extra = {}) {
    return { ...extra }
}

// ╔══════════════ [ db.js ] ══════════════╗

// ───────── database (JSON lokal) ─────────
// Dipakai untuk: pengaturan grup (welcome, anti*, autoreply), auto promosi, autoreactsw, jadwal buka/tutup grup.
const DB_PATH = './database/db.json'
fs.mkdirSync('./database', { recursive: true })

// pindahkan isi folder lama "db" (versi sebelumnya) ke "database"
if (fs.existsSync('./db')) {
    for (const f of fs.readdirSync('./db')) {
        if (!fs.existsSync(`./database/${f}`) || fs.statSync(`./database/${f}`).size < 100) {
            fs.rmSync(`./database/${f}`, { recursive: true, force: true })
            fs.renameSync(`./db/${f}`, `./database/${f}`)
        }
    }
    try { fs.rmdirSync('./db') } catch {}
}

// baca database dari file
export const loadDB = () => {
    if (!fs.existsSync(DB_PATH)) return {}
    try {
        const data = fs.readFileSync(DB_PATH, 'utf-8')
        return data ? JSON.parse(data) : {}
    } catch {
        return {}
    }
}

// Tulis ke disk digabung (debounce) + atomic + async, supaya tidak memblokir event loop
// setiap kali ada perubahan database.
export const saveDB = (db) => {
    scheduleJsonWrite(DB_PATH, db)
}

// isi awal database
const DEFAULTS = { users: {}, groups: {}, promosi: {}, autosw: {}, gctimers: {} }

// siapkan database saat bot start
export const initDatabase = () => {
    const data = { ...DEFAULTS, ...loadDB() }
    // setiap assign ke global.db.<key> otomatis tersimpan ke file
    global.db = new Proxy(data, {
        set(target, property, value) {
            target[property] = value
            saveDB(target)
            return true
        }
    })
}

// ╔══════════════ [ system.js ] ══════════════╗

// ───────── sysinfo ─────────
const CGROUP_LIMIT_FILES = ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']
const CGROUP_USAGE_FILES = ['/sys/fs/cgroup/memory.current', '/sys/fs/cgroup/memory/memory.usage_in_bytes']
const CPU_SAMPLE_MS = 250

// ubah byte jadi KB/MB/GB
export function formatBytes(bytes) {
    const value = Number(bytes)
    if (!Number.isFinite(value) || value <= 0) return '0 B'

    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
    const scaled = value / 1024 ** exponent
    return `${scaled.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`
}

// hitung persen
export function percentOf(part, total) {
    if (!total) return 0
    return Math.min(100, Math.max(0, (part / total) * 100))
}

// gambar bar penggunaan
export function usageBar(percent, size = 10) {
    const filled = Math.round((percent / 100) * size)
    return `${'▰'.repeat(filled)}${'▱'.repeat(size - filled)} ${percent.toFixed(1)}%`
}

function readText(file) {
    try {
        return fs.readFileSync(file, 'utf8').trim()
    } catch {
        return null
    }
}

function readNumber(files) {
    for (const file of files) {
        const raw = readText(file)
        const value = Number(raw)
        if (raw && Number.isFinite(value)) return value
    }
    return null
}

// nama distro Linux
function distroName() {
    const release = readText('/etc/os-release')
    const match = release?.match(/^PRETTY_NAME="?([^"\n]+)"?/m)
    return match ? match[1] : `${os.type()} ${os.release()}`
}

// baca waktu CPU
function cpuTimes() {
    return os.cpus().reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((sum, t) => sum + t, 0)
        return { idle: acc.idle + cpu.times.idle, total: acc.total + total }
    }, { idle: 0, total: 0 })
}

// ukur pemakaian CPU
async function sampleCpuUsage() {
    const start = cpuTimes()
    await new Promise(resolve => setTimeout(resolve, CPU_SAMPLE_MS))
    const end = cpuTimes()
    const total = end.total - start.total
    const idle = end.idle - start.idle
    return total > 0 ? percentOf(total - idle, total) : 0
}

// baca info RAM
function memoryInfo() {
    const total = os.totalmem()
    const free = os.freemem()
    const limit = readNumber(CGROUP_LIMIT_FILES)
    const panelLimit = limit && limit < total ? limit : null
    const panelUsed = panelLimit ? readNumber(CGROUP_USAGE_FILES) : null
    const proc = process.memoryUsage()

    return {
        total,
        free,
        used: total - free,
        panelLimit,
        panelUsed,
        rss: proc.rss,
        heapUsed: proc.heapUsed,
        heapTotal: proc.heapTotal,
        external: proc.external
    }
}

// baca info disk
async function diskInfo() {
    try {
        const stat = await fs.promises.statfs('.')
        const total = stat.blocks * stat.bsize
        const free = stat.bavail * stat.bsize
        return { total, free, used: total - free }
    } catch {
        return null
    }
}

// hitung ukuran folder
function pathSize(target, depth = 0) {
    try {
        const stat = fs.statSync(target)
        if (!stat.isDirectory()) return stat.size
        if (depth > 4) return 0

        return fs.readdirSync(target).reduce((sum, name) => sum + pathSize(path.join(target, name), depth + 1), 0)
    } catch {
        return 0
    }
}

// baca versi paket npm
function packageVersion(name) {
    const raw = readText(path.join(process.cwd(), 'node_modules', name, 'package.json'))
    try {
        return raw ? JSON.parse(raw).version : null
    } catch {
        return null
    }
}

// statistik bot
function botStats() {
    const db = global.db || {}
    const orders = Object.values(db.orders || {})

    return {
        products: Object.keys(db.products || {}).length,
        users: Object.keys(db.users || {}).length,
        vouchers: Object.keys(db.vouchers || {}).length,
        banned: Object.keys(db.banned || {}).length,
        orders: orders.length,
        ordersSuccess: orders.filter(o => o.status === 'SUCCESS').length,
        ordersWaiting: orders.filter(o => o.status === 'WAITING_CONFIRMATION').length,
        commands: countAllCommands(),
        databaseSize: pathSize('./database'),
        sessionSize: pathSize('./session'),
        selfmode: !!global.selfmode,
        prefixes: Array.isArray(global.prefix) ? global.prefix : [],
        version: global.versi,
        baileys: packageVersion('@whiskeysockets/baileys'),
        luna: packageVersion('@ryuu-reinzz/luna-lib')
    }
}

// kumpulkan info sistem untuk .devtools
export async function collectSystemInfo() {
    const cpus = os.cpus()
    const [load1, load5, load15] = os.loadavg()
    const [cpuUsage, disk] = await Promise.all([sampleCpuUsage(), diskInfo()])

    return {
        os: {
            distro: distroName(),
            kernel: os.release(),
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname()
        },
        cpu: {
            model: (cpus[0]?.model || 'Unknown').replace(/\s+/g, ' ').trim(),
            cores: cpus.length,
            speed: cpus[0]?.speed || 0,
            usage: cpuUsage,
            load: [load1, load5, load15]
        },
        memory: memoryInfo(),
        disk,
        node: {
            version: process.version,
            v8: process.versions.v8,
            pid: process.pid,
            eventLoop: performance.eventLoopUtilization().utilization * 100
        },
        uptime: {
            bot: runtime(process.uptime()),
            system: runtime(os.uptime())
        },
        bot: botStats()
    }
}

// ───────── devtools ─────────
export async function runDevtools(sock, m, ctx) {
    const { text, prefix, command, reply, example, sender, jid, isOwner, isAdmin, isPremium, body, isCmd } = ctx

    // eval / exec = akses penuh ke server, jangan pernah dibuka untuk non-owner (mode public)
    if (!isOwner) return false

    if (body.startsWith('=>')) {
        let code = body.slice(2).trim()
        let { key } = await sock.sendMessage(jid, { text: 'Evaling...' }, { quoted: m })
        try {
            let result = await eval(`(async () => { return ${code} })()`)
            await sock.sendMessage(jid, { text: util.format(result), edit: key })
        } catch (e) {
            await sock.sendMessage(jid, { text: util.format(e), edit: key })
        }
        return true
    }

    if (body.startsWith('>')) {
        let code = body.slice(1).trim()
        let { key } = await sock.sendMessage(jid, { text: 'Evaling...' }, { quoted: m })
        try {
            let result = await eval(`(async () => { return ${code} })()`)
            await sock.sendMessage(jid, { text: util.inspect(result), edit: key })
        } catch (e) {
            await sock.sendMessage(jid, { text: util.format(e), edit: key })
        }
        return true
    }

    if (body.startsWith('$')) {
        let cmd = body.slice(1).trim()
        let { key } = await sock.sendMessage(jid, { text: 'Executing...' }, { quoted: m })
        exec(cmd, async (err, stdout, stderr) => {
            if (err) return sock.sendMessage(jid, { text: util.format(err), edit: key })
            if (stderr) return sock.sendMessage(jid, { text: stderr, edit: key })
            await sock.sendMessage(jid, { text: stdout || 'No output', edit: key })
        })
        return true
    }

    return false
}

// ╔══════════════ [ autosw.js ] ══════════════╗

// ───────── auto lihat + reaction story ─────────
// Sengaja minimal: pesan story tidak di-serialize dan tidak lewat handler.
// Kalau fitur mati, cuma 1 pembacaan properti lalu selesai.
// Config disimpan di global.db.autosw = { on, mode: 'react' | 'view', emojis: [] }

const DEFAULT_EMOJIS = ['🔥', '😂', '❤️', '👍', '😍']
const seen = new Set()
const wait = (ms) => new Promise(r => setTimeout(r, ms))


// auto lihat & reaksi story kontak
export async function autoSW(sock, raw) {
    const cfg = global.db?.autosw
    if (!cfg?.on) return

    const key = raw?.key
    const msg = raw?.message
    if (!key?.id || key.fromMe || !msg || msg.protocolMessage || msg.reactionMessage) return

    if (seen.has(key.id)) return
    seen.add(key.id)
    if (seen.size > 200) seen.delete(seen.values().next().value)

    try {
        // dikirim langsung sebagai receipt "read" supaya story tetap terlihat
        // walaupun pengaturan read receipt akunmu dimatikan
        await sock.sendReceipt('status@broadcast', key.participant, [key.id], 'read')
            .catch(() => sock.readMessages([key]))

        if (cfg.mode === 'view') return

        const list = cfg.emojis?.length ? cfg.emojis : DEFAULT_EMOJIS
        const emoji = list[Math.floor(Math.random() * list.length)]
        await wait(800 + Math.random() * 1700) // jeda acak supaya terlihat wajar

        const me = sock.decodeJid(sock.user?.id)
        const statusJidList = [...new Set([key.participant, key.participantAlt, me].filter(Boolean))]
        await sock.sendMessage('status@broadcast', { react: { text: emoji, key } }, { statusJidList })
    } catch {
        // story gagal dibalas bukan masalah besar, abaikan
    }
}


// ╔══════════════ [ registry.js ] ══════════════╗

// Daftar fitur tambahan yang dimuat lazy (lihat extra-features di plugin.js).
export const rbFeatures = new Map()
export const rbLibs = new Map()
// daftarkan fitur command ringkas
export function rbDefine(ids, factory) {
    const rec = { factory, value: null }
    for (const id of [].concat(ids)) rbFeatures.set(id, rec)
}
export function rbDefineLib(name, factory) {
    rbLibs.set(name, { factory, value: null })
}

// Hitung total command dari global.plugins (bukan jumlah file plugin)
function countAllCommands() {
    let total = 0
    const seen = new Set()
    for (const plugin of Object.values(global.plugins || {})) {
        if (!plugin || seen.has(plugin)) continue
        seen.add(plugin)
        const groups = Array.isArray(plugin.commandGroups) ? plugin.commandGroups : [plugin]
        for (const h of groups) {
            if (!h?.command || h.command instanceof RegExp || plugin.disabled) continue
            const hidden = Array.isArray(h.hide) ? h.hide : []
            total += (Array.isArray(h.command) ? h.command : [h.command])
                .map(String).filter(c => c && !c.includes('_') && !hidden.includes(c)).length
        }
    }
    return total
}
