// Jualan panel.
//   .1gb .2gb ... .10gb .unli  <username>,<nomor>     buat akun + server untuk pembeli (server 1)
//   .srv21gb ... .srv2unli     <username>,<nomor>     sama, di server 2 (config: domain2 dst)
//   .cadmin / .createadmin     <username>,<nomor>     buat akun ADMIN panel (PT Panel / Owner Panel / owner bot)
//   .cadmin2 / .createadmin2   <username>,<nomor>     buat akun ADMIN di server 2 (owner bot)
// Nomor pembeli boleh ditulis, di-tag, atau pesan pembeli di-reply (username saja cukup).
// Paket, domain, apikey, egg, node, lokasi, dan info toko diatur di config.js -> global.panel
import * as C from '../../lib/panel/core.js'
import * as UI from '../../lib/panel/ui.js'
import { getMeta } from '../../lib/wa.js'
import { pickTargetJid, phoneOf } from '../../lib/core-data.js'

const { bold: B } = UI

const DEFAULT_KEYS = ['1gb', '2gb', '3gb', '4gb', '5gb', '6gb', '7gb', '8gb', '9gb', '10gb', 'unli']
const keys = C.planKeys().length ? C.planKeys() : DEFAULT_KEYS
const ADMIN_CMDS = ['createadmin', 'cadmin', 'createadmin2', 'cadmin2']
const busy = new Set()

const parseCmd = (cmd) => {
    if (keys.includes(cmd)) return { n: 1, key: cmd }
    if (cmd.startsWith('srv2') && keys.includes(cmd.slice(4))) return { n: 2, key: cmd.slice(4) }
    return null
}
const fail = (title, detail, extra) => [`☾ ${B(title)}`, UI.LINE, detail, ...(extra ? ['', extra] : [])].join('\n')
const noRole = () => `☾ ${B('AKSES DITOLAK')}\nPerintah ini khusus *Reseller Panel* ke atas.\nHubungi owner untuk menjadi reseller.`
const BAD_USER = 'Username hanya boleh huruf, angka, titik, minus, garis bawah (3–32 karakter, tanpa spasi).'

// "username,nomor" -> { username, jid }. Tanpa koma: kata pertama = username, sisanya = target.
function parseTarget(m, text) {
    const raw = String(text || '').trim()
    const i = raw.indexOf(',')
    let username, rest
    if (i >= 0) {
        username = raw.slice(0, i).trim().split(/\s+/)[0] || ''
        rest = raw.slice(i + 1).trim()
    } else {
        const [first = '', ...others] = raw.split(/\s+/)
        username = first
        rest = others.join(' ')
    }
    return { username, jid: pickTargetJid(m, rest) }
}

function dmText({ kind, username, password, domain, plan, key }) {
    const s = C.store()
    const terms = s.terms.map(t => '• ' + t)
    const head = kind === 'admin' ? 'AKUN ADMIN PANEL KAMU' : 'PAKETMU SUDAH SIAP'
    const spec = plan ? [`Paket    : ${C.planTitle(key)}`, `RAM      : ${C.mbLabel(plan.ram)}`, `Disk     : ${C.mbLabel(plan.disk)}`, `CPU      : ${C.cpuLabel(plan.cpu)}`] : []
    return [
        `☾ ${B(head)}`, UI.LINE, `Username : ${username}`, `Password : ${password}`, `Login    : ${domain}`, ...spec, UI.LINE,
        kind === 'admin'
            ? 'Data ini hanya dikirim 1x. Simpan baik-baik; kalau hilang, tidak bisa dikirim ulang.'
            : `Masa aktif ${s.expired} • garansi ${s.garansi}`,
        ...(terms.length ? ['', B('Syarat & Ketentuan'), ...terms] : []),
        '', `Terima kasih telah membeli di ${s.name}`,
        ...(s.contact ? [`Kontak : ${s.contact}`] : []),
        ...(s.web ? [`Web    : ${s.web}`] : [])
    ].join('\n')
}

const dmButtons = (c, username, password) => [
    UI.copy('Salin Password', password, 'copy_pw'),
    UI.copy('Salin Username', username, 'copy_user'),
    UI.link('Buka Panel', c.domain)
]

