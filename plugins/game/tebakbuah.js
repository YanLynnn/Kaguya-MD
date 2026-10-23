import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakbuah', m, ctx)

handler.tags = ['game']
handler.command = ['tebakbuah']

export default handler
