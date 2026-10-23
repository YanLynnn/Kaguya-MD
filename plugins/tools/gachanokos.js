import { rbRun, rbRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))
  const { getJamPercentage, checkMetaBusiness } = (await rbLib('cekbio'))

  const BASE_URL = 'https://smsku.zelapi.eu.cc/api';
  const activePolls = new Map();

  async function pollOtp(sock, chatJid, numClean, maxMinutes = 3) {
    if (activePolls.has(numClean)) {
      clearInterval(activePolls.get(numClean));
    }

    const startTime = Date.now();
    const maxTime = maxMinutes * 60 * 1000;

    const intervalId = setInterval(async () => {
      try {
        if (Date.now() - startTime > maxTime) {
          clearInterval(intervalId);
          activePolls.delete(numClean);
          await sock.sendMessage(chatJid, {
            text: `⏱️ *WAKTU OTP HABIS*\n\n📞 Nomor: +${numClean}\nWaktu tunggu 3 menit telah berakhir. OTP belum diterima.`
          });
          return;
        }

        const { data } = await axios.get(`${BASE_URL}/latest_otp`, {
          params: { number: numClean },
          timeout: 10000
        });

        if (data && data.success && data.has_otp && data.otp_code) {
          clearInterval(intervalId);
          activePolls.delete(numClean);
          await sock.sendMessage(chatJid, {
            text: `🎉 *KODE OTP MASUK OTOMATIS!*\n\n` +
                  `📞 *Nomor:* +${numClean}\n` +
                  `🔑 *Kode OTP:* \`${data.otp_code}\`\n\n` +
                  `💡 Segera gunakan kode OTP ini!`
          });
        }
      } catch (e) {}
    }, 5000);

    activePolls.set(numClean, intervalId);
  }

  const handler = async (m, { sock, text, args, command, reply }) => {
    const cmd = command.toLowerCase();

    try {
      if (cmd === 'gachanokos' || cmd === 'gachanokoswa') {
        let countryInput = text ? text.trim() : '';
        let count = 3;

        if (args && args.length > 0) {
          const lastArgNum = parseInt(args[args.length - 1]);
          if (!isNaN(lastArgNum) && lastArgNum > 0) {
            count = Math.min(10, Math.max(1, lastArgNum));
            countryInput = args.slice(0, -1).join(' ').trim();
          }
        }

        let targetCountries = [];
        try {
          const cRes = await axios.get(`${BASE_URL}/countries?service=WhatsApp`, { timeout: 10000 });
          if (cRes.data && cRes.data.success && Array.isArray(cRes.data.countries)) {
            targetCountries = cRes.data.countries;
          }
        } catch (e) {}

        const results = [];
        for (let i = 0; i < count; i++) {
          try {
            let selectedCountry = countryInput;
            if (!selectedCountry && targetCountries.length > 0) {
              const randomC = targetCountries[Math.floor(Math.random() * targetCountries.length)];
              selectedCountry = randomC.name || randomC.code || 'TG';
            }
            if (!selectedCountry) selectedCountry = 'TG';

            let reqPayload = { service: 'WhatsApp', country: selectedCountry };
            let res = await axios.post(`${BASE_URL}/request_number`, reqPayload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 20000
            });

            let data = res.data;
            if ((!data || !data.success || !data.number) && targetCountries.length > 0) {
              for (const cItem of targetCountries) {
                const fallbackC = cItem.name || cItem.code;
                try {
                  const fbRes = await axios.post(`${BASE_URL}/request_number`, {
                    service: 'WhatsApp',
                    country: fallbackC
                  }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15000
                  });
                  if (fbRes.data && fbRes.data.success && fbRes.data.number) {
                    data = fbRes.data;
                    selectedCountry = fallbackC;
                    break;
                  }
                } catch (_) {}
              }
            }

            if (data && data.success && data.number) {
              const numClean = data.number.replace(/\D/g, '');
              let isRegistered = false;
              let bioText = "";
              let setAt = null;
              let metaBusiness = false;

              try {
                const jid = numClean + '@s.whatsapp.net';
                const [waCheck] = await sock.onWhatsApp(jid);
                if (waCheck && waCheck.exists) {
                  isRegistered = true;
                  try {
                    const statusResult = await sock.fetchStatus(jid);
                    let rawStatus = Array.isArray(statusResult) ? statusResult[0]?.status || statusResult[0] : statusResult?.status || statusResult;
                    if (rawStatus && typeof rawStatus === 'object') {
                      bioText = rawStatus.status !== undefined ? String(rawStatus.status) : (rawStatus.text !== undefined ? String(rawStatus.text) : "");
                      if (rawStatus.setAt) setAt = new Date(rawStatus.setAt);
                    } else if (typeof rawStatus === 'string') {
                      bioText = rawStatus;
                    }
                  } catch (_) {}

                  try {
                    const busCheck = await checkMetaBusiness(sock, jid);
                    metaBusiness = busCheck.isBusiness;
                  } catch (_) {}
                }
              } catch (_) {}

              const jamPct = getJamPercentage(bioText, setAt, metaBusiness);

              results.push({
                number: numClean,
                registered: isRegistered,
                bio: bioText,
                setAt: setAt,
                metaBusiness: metaBusiness,
                jamPercentage: jamPct,
                country: data.country || selectedCountry
              });

              pollOtp(sock, m.chat, numClean);
            }
          } catch (err) {
            console.error(`ɢᴀɢᴀʟ request nomor ke-${i + 1}:`, err.message);
          }
          if (i < count - 1) {
            await new Promise(r => setTimeout(r, 500));
          }
        }

        if (results.length === 0) {
          throw new Error('Nomor pada server ZELAPI saat ini sedang habis.');
        }

        let resText = `🎉 *GACHA NOKOS & CEK BIO (${results.length})*\n\n`;
        const buttons = [];

        results.forEach((item, idx) => {
          const regStatus = item.registered ? '✅ Terdaftar' : '❌ Belum Terdaftar';
          const bioInfo = item.bio ? `"${item.bio}"` : 'Tanpa Bio';
          const busInfo = item.metaBusiness ? ' MetaBiz' : '';

          resText += `*${idx + 1}.* \`+${item.number}\`\n`;
          resText += `   └ ${regStatus} | 📝 ${bioInfo}${busInfo}\n`;
          resText += `   └ 📮 ${item.jamPercentage}% Anti-Jam\n\n`;

          buttons.push({
            type: 'copy',
            code: item.number,
            text: `📋 Salin #${idx + 1}`
          });
        });

        buttons.push({
          type: 'reply',
          text: '🔄 Ganti Nomor (Gacha Lagi)',
          id: `.gachanokos ${countryInput || ''} ${results.length}`
        });

        buttons.push({
          type: 'reply',
          text: '🌍 Ganti Negara',
          id: `.statzelapi`
        });

        if (typeof sock.sendButtons === 'function') {
          return await sock.sendButtons(m.chat, {
            text: resText.trim(),
            footer: '📌 Auto OTP aktif 3 menit',
            buttons: buttons
          }, { quoted: m });
        } else {
          return reply(resText.trim());
        }
      }

      if (cmd === 'cekotp') {
        if (!text) {
          return reply('❌ Masukkan nomor!\n*ᴄᴏɴᴛᴏʜ:* `.cekotp 6288269202428`');
        }
        const numClean = text.replace(/\D/g, '');
        await reply(`🔍 Memeriksa OTP untuk nomor +${numClean}...`);

        const { data } = await axios.get(`${BASE_URL}/latest_otp`, {
          params: { number: numClean },
          timeout: 15000
        });

        if (!data || !data.success) {
          throw new Error(data?.error || 'ɢᴀɢᴀʟ memeriksa OTP.');
        }

        if (data.has_otp && data.otp_code) {
          if (activePolls.has(numClean)) {
            clearInterval(activePolls.get(numClean));
            activePolls.delete(numClean);
          }
          return reply(
            `📩 *OTP DITERIMA!*\n\n` +
            `📞 *Nomor:* +${numClean}\n` +
            `🔑 *Kode OTP:* \`${data.otp_code}\`\n` +
            `🕒 *Waktu:* Baru saja`
          );
        } else {
          return reply(
            `⏳ *BELUM ADA OTP*\n\n` +
            `📞 *Nomor:* +${numClean}\n` +
            `ℹ️ Kode OTP belum masuk. Bot masih memantau OTP secara otomatis.`
          );
        }
      }

      if (cmd === 'lepasnokos' || cmd === 'releasenokos') {
        if (!text) {
          return reply('❌ Masukkan nomor yang akan dilepas!\n*ᴄᴏɴᴛᴏʜ:* `.lepasnokos 6288269202428`');
        }
        const numClean = text.replace(/\D/g, '');
        if (activePolls.has(numClean)) {
          clearInterval(activePolls.get(numClean));
          activePolls.delete(numClean);
        }
        await reply(`⏳ Melepaskan nomor +${numClean}...`);

        const { data } = await axios.post(`${BASE_URL}/release_number`, {
          number: numClean
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        });

        if (data && data.success) {
          return reply(`✅ Nomor +${numClean} berhasil dilepaskan.`);
        } else {
          throw new Error(data?.error || 'ɢᴀɢᴀʟ melepaskan nomor.');
        }
      }

      if (cmd === 'listnokoszel' || cmd === 'mynokos') {
        await reply('⏳ Mengambil daftar nomor aktif...');
        const { data } = await axios.get(`${BASE_URL}/my_numbers`, { timeout: 15000 });

        if (!data || !data.success) {
          throw new Error(data?.error || 'ɢᴀɢᴀʟ mengambil data.');
        }

        const numbers = data.numbers || [];
        if (numbers.length === 0) {
          return reply('📋 Tidak ada nomor aktif saat ini.');
        }

        let txt = `📋 *DAFTAR NOMOR AKTIF ZELAPI (${numbers.length})*\n\n`;
        numbers.forEach((item, idx) => {
          txt += `${idx + 1}. \`+${String(item.number || item).replace(/\D/g, '')}\` (ID: ${item.id || '-'})\n`;
        });
        return reply(txt);
      }

      if (cmd === 'statnokos' || cmd === 'statzelapi') {
        await reply('⏳ Mengambil statistik ZELAPI...');
        const { data } = await axios.get(`${BASE_URL}/stats/detailed?period=daily`, { timeout: 15000 });

        return reply(
          `📊 *STATISTIK NOKOS ZELAPI*\n\n` +
          `📲 *Total Nomor Tersedia:* ${data.available_numbers || 0}\n` +
          `📩 *Total OTP Diterima:* ${data.otp_count || 0}\n` +
          `🌍 *Jumlah 🏳️ *ɴᴇɢᴀʀᴀ:** ${data.countries_count || 0}\n` +
          `📦 *Jumlah Layanan:* ${data.services_count || 0}`
        );
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Terjadi kesalahan sistem.';
      return reply(`❌ *Error:* ${errorMsg}`);
    }
  };

  handler.help = ['gachanokos [negara] [jumlah]', 'cekotp <nomor>', 'lepasnokos <nomor>', 'listnokoszel', 'statnokos'];
  handler.tags = ['tools', 'gacha'];
  handler.command = ['gachanokos','cekotp','releasenokos'];
  handler.limit = true;
  return handler
}

rbRegister("tools/gachanokos", feature)

let handler = (m, ctx) => rbRun("tools/gachanokos", m, ctx)

handler.command = ["gachanokos", "cekotp", "releasenokos"]
handler.help = ["gachanokos [negara] [jumlah]", "cekotp <nomor>", "lepasnokos <nomor>", "listnokoszel", "statnokos"]
handler.tags = ["tools"]

export default handler
