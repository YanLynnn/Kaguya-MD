import { fetchJSON, FriendlyError, guard } from '../../lib/scraper.js'

// Pelacakan resi memakai BinderByte (https://binderbyte.com). Butuh API key gratis,
// isi di config.js:  global.binderbyteKey = 'KEY_KAMU'

const API = 'https://api.binderbyte.com/v1/track'

const COURIERS = {
    jne: 'jne', pos: 'pos', jnt: 'jnt', 'j&t': 'jnt', jt: 'jnt',
    sicepat: 'sicepat', tiki: 'tiki', anteraja: 'anteraja', wahana: 'wahana',
    ninja: 'ninja', ninjaxpress: 'ninja', lion: 'lion', lionparcel: 'lion'
}

let handler = guard(async (m, { text, reply, example }) => {
    const [first, ...rest] = String(text || '').trim().split(/\s+/)
    const courier = COURIERS[String(first || '').toLowerCase()]
    const awb = rest.join('').trim()

    if (!first || !courier || !awb) {
        return example('jne 1234567890123  (kurir: jne, pos, jnt, sicepat, tiki, anteraja, wahana, ninja, lion)')
    }

    const key = String(global.binderbyteKey || '').trim()
    if (!key) {
        return reply(
            'Fitur cekresi butuh API key gratis dari BinderByte.\n\n' +
            '1. Daftar di https://binderbyte.com dan ambil API key\n' +
            "2. Buka config.js, isi: global.binderbyteKey = 'KEY_KAMU'\n" +
            '3. Simpan (bot otomatis memuat ulang), lalu coba lagi'
        )
    }

    const json = await fetchJSON(`${API}?api_key=${encodeURIComponent(key)}&courier=${courier}&awb=${encodeURIComponent(awb)}`)
    if (Number(json?.status) !== 200 || !json?.data) {
        throw new FriendlyError(`Resi tidak ditemukan atau belum ada data.\n${json?.message ? `Pesan server: ${json.message}` : ''}`.trim())
    }

    const s = json.data.summary || {}
    const d = json.data.detail || {}
    const history = Array.isArray(json.data.history) ? json.data.history : []
    const v = (x) => (x ? String(x) : '-')

    const lines = history.slice(0, 8).map(h => `• ${v(h.date)}\n  ${v(h.desc)}${h.location ? ` (${h.location})` : ''}`)

    return reply(
        `📦 *CEK RESI*\n\n` +
        `Resi    : ${v(s.awb || awb)}\n` +
        `Kurir   : ${v(s.courier || courier.toUpperCase())}\n` +
        `Layanan : ${v(s.service)}\n` +
        `Status  : *${v(s.status)}*\n` +
        `Asal    : ${v(d.origin)}\n` +
        `Tujuan  : ${v(d.destination)}\n` +
        `Penerima: ${v(d.receiver)}` +
        (lines.length ? `\n\n*Riwayat terbaru*\n${lines.join('\n')}` : '') +
        (history.length > 8 ? `\n...dan ${history.length - 8} riwayat lainnya` : '') +
        `\n\n_Sumber: BinderByte_`
    )
})

handler.command = ['cekresi']
handler.help = ['cekresi']
handler.tags = ['tools']

export default handler
