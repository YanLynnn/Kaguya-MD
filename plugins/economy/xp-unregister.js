import { adapt } from '../../lib/plugin-engine.js'
import { sukses, gagal, peringatan } from '../../lib/core-data.js'

let handler = async (m, { args, usedPrefix }) => {
  const user = global.db.data.users[m.sender]

  if (!user.registered) return m.reply(gagal('Kamu belum terdaftar.'))

  // minta konfirmasi dulu
  if (!args[0]) return m.reply(peringatan(`*Konfirmasi Unregister*\n\n🍡 Ketik:\n${usedPrefix}unreg yes\n\nuntuk melanjutkan.`))
  if (args[0].toLowerCase() !== 'yes') return m.reply(gagal('Unregister dibatalkan.'))

  user.registered = false
  user.name = ''
  user.age = 0

  m.reply(sukses('Unregister berhasil ✨'))
}

handler.help = ['unreg']
handler.tags = ['xp']
handler.command = /^unreg(ister)?$/i
handler.register = true

export default adapt(handler, { category: 'economy' })
