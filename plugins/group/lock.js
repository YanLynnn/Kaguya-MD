import { waError } from '../../lib/wa.js'
import { formatWib } from '../../lib/core-system.js'

// opengc / closegc [durasi]  ->  contoh: closegc 30m  (tutup sekarang, buka lagi otomatis 30 menit kemudian)
// Jadwal disimpan di database, jadi tetap jalan setelah bot restart.

const UNIT = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }
const MAX_MS = 7 * UNIT.d
const timers = (global.__gcTimers ||= new Map())

const parseDuration = (t = '') => {
    const hit = String(t).trim().match(/^(\d+)\s*([smhd])$/i)
    return hit ? Math.min(Number(hit[1]) * UNIT[hit[2].toLowerCase()], MAX_MS) : 0
}

const label = (ms) => {
    const m = Math.round(ms / 60000)
    if (m >= 1440) return `${Math.round(m / 1440)} hari`
    if (m >= 60) return `${Math.round(m / 60)} jam`
    return `${Math.max(m, 1)} menit`
}

const store = () => ({ ...(global.db?.gctimers || {}) })
const saveStore = (data) => { global.db.gctimers = data }

function schedule(jid, action, at) {
    clearTimeout(timers.get(jid))

    const run = async () => {
        const sock = global.sock
        if (!sock?.user) return timers.set(jid, setTimeout(run, 10000)) // bot belum tersambung, coba lagi

        try {
            await sock.groupSettingUpdate(jid, action === 'open' ? 'not_announcement' : 'announcement')
            await sock.sendMessage(jid, { text: action === 'open' ? '🔓 Grup dibuka otomatis, semua member bisa chat.' : '🔒 Grup ditutup otomatis, hanya admin yang bisa chat.' })
        } catch (e) {
            console.error('[GC TIMER]', e.message)
        }
        timers.delete(jid)
        const data = store()
        delete data[jid]
        saveStore(data)
    }

    timers.set(jid, setTimeout(run, Math.max(1000, at - Date.now())))
}

// pulihkan jadwal yang tersimpan (dipanggil saat plugin dimuat)
for (const [jid, t] of Object.entries(global.db?.gctimers || {})) {
    if (!timers.has(jid)) schedule(jid, t.action, t.at)
}

let handler = async (m, { sock, text, command, jid, reply }) => {
    const open = command === 'opengc'
    const ms = parseDuration(text)

    if (text && !ms) return reply(`Durasi tidak valid. Contoh: ${command} 30m (s = detik, m = menit, h = jam, d = hari, maks 7 hari)`)

    try {
        await sock.groupSettingUpdate(jid, open ? 'not_announcement' : 'announcement')
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }

    // perintah tanpa durasi membatalkan jadwal lama
    clearTimeout(timers.get(jid))
    timers.delete(jid)
    const data = store()
    delete data[jid]

    if (!ms) {
        saveStore(data)
        return reply(open ? '🔓 Grup dibuka, semua member bisa chat.' : '🔒 Grup ditutup, hanya admin yang bisa chat.')
    }

    const next = open ? 'close' : 'open'
    const at = Date.now() + ms
    data[jid] = { action: next, at }
    saveStore(data)
    schedule(jid, next, at)

    return reply(`${open ? '🔓 Grup dibuka' : '🔒 Grup ditutup'} selama ${label(ms)}.\nOtomatis ${next === 'open' ? 'dibuka' : 'ditutup'} lagi: ${formatWib(at)}`)
}

handler.command = ['opengc', 'closegc']
handler.tags = ['group']
handler.group = true

export default handler