// JID tujuan DM: pakai nomor telepon kalau bisa dibaca, kalau tidak pakai jid aslinya
async function dmJid(sock, jid, meta) {
    const phone = await phoneOf(sock, jid, meta)
    return phone ? C.toPN(phone) : jid
}

async function sell(m, ctx, role, { n, key }) {
    const { sock, text, prefix, command, reply } = ctx
    if (!role) return reply(noRole())
    if ((global.panel || {}).onlyGroup !== false && !m.isGroup) return reply(global.mess.group)

    const { username, jid } = parseTarget(m, text)
    if (!username) return reply(`☾ ${B('FORMAT')}\n${prefix}${command} username,nomor\nContoh : ${prefix}${command} budi,628123456789\n\nAtau reply pesan pembeli lalu ketik: ${prefix}${command} budi`)
    if (!C.validUser(username)) return reply(BAD_USER)
    if (!jid) return reply('Pembeli belum jelas. Tulis nomornya, tag orangnya, atau reply pesannya.')
    const c = C.cfg(n)
    if (!c.ready) return reply(C.notReadyMsg(n))
    const plan = C.planOf(key)
    if (!plan) return reply('Paket tidak ditemukan di config.')

    const lock = n + ':' + username.toLowerCase()
    if (busy.has(lock)) return reply('Pesanan dengan username itu sedang diproses.')
    busy.add(lock)
    try {
        const meta = m.isGroup ? await getMeta(sock, m.chat).catch(() => null) : null
        const buyerNum = await C.numberOf(sock, jid, meta)
        const a = await UI.anim(sock, m, `PESANAN PANEL ${C.planTitle(key)}${n === 2 ? ' • SERVER 2' : ''}`,
            ['Menghubungi panel', 'Membuat akun pembeli', 'Memasang server', 'Mengirim paket ke pembeli', 'Menyelesaikan pesanan'], `Pembeli : +${buyerNum}`)

        const ping = await C.call(c, 'app', 'GET', '/api/application/users', null, { per_page: 1 })
        if (!ping.ok) return a.fail(fail('PANEL TIDAK BISA DIHUBUNGI', C.why(ping), 'Cek domain, PLTA, dan koneksi di config.js'))
        await a.step(1)

        const u = await C.createUser(c, { username })
        if (!u.ok) return a.fail(fail('GAGAL MEMBUAT AKUN', u.error, 'Belum ada yang dibuat. Coba username lain.'))
        await a.step(2)

        const sv = await C.createServer(c, { name: username, userId: u.user.id, plan })
        if (!sv.ok) {
            await C.deleteUser(c, u.user.id)
            return a.fail(fail('GAGAL MEMASANG SERVER', sv.error, 'Akun yang sempat dibuat sudah dihapus otomatis. Aman diulang.'))
        }
        await a.step(3)

        const st = C.store()
        let card = null
        try {
            card = await UI.planCard({
                store: st.name, title: `PAKET ${C.planTitle(key)}`, plan,
                labels: { ram: C.mbLabel(plan.ram), disk: C.mbLabel(plan.disk), cpu: C.cpuLabel(plan.cpu) },
                username, status: 'AKTIF', expired: st.expired, garansi: st.garansi, line: st.web || st.contact || ''
            })
        } catch (e) { console.error('[ PANEL ] kartu paket gagal:', e.message) }

        const body = dmText({ kind: 'plan', username, password: u.password, domain: c.domain, plan, key })
        const sent = await UI.deliver(sock, await dmJid(sock, jid, meta), { image: card, body, footer: st.name, buttons: dmButtons(c, username, u.password) })
        await a.step(4)

        const s = sv.server
        await a.done([
            `☾ ${B('PESANAN SELESAI')}`, UI.LINE,
            `Paket   : ${C.planTitle(key)}${n === 2 ? ' (server 2)' : ''}`, `Pembeli : +${buyerNum}`,
            `Akun    : ${u.user.username} (ID ${u.user.id})`, `Server  : ID ${s.id}`,
            `RAM     : ${C.mbLabel(s.limits.memory)}`, `Disk    : ${C.mbLabel(s.limits.disk)}`, `CPU     : ${C.cpuLabel(s.limits.cpu)}`, UI.LINE,
            sent ? 'Data login sudah dikirim ke chat pribadi pembeli.' : 'DM ke pembeli gagal. Data login dikirim ke chat pribadimu, teruskan manual.'
        ].join('\n'))
        if (!sent) await sock.sendMessage(m.sender, { text: body }).catch(() => {})
    } finally { busy.delete(lock) }
}

