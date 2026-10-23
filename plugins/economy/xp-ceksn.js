import { adapt } from '../../lib/plugin-engine.js'
import { kartu } from '../../lib/core-data.js'
import { createHash } from 'crypto'

let handler = async (m) => {
  const sn = createHash('md5').update(m.sender).digest('hex')
  m.reply(kartu('Serial Number', [['SN', sn]], 'Simpan baik-baik, jangan dikasih ke orang lain!'))
}

handler.help = ['ceksn']
handler.tags = ['xp']
handler.command = /^ceksn$/i
handler.register = true

export default adapt(handler, { category: 'economy' })
