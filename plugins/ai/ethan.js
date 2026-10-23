import { handleApiTool } from '../../lib/scraper.js'

// Argumen kurang / foto belum dikirim -> balasan "Command salah" berisi format & contoh.
let handler = (m, ctx) => handleApiTool('ethan', m, ctx)

handler.command = ['ethan']
handler.help = ['ethan']
handler.tags = ['ai']

handler.limit = true

export default handler
