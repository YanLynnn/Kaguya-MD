import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('susunkata', m, ctx)

handler.tags = ['game']
handler.command = ['susunkata']

export default handler
