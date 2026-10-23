import { runGachaPet } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGachaPet(m, ctx)

handler.tags = ['game']
handler.command = ['gachapet']

export default handler