async function makeAdmin(m, ctx, role, n) {
    const { sock, text, prefix, command, reply } = ctx
    const allowed = n === 2 ? role === 'bot' : ['bot', 'pt', 'owner'].includes(role)
    if (!allowed) return reply(`☾ ${B('AKSES DITOLAK')}\n${n === 2 ? 'Khusus owner bot.' : 'Khusus PT Panel, Owner Panel, atau owner bot.'}`)
    if ((global.panel || {}).onlyGroup !== false && !m.isGroup) return reply(global.mess.group)

    const { username, jid } = parseTarget(m, text)
    if (!username) return reply(`☾ ${B('FORMAT')}\n${prefix}${command} username,nomor\nContoh : ${prefix}${command} budi,@tag`)
    if (!C.validUser(username)) return reply(BAD_USER)
    if (!jid) return reply('Penerima belum jelas. Tulis nomornya, tag orangnya, atau reply pesannya.')
    const c = C.cfg(n)
    if (!c.ready) return reply(C.notReadyMsg(n))

    const lock = 'adm' + n + ':' + username.toLowerCase()
    if (busy.has(lock)) return reply('Permintaan dengan username itu sedang diproses.')
    busy.add(lock)
    try {
        const meta = m.isGroup ? await getMeta(sock, m.chat).catch(() => null) : null
        const num = await C.numberOf(sock, jid, meta)
        const a = await UI.anim(sock, m, `AKUN ADMIN PANEL${n === 2 ? ' • SERVER 2' : ''}`,
            ['Menghubungi panel', 'Membuat akun admin', 'Mengirim data ke penerima'], `Penerima : +${num}`)

        const ping = await C.call(c, 'app', 'GET', '/api/application/users', null, { per_page: 1 })
        if (!ping.ok) return a.fail(fail('PANEL TIDAK BISA DIHUBUNGI', C.why(ping), 'Cek domain, PLTA, dan koneksi di config.js'))
        await a.step(1)

        const u = await C.createUser(c, { username, admin: true })
        if (!u.ok) return a.fail(fail('GAGAL MEMBUAT ADMIN', u.error))
        await a.step(2)

        const st = C.store()
        const body = dmText({ kind: 'admin', username, password: u.password, domain: c.domain })
        const sent = await UI.deliver(sock, await dmJid(sock, jid, meta), { body, footer: st.name, buttons: dmButtons(c, username, u.password) })
        await a.done([
            `☾ ${B('ADMIN PANEL DITERBITKAN')}`, UI.LINE, `ID       : ${u.user.id}`, `UUID     : ${u.user.uuid}`,
            `Username : ${u.user.username}`, `Email    : ${u.user.email}`, `Admin    : ${u.user.root_admin ? 'ya' : 'tidak'}`,
            `Dibuat   : ${u.user.created_at}`, `Login    : ${c.domain}`, UI.LINE,
            sent ? 'Data login sudah dikirim ke chat pribadi penerima.' : 'DM ke penerima gagal. Data login dikirim ke chat pribadimu, teruskan manual.'
        ].join('\n'))
        if (!sent) await sock.sendMessage(m.sender, { text: body }).catch(() => {})
    } finally { busy.delete(lock) }
}

let handler = async (m, ctx) => {
    const { sock, command, isOwner } = ctx
    const meta = m.isGroup ? await getMeta(sock, m.chat).catch(() => null) : null
    const role = await C.roleOf(sock, m.sender, isOwner, meta)
    if (ADMIN_CMDS.includes(command)) return makeAdmin(m, ctx, role, command.endsWith('2') ? 2 : 1)
    const pc = parseCmd(command)
    if (pc) return sell(m, ctx, role, pc)
}

handler.command = [...keys, ...keys.map(k => 'srv2' + k), ...ADMIN_CMDS]
handler.help = [...keys, 'createadmin']
handler.tags = ['panel']

export default handler
