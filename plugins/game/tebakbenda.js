import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakbenda', m, ctx)

handler.tags = ['game']
handler.command = ['tebakbenda']

export default handler
