import { rbRun, rbRegister } from '../../lib/plugin-engine.js'
import FormData from 'form-data'
import fetch from 'node-fetch'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  async function uploadUguu(buffer) {
    try {
      const fd = new FormData()
      fd.append('files[]', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg')
      const res = await fetch('https://uguu.se/upload', {
        method: 'POST',
        body: fd
      })
      const json = await res.json()
      return json?.files?.[0]?.url || null
    } catch {
      return null
    }
  }

  let handler = async (m, { conn, sock, usedPrefix, command }) => {
    const client = conn || sock
    const quoted = m.quoted ? m.quoted : m
    const mime = quoted.mimetype || ''

    if (!mime.startsWith('image/')) {
      return m.reply(`Kirim atau balas (reply) gambar dengan caption *${usedPrefix + command}*`)
    }

    await m.reply('Sedang memproses gambar dengan AI...')

    try {
      const buffer = typeof quoted.download === 'function' ? await quoted.download() : await m.download()
      if (!buffer) return m.reply('Gagal mengunduh gambar.')

      const imageUrl = await uploadUguu(buffer)
      if (!imageUrl) return m.reply('Gagal mengunggah gambar.')

      const apiUrl = `https://api-faa.my.id/faa/${command}?url=${encodeURIComponent(imageUrl)}`
      const res = await fetch(apiUrl)

      if (!res.ok) return m.reply(`API error: ${res.status} ${res.statusText}`)

      const resultBuffer = Buffer.from(await res.arrayBuffer())

      await client.sendMessage(
        m.chat,
        {
          image: resultBuffer,
          caption: `Berhasil mengubah ke *${command}* ✨`
        },
        { quoted: m.raw || (typeof sock.getFakeQuoted === 'function' ? sock.getFakeQuoted() : undefined) }
      )
    } catch (err) {
      return m.reply(`Terjadi kesalahan: ${err.message || err}`)
    }
  }

  handler.command = ['tobotak']
  handler.owner = false
  handler.premium = false
  handler.group = false
  handler.private = false
  handler.admin = false
  handler.botadmin = false
  handler.noJadiBot = false
  return handler
}

rbRegister("ai-image/tojepang", feature)

let handler = (m, ctx) => rbRun("ai-image/tojepang", m, ctx)

handler.command = ["tojepang"]
handler.tags = ["ai-image"]

handler.limit = true

export default handler
