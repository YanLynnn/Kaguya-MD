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
import { saveDB } from '../../lib/core-system.js'
import { updateConfigValue } from '../../lib/core-file.js'
import {
    parseDuration,
    formatDate,
    formatRemaining,
    userOf,
    sewaData,
    getRental,
    isGroupRented,
    activateRental,
    removeRental,
    listRentals
} from '../../lib/core-data.js'
import { toPN } from '../../lib/plugin-engine.js'
import { getMeta, waError } from '../../lib/wa.js'

const ORDER_TTL_MIN = 15
const UNIQUE_MAX = 99
const LATE_PROOF_HOURS = 24
const PER_PAGE = 12
const GROUP_LINK = /chat\.whatsapp\.com\/([0-9A-Za-z]+)/i
const GROUP_JID = /^[\d-]+@g\.us$/

// ───────── QRIS ─────────
function crc16(str) {
    let crc = 0xffff
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8
        for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
}
const qrisText = () => String(global.qrisStatic || '').replace(/[\r\n]+/g, '').trim()
const qrisReady = () => {
    const q = qrisText()
    return q.startsWith('000201') && q.length >= 8 && q.slice(0, -4).endsWith('6304') && crc16(q.slice(0, -4)) === q.slice(-4).toUpperCase()
}

function parseTLV(qris) {
    const out = []
    let i = 0
    while (i < qris.length) {
        if (i + 4 > qris.length) throw new Error('Format QRIS rusak.')
        const tag = qris.slice(i, i + 2)
        const len = parseInt(qris.slice(i + 2, i + 4), 10)
        if (Number.isNaN(len) || len < 0 || i + 4 + len > qris.length) throw new Error(`Format QRIS rusak pada tag ${tag}.`)
        out.push({ tag, value: qris.slice(i + 4, i + 4 + len) })
        i += 4 + len
    }
    return out
}
const tlv = (tag, value) => `${tag}${String(value.length).padStart(2, '0')}${value}`

function toDynamic(staticQris, nominal) {
    const items = []
    for (const el of parseTLV(staticQris)) {
        if (['54', '55', '56', '57', '63'].includes(el.tag)) continue
        items.push(el.tag === '01' ? { tag: '01', value: '12' } : el)
    }
    if (!items.some(x => x.tag === '01')) items.splice(1, 0, { tag: '01', value: '12' })
    let at = items.findIndex(x => x.tag === '58')
    if (at < 0) at = items.length
    items.splice(at, 0, { tag: '54', value: String(nominal) })
    const body = items.map(x => tlv(x.tag, x.value)).join('') + '6304'
    return body + crc16(body)
}

const merchantOf = () => { try { return parseTLV(qrisText()).find(x => x.tag === '59')?.value || '-' } catch { return '-' } }

