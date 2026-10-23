import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('tebaksurah', m, ctx)

handler.tags = ['game']
handler.command = ['tebaksurah']

export default handler
