/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* Feature: Thanks To
* Type: Plugins | ESM Modules
* Copyright © YannRzy Tech 2026
  */

const handler = async (m, { sock, jid }) => {
const text = `
╭━━━〔 🍓 *THANKS TO* 🍰 〕━━━╮
│
│ 🤖 ${global.namebot || 'Kaguya'}
│
│ 🌷 *Special Thanks*
│
│ 💖 *YannRzy Tech*
│    Creator & Developer
│
│
│ 🎀 *ZansPiw*
│     Friend & Support
│
│
│ 🌸 *Zass Desuta*
│     Big Thanks
│
│
│ 🧸 *Baileys*
│    WhatsApp Connection Library
│
│ 🍡 *All Contributors*
│    For ideas, support, and inspiration
│
│ 💕 *All Users*
│    Thank you for using ${global.namebot || 'Kaguya'}!
│
╰━━━━━━━━━━━━━━━━━━━━━━╯

૮꒰ ˶• ༝ •˶꒱ა
*Thank you for being part of ${global.namebot || 'Kaguya'}! ♡*
`.trim()

return sock.sendMessage(jid, { text }, { quoted: m })

}

handler.help = ['tqto']
handler.tags = ['main']
handler.command = ['tqto', 'thanksto', 'thanks']

export default handler