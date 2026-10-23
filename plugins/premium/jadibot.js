import { startJadibot, stopJadibot, listJadibot, clones } from '../../lib/wa.js'
import { runtime, formatPhone } from '../../lib/core-system.js'

const normalize = (raw) => String(raw || '').replace(/\D/g, '').replace(/^0/, '62')

let handler = async (m, { sock, jid, text, command, reply, example, isOwner }) => {
    if (command === 'jadibot') {
        const number = normalize(text)
        if (!number || number.length < 8) return example('628xxxxxxxxxx')
        if (clones.has(number)) return reply(`Nomor ${formatPhone(number)} sudah punya sesi jadibot aktif.\nKetik *stopjadibot ${number}* dulu kalau mau mengulang.`)

        await reply(`Menyiapkan jadibot untuk ${formatPhone(number)}, tunggu kode pairingnya ya...`)

        try {
            await startJadibot(number, { sock, jid }, m.sender)
        } catch (e) {
            await reply(`Gagal memulai jadibot: ${e.message}`)
        }
        return
    }

    if (command === 'stopjadibot') {
        const number = normalize(text)
        if (!number) return example('628xxxxxxxxxx')

        if (!clones.has(number)) return reply('Tidak ada sesi jadibot aktif untuk nomor itu.')

        // user premium hanya boleh menghentikan sesi yang dia buat sendiri; owner boleh semua
        const session = listJadibot().find((s) => s.number === number)
        if (!isOwner && session?.requester !== m.sender) return reply('Itu bukan sesi jadibot milikmu.')

        // balas dulu, baru matikan socket: kalau command ini diterima lewat socket jadibot
        // yang sedang dihentikan, balasan tidak akan terkirim kalau socketnya sudah ditutup
        await reply(`Jadibot ${formatPhone(number)} dihentikan dan sesinya dihapus.`).catch(() => null)
        try {
            await stopJadibot(number)
        } catch (e) {
            console.error(e)
        }
        return
    }

    if (command === 'listjadibot') {
        // user premium hanya melihat sesi miliknya; owner melihat semua
        const list = listJadibot().filter((s) => isOwner || s.requester === m.sender)
        if (!list.length) return reply(isOwner ? 'Tidak ada sesi jadibot yang aktif saat ini.' : 'Kamu belum punya sesi jadibot yang aktif.')

        const lines = list.map(({ number, startedAt }, i) =>
            `${i + 1}. ${formatPhone(number)} — aktif ${runtime((Date.now() - startedAt) / 1000)}`
        )
        return reply(`*Jadibot aktif (${list.length}):*\n\n${lines.join('\n')}`)
    }
}

handler.command = ['jadibot', 'stopjadibot', 'listjadibot']
handler.tags = ['premium']
handler.premium = true
handler.owner = true

export default handler
