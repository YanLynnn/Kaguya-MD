import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('imagetoprompt', m, ctx)

handler.command = ['imagetoprompt']
handler.help = ['imagetoprompt']
handler.tags = ['ai']

handler.limit = true

export default handler
