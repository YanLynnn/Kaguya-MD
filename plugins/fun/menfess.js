// 🍧 Menfess / confess anonim
//   .menfess 628xxxx|pesan        kirim pesan anonim (hanya di chat pribadi bot)
//   .balasmenfess ID|pesan        penerima membalas pengirim, tetap anonim
//   .tolakmenfess                 penerima menolak / membuka kembali menfess
//   .cekmenfess ID                (owner) lihat pengirim kalau ada penyalahgunaan
import { adapt } from '../../lib/plugin-engine.js'
import { cfg, store, wibDay, durasi } from '../../lib/plugin-features.js'

const LINK = /(https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me\/|bit\.ly|t\.me\/)/i
const nomor = (s) => {
    let n = String(s || '').replace(/\D/g, '')
    if (n.startsWith('0')) n = '62' + n.slice(1)
    else if (n.startsWith('8')) n = '62' + n
    return n
}
const idBaru = (k) => {
    let id
    do { id = Math.random().toString(36).slice(2, 7).toUpperCase() } while (k.menfess[id])
    return id
}

function rapikan(k) {
    const ids = Object.keys(k.menfess)
    if (ids.length > 500) {
        ids.sort((a, b) => k.menfess[a].t - k.menfess[b].t)
        for (const id of ids.slice(0, ids.length - 500)) delete k.menfess[id]
    }
}

function cekBatas(user, c) {
    const hari = wibDay()
    if (!user.menfessLog || user.menfessLog.day !== hari) user.menfessLog = { day: hari, n: 0, last: user.menfessLog?.last || 0 }
    const tunggu = user.menfessLog.last + c.cooldownDetik * 1000 - Date.now()
    if (tunggu > 0) return `🧃 Tunggu ${durasi(tunggu)} lagi sebelum kirim menfess lagi.`
    if (user.menfessLog.n >= c.maxPerHari) return `🍅 Batas menfess hari ini (${c.maxPerHari}x) sudah tercapai.`
    return null
}

