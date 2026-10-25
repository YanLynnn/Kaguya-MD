import { adapt } from '../../lib/plugin-engine.js'
let handler = async (m, { conn, usedPrefix }) => {
	let caption = `
🚨 Silahkan Pilih Misi Kamu:

🛵 Ojek
🚀 Roket
👮 Polisi
🚶 Rob
☠️ Hitman
🚖 Taxy

Contoh:
${usedPrefix}ojek
`.trim()
	m.reply(caption)
}
handler.help = ['misi', 'misirpg']
handler.tags = ['info']
handler.command = /^(misi(rpg)?|misirpg)$/i
handler.register = true
handler.group = true
handler.rpg = true
export default adapt(handler, { category: 'rpg' })