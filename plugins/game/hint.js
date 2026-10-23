import { runGameHint } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGameHint(m, ctx)

handler.tags = ['game']
handler.command = ['hint']

export default handler
