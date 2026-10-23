// Pintu utama jualan panel.
//   .kaguyapanel          animasi pembuka -> kartu dasbor (peran, status server, kapasitas) + menu tombol
//   .kaguyapanel skip     langsung dasbor      .kaguyapanel status   cek server saja
//   .kaguyapanel cara     cara order           .kaguyapanel paket    daftar paket
//   .ramlist              daftar paket         .tutorial             tutorial menjalankan bot di panel
// Semua pengaturan (domain, apikey, paket, toko) ada di config.js -> global.panel
import * as C from '../../lib/panel/core.js'
import * as UI from '../../lib/panel/ui.js'
import { getMeta } from '../../lib/wa.js'

const { bold: B, cut } = UI

function planLines() {
    const keys = C.planKeys()
    const w = Math.max(...keys.map(k => C.planTitle(k).length), 5)
    const row = (a, b, c, d) => `${a.padEnd(w)}  ${b.padEnd(9)} ${c.padEnd(9)} ${d}`
    return [
        row('PAKET', 'RAM', 'DISK', 'CPU'),
        ...keys.map(k => { const p = C.planOf(k); return row(C.planTitle(k), C.mbLabel(p.ram), C.mbLabel(p.disk), C.cpuLabel(p.cpu)) })
    ]
}

function paketText(prefix) {
    const keys = C.planKeys()
    const ex = keys[1] || keys[0] || '1gb'
    return [
        `☾ ${B('DAFTAR PAKET PANEL')}`, UI.LINE, UI.mono(planLines()), UI.LINE,
        `${B('Server 1')}  ${prefix}${ex} username,nomor`,
        ...(C.cfg(2).ready ? [`${B('Server 2')}  ${prefix}srv2${ex} username,nomor`] : []),
        `Contoh : ${prefix}${ex} budi,628123456789`, '',
        `Admin panel : ${prefix}cadmin username,nomor`
    ].join('\n')
}

function caraText(prefix) {
    const s = C.store()
    const ex = C.planKeys()[1] || '2gb'
    return [
        `☾ ${B('CARA ORDER PANEL')}`, UI.LINE,
        '1. Pastikan kamu terdaftar sebagai penjual (Reseller Panel ke atas).',
        `2. Ketik: ${prefix}${ex} username,nomor pembeli`,
        '3. Bot menyiapkan akun + server, lalu mengirim data login ke chat pribadi pembeli lengkap dengan tombol salin.',
        '4. Ringkasan pesanan (tanpa password) muncul di chat tempat kamu memesan.', UI.LINE,
        `Masa aktif ${s.expired} • garansi ${s.garansi}`,
        'Mau jadi reseller? Hubungi owner.'
    ].join('\n')
}

const tutorialText = (who) => [
    `☾ ${B('TUTORIAL MENJALANKAN BOT DI PANEL')}`, UI.LINE,
    `Halo @${who}`, '',
    `1. ${B('Versi Node')} : minimal v22 (cek di menu Startup).`,
    `2. ${B('Upload')} : unggah file bot .zip ke menu Files, klik kanan lalu Unarchive.`,
    `3. ${B('Install')} : buka Console, ketik: npm install`,
    `4. ${B('Jalankan')} : ketik: npm start`,
    `5. ${B('Sambungkan')} : masukkan nomor HP di Console, tunggu kode pairing, lalu masukkan di WhatsApp (Perangkat Tertaut > Tautkan dengan nomor telepon).`, '',
    B('Pengaturan owner'),
    '1. Buka config.js, ubah global.owners ke nomormu (628xxx).',
    '2. Wajib Restart dari panel setelah mengubah config.', UI.LINE
].join('\n')

async function statusLines(c, n) {
    if (!c.ready) return [`Server ${n}  : belum diatur di config.js`]
    const o = await C.overview(c)
    if (!o.online) return [`Server ${n}  : OFFLINE`, `Sebab     : ${o.error}`]
    const cap = o.node?.memory
        ? `${Math.round((o.node.memAlloc || 0) / o.node.memory * 100)}% RAM • ${o.node.disk ? Math.round((o.node.diskAlloc || 0) / o.node.disk * 100) : '?'}% disk`
        : 'tidak tersedia'
    return [`Server ${n}  : ONLINE • ${o.ms} ms`, `Akun      : ${o.users} user • ${o.servers} server`, `Terpakai  : ${cap}`]
}

// animasi pembuka -> hasil ringkasan untuk kartu
async function opening(sock, m, who, role) {
    const a = await UI.anim(sock, m, 'PANEL TERBUKA', ['Membuka pintu panel', 'Memeriksa peranmu', 'Menghubungi server panel', 'Menghitung persediaan paket'], `Selamat datang, ${String(who).slice(0, 18)}`)
    await UI.sleep(500); await a.step(1)
    await UI.sleep(400); await a.step(2)
    const c = C.cfg(1)
    let ov = null
    if (c.ready) { try { ov = await C.overview(c) } catch {} }
    await a.step(3)
    await UI.sleep(400)
    await a.done([`☾ ${B('PANEL SIAP')}`, UI.LINE, `Peran : ${role}`, `Server: ${ov ? (ov.online ? 'online' : 'offline') : 'belum diatur'}`].join('\n'))
    await UI.sleep(700)
    try { await a.remove() } catch {}
    return ov
}

