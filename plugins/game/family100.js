import { runFamily100 } from '../../lib/plugin-engine.js'

const handler = (m, ctx) => runFamily100(m, ctx)

handler.tags = ['game']
handler.command = ['family100']

export default handler