// ───────── helper ─────────
const rp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`
const tagOf = (jid) => String(jid || '').split('@')[0].split(':')[0]
const ACTIVE = new Set(['pending', 'waiting'])
const STATUS = {
    pending: '⏳ Menunggu pembayaran', waiting: '🕐 Menunggu konfirmasi owner', done: '✅ Selesai',
    rejected: '❌ Ditolak', cancelled: '🚫 Dibatalkan', expired: '⌛ Kedaluwarsa'
}
const plans = () => (Array.isArray(global.sewaPlans) ? global.sewaPlans : []).filter(p => p?.id && Number.isFinite(Number(p.harga)))
const durLabel = (plan) => (plan.hari === null ? 'Permanen' : plan.nama || `${plan.hari} hari`)
const ownerJids = () => (global.owners || []).map(n => `${String(n).replace(/\D/g, '')}@s.whatsapp.net`)
const isImage = (msg) => !!msg?.isMedia && msg.mtype === 'imageMessage'
const normId = (raw) => { const d = String(raw || '').replace(/\D/g, ''); return d ? `SWA-${d.padStart(4, '0')}` : null }

function expireOrders() {
    const d = sewaData()
    let changed = false
    for (const o of Object.values(d.orders)) {
        if (o.status === 'pending' && Date.now() - o.createdAt > ORDER_TTL_MIN * 60_000) { o.status = 'expired'; changed = true }
    }
    if (changed) saveDB(global.db)
}

const rentalLine = (r) =>
    `*${r.name || '(tanpa nama)'}*\n   ${r.until === null ? '♾️ permanen' : `${r.until > Date.now() ? '⏳' : '⌛'} ${formatRemaining(r.until)} (s/d ${formatDate(r.until)})`}\n   ${r.jid}`

async function groupName(sock, jid) {
    return (await getMeta(sock, jid).catch(() => null))?.subject || ''
}

async function isMember(sock, jid) {
    try { await sock.groupMetadata(jid); return true } catch { return false }
}

// ───────── plugin ─────────
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply }) => {
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()

    const ownerOnly = ['pesanansewa', 'accsewa', 'tolaksewa', 'addsewa', 'delsewa', 'listsewa', 'sewamode']
    if (ownerOnly.includes(command) && !isOwner) return reply(global.mess?.owner || 'Khusus owner.')

    try {
        // ===== .sewa [paket] [link grup] =====
        if (command === 'sewa') {
            const list = plans()
            if (!list.length) return reply('Paket sewa belum diatur.')

            const tokens = body.split(/\s+/).filter(Boolean)
            const link = tokens.find(t => GROUP_LINK.test(t))
            const planTok = tokens.find(t => !GROUP_LINK.test(t))

            if (!planTok) {
                const r = m.isGroup ? getRental(jid) : null
                const status = r
                    ? (r.until === null || r.until > Date.now()
                        ? `\n✅ Grup ini sedang menyewa: ${r.until === null ? 'permanen' : `${formatRemaining(r.until)} lagi (s/d ${formatDate(r.until)})`}\n`
                        : `\n⌛ Sewa grup ini sudah habis sejak ${formatDate(r.until)}.\n`)
                    : ''
                const rows = list.map((pl, i) => `${i + 1}. *${pl.id}* — ${durLabel(pl)}\n   💰 ${rp(pl.harga)}`)
                return reply(
                    `╭─▣「 *SEWA BOT* 」▣─╮\n╰─────────────➤\n${status}\n${rows.join('\n')}\n\n` +
                    (m.isGroup
                        ? `Pesan untuk grup ini: ${p}sewa <paket>\nContoh: ${p}sewa ${list[0].id}`
                        : `Pesan: ${p}sewa <paket> <link grup>\nContoh: ${p}sewa ${list[0].id} https://chat.whatsapp.com/xxxx`) +
                    `\n\nBayar lewat QRIS, lalu kirim bukti dengan ${p}buktisewa.`
                )
            }

            const idx = /^\d+$/.test(planTok) ? Number(planTok) - 1 : -1
            const plan = list.find(pl => pl.id.toLowerCase() === planTok.toLowerCase()) || list[idx]
            if (!plan) return reply(`Paket "${planTok}" tidak ditemukan. Ketik ${p}sewa untuk melihat daftar.`)
            if (!qrisReady()) return reply(isOwner ? 'QRIS sewa belum valid. Isi global.qrisStatic di config.js.' : 'Pembayaran sewa belum tersedia saat ini.')

            // grup tujuan: grup ini, atau (di private chat) grup dari link
            let group = null
            let name = ''
            let code = null
            if (m.isGroup && !link) {
                group = jid
                name = await groupName(sock, jid)
            } else {
                if (!link) return reply(`Di private chat sertakan link grup.\nContoh: ${p}sewa ${plan.id} https://chat.whatsapp.com/xxxx`)
                code = link.match(GROUP_LINK)[1]
                try {
                    const info = await sock.groupGetInviteInfo(code)
                    group = info.id
                    name = info.subject || ''
                } catch {
                    return reply('Link grup tidak valid atau sudah kedaluwarsa.')
                }
            }

            const buyer = await toPN(sock, m.sender)
            const open = Object.values(d.orders).find(o => o.buyer === buyer && ACTIVE.has(o.status))
            if (open) return reply(`Kamu masih punya order aktif *${open.id}* (${STATUS[open.status]}).\n${open.status === 'pending' ? `Selesaikan pembayarannya atau batalkan dengan ${p}batalsewa.` : 'Tunggu konfirmasi owner.'}`)

            // kode unik supaya nominal tiap order berbeda (memudahkan cek mutasi)
            const taken = new Set(Object.values(d.orders).filter(o => ACTIVE.has(o.status)).map(o => o.total))
            let unique = 0
            let total = 0
            for (let i = 0; i < 200; i++) {
                unique = 1 + Math.floor(Math.random() * UNIQUE_MAX)
                total = Number(plan.harga) + unique
                if (!taken.has(total)) break
            }

            d.seq += 1
            const id = `SWA-${String(d.seq).padStart(4, '0')}`
            d.orders[id] = {
                id, buyer, group, groupName: name, code, plan: plan.id, planName: durLabel(plan), days: plan.hari,
                price: Number(plan.harga), unique, total, status: 'pending', createdAt: Date.now()
            }
            saveDB(global.db)

            const image = await QRCode.toBuffer(toDynamic(qrisText(), total), { width: 600, margin: 3, errorCorrectionLevel: 'M' })
            return sock.sendMessage(m.chat, {
                image,
                caption:
                    `╭─▣「 *ORDER SEWA ${id}* 」▣─╮\n` +
                    `┃ 🤖 Paket    : ${durLabel(plan)}\n` +
                    `┃ 👥 Grup     : ${name || group}\n` +
                    `┃ 💰 Harga    : ${rp(plan.harga)}\n` +
                    `┃ 🔢 Kode unik: ${unique}\n` +
                    `┃ 💳 *Total   : ${rp(total)}*\n` +
                    `┃ 🏪 Penerima : ${merchantOf()}\n` +
                    `╰─────────────➤\n\n` +
                    `Scan QRIS di atas dan bayar *tepat ${rp(total)}* (termasuk kode unik).\n` +
                    `Order berlaku ${ORDER_TTL_MIN} menit.\n\n` +
                    `Setelah membayar kirim *foto bukti* dengan caption ${p}buktisewa\n` +
                    `Batal: ${p}batalsewa`
            }, { quoted: m })
        }

        // ===== .buktisewa =====
        if (command === 'buktisewa') {
            const buyer = await toPN(sock, m.sender)
            const mine = Object.values(d.orders).filter(o => o.buyer === buyer).sort((a, b) => b.createdAt - a.createdAt)
            const order = mine.find(o => ACTIVE.has(o.status)) ||
                mine.find(o => o.status === 'expired' && Date.now() - o.createdAt < LATE_PROOF_HOURS * 3_600_000)
            if (!order) return reply(`Kamu belum punya order sewa aktif. Pesan dulu dengan ${p}sewa <paket>.`)

            const source = isImage(m) ? m : (isImage(m.quoted) ? m.quoted : null)
            if (!source) return reply(`Kirim *foto* bukti bayar dengan caption ${p}buktisewa, atau balas foto bukti dengan ${p}buktisewa.`)
            const buf = await source.download().catch(() => null)
            if (!buf?.length) return reply('Gagal mengunduh fotonya. Coba kirim ulang.')

            const caption =
                `📥 *BUKTI BAYAR SEWA*${order.status === 'expired' ? ' _(order sempat kedaluwarsa, cek mutasi!)_' : ''}\n\n` +
                `🧾 ${order.id}\n🤖 ${order.planName}\n👥 ${order.groupName || order.group}\n💳 Total: ${rp(order.total)}\n👤 @${tagOf(buyer)}\n\n` +
                `Setujui : ${p}accsewa ${order.id}\nTolak   : ${p}tolaksewa ${order.id} <alasan>`
            const sent = await Promise.allSettled(ownerJids().map(j => sock.sendMessage(j, { image: buf, caption, mentions: [buyer] })))
            if (!sent.some(r => r.status === 'fulfilled')) return reply('Gagal meneruskan bukti ke owner. Hubungi owner langsung ya.')

            order.status = 'waiting'
            order.proofAt = Date.now()
            saveDB(global.db)
            return reply(`✅ Bukti untuk *${order.id}* sudah diteruskan ke owner.\nTunggu konfirmasi ya, sewa akan aktif otomatis setelah disetujui. 🙏`)
        }

        // ===== .batalsewa =====
        if (command === 'batalsewa') {
            const buyer = await toPN(sock, m.sender)
            const order = Object.values(d.orders).find(o => o.buyer === buyer && o.status === 'pending')
            if (!order) {
                const waiting = Object.values(d.orders).find(o => o.buyer === buyer && o.status === 'waiting')
                return reply(waiting ? `Order ${waiting.id} sudah kamu kirimi bukti bayar, hubungi owner kalau mau membatalkan.` : 'Tidak ada order sewa yang bisa dibatalkan.')
            }
            order.status = 'cancelled'
            saveDB(global.db)
            return reply(`🚫 Order ${order.id} dibatalkan.`)
        }

        // ===== .ceksewa =====
        if (command === 'ceksewa') {
            if (!m.isGroup) return reply('Pakai di dalam grup yang mau dicek.')
            const r = getRental(jid)
            if (!r) return reply(`Grup ini belum pernah menyewa bot.\nKetik ${p}sewa untuk melihat paket.`)
            const active = r.until === null || r.until > Date.now()
            return reply(
                `*▢ STATUS SEWA*\n\nStatus : ${active ? '✅ Aktif' : '⌛ Habis'}\n` +
                `Masa   : ${r.until === null ? 'Permanen' : `${active ? formatRemaining(r.until) + ' lagi' : 'habis sejak ' + formatDate(r.until)}\nBerakhir: ${formatDate(r.until)}`}\n` +
                `Paket  : ${r.plan || '-'}\nSejak  : ${formatDate(r.firstAdded || r.added)}`
            )
        }

        // ===== .pesanansewa (owner) =====
        if (command === 'pesanansewa') {
            const active = Object.values(d.orders).filter(o => ACTIVE.has(o.status)).sort((a, b) => a.createdAt - b.createdAt)
            const recent = Object.values(d.orders).filter(o => o.status === 'done').sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
            if (!active.length && !recent.length) return reply('Belum ada order sewa.')
            const fmt = (o) => `🧾 *${o.id}* — ${o.planName}\n   👥 ${o.groupName || o.group}\n   ${rp(o.total)} | ${STATUS[o.status]} | @${tagOf(o.buyer)}`
            return sock.sendMessage(m.chat, {
                text: `*▢ PESANAN SEWA*\n\n*Berjalan* (${active.length})\n${active.map(fmt).join('\n\n') || '-'}\n\n*Selesai terakhir*\n${recent.map(fmt).join('\n\n') || '-'}\n\nSetujui: ${p}accsewa <id>   Tolak: ${p}tolaksewa <id> <alasan>`,
                mentions: [...active, ...recent].map(o => o.buyer)
            }, { quoted: m })
        }

        // ===== .accsewa <id> (owner) =====
        if (command === 'accsewa') {
            const id = normId(body.split(/\s+/)[0])
            const order = id && d.orders[id]
            if (!order) return reply(`Format: ${p}accsewa <id>   contoh: ${p}accsewa SWA-0001\nLihat daftar: ${p}pesanansewa`)
            if (order.status === 'done') return reply(`${id} sudah selesai sebelumnya.`)
            if (!['pending', 'waiting', 'expired'].includes(order.status)) return reply(`${id} berstatus ${STATUS[order.status]}, tidak bisa di-ACC.`)

            // bot belum ada di grup tujuan (order dari private chat / sudah keluar) -> gabung lewat link
            let joinNote = ''
            if (!(await isMember(sock, order.group))) {
                if (!order.code) return reply(`Bot tidak ada di grup ${order.groupName || order.group} dan order ini tidak punya link. Masukkan bot manual lalu ACC lagi.`)
                try {
                    await sock.groupAcceptInvite(order.code)
                    joinNote = '\n🤝 Bot sudah bergabung ke grup.'
                } catch (e) {
                    return reply(`Gagal bergabung ke grup (${waError(e)}).\nMinta pembeli kirim link baru, atau masukkan bot manual lalu ACC lagi.`)
                }
            }

            const { rental, extended } = activateRental(order.group, order.days === null ? null : order.days * 864e5, { name: order.groupName, by: order.buyer, plan: order.planName })
            order.status = 'done'
            order.doneAt = Date.now()
            saveDB(global.db)

            const until = rental.until === null ? 'permanen' : `sampai ${formatDate(rental.until)}`
            await sock.sendMessage(order.group, {
                text: `✅ *SEWA BOT ${extended ? 'DIPERPANJANG' : 'AKTIF'}*\n\n🤖 Paket: ${order.planName}\n📅 Berlaku: ${until}\n\nTerima kasih sudah menyewa! Ketik *${p}menu* untuk mulai. 🙏`
            }).catch(() => null)
            await sock.sendMessage(order.buyer, {
                text: `✅ *PEMBAYARAN DITERIMA*\n\n🧾 ${order.id}\n🤖 ${order.planName}\n👥 ${order.groupName || order.group}\n📅 Berlaku ${until}\n\nTerima kasih! 🙏`
            }).catch(() => null)
            return reply(`✅ ${id} selesai. Sewa ${order.groupName || order.group} ${extended ? 'diperpanjang' : 'aktif'} (${until}).${joinNote}`)
        }

        // ===== .tolaksewa <id> [alasan] (owner) =====
        if (command === 'tolaksewa') {
            const [idRaw, ...why] = body.split(/\s+/)
            const id = normId(idRaw)
            const order = id && d.orders[id]
            if (!order) return reply(`Format: ${p}tolaksewa <id> [alasan]   contoh: ${p}tolaksewa SWA-0001 nominal tidak sesuai`)
            if (!['pending', 'waiting', 'expired'].includes(order.status)) return reply(`${id} berstatus ${STATUS[order.status]}, tidak bisa ditolak.`)
            order.status = 'rejected'
            order.reason = why.join(' ').trim()
            saveDB(global.db)
            await sock.sendMessage(order.buyer, {
                text: `❌ *ORDER SEWA DITOLAK*\n\n🧾 ${order.id}\n🤖 ${order.planName}\n${order.reason ? `📝 Alasan: ${order.reason}\n` : ''}\nKalau merasa sudah membayar, hubungi owner dengan menyertakan bukti bayar.`
            }).catch(() => null)
            return reply(`❌ ${id} ditolak dan pembeli diberi tahu.`)
        }

        // ===== .addsewa <durasi> [link/id grup] (owner) =====
        if (command === 'addsewa') {
            const tokens = body.split(/\s+/).filter(Boolean)
            const dur = tokens.map(t => parseDuration(t)).find(Boolean)
            if (!dur) return reply(`Format: ${p}addsewa <durasi> [link / id grup]\nDurasi: 12h, 30d, 2w, 1mo, 1y, atau perm.\nContoh: ${p}addsewa 30d  (di grup ini)\n${p}addsewa perm https://chat.whatsapp.com/xxxx`)

            let target = null
            let name = ''
            const gTok = tokens.find(t => GROUP_LINK.test(t) || GROUP_JID.test(t))
            if (gTok && GROUP_LINK.test(gTok)) {
                const code = gTok.match(GROUP_LINK)[1]
                const info = await sock.groupGetInviteInfo(code).catch(() => null)
                if (!info) return reply('Link grup tidak valid atau sudah kedaluwarsa.')
                target = info.id
                name = info.subject || ''
                if (!(await isMember(sock, target))) {
                    await sock.groupAcceptInvite(code).catch(e => { throw new Error(`Gagal bergabung ke grup: ${waError(e)}`) })
                }
            } else if (gTok) {
                target = gTok
                name = await groupName(sock, target)
            } else if (m.isGroup) {
                target = jid
                name = await groupName(sock, jid)
            } else {
                return reply('Pakai di dalam grup, atau sertakan link / id grup.')
            }

            const { rental, extended } = activateRental(target, dur.ms, { name, by: 'owner', plan: 'manual' })
            const until = rental.until === null ? 'permanen' : `sampai ${formatDate(rental.until)}`
            await sock.sendMessage(target, { text: `✅ *SEWA BOT ${extended ? 'DIPERPANJANG' : 'AKTIF'}*\n\n📅 Berlaku ${until}` }).catch(() => null)
            return reply(`✅ Sewa ${name || target} ${extended ? 'diperpanjang' : 'aktif'} (${until}).`)
        }

        // ===== .delsewa [id grup] [leave] (owner) =====
        if (command === 'delsewa') {
            const tokens = body.split(/\s+/).filter(Boolean)
            const target = tokens.find(t => GROUP_JID.test(t)) || (m.isGroup ? jid : null)
            if (!target) return reply(`Pakai di dalam grup, atau sertakan id grup.\nContoh: ${p}delsewa 1203xxxx@g.us leave`)
            if (!removeRental(target)) return reply('Grup itu tidak terdaftar menyewa.')
            const leave = tokens.some(t => /^leave$/i.test(t))
            if (leave) {
                await sock.sendMessage(target, { text: '👋 Sewa dihentikan oleh owner. Bot keluar dari grup.' }).catch(() => null)
                await sock.groupLeave(target).catch(() => null)
            }
            return reply(`✅ Sewa ${target} dihapus${leave ? ' dan bot keluar dari grup' : ''}.`)
        }

        // ===== .listsewa [hal] (owner) =====
        if (command === 'listsewa') {
            const all = listRentals().sort((a, b) => (a.until ?? Infinity) - (b.until ?? Infinity))
            if (!all.length) return reply('Belum ada grup yang menyewa.')
            const pages = Math.ceil(all.length / PER_PAGE)
            const page = Math.min(Math.max(parseInt(body) || 1, 1), pages)
            const start = (page - 1) * PER_PAGE
            const aktif = all.filter(r => r.until === null || r.until > Date.now()).length
            return reply(
                `*▢ GRUP PENYEWA* (${all.length}, aktif ${aktif})\nHalaman ${page}/${pages}\n\n` +
                all.slice(start, start + PER_PAGE).map((r, i) => `${start + i + 1}. ${rentalLine(r)}`).join('\n') +
                (page < pages ? `\n\nHalaman berikutnya: ${p}listsewa ${page + 1}` : '')
            )
        }

        // ===== .sewamode on|off (owner) =====
        if (command === 'sewamode') {
            const arg = body.split(/\s+/)[0].toLowerCase()
            const on = /^(on|1|true|aktif)$/i.test(arg)
            const off = /^(off|0|false|mati|nonaktif)$/i.test(arg)
            if (!on && !off) {
                return reply(
                    `*▢ MODE SEWA*\nStatus: ${global.sewamode === true ? '✅ ON (grup wajib sewa)' : '❌ OFF'}\n` +
                    `Grup penyewa aktif: ${listRentals().filter(r => r.until === null || r.until > Date.now()).length}\n\n` +
                    `${p}sewamode on  → grup yang belum sewa tidak dilayani\n${p}sewamode off`
                )
            }
            if ((global.sewamode === true) === on) return reply(`･ﾟ✦ sewamode sudah ${on ? 'aktif' : 'nonaktif'}.`)
            global.sewamode = on
            const saved = updateConfigValue('sewamode', on)
            return reply(
                `･ﾟ✦ sewamode ${on ? 'diaktifkan' : 'dimatikan'}.` +
                (on ? `\n⚠️ Mulai sekarang grup yang belum sewa (atau sewanya habis) tidak dilayani. Daftarkan grup yang sudah ada dengan ${p}addsewa di grup masing-masing.` : '') +
                (saved ? '' : '\n\n_Gagal menyimpan ke config.js, pengaturan kembali seperti semula setelah restart._')
            )
        }
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['sewa', 'buktisewa', 'batalsewa', 'ceksewa', 'pesanansewa', 'accsewa', 'tolaksewa', 'addsewa', 'delsewa', 'listsewa', 'sewamode']
handler.help = ['sewa', 'sewa <paket>', 'buktisewa', 'batalsewa', 'ceksewa']
handler.tags = ['store']

export default handler