async function dashboard(sock, m, prefix, who, role, ov, roleKey) {
    const st = C.store()
    const c = C.cfg(1)
    if (!ov && c.ready) { try { ov = await C.overview(c) } catch {} }
    const rank = C.rankOf(roleKey)
    const isBot = roleKey === 'bot'
    const keys = C.planKeys()

    const body = [
        `☾ ${B(st.name)}`, UI.LINE,
        `Peran   : ${role}`,
        `Server  : ${!c.ready ? 'belum diatur (config.js)' : ov?.online ? `online • ${ov.ms} ms` : 'offline'}`,
        ...(ov?.online ? [`Akun    : ${ov.users} user • ${ov.servers} server`] : []),
        `Paket   : ${keys.map(C.planTitle).join(' ')}`, UI.LINE,
        rank >= 1 ? 'Pilih menu lewat tombol di bawah.' : 'Kamu belum terdaftar sebagai penjual. Hubungi owner untuk menjadi reseller.'
    ].join('\n')

    let image = null
    try {
        image = await UI.dashCard({ store: st.name, role, name: who, online: !!ov?.online, ms: ov?.ms, users: ov?.users, servers: ov?.servers, node: ov?.node, plans: keys.map(C.planTitle).join('  ') })
    } catch (e) { console.error('[ PANEL ] kartu dasbor gagal:', e.message) }

    const row = (title, desc, id) => ({ header: '', title: cut(title, 24), description: cut(desc, 72), id })
    const sections = [{ title: 'Jualan', rows: [
        row('Daftar Paket', 'Spesifikasi RAM, disk, CPU', `${prefix}ramlist`),
        row('Cara Order', 'Langkah menjual panel', `${prefix}kaguyapanel cara`),
        row('Tutorial Run Bot', 'Menjalankan bot di panel', `${prefix}tutorial`)
    ] }]
    if (rank >= 2) sections.push({ title: 'Penjual', rows: [row('Daftar Penjual', 'Reseller, admin, PT, owner panel', `${prefix}listseller`)] })
    if (isBot) sections.push({ title: 'Kelola Panel', rows: [
        row('Daftar User', 'User di panel', `${prefix}listusr`),
        row('Daftar Server', 'Server + status', `${prefix}listsrv`),
        row('Daftar Admin', 'Akun admin', `${prefix}listadm`)
    ] })
    sections.push({ title: 'Info', rows: [row('Status Server', 'Latensi, akun, kapasitas', `${prefix}kaguyapanel status`)] })

    const buttons = [
        UI.select('Buka Menu Panel', sections),
        UI.qr('Muat Ulang', `${prefix}kaguyapanel skip`),
        ...(st.web ? [UI.link('Website', st.web)] : [])
    ]
    return UI.deliver(sock, m.chat, { image, body, footer: st.name, buttons, quoted: m })
}

let handler = async (m, { sock, text, prefix, command, reply, isOwner }) => {
    const sub = String(text || '').trim().split(/\s+/)[0].toLowerCase()

    if (command === 'ramlist') return reply(paketText(prefix))
    if (command === 'tutorial') {
        const num = await C.numberOf(sock, m.sender)
        return sock.sendMessage(m.chat, { text: tutorialText(num), mentions: [m.sender] }, { quoted: m })
    }
    if (sub === 'paket') return reply(paketText(prefix))
    if (sub === 'cara') return reply(caraText(prefix))

    const meta = m.isGroup ? await getMeta(sock, m.chat).catch(() => null) : null
    const roleKey = await C.roleOf(sock, m.sender, isOwner, meta)

    if (sub === 'status') {
        if (!roleKey) return reply('Status server hanya untuk penjual panel.')
        const lines = [...await statusLines(C.cfg(1), 1)]
        if (C.cfg(2).domain) lines.push('', ...await statusLines(C.cfg(2), 2))
        return reply([`☾ ${B('STATUS SERVER')}`, UI.LINE, ...lines].join('\n'))
    }

    const role = C.roleName(roleKey)
    const who = m.pushName && m.pushName !== 'no name' ? m.pushName : 'Tamu'
    let ov = null
    if (!['skip', 'menu', 'refresh'].includes(sub)) ov = await opening(sock, m, who, role)
    return dashboard(sock, m, prefix, who, role, ov, roleKey)
}

handler.command = ['kaguyapanel', 'kpanel', 'panelmenu', 'ramlist', 'tutorial']
handler.help = ['kaguyapanel', 'ramlist', 'tutorial']
handler.tags = ['panel']

export default handler
