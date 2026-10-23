import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebakepep', m, ctx)

handler.tags = ['game']
handler.command = ['tebakepep']

export default handler