let handler = async (m, { conn, command, text, usedPrefix, isOwner, isPremium }) => {
    const c = cfg('menfess')
    const k = store()
    if (!c.on) return m.reply('🍅 Fitur menfess sedang dimatikan.')

    // ───── tolak / buka menfess ─────
    if (/^(tolakmenfess|blokmenfess)$/i.test(command)) {
        const aktif = !k.menfessBlock[m.sender]
        k.menfessBlock[m.sender] = aktif
        if (!aktif) delete k.menfessBlock[m.sender]
        global.db.kaguya = k
        return m.reply(aktif
            ? '🍡 Oke, kamu tidak akan menerima menfess lagi.\nKetik perintah yang sama untuk membukanya kembali.'
            : '🍓 Menfess untukmu dibuka lagi~')
    }

    // ───── owner: cek pengirim ─────
    if (command === 'cekmenfess') {
        if (!isOwner) return m.reply(global.mess?.owner || '🍅 Khusus owner')
        const d = k.menfess[String(text || '').trim().toUpperCase()]
        if (!d) return m.reply('🍅 ID menfess tidak ditemukan.')
        return m.reply(`🍰 *MENFESS ${String(text).trim().toUpperCase()}*\n\nDari : ${d.from.split('@')[0]}\nKe   : ${d.to.split('@')[0]}\nWaktu: ${new Date(d.t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n${d.pesan}`)
    }

    const user = global.db.data.users[m.sender]
    const [kiri, ...sisa] = String(text || '').split('|')
    const pesan = sisa.join('|').trim()

    // ───── balas menfess ─────
    if (command === 'balasmenfess') {
        const id = String(kiri || '').trim().toUpperCase()
        const d = k.menfess[id]
        if (!id || !pesan) return m.reply(`🍰 Format: *${usedPrefix}balasmenfess ID|pesan*\nContoh: ${usedPrefix}balasmenfess AB12C|terima kasih ya`)
        if (!d || d.to !== m.sender) return m.reply('🍅 Menfess itu tidak ditemukan atau bukan untukmu.')
        if (pesan.length > c.maxPanjang) return m.reply(`🍅 Pesan maksimal ${c.maxPanjang} karakter.`)
        if (LINK.test(pesan)) return m.reply('🍅 Link tidak diperbolehkan di menfess.')
        const batas = cekBatas(user, c)
        if (batas) return m.reply(batas)
        await conn.sendMessage(d.from, {
            text: `🍧 *BALASAN MENFESS* 🍧\n\nSeseorang membalas menfess-mu:\n\n“${pesan}”\n\n🍡 ID: ${id}`
        }).catch(() => { throw '🍅 Gagal mengirim balasan, pengirim tidak bisa dihubungi.' })
        user.menfessLog.n++
        user.menfessLog.last = Date.now()
        return m.reply('🍓 Balasan anonim terkirim!')
    }

    // ───── kirim menfess ─────
    if (m.isGroup) return m.reply('🍰 Menfess hanya bisa dikirim lewat chat pribadi bot supaya identitasmu aman ya~')

    const tujuan = nomor(kiri)
    if (!tujuan || !pesan) {
        return m.reply(`🍧 *MENFESS ANONIM* 🍧\n\nKirim pesan tanpa nama!\n\n🍰 Format:\n*${usedPrefix}menfess nomor|pesan*\n\n🍡 Contoh:\n${usedPrefix}menfess 6281234567890|hai, kamu keren banget hari ini!\n\n✨ Pesan maks ${c.maxPanjang} karakter, tanpa link.\n🍥 Penerima bisa membalas anonim lewat *${usedPrefix}balasmenfess*`)
    }
    if (tujuan.length < 9 || tujuan.length > 15) return m.reply('🍅 Nomor tujuan tidak valid. Pakai format 628xxx atau 08xxx.')
    if (pesan.length > c.maxPanjang) return m.reply(`🍅 Pesan terlalu panjang (maks ${c.maxPanjang} karakter).`)
    if (LINK.test(pesan)) return m.reply('🍅 Link tidak diperbolehkan di menfess.')

    const tujuanJid = `${tujuan}@s.whatsapp.net`
    if (tujuanJid === m.sender) return m.reply('🍡 Masa kirim menfess ke diri sendiri~')

    const batas = cekBatas(user, c)
    if (batas) return m.reply(batas)

    if (k.menfessBlock[tujuanJid]) return m.reply('🍡 Penerima tidak menerima menfess.')

    const cek = await conn.onWhatsApp(tujuanJid).catch(() => null)
    if (cek && !cek[0]?.exists) return m.reply('🍅 Nomor itu tidak terdaftar di WhatsApp.')
    const jidTujuan = cek?.[0]?.jid || tujuanJid

    // bayar limit (non-premium)
    const biaya = Number(c.biayaLimit) || 0
    if (biaya && !isPremium && !isOwner) {
        if ((Number(user.limit) || 0) < biaya) return m.reply(`🍅 Limit kamu habis. Menfess butuh ${biaya} limit.`)
    }

    const id = idBaru(k)
    await conn.sendMessage(jidTujuan, {
        text: `🍧 *MENFESS* 🍧\n\nKamu mendapat pesan anonim:\n\n“${pesan}”\n\n🍡 ID: *${id}*\n🍰 Balas anonim: *${usedPrefix}balasmenfess ${id}|pesan*\n🍥 Tidak mau menerima menfess: *${usedPrefix}tolakmenfess*`
    }).catch(() => { throw '🍅 Gagal mengirim, penerima tidak bisa dihubungi.' })

    k.menfess[id] = { from: m.sender, to: tujuanJid, t: Date.now(), pesan }
    rapikan(k)
    global.db.kaguya = k
    user.menfessLog.n++
    user.menfessLog.last = Date.now()
    if (biaya && !isPremium && !isOwner) user.limit -= biaya

    await m.reply(`🍓 Menfess terkirim secara anonim ke ${tujuan}!\n🍡 ID: ${id}${biaya && !isPremium && !isOwner ? `\n🎫 -${biaya} limit` : ''}`)
}

handler.help = ['menfess nomor|pesan', 'balasmenfess ID|pesan', 'tolakmenfess']
handler.tags = ['fun']
handler.command = /^(menfess|confess|balasmenfess|tolakmenfess|blokmenfess|cekmenfess)$/i
handler.exp = 0

export default adapt(handler, { category: 'fun' })
