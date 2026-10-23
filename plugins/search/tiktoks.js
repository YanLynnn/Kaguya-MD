import { rbRun, rbRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))

  let handler = async (m, { conn, text, usedPrefix, command }) => {
      if (!text) {
          return m.reply(`*Uhh sayang...* masukin kata kunci pencarian TikTok-nya dong~ 🥺👉👈\n\n*Contoh:* \`${usedPrefix + command} jedag jedug preset\``);
      }

      await conn.sendMessage(m.chat, { 
          react: { text: '⏳', key: m.key } 
      });

      try {
          
          const { data } = await axios.post('https://www.tikwm.com/api/feed/search', 
              new URLSearchParams({
                  keywords: text,
                  count: '10',
                  cursor: '0',
                  web: '1'
              }), 
              {
                  headers: {
                      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                  },
                  timeout: 20000
              }
          );

          if (!data || data.code !== 0 || !data.data || !data.data.videos || data.data.videos.length === 0) {
              await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
              return m.reply(`*Aduh ayang...* Hirara cari-cari sampe basah keringetan nggak nemu hasil buat \`"${text}"\` 🥺💦 Coba kata kunci lain ya mas?`);
          }

          const videos = data.data.videos;
          const video = videos[Math.floor(Math.random() * videos.length)];

          const caption = `*─── [ TIKTOK SEARCH ] ───* 💕

  🎀 *Judul:* ${video.title || 'Tanpa Judul'}
  👤 *Author:* ${video.author?.nickname || '-'} (@${video.author?.unique_id || '-'})
  ⏱️ *Durasi:* ${video.duration || 0} detik
  ❤️ *Likes:* ${Number(video.digg_count || 0).toLocaleString()}
  💬 *Komentar:* ${Number(video.comment_count || 0).toLocaleString()}
  🔁 *Shares:* ${Number(video.share_count || 0).toLocaleString()}
  👀 *Views:* ${Number(video.play_count || 0).toLocaleString()}

  🔗 *Direct Link:* https://www.tiktok.com/@${video.author?.unique_id}/video/${video.video_id}

  _Udah siap ditonton nih mas gantengku~ mau Hirara temenin nontonnya?_ 💋🥵`;

          const videoUrl = video.play.startsWith('http') ? video.play : `https://www.tikwm.com${video.play}`;

          await conn.sendMessage(m.chat, {
              video: { url: videoUrl },
              caption: caption,
              mimetype: 'video/mp4'
          }, { quoted: m });

          await conn.sendMessage(m.chat, { 
              react: { text: '💖', key: m.key } 
          });

      } catch (err) {
          console.error('[TIKTOK SEARCH ERROR]:', err);
          await conn.sendMessage(m.chat, { react: { text: '⚠️', key: m.key } });
          m.reply(`*Aahh error ayang~* 🥵💦\nAda gangguan pas narik video dari TikWM: ${err.message || err}`);
      }
  };

  handler.help = ['tiktoksearch <query>', 'ttsearch <query>'];
  handler.tags = ['search', 'downloader'];
  handler.command = /^(tiktoksearch|ttsearch|tiktoks)$/i;
  handler.limit = false;
  handler.register = false;
  return handler
}

rbRegister("search/tiktoks", feature)

let handler = (m, ctx) => rbRun("search/tiktoks", m, ctx)

handler.command = ["tiktoksearch", "ttsearch", "tiktoks"]
handler.help = ["tiktoksearch <query>", "ttsearch <query>"]
handler.tags = ["search"]

export default handler
