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


import QRCode from 'qrcode'

const QRIS_STATIC = '00020101021126570011ID.DANA.WWW011893600915302169795102090216979510303UMI51440014ID.CO.QRIS.WWW0215ID10265029601680303UMI5204549953033605802ID5923Toko Digital Store Iyan6013Kab. Kotabaru6105721626304048D'

const MIN_NOMINAL = 1000
const MAX_NOMINAL = 10_000_000

// ───────── konversi QRIS ─────────
function crc16(str) {
    let crc = 0xffff
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8
        for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
}

function crcValid(qris) {
    if (qris.length < 8 || !qris.slice(0, -4).endsWith('6304')) return false
    return crc16(qris.slice(0, -4)) === qris.slice(-4).toUpperCase()
}

function parseTLV(qris) {
    const out = []
    let i = 0
    while (i < qris.length) {
        if (i + 4 > qris.length) throw new Error('Format QRIS rusak (data terpotong).')
        const tag = qris.slice(i, i + 2)
        const len = parseInt(qris.slice(i + 2, i + 4), 10)
        if (Number.isNaN(len) || len < 0 || i + 4 + len > qris.length) throw new Error(`Format QRIS rusak pada tag ${tag}.`)
        out.push({ tag, value: qris.slice(i + 4, i + 4 + len) })
        i += 4 + len
    }
    return out
}

const tlv = (tag, value) => `${tag}${String(value.length).padStart(2, '0')}${value}`

function infoQRIS(qris) {
    const map = Object.fromEntries(parseTLV(qris).map(x => [x.tag, x.value]))
    return { merchant: map['59'] || '-', city: map['60'] || '-', type: map['01'] }
}

function toDynamic(staticQris, nominal) {
    const items = []
    for (const el of parseTLV(staticQris)) {
        if (['54', '55', '56', '57', '63'].includes(el.tag)) continue // nominal lama, biaya, CRC lama dibuang
        items.push(el.tag === '01' ? { tag: '01', value: '12' } : el)
    }
    if (!items.some(x => x.tag === '01')) items.splice(1, 0, { tag: '01', value: '12' })

    // tag 54 diletakkan tepat sebelum tag 58 (negara), sesuai urutan EMVCo
    let at = items.findIndex(x => x.tag === '58')
    if (at < 0) at = items.length
    items.splice(at, 0, { tag: '54', value: String(nominal) })

    const body = items.map(x => tlv(x.tag, x.value)).join('') + '6304'
    return body + crc16(body)
}

// "10000", "10.000", "Rp 10.000", "10k", "10rb", "1jt"
function parseNominal(raw) {
    const s = String(raw || '').toLowerCase().replace(/rp|\s/g, '')
    const m = s.match(/^(\d+(?:[.,]\d+)*)(k|rb|ribu|jt|juta)?$/)
    if (!m) return null
    const unit = m[2]
    if (unit) {
        const n = Number(m[1].replace(',', '.'))
        const v = Math.round(n * (['jt', 'juta'].includes(unit) ? 1_000_000 : 1000))
        return Number.isFinite(v) ? v : null
    }
    const v = Number(m[1].replace(/[.,]/g, ''))
    return Number.isInteger(v) ? v : null
}

const rp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`

// ───────── plugin ─────────
const QRIS = QRIS_STATIC.replace(/[\r\n]+/g, '').trim() // spasi di dalam dipertahankan (nama merchant bisa berspasi)

let handler = async (m, { sock, text, command, prefix, isOwner, reply }) => {
    const p = prefix || '.'
    const cmd = command === 'qris' ? 'qris' : 'donate' // contoh di pesan mengikuti command yang diketik user

    let info
    try {
        if (!QRIS.startsWith('000201') || !crcValid(QRIS)) throw new Error('invalid')
        info = infoQRIS(QRIS)
    } catch {
        return reply(isOwner
            ? 'QRIS belum diisi atau tidak valid. Buka plugins/info/qris.js, isi QRIS_STATIC dengan teks QRIS (diawali 000201, disalin utuh sampai akhir).'
            : 'Donasi belum tersedia saat ini.')
    }

    if (!(text || '').trim()) {
        return reply(`*Donasi ke ${info.merchant}*\n\nKetik: ${p}${cmd} <nominal>\nContoh: ${p}${cmd} 10000  atau  ${p}${cmd} 10k`)
    }

    const nominal = parseNominal(text)
    if (!nominal) return reply(`Nominal tidak valid. Contoh: ${p}${cmd} 10000  atau  ${p}${cmd} 10k`)
    if (nominal < MIN_NOMINAL) return reply(`Minimal donasi ${rp(MIN_NOMINAL)}.`)
    if (nominal > MAX_NOMINAL) return reply(`Maksimal donasi ${rp(MAX_NOMINAL)}.`)

    const payload = toDynamic(QRIS, nominal)
    const image = await QRCode.toBuffer(payload, { width: 600, margin: 3, errorCorrectionLevel: 'M' })
    return sock.sendMessage(m.chat, {
        image,
        caption:
            `╭─▣「 *QRIS* 」▣─╮\n` +
            `┃ 🏪 Penerima : ${info.merchant}\n` +
            `┃ 💰 Nominal  : ${rp(nominal)}\n` +
            `╰─────────────➤\n\n` +
            `Scan QR di atas lewat e-wallet atau m-banking apa saja yang mendukung QRIS. Terima kasih! 🙏`
    }, { quoted: m })
}

handler.command = ['donate', 'qris']
handler.tags = ['info']

export default handler
