// Kelola isi panel Pterodactyl (khusus owner bot).
//   .listusr [hal]     daftar user          .listadm [hal]    daftar admin
//   .listsrv [hal]     daftar server        .delusr <id>      hapus user
//   .delsrv <id>       hapus server         .suspend <id>     suspend server
//   .unsuspend <id>    buka suspend         .addsrv nama,keterangan,userId,eggId,locationId,memori/disk,cpu
// Tambahkan angka 2 di akhir (mis. .listusr2) untuk memakai server 2.
import * as C from '../../lib/panel/core.js'
import * as UI from '../../lib/panel/ui.js'

const { bold: B } = UI

const BASE = ['listusr', 'listsrv', 'listadm', 'delusr', 'delsrv', 'suspend', 'unsuspend', 'addsrv']
const split = (cmd) => {
    const two = /2$/.test(cmd) && BASE.includes(cmd.slice(0, -1))
    return { cmd: two ? cmd.slice(0, -1) : cmd, n: two ? 2 : 1 }
}
const fail = (title, detail) => [`☾ ${B(title)}`, UI.LINE, detail].join('\n')

async function pager(ctx, c, n, kind) {
    const { text, prefix, command, reply } = ctx
    const page = Math.max(1, parseInt(String(text || '').trim().split(/\s+/)[0]) || 1)
    const adminOnly = kind === 'adm'
    const isUsers = kind !== 'srv'

    const r = isUsers ? await C.listUsers(c, page) : await C.listServers(c, page)
    if (!r.ok) return reply(fail('GAGAL MEMBACA PANEL', C.why(r)))
    const pg = r.data.meta.pagination
    const items = r.data.data.map(x => x.attributes)
    const sfx = n === 2 ? '2' : ''

    let rows
    if (isUsers) {
        rows = items.filter(u => !adminOnly || u.root_admin)
            .map(u => `${String(u.id).padStart(3)}  ${u.username}${u.root_admin ? '  [admin]' : ''}\n     ${u.first_name} ${u.last_name}`)
    } else {
        const states = await Promise.all(items.map(s => C.powerState(c, s.uuid).catch(() => null)))
        rows = items.map((s, i) => `${String(s.id).padStart(3)}  ${s.name}\n     ${states[i] || (s.suspended ? 'suspended' : s.status || 'tidak diketahui')}`)
    }

    const title = kind === 'srv' ? 'DAFTAR SERVER' : adminOnly ? 'DAFTAR ADMIN' : 'DAFTAR USER'
    const out = [`☾ ${B(title)}${n === 2 ? ' • SERVER 2' : ''}`, UI.LINE, ...(rows.length ? rows : ['(kosong di halaman ini)']), UI.LINE, `Halaman ${pg.current_page}/${pg.total_pages} • total ${pg.count}`]
    if (pg.current_page < pg.total_pages) out.push(`Berikutnya: ${prefix}${command.replace(/2$/, '')}${sfx} ${pg.current_page + 1}`)
    return reply(out.join('\n'))
}

async function act(ctx, c, kind, id) {
    const { reply } = ctx
    let r, okText
    if (kind === 'delusr') { r = await C.deleteUser(c, id); okText = `User ID ${id} dihapus.` }
    else if (kind === 'delsrv') { r = await C.deleteServer(c, id); okText = `Server ID ${id} dihapus.` }
    else if (kind === 'suspend') { r = await C.suspend(c, id, true); okText = `Server ID ${id} disuspend.` }
    else { r = await C.suspend(c, id, false); okText = `Suspend server ID ${id} dibuka.` }
    if (!r.ok) return reply(fail('GAGAL', r.status === 404 ? `ID ${id} tidak ditemukan.` : C.why(r)))
    return reply([`☾ ${B('BERHASIL')}`, UI.LINE, okText].join('\n'))
}

async function addServer(ctx, c) {
    const { text, prefix, command, reply } = ctx
    const s = String(text || '').split(',').map(x => x.trim())
    if (s.length < 7) return reply(`☾ ${B('FORMAT')}\n${prefix}${command} nama,keterangan,userId,eggId,locationId,memori/disk,cpu\nContoh : ${prefix}${command} bot1,-,12,15,1,2048/4096,100`)
    const [name, desc, userId, egg, loc, md, cpu] = s
    const [mem, disk] = String(md).split('/')
    if (![userId, egg, loc, mem, disk, cpu].every(v => /^\d+$/.test(String(v)))) return reply('userId, eggId, locationId, memori/disk, dan cpu harus angka.')

    const r = await C.createServer({ ...c, egg: Number(egg), location: Number(loc) }, {
        name, description: desc && desc !== '-' ? desc : undefined, userId: Number(userId),
        plan: { ram: Number(mem), disk: Number(disk), cpu: Number(cpu) }
    })
    if (!r.ok) return reply(fail('GAGAL MEMBUAT SERVER', r.error))
    const v = r.server
    return reply([`☾ ${B('SERVER DIBUAT')}`, UI.LINE, `ID     : ${v.id}`, `UUID   : ${v.uuid}`, `Nama   : ${v.name}`, `RAM    : ${C.mbLabel(v.limits.memory)}`, `Disk   : ${C.mbLabel(v.limits.disk)}`, `CPU    : ${C.cpuLabel(v.limits.cpu)}`, `Dibuat : ${v.created_at}`].join('\n'))
}

let handler = async (m, ctx) => {
    const { cmd, n } = split(ctx.command)
    const c = C.cfg(n)
    if (!c.ready) return ctx.reply(C.notReadyMsg(n))
    if (cmd === 'listusr') return pager(ctx, c, n, 'usr')
    if (cmd === 'listadm') return pager(ctx, c, n, 'adm')
    if (cmd === 'listsrv') return pager(ctx, c, n, 'srv')
    if (cmd === 'addsrv') return addServer(ctx, c)

    const id = String(ctx.text || '').trim().split(/\s+/)[0].replace(/\D/g, '')
    if (!id) return ctx.reply(`ID-nya mana?\nContoh : ${ctx.prefix}${ctx.command} 12`)
    return act(ctx, c, cmd, id)
}

handler.command = [...BASE, ...BASE.map(x => x + '2')]
handler.help = ['listusr', 'listsrv', 'listadm', 'delusr', 'delsrv', 'suspend', 'unsuspend', 'addsrv']
handler.tags = ['panel']
handler.owner = true

export default handler
