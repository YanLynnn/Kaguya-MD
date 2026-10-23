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
import { toPN } from '../../lib/plugin-engine.js'

const QRIS_STATIC = global.qrisStatic || ''
const STORE_NAME = 'Toko Digital Store Iyan'
const ORDER_TTL_MIN = 15          // order yang belum dibayar kedaluwarsa setelah ... menit
const UNIQUE_MAX = 99             // kode unik 1..99 ditambahkan ke harga untuk mencocokkan mutasi
const MIN_PRICE = 1000
const HISTORY_LIMIT = 10
const LATE_PROOF_HOURS = 24       // bukti bayar masih diterima untuk order kedaluwarsa dalam ... jam

// ───────── QRIS ─────────
function crc16(str) {
    let crc = 0xffff
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8
        for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
}

const QRIS = QRIS_STATIC.replace(/[\r\n]+/g, '').trim()
const crcValid = (q) => q.length >= 8 && q.slice(0, -4).endsWith('6304') && crc16(q.slice(0, -4)) === q.slice(-4).toUpperCase()
const qrisReady = () => QRIS.startsWith('000201') && crcValid(QRIS)

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

// ───────── data & helper ─────────
const getDB = () => {
    const d = (global.db.store ||= {})
    d.products ||= {}
    d.orders ||= {}
    d.seq ||= 0
    return d
}

const rp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`
const tagOf = (jid) => String(jid || '').split('@')[0].split(':')[0]
const ACTIVE = new Set(['pending', 'waiting'])
const STATUS = {
    pending: '⏳ Menunggu pembayaran',
    waiting: '🕐 Menunggu konfirmasi owner',
    done: '✅ Selesai',
    rejected: '❌ Ditolak',
    cancelled: '🚫 Dibatalkan',
    expired: '⌛ Kedaluwarsa'
}

const normId = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '')
    return digits ? `INV-${digits.padStart(4, '0')}` : null
}

const ago = (ts) => {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
    if (s < 60) return `${s} detik lalu`
    if (s < 3600) return `${Math.floor(s / 60)} menit lalu`
    if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`
    return `${Math.floor(s / 86400)} hari lalu`
}

const dayKey = (ts) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // YYYY-MM-DD

function expireOrders() {
    const d = getDB()
    let changed = false
    for (const o of Object.values(d.orders)) {
        if (o.status === 'pending' && Date.now() - o.createdAt > ORDER_TTL_MIN * 60_000) {
            o.status = 'expired'
            changed = true
        }
    }
    if (changed) saveDB(global.db)
}

const activeOrdersOf = (code) => Object.values(getDB().orders).filter(o => o.code === code && ACTIVE.has(o.status))

// stok tersedia = stok - order yang sedang berjalan (supaya tidak dijual dua kali); Infinity untuk produk manual
const available = (p) => (Array.isArray(p.stock) ? Math.max(0, p.stock.length - activeOrdersOf(p.code).length) : Infinity)

const stockLabel = (p, owner = false) => {
    if (!Array.isArray(p.stock)) return owner ? 'manual' : 'ready'
    const n = available(p)
    return n > 0 ? `${owner ? p.stock.length : n}` : 'habis'
}

const ownerJids = () => (global.owners || []).map(n => `${String(n).replace(/\D/g, '')}@s.whatsapp.net`)

const isImage = (msg) => !!msg?.isMedia && msg.mtype === 'imageMessage'

