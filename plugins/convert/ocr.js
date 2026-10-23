// .ocr  -> ubah teks di dalam gambar menjadi teks (kirim / reply foto)
import { handleApiTool } from '../../lib/scraper.js'

let handler = (m, ctx) => handleApiTool('ocr', m, ctx)

handler.command = ['ocr']
handler.help = ['ocr']
handler.tags = ['convert']

handler.limit = true

export default handler
