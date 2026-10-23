// .fitur  -> status semua fitur tambahan (diatur di config.js -> global.fitur). Khusus owner.
import { statusFitur, startFitur } from '../../lib/plugin-features.js'

startFitur()

let handler = async (m, { reply }) => {
    return reply(`⚙️ *STATUS FITUR* (edit di config.js → global.fitur)\n\n${statusFitur()}\n\nPengaturan di config.js berlaku otomatis tanpa restart.`)
}

handler.help = ['fitur']
handler.tags = ['owner']
handler.command = ['fitur', 'statusfitur']
handler.owner = true

export default handler
