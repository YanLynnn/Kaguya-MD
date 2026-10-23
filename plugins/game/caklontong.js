import { runGame } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runGame('caklontong', m, ctx)

handler.tags = ['game']
handler.command = ['caklontong']

export default handler
