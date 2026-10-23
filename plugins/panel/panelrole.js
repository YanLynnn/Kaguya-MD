// Atur peran penjual panel.
//   Reseller Panel -> boleh .1gb ... .unli
//   Admin Panel    -> + menambah/menghapus Reseller
//   PT Panel       -> + membuat admin panel (.cadmin) dan menambah/menghapus Admin
//   Owner Panel    -> + menambah/menghapus PT Panel
//   Owner bot      -> semua, termasuk menambah/menghapus Owner Panel
//   .addresellerp .addadminp .addptp .addownp   <nomor | @tag | reply>
//   .delresellerp .deladminp .delptp .delownp   <nomor | @tag | reply>
//   .listseller (alias .premlist)               daftar semua penjual panel
import * as C from '../../lib/panel/core.js'
import * as UI from '../../lib/panel/ui.js'
import { getMeta } from '../../lib/wa.js'
import { pickTargetJid, resolveIds } from '../../lib/core-data.js'

const { bold: B } = UI

// perintah -> [peran, pangkat minimum pelaku, tambah?]
const MAP = {
    addresellerp: ['reseller', 2, true], delresellerp: ['reseller', 2, false],
    addadminp: ['admin', 3, true], deladminp: ['admin', 3, false],
    addptp: ['pt', 4, true], delptp: ['pt', 4, false],
    addownp: ['owner', 5, true], delownp: ['owner', 5, false]
}
const NEED = { 2: 'Admin Panel ke atas', 3: 'PT Panel ke atas', 4: 'Owner Panel ke atas', 5: 'owner bot' }

function listAll(reply, prefix) {
    const rows = []
    let total = 0
    for (const r of [...C.ROLES].reverse()) {
        const list = C.listRole(r)
        total += list.length
        rows.push(`${B(C.ROLE_LABEL[r])} (${list.length})`, ...(list.length ? list.map((n, i) => `${i + 1}. +${n}`) : ['—']), '')
    }
    return reply([`☾ ${B('PENJUAL PANEL')}`, UI.LINE, ...rows, UI.LINE, `Total ${total} orang`, `Tambah: ${prefix}addresellerp 628xxx`].join('\n'))
}

let handler = async (m, { sock, text, prefix, command, reply, isOwner }) => {
    const meta = m.isGroup ? await getMeta(sock, m.chat).catch(() => null) : null
    const actorRole = await C.roleOf(sock, m.sender, isOwner, meta)

    if (command === 'listseller' || command === 'premlist') {
        if (!actorRole) return reply('Daftar penjual hanya untuk penjual panel.')
        return listAll(reply, prefix)
    }

    const [role, need, adding] = MAP[command]
    if (C.rankOf(actorRole) < need) return reply(`☾ ${B('AKSES DITOLAK')}\nPerintah ini khusus ${NEED[need]}.`)

    const target = pickTargetJid(m, text)
    if (!target) return reply(`☾ ${B('FORMAT')}\n${prefix}${command} 628xxx\nAtau tag orangnya / reply pesannya.`)

    const number = await C.numberOf(sock, target, meta)
    const label = C.ROLE_LABEL[role]
    if (adding) {
        const ok = C.addRole(role, number)
        return reply(ok ? `☾ ${B('BERHASIL')}\n+${number} sekarang ${label}.` : `+${number} sudah menjadi ${label}.`)
    }
    // hapus: cocokkan semua ID (nomor + LID) milik orang itu
    const ids = await resolveIds(sock, target, meta)
    const ok = C.delRole(role, [number, ...ids])
    return reply(ok ? `☾ ${B('BERHASIL')}\n+${number} dicabut dari ${label}.` : `+${number} bukan ${label}.`)
}

handler.command = [...Object.keys(MAP), 'listseller', 'premlist']
handler.help = ['addresellerp', 'addadminp', 'addptp', 'addownp', 'listseller']
handler.tags = ['panel']

export default handler
