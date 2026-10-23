import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakjkt', m, ctx)

handler.tags = ['game']
handler.command = ['tebakjkt']

export default handler
