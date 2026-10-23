import { dioRun, dioRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // .siapa <pertanyaan> — pilih satu anggota grup secara acak.
        const pick = (a) => a[Math.floor(Math.random() * a.length)]
        const num = (j) => String(j).split('@')[0].split(':')[0]

        module.exports = {
          name: 'siapa', alias: ['siapayang'], category: 'fun', group: true,
          desc: 'Pilih anggota grup acak untuk sebuah pertanyaan',
          run: async ({ sock, m, text, prefix, reply, groupMetadata }) => {
            if (!text) return reply(`❓ Contoh: ${prefix}siapa yang paling sering telat`)
            const ids = ((groupMetadata && groupMetadata.participants) || []).map(p => p.jid || p.id).filter(Boolean)
            if (!ids.length) return reply('❌ Daftar anggota grup tidak terbaca.')
            const w = pick(ids)
            await sock.sendMessage(m.chat, { text: `🎯 *${text.trim()}*\n\nJawabannya: @${num(w)}`, mentions: [w] }, { quoted: m })
          },
        }
    }

dioRegister("fun/tanyagrup", feature)

let handler = (m, ctx) => dioRun("fun/tanyagrup", m, ctx)

handler.command = ["siapa", "siapayang"]
handler.hide = ["siapayang"]
handler.help = ["siapa"]
handler.tags = ["fun"]
handler.group = true

export default handler
