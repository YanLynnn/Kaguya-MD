// plugins/tools/amprem.js
// Pakai: .amprem emailkamu@gmail.com
// 1) bot minta magic link ke email itu  2) kirim link "Sign in to Alight Creative" dari email ke chat  3) premium diklaim
// Khusus owner & user premium.
import axios from 'axios'

const BASE_URL = 'https://am.zervida.my.id'
const API_LINK = `${BASE_URL}/api/amprem/link`
const API_CLAIM = `${BASE_URL}/api/amprem/claim`
const TIMEOUT_MS = 5 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LINK_RE = /^https?:\/\/alight-creative\.firebaseapp\.com\/\S+$/i

if (!global.ampremState) global.ampremState = {}

const react = (conn, m, emoji) => conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } }).catch(() => null)
const send = (conn, m, text) => conn.sendMessage(m.chat, { text }, { quoted: m })

function cancelState(userId) {
    clearTimeout(global.ampremState[userId]?.timer)
    delete global.ampremState[userId]
}

function waitForLink(conn, m, email) {
    const userId = m.sender
    cancelState(userId)
    const timer = setTimeout(() => {
        if (global.ampremState[userId]?.timer !== timer) return
        delete global.ampremState[userId]
        send(conn, m, '⌛ Proses dibatalkan otomatis (timeout 5 menit).').catch(() => null)
    }, TIMEOUT_MS)
    timer.unref?.()
    global.ampremState[userId] = { email, timer }
}

async function claim(conn, m, email, link) {
    await send(conn, m, '⏳ *Memverifikasi & klaim premium...*')
    try {
        const { data = {} } = await axios.post(API_CLAIM, { email, link }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
        })
        if (data.status === 'premium') {
            await send(conn, m, `🎉 *PREMIUM AKTIF!*\n\n📧 Email: \`${email}\`\n💎 Status: PREMIUM\n\n📱 Buka Alight Motion di HP kamu!`)
            return react(conn, m, '✅')
        }
        await send(conn, m, `⚠️ *Klaim belum berhasil.*\n\nError: ${data.error || 'Coba lagi nanti'}`)
        return react(conn, m, '❌')
    } catch (err) {
        await send(conn, m, `❌ *Gagal klaim:* ${err.response?.data?.error || err.message || 'Coba lagi nanti'}`)
        return react(conn, m, '❌')
    }
}

let handler = async (m, { sock: conn, text, command, prefix, isOwner, isPremium }) => {
    const userId = m.sender
    const p = prefix || '.'
    const cmd = (command || '').toLowerCase()
    const body = (m.text || text || '').trim()

    // ===== .batalkan =====
    if (cmd === 'batalkan') {
        if (!global.ampremState[userId]) return p ? send(conn, m, '⚠️ Tidak ada proses yang sedang berjalan.') : undefined
        cancelState(userId)
        await react(conn, m, '🛑')
        return send(conn, m, `✅ Proses dibatalkan.\nKetik \`${p}amprem email@kamu.com\` untuk mulai lagi.`)
    }

    // ===== .amprem <email> [link] =====
    if (cmd === 'amprem') {
        // flag handler.premium tidak dipakai karena jalur kirim-link (customPrefix) tidak mengenal premium non-owner
        if (!isOwner && !isPremium) return send(conn, m, global.mess?.premium || '⚠️ Fitur ini khusus owner dan user premium.')

        const parts = (text || '').trim().split(/\s+/).filter(Boolean)
        const email = parts.find(v => EMAIL_RE.test(v))
        const link = parts.find(v => LINK_RE.test(v))

        if (!email) {
            return send(conn, m, `🚀 *Alight Motion Premium*\n\nMasukkan emailnya bersamaan dengan command:\n\`${p}amprem emailkamu@gmail.com\``)
        }

        // email + link sekaligus -> langsung klaim
        if (link) {
            cancelState(userId)
            return claim(conn, m, email, link)
        }

        await react(conn, m, '⏳')
        try {
            const { data } = await axios.post(API_LINK, { email }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            })
            if (data?.status === 'premium') {
                cancelState(userId)
                await react(conn, m, '✅')
                return send(conn, m, '🎉 *Akun ini sudah premium!*')
            }
        } catch (err) {
            cancelState(userId)
            await react(conn, m, '❌')
            return send(conn, m, `❌ *Gagal kirim link:* ${err.response?.data?.error || err.message || 'Gagal kirim link.'}`)
        }

        waitForLink(conn, m, email)
        await react(conn, m, '📩')
        return send(conn, m,
            `📩 Magic link dikirim ke \`${email}\`.\n\n` +
            `Cek inbox/spam, lalu salin link *"Sign in to Alight Creative"* dan kirim ke sini (waktu 5 menit).\n\n` +
            `Batal? Ketik \`${p}batalkan\``
        )
    }

    // ===== jalur customPrefix: link dari email =====
    // hanya jalan kalau user sudah memulai lewat .amprem (yang sudah dicek premium)
    const state = global.ampremState[userId]
    if (!state || !LINK_RE.test(body)) return

    clearTimeout(state.timer)
    delete global.ampremState[userId]
    return claim(conn, m, state.email, body)
}

// 'batal' dipakai plugin store/beli.js (batalkan order), jadi cancel AM Premium pakai 'batalkan'
handler.command = ['amprem', 'batalkan']
handler.tags = ['premium', 'alightmotion']
// Jangan tambahkan handler.premium = true: jalur customPrefix di handler.js tidak mengenal premium non-owner,
// sehingga user premium akan macet saat mengirim link. Cek premium sudah ada di dalam command .amprem.

// hanya link magic Alight Creative (email sekarang dikirim lewat command)
handler.customPrefix = /^\s*https?:\/\/alight-creative\.firebaseapp\.com\/\S+\s*$/i

export default handler
