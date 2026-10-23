import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakkimia', m, ctx)

handler.tags = ['game']
handler.command = ['tebakkimia']

export default handler