// ───────── plugin ─────────
let handler = async (m, { sock, text, command, prefix, isOwner, reply }) => {
    const p = prefix || '.'
    const body = (text || '').trim()
    const d = getDB()
    expireOrders()

    const ownerOnly = ['addproduk', 'editproduk', 'delproduk', 'addstok', 'clearstok', 'pesanan', 'acc', 'tolak', 'rekap']
    if (ownerOnly.includes(command) && !isOwner) return reply(global.mess?.owner || 'Khusus owner.')

    // ===== .produk / .katalog =====
    if (command === 'produk' || command === 'katalog') {
        const list = Object.values(d.products)
        if (!list.length) return reply(isOwner ? `Katalog kosong. Tambah dengan:\n${p}addproduk kode|nama|harga|deskripsi` : 'Katalog masih kosong.')

        if (body) {
            const pr = d.products[body.toLowerCase()]
            if (!pr) return reply(`Produk "${body}" tidak ditemukan. Ketik ${p}produk untuk melihat daftar.`)
            return reply(
                `╭─▣「 *${pr.name}* 」▣─╮\n` +
                `┃ 🔖 Kode  : ${pr.code}\n` +
                `┃ 💰 Harga : ${rp(pr.price)}\n` +
                `┃ 📦 Stok  : ${stockLabel(pr, isOwner)}\n` +
                `╰─────────────➤\n` +
                `${pr.desc ? `\n${pr.desc}\n` : ''}\nBeli: ${p}beli ${pr.code}`
            )
        }

        const lines = list.map(pr =>
            `🔖 *${pr.code}* — ${pr.name}\n   💰 ${rp(pr.price)}  |  📦 ${stockLabel(pr, isOwner)}${pr.desc ? `\n   ${pr.desc.split('\n')[0].slice(0, 80)}` : ''}`
        )
        return reply(`╭─▣「 *${STORE_NAME.toUpperCase()}* 」▣─╮\n╰─────────────➤\n\n${lines.join('\n\n')}\n\nBeli: ${p}beli <kode>\nDetail: ${p}produk <kode>`)
    }

    // ===== .addproduk kode|nama|harga|deskripsi =====
    if (command === 'addproduk') {
        const [codeRaw, name, priceRaw, ...descParts] = body.split('|').map(s => s.trim())
        const code = String(codeRaw || '').toLowerCase()
        const price = Number(String(priceRaw || '').replace(/[.,\s]/g, ''))
        if (!/^[a-z0-9-]{1,12}$/.test(code) || !name || !Number.isInteger(price)) {
            return reply(`Format: ${p}addproduk kode|nama|harga|deskripsi\nContoh: ${p}addproduk netflix|Netflix 1 Bulan|25000|Akun sharing 1 profil\n\nKode: huruf kecil/angka/-, maks 12 karakter.`)
        }
        if (price < MIN_PRICE) return reply(`Harga minimal ${rp(MIN_PRICE)}.`)
        if (d.products[code]) return reply(`Kode "${code}" sudah dipakai. Ubah produknya dengan ${p}editproduk.`)
        d.products[code] = { code, name, price, desc: descParts.join('|').trim(), stock: null, createdAt: Date.now() }
        saveDB(global.db)
        return reply(`✅ Produk ditambahkan.\n\n🔖 ${code} — ${name}\n💰 ${rp(price)}\n\nIsi stok (opsional, untuk pengiriman otomatis):\n${p}addstok ${code} <item>`)
    }

    // ===== .editproduk kode|field|nilai =====
    if (command === 'editproduk') {
        const [codeRaw, fieldRaw, ...rest] = body.split('|').map(s => s.trim())
        const pr = d.products[String(codeRaw || '').toLowerCase()]
        const value = rest.join('|').trim()
        const field = String(fieldRaw || '').toLowerCase()
        if (!pr || !['nama', 'harga', 'deskripsi'].includes(field) || !value) {
            return reply(`Format: ${p}editproduk kode|nama/harga/deskripsi|nilai baru\nContoh: ${p}editproduk netflix|harga|27000`)
        }
        if (field === 'nama') pr.name = value
        if (field === 'deskripsi') pr.desc = value
        if (field === 'harga') {
            const price = Number(value.replace(/[.,\s]/g, ''))
            if (!Number.isInteger(price) || price < MIN_PRICE) return reply(`Harga tidak valid (minimal ${rp(MIN_PRICE)}).`)
            pr.price = price
        }
        saveDB(global.db)
        return reply(`✅ ${pr.code}: ${field} diubah.`)
    }

    // ===== .delproduk kode =====
    if (command === 'delproduk') {
        const code = body.toLowerCase()
        if (!d.products[code]) return reply(`Produk "${body}" tidak ditemukan.`)
        if (activeOrdersOf(code).length) return reply('Masih ada order aktif untuk produk ini. Selesaikan dulu lewat .pesanan.')
        delete d.products[code]
        saveDB(global.db)
        return reply(`🗑️ Produk ${code} dihapus.`)
    }

    // ===== .addstok kode item (satu item per baris) =====
    if (command === 'addstok') {
        const lines = body.split('\n')
        const first = (lines.shift() || '').trim()
        const code = (first.split(/\s+/)[0] || '').toLowerCase()
        const rest = first.slice(code.length).trim()
        const pr = d.products[code]
        if (!pr) return reply(`Format: ${p}addstok kode <item>\nUntuk banyak item, taruh satu item per baris:\n${p}addstok netflix\nakun1@mail.com|pass1\nakun2@mail.com|pass2`)
        const items = [rest, ...lines].map(s => s.trim()).filter(Boolean)
        if (!items.length) return reply('Itemnya kosong. Tulis item di baris berikutnya (satu item per baris).')
        if (!Array.isArray(pr.stock)) pr.stock = []
        pr.stock.push(...items)
        saveDB(global.db)
        return reply(`✅ ${items.length} item ditambahkan ke ${pr.code}.\nTotal stok: ${pr.stock.length}`)
    }

    // ===== .clearstok kode =====
    if (command === 'clearstok') {
        const pr = d.products[body.toLowerCase()]
        if (!pr) return reply(`Format: ${p}clearstok kode`)
        const n = Array.isArray(pr.stock) ? pr.stock.length : 0
        pr.stock = []
        saveDB(global.db)
        return reply(`🗑️ ${n} item stok ${pr.code} dihapus (produk sekarang habis).`)
    }

    // ===== .beli kode =====
    if (command === 'beli') {
        if (!qrisReady()) {
            return reply(isOwner
                ? 'QRIS belum diisi. Buka plugins/main/store.js lalu isi QRIS_STATIC dengan teks QRIS kamu.'
                : 'Pembelian belum tersedia saat ini.')
        }
        const pr = d.products[body.toLowerCase()]
        if (!body) return reply(`Format: ${p}beli <kode>\nLihat daftar: ${p}produk`)
        if (!pr) return reply(`Produk "${body}" tidak ditemukan. Ketik ${p}produk untuk melihat daftar.`)
        if (available(pr) <= 0) return reply(`Maaf, *${pr.name}* sedang habis.`)

        const buyer = await toPN(sock, m.sender)
        const running = Object.values(d.orders).find(o => o.buyer === buyer && ACTIVE.has(o.status))
        if (running) {
            return reply(`Kamu masih punya order *${running.id}* (${STATUS[running.status]}).\n${running.status === 'pending' ? `Bayar dulu atau batalkan dengan ${p}batalorder.` : 'Tunggu konfirmasi owner ya.'}`)
        }

        const usedTotals = new Set(Object.values(d.orders).filter(o => o.status === 'pending').map(o => o.total))
        const free = []
        for (let u = 1; u <= UNIQUE_MAX; u++) if (!usedTotals.has(pr.price + u)) free.push(u)
        if (!free.length) return reply('Sedang ramai, coba lagi beberapa menit lagi ya.')
        const unique = free[Math.floor(Math.random() * free.length)]
        const total = pr.price + unique

        d.seq += 1
        const id = `INV-${String(d.seq).padStart(4, '0')}`
        d.orders[id] = {
            id, code: pr.code, name: pr.name, price: pr.price, unique, total,
            buyer, chat: m.chat, status: 'pending', createdAt: Date.now()
        }
        saveDB(global.db)

        const image = await QRCode.toBuffer(toDynamic(QRIS, total), { width: 600, margin: 3, errorCorrectionLevel: 'M' })
        return sock.sendMessage(m.chat, {
            image,
            caption:
                `╭─▣「 *INVOICE ${id}* 」▣─╮\n` +
                `┃ 🛍️ Produk     : ${pr.name}\n` +
                `┃ 💰 Harga      : ${rp(pr.price)}\n` +
                `┃ 🔢 Kode unik  : ${unique}\n` +
                `┃ 💳 *Total bayar : ${rp(total)}*\n` +
                `┃ ⏳ Berlaku    : ${ORDER_TTL_MIN} menit\n` +
                `╰─────────────➤\n\n` +
                `1. Scan QR di atas lewat e-wallet / m-banking (QRIS).\n` +
                `2. Bayar *tepat ${rp(total)}* (termasuk kode unik).\n` +
                `3. Kirim foto bukti bayar dengan caption ${p}bukti (atau balas fotonya dengan ${p}bukti).\n\n` +
                `Batal: ${p}batalorder`
        }, { quoted: m })
    }

    // ===== .bukti (foto bukti bayar) =====
    if (command === 'bukti') {
        const buyer = await toPN(sock, m.sender)
        const mine = Object.values(d.orders).filter(o => o.buyer === buyer).sort((a, b) => b.createdAt - a.createdAt)
        const order = mine.find(o => ACTIVE.has(o.status)) ||
            mine.find(o => o.status === 'expired' && Date.now() - o.createdAt < LATE_PROOF_HOURS * 3_600_000)
        if (!order) return reply(`Kamu belum punya order aktif. Pesan dulu dengan ${p}beli <kode>.`)

        const source = isImage(m) ? m : (isImage(m.quoted) ? m.quoted : null)
        if (!source) return reply(`Kirim *foto* bukti bayar dengan caption ${p}bukti, atau balas foto bukti dengan ${p}bukti.`)
        const buf = await source.download().catch(() => null)
        if (!buf?.length) return reply('Gagal mengunduh fotonya. Coba kirim ulang.')

        const wasExpired = order.status === 'expired'
        const caption =
            `📥 *BUKTI BAYAR*${wasExpired ? ' _(order sempat kedaluwarsa, cek mutasi!)_' : ''}\n\n` +
            `🧾 ${order.id}\n🛍️ ${order.name}\n💳 Total: ${rp(order.total)}\n👤 @${tagOf(buyer)}\n\n` +
            `Setujui : ${p}acc ${order.id}\nTolak   : ${p}tolak ${order.id} <alasan>`
        const sent = await Promise.allSettled(ownerJids().map(j => sock.sendMessage(j, { image: buf, caption, mentions: [buyer] })))
        if (!sent.some(r => r.status === 'fulfilled')) return reply('Gagal meneruskan bukti ke owner. Hubungi owner langsung ya.')

        order.status = 'waiting'
        order.proofAt = Date.now()
        saveDB(global.db)
        return reply(`✅ Bukti untuk *${order.id}* sudah diteruskan ke owner.\nTunggu konfirmasi ya, produk akan dikirim ke chat pribadi kamu. 🙏`)
    }

    // ===== .batalorder =====
    if (command === 'batalorder') {
        const buyer = await toPN(sock, m.sender)
        const order = Object.values(d.orders).find(o => o.buyer === buyer && o.status === 'pending')
        if (!order) {
            const waiting = Object.values(d.orders).find(o => o.buyer === buyer && o.status === 'waiting')
            return reply(waiting ? `Order ${waiting.id} sudah kamu kirimi bukti bayar, hubungi owner kalau mau membatalkan.` : 'Tidak ada order yang bisa dibatalkan.')
        }
        order.status = 'cancelled'
        saveDB(global.db)
        return reply(`🚫 Order ${order.id} dibatalkan.`)
    }

    // ===== .riwayat =====
    if (command === 'riwayat') {
        const buyer = await toPN(sock, m.sender)
        const mine = Object.values(d.orders).filter(o => o.buyer === buyer).sort((a, b) => b.createdAt - a.createdAt).slice(0, HISTORY_LIMIT)
        if (!mine.length) return reply('Kamu belum punya riwayat pembelian.')
        const lines = mine.map(o => `🧾 *${o.id}* — ${o.name}\n   ${rp(o.total)}  |  ${STATUS[o.status]}  |  ${ago(o.createdAt)}`)
        return reply(`*Riwayat pembelian kamu*\n\n${lines.join('\n\n')}`)
    }

    // ===== .pesanan (owner) =====
    if (command === 'pesanan') {
        const list = Object.values(d.orders).filter(o => ACTIVE.has(o.status)).sort((a, b) => (a.status === 'waiting' ? -1 : 1) - (b.status === 'waiting' ? -1 : 1) || a.createdAt - b.createdAt)
        if (!list.length) return reply('Tidak ada pesanan yang menunggu.')
        const lines = list.map(o => `🧾 *${o.id}* — ${o.name}\n   ${rp(o.total)}  |  ${STATUS[o.status]}  |  @${tagOf(o.buyer)}  |  ${ago(o.createdAt)}`)
        return sock.sendMessage(m.chat, { text: `*Pesanan aktif (${list.length})*\n\n${lines.join('\n\n')}\n\n${p}acc <id>  /  ${p}tolak <id> <alasan>`, mentions: list.map(o => o.buyer) }, { quoted: m })
    }

    // ===== .acc <id> =====
    if (command === 'acc') {
        const id = normId(body.split(/\s+/)[0])
        const order = id && d.orders[id]
        if (!order) return reply(`Format: ${p}acc <id>   contoh: ${p}acc INV-0001\nLihat daftar: ${p}pesanan`)
        if (order.status === 'done') return reply(`${id} sudah selesai sebelumnya.`)
        if (!['pending', 'waiting', 'expired'].includes(order.status)) return reply(`${id} berstatus ${STATUS[order.status]}, tidak bisa di-ACC.`)

        const pr = d.products[order.code]
        let item = null
        if (pr && Array.isArray(pr.stock)) {
            if (!pr.stock.length) return reply(`Stok ${pr.code} habis, ${id} belum di-ACC.\nTambah stok dengan ${p}addstok, atau tolak dengan ${p}tolak ${id}.`)
            item = pr.stock.shift()
        }
        order.status = 'done'
        order.doneAt = Date.now()
        if (item) order.item = item
        saveDB(global.db)

        const msg = item
            ? `✅ *PEMBAYARAN DITERIMA*\n\n🧾 ${order.id}\n🛍️ ${order.name}\n\n📦 *Pesanan kamu:*\n${item}\n\nTerima kasih sudah belanja di ${STORE_NAME}! 🙏`
            : `✅ *PEMBAYARAN DITERIMA*\n\n🧾 ${order.id}\n🛍️ ${order.name}\n\nPesananmu dikonfirmasi, owner akan segera memprosesnya. Terima kasih! 🙏`
        const ok = await sock.sendMessage(order.buyer, { text: msg }).then(() => true).catch(() => false)
        if (ok) return reply(`✅ ${id} selesai.${item ? ' Produk sudah dikirim ke DM pembeli.' : ' Pembeli sudah diberi tahu.'}`)
        return sock.sendMessage(m.chat, {
            text: `✅ ${id} ditandai selesai, tapi *gagal mengirim DM* ke @${tagOf(order.buyer)}.\n${item ? `Kirim manual item ini:\n${item}` : 'Hubungi pembeli secara manual.'}`,
            mentions: [order.buyer]
        }, { quoted: m })
    }

    // ===== .tolak <id> [alasan] =====
    if (command === 'tolak') {
        const [idRaw, ...why] = body.split(/\s+/)
        const id = normId(idRaw)
        const order = id && d.orders[id]
        if (!order) return reply(`Format: ${p}tolak <id> [alasan]   contoh: ${p}tolak INV-0001 nominal tidak sesuai`)
        if (!['pending', 'waiting', 'expired'].includes(order.status)) return reply(`${id} berstatus ${STATUS[order.status]}, tidak bisa ditolak.`)
        order.status = 'rejected'
        order.reason = why.join(' ').trim()
        saveDB(global.db)
        await sock.sendMessage(order.buyer, {
            text: `❌ *ORDER DITOLAK*\n\n🧾 ${order.id}\n🛍️ ${order.name}\n${order.reason ? `📝 Alasan: ${order.reason}\n` : ''}\nKalau merasa sudah membayar, hubungi owner dengan menyertakan bukti bayar.`
        }).catch(() => null)
        return reply(`❌ ${id} ditolak dan pembeli diberi tahu.`)
    }

    // ===== .rekap (owner) =====
    if (command === 'rekap') {
        const done = Object.values(d.orders).filter(o => o.status === 'done')
        const today = dayKey(Date.now())
        const month = today.slice(0, 7)
        const sum = (arr) => arr.reduce((a, o) => a + o.total, 0)
        const dToday = done.filter(o => dayKey(o.doneAt) === today)
        const dMonth = done.filter(o => dayKey(o.doneAt).startsWith(month))

        const count = {}
        for (const o of dMonth) count[o.name] = (count[o.name] || 0) + 1
        const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 3)
            .map(([n, c], i) => `${i + 1}. ${n} (${c}x)`).join('\n') || '-'
        const waiting = Object.values(d.orders).filter(o => ACTIVE.has(o.status)).length

        return reply(
            `╭─▣「 *REKAP ${STORE_NAME.toUpperCase()}* 」▣─╮\n` +
            `┃ 📅 Hari ini  : ${dToday.length} order • ${rp(sum(dToday))}\n` +
            `┃ 🗓️ Bulan ini : ${dMonth.length} order • ${rp(sum(dMonth))}\n` +
            `┃ 📊 Semua     : ${done.length} order • ${rp(sum(done))}\n` +
            `┃ ⏳ Menunggu  : ${waiting} pesanan\n` +
            `╰─────────────➤\n\n*Terlaris bulan ini*\n${top}\n\n_Total termasuk kode unik._`
        )
    }
}

handler.command = ['produk', 'katalog', 'beli', 'bukti', 'batalorder', 'riwayat',
    'addproduk', 'editproduk', 'delproduk', 'addstok', 'clearstok', 'pesanan', 'acc', 'tolak', 'rekap']
handler.tags = ['store']

export default handler
