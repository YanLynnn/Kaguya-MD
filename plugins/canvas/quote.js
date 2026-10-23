/**

* YannRzy Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */


// ───────── quote ─────────
// Gabungan plugin canvas: buatquotes, iqc, iqc2, iqcpink, ttqc, tiktokchat
// Port dari RIMURU-MD. Pesan keluar memakai sock.sendMessage / m.reply bawaan WhatsApp (tanpa tombol / kartu custom).

import axios from 'axios'
import fs from 'fs'
import https from 'https'
import http from 'http'
import FormData from 'form-data'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { te, wrapPlugin, mergePlugins } from '../../lib/plugin-engine.js'

// ── buatquotes ──
const _buatquotes = (() => {
const pluginConfig = {
    name: 'buatquotes',
    alias: [],
    category: 'canvas',
    description: 'Membuat gambar quote bertema anime secara custom.',
    usage: '.buatquotes [id background] | <teks> | [nama pembuat]',
    example: '.buatquotes 2 | Tetaplah hidup walaupun tidak berguna | Maman',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true
};

const FONT_QUOTE = {
  family: 'arialn',
  url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Font/ARIALN.ttf',
  localName: 'ARIALN.ttf'
};

const FONT_USERNAME = {
  family: 'Inter',
  url: 'https://github.com/rsms/inter/raw/refs/heads/master/docs/font-files/Inter-Medium.woff2',
  localName: 'Inter-Medium.woff2'
};

const BACKGROUNDS = {
  1: {
    name: 'l',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/qca/L.png',
    textZone: { x: 775, y: 56, w: 456, h: 1102 },
    usernameZone: { x: 890, y: 1167, w: 228, h: 50 },
    usernameFontSize: 28
  },
  2: {
    name: 'gojo',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/qca/gok.png',
    textZone: { x: 755, y: 68, w: 466, h: 1027 },
    usernameZone: { x: 863, y: 1108, w: 249, h: 50 },
    usernameFontSize: 28
  },
  3: {
    name: 'yuji',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/qca/cc.png',
    textZone: { x: 35, y: 68, w: 466, h: 1027 },
    usernameZone: { x: 133, y: 1108, w: 249, h: 50 },
    usernameFontSize: 28
  },
  4: {
    name: 'denji',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/qca/denji.png',
    textZone: { x: 655, y: 68, w: 512, h: 1083 },
    usernameZone: { x: 795, y: 1152, w: 249, h: 50 },
    usernameFontSize: 28
  },
  5: {
    name: 'thorfin',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/qca/thorfin.png',
    textZone: { x: 65, y: 54, w: 489, h: 992 },
    usernameZone: { x: 162, y: 1042, w: 249, h: 50 },
    usernameFontSize: 28
  },
  6: {
    name: 'naruto',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/qca/Naruto.png',
    textZone: { x: 40, y: 56, w: 481, h: 1065 },
    usernameZone: { x: 170, y: 1126, w: 228, h: 50 },
    usernameFontSize: 28
  },
  7: {
    name: 'light',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/qca/LIghtyagami.png',
    textZone: { x: 38, y: 56, w: 493, h: 941 },
    usernameZone: { x: 170, y: 1025, w: 228, h: 50 },
    usernameFontSize: 28
  },
  8: {
    name: 'higuruma',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/qca/higuruma.png',
    textZone: { x: 755, y: 68, w: 424, h: 920 },
    usernameZone: { x: 840, y: 993, w: 249, h: 50 },
    usernameFontSize: 28
  }
};

const TEXT_STYLE = {
  fontWeight: 400,
  fontFamily: 'arialn, sans-serif',
  color: '#111111',
  align: 'justify',
  initialSize: 75,
  minFontSize: 24
};

const USERNAME_STYLE = {
  fontWeight: 500,
  fontFamily: 'Inter, sans-serif',
  color: '#121212',
  align: 'left',
  gap: 40
};

const CANVAS_SIZE = { width: 1254, height: 1254 };

let fontsLoaded = false;
const bgCache = new Map();

async function download(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    }
  });
  if (!res.ok) throw new Error(`Gagal download ${url}: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function setupEnv(bg) {
  let bgBuffer = bgCache.get(bg.name);
  if (!bgBuffer) {
    bgBuffer = await download(bg.url);
    bgCache.set(bg.name, bgBuffer);
  }

  if (!fontsLoaded) {
    GlobalFonts.register(await download(FONT_QUOTE.url), FONT_QUOTE.family);
    GlobalFonts.register(await download(FONT_USERNAME.url), FONT_USERNAME.family);
    fontsLoaded = true;
  }

  return bgBuffer;
}

function wrapText(ctx, text, maxWidth) {
  const out = [];
  text.split('\n').forEach(p => {
    let cur = '';
    p.split(' ').forEach(w => {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxWidth && cur) { out.push(cur); cur = w; }
      else cur = t;
    });
    out.push(cur);
  });
  return out;
}

function fitTextInZone(ctx, text, zone, opts) {
  const { fontWeight, fontFamily, initialSize, minSize = 10, step = 2 } = opts;
  let fontSize = initialSize;
  let lines, lh;

  while (fontSize >= minSize) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    lines = wrapText(ctx, text, zone.w);
    lh = fontSize * 1.2;
    if (lines.length * lh <= zone.h) break;
    fontSize -= step;
  }
  if (fontSize < minSize) {
    fontSize = minSize;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    lines = wrapText(ctx, text, zone.w);
    lh = fontSize * 1.2;
  }
  return { fontSize, lines, lh };
}

function drawJustifiedLine(ctx, line, x, y, targetWidth) {
  const words = line.split(' ');
  if (words.length === 1) {
    ctx.textAlign = 'center';
    ctx.fillText(line, x + targetWidth / 2, y);
    return;
  }
  const wordWidths = words.map(w => ctx.measureText(w).width);
  const totalWordsWidth = wordWidths.reduce((a, b) => a + b, 0);
  const spaceWidth = (targetWidth - totalWordsWidth) / (words.length - 1);

  ctx.textAlign = 'left';
  let cx = x;
  words.forEach((w, i) => {
    ctx.fillText(w, cx, y);
    cx += wordWidths[i] + spaceWidth;
  });
}

function drawQuoteText(ctx, text, zone, opts) {
  const { fontSize, lines, lh } = fitTextInZone(ctx, text, zone, opts);
  ctx.font = `${opts.fontWeight} ${fontSize}px ${opts.fontFamily}`;

  ctx.save();
  ctx.beginPath();
  ctx.rect(zone.x, zone.y, zone.w, zone.h);
  ctx.clip();
  const startY = zone.y + zone.h / 2 - (lines.length * lh) / 2 + lh / 2;

  if (opts.align === 'justify') {
    lines.forEach((l, i) => {
      const y = startY + i * lh;
      const isLastLine = i === lines.length - 1;
      if (isLastLine) {
        ctx.textAlign = 'center';
        ctx.fillText(l, zone.x + zone.w / 2, y);
      } else {
        drawJustifiedLine(ctx, l, zone.x, y, zone.w);
      }
    });
  } else {
    const drawX = opts.align === 'center' ? zone.x + zone.w / 2 : opts.align === 'right' ? zone.x + zone.w : zone.x;
    ctx.textAlign = opts.align;
    lines.forEach((l, i) => ctx.fillText(l, drawX, startY + i * lh));
  }
  ctx.restore();

  return startY + (lines.length - 1) * lh + lh / 2;
}

function drawUsernameText(ctx, text, x, y, opts, fontSize, maxWidth) {
  ctx.font = `${opts.fontWeight} ${fontSize}px ${opts.fontFamily}`;
  ctx.textAlign = 'center';
  const lh = fontSize * 1.2;
  const lines = wrapText(ctx, text, maxWidth);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
}

async function drawScene(bgId, quoteText, usernameStr, outFile) {
  const bg = BACKGROUNDS[bgId];
  if (!bg) throw new Error(`Background nomor ${bgId} tidak ditemukan`);

  const bgBuffer = await setupEnv(bg);

  const canvas = createCanvas(CANVAS_SIZE.width, CANVAS_SIZE.height);
  const ctx = canvas.getContext('2d');

  const bgImg = await loadImage(bgBuffer);
  ctx.drawImage(bgImg, 0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);

  ctx.save();
  ctx.fillStyle = TEXT_STYLE.color;
  ctx.textBaseline = 'middle';
  const quoteEndY = drawQuoteText(ctx, `"${quoteText}"`, bg.textZone, TEXT_STYLE);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = USERNAME_STYLE.color;
  ctx.textBaseline = 'middle';
  const usernameX = bg.textZone.x + bg.textZone.w / 2;
  const usernameY = quoteEndY + USERNAME_STYLE.gap;
  drawUsernameText(ctx, usernameStr, usernameX, usernameY, USERNAME_STYLE, bg.usernameFontSize, bg.textZone.w);
  ctx.restore();

  const pngData = await canvas.encode('png');
  await writeFile(outFile, pngData);
  return outFile;
}

async function handler(m, { sock, text }) {
    if (!text) {
        return m.reply(
            `🎨 *FITUR BUAT QUOTES ANIME*\n\n` +
            `Fitur ini akan membantumu merangkai kata-kata mutiara dengan latar belakang karakter anime favorit yang sangat keren!\n\n` +
            `*CARA PENGGUNAAN:*\n` +
            `- \`${m.prefix}buatquotes <teks>\`\n` +
            `- \`${m.prefix}buatquotes <id_background> | <teks>\`\n` +
            `- \`${m.prefix}buatquotes <id_background> | <teks> | <namamu>\`\n\n` +
            `*DAFTAR BACKGROUND PENDUKUNG (ID 1-8):*\n` +
            `- 1: L (Death Note)\n` +
            `- 2: Gojo Satoru\n` +
            `- 3: Yuji Itadori\n` +
            `- 4: Denji (Chainsaw Man)\n` +
            `- 5: Thorfinn\n` +
            `- 6: Naruto\n` +
            `- 7: Light Yagami\n` +
            `- 8: Higuruma\n\n` +
            `_Contoh: ${m.prefix}buatquotes 2 | Tetaplah hidup walaupun tidak berguna | Maman_`
        );
    }

    try {
        await m.react('🕕');

        let bgId = null;
        let qText = "";
        let qName = "";

        const parts = text.split('|').map(v => v.trim());
        if (parts.length >= 3) {
            bgId = parseInt(parts[0]);
            qText = parts[1];
            qName = parts[2];
        } else if (parts.length === 2) {
            if (!isNaN(parseInt(parts[0])) && BACKGROUNDS[parseInt(parts[0])]) {
                bgId = parseInt(parts[0]);
                qText = parts[1];
            } else {
                qText = parts[0];
                qName = parts[1];
            }
        } else {
            qText = text;
        }

        if (!bgId || !BACKGROUNDS[bgId]) {
            bgId = Math.floor(Math.random() * 8) + 1;
        }
        
        let finalName = qName || m.pushName || 'Someone';
        if (!finalName.startsWith('-')) {
            finalName = '- ' + finalName;
        }

        const tempDir = join(process.cwd(), 'temp');
        if (!existsSync(tempDir)) await mkdir(tempDir, { recursive: true });
        
        const outPath = join(tempDir, `quoteanime_${Date.now()}.png`);
        
        await drawScene(bgId, qText, finalName, outPath);

        await sock.sendMessage(m.chat, { image: { url: outPath } }, { quoted: m });

        if (existsSync(outPath)) unlinkSync(outPath);
        await m.react('✅');

    } catch (e) {
        bgCache.clear();
        fontsLoaded = false;
        console.error(e);
        await m.react('❌');
        m.reply(`❌ *GAGAL MEMBUAT QUOTE*\n\nMaaf, sistem mengalami gangguan saat mencoba membuat gambar quote. Silakan coba lagi nanti.`);
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── iqc ──
const _iqc = (() => {
const pluginConfig = {
    name: "iqc",
    alias: [],
    category: "canvas",
    description: "Membuat Fake Quote iOS style secara instan.",
    usage: ".iqc [text/reply]",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true,
};

async function handler(m, { sock, text }) {
    try {
        const targetText = text || (m.quoted && m.quoted.text ? m.quoted.text : "");
        
        if (!targetText) {
            let help = `💬 *FITUR FAKE QUOTE iOS*\n\n`
            help += `Fitur ini digunakan untuk membuat gambar quote elegan bergaya iOS dengan sangat cepat.\n\n`
            help += `*Cara Penggunaan:*\n`
            help += `- Ketik *${m.prefix}iqc <teks kamu>*\n`
            help += `- Atau kamu bisa membalas (reply) pesan teks orang lain dengan perintah *${m.prefix}iqc*\n\n`
            help += `_Pesan tersebut akan secara otomatis diubah menjadi quote keren!_`
            return m.reply(help)
        }

        await m.react('🕕');

        const apiUrl = `https://my.izuka-api.xyz/api/canvas/iqc?text=${encodeURIComponent(targetText)}`
        
        await sock.sendMessage(m.chat, { image: { url: apiUrl } }, { quoted: m });
        
        await m.react('✅');

    } catch (error) {
        console.error("[IQC Plugin Error]", error)
        await m.react('❌')
        m.reply(`Maaf, terjadi kesalahan saat mencoba membuat gambar quote. Silakan coba lagi beberapa saat.`)
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── iqc2 ──
const _iqc2 = (() => {
const pluginConfig = {
    name: "iqc2",
    alias: [],
    category: "canvas",
    description: "Membuat Fake Quote iOS style dengan informasi baterai dan provider.",
    usage: ".iqc2 [text/reply]",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true,
};

async function handler(m, { sock, text }) {
    try {
        const targetText = text || (m.quoted && m.quoted.text ? m.quoted.text : "");
        
        if (!targetText) {
            return m.reply(
                `Halo *${m.pushName}*, sepertinya kamu belum memasukkan teksnya.\n\n` +
                `Silakan gunakan perintah dengan format:\n` +
                `- .iqc2 <teks kamu>\n` +
                `- Atau balas (reply) pesan orang lain dengan .iqc2`
            );
        }

        await m.react('🕕');

        const providers = ["INDOSAT", "TELKOMSEL", "XL", "TRI", "SMARTFREN", "WIFI"];
        const randomProvider = providers[Math.floor(Math.random() * providers.length)];
        
        const now = new Date();
        const jam = now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).replace('.', ':');
        
        const randomBaterai = Math.floor(Math.random() * (100 - 10 + 1)) + 10; // 10-100

        const apiUrl = `https://api.nexray.eu.cc/maker/v1/iqc?text=${encodeURIComponent(targetText)}&provider=${encodeURIComponent(randomProvider)}&jam=${encodeURIComponent(jam)}&baterai=${randomBaterai}`;
        
        await sock.sendMessage(m.chat, { image: { url: apiUrl } }, { quoted: m });
        
        await m.react('✅');

    } catch (error) {
        console.error("[IQC2 Plugin Error]", error);
        await m.react('❌');
        m.reply(`Maaf *${m.pushName}*, terjadi kesalahan saat mencoba membuat gambar quote. Silakan coba lagi beberapa saat.`);
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── iqcpink ──
const _iqcpink = (() => {
const __dirname = dirname(fileURLToPath(import.meta.url));

const pluginConfig = {
    name: "iqcpink",
    alias: [],
    category: "canvas",
    description: "Membuat Fake Quote iOS style versi pink.",
    usage: ".iqcpink [text/reply]",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true,
};

let fontsLoaded = false;
const BG_URL   = "https://files.catbox.moe/2fsv03.png";
let bgImgBuffer = null;

const INTER_FONTS = [
    { url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2', file: 'Inter-Regular.ttf' },
    { url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2', file: 'Inter-Medium.ttf'  },
    { url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2', file: 'Inter-SemiBold.ttf' },
];

const APPLE_EMOJI_JSON_URL   = 'https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json';

const BG_W = 906;
const BG_H = 1736;
const SX = BG_W / 1080;
const SY = BG_H / 2280;

const state = {
    text: "Kesendirian adalah teman terbaik ku😂😂",
    time: "22.54",
    bubbleColor:  "#ffc5d5", 
    textColor:    "#111111",
    timeColor:    "#5e4146", 
    tickColor:    "#8c1d2c",
    fontSize:     Math.round(45  * SX), 
    bubbleWidth:  Math.round(746 * SX),
    showReaction: true,
    emojiSize:    Math.round(90  * SX),
    emojiSpacing: Math.round(110 * SX),
    emojiXOffset: Math.round(15  * SX),
    emojiYOffset: -15,
    reactionScale: 1.0,
    emojis: ["👍", "❤️", "😂", "😮", "😢", "🙏"],
    offsetX: 20,
    offsetY: 0,
};

let appleEmojiMap = null;

async function downloadFile(url) {
    const axios = (await import('axios')).default;
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        maxRedirects: 5,
    });
    return Buffer.from(res.data);
}

function emojiToUnicode(emoji) {
    return [...emoji].map(c => c.codePointAt(0).toString(16)).join('-');
}

async function loadAppleEmojiMap() {
    if (appleEmojiMap) return appleEmojiMap;
    const buf = await downloadFile(APPLE_EMOJI_JSON_URL);
    appleEmojiMap = JSON.parse(buf.toString('utf-8'));
    return appleEmojiMap;
}

async function drawAppleEmoji(ctx, emoji, x, y, size) {
    const map = await loadAppleEmojiMap();
    const base = emojiToUnicode(emoji);
    const variants = [
        base,
        base.replace(/-fe0f/g, ''),
        base.toUpperCase(),
        base.replace(/-fe0f/g, '').toUpperCase(),
    ];
    let b64 = null;
    for (const v of variants) {
        if (map[v]) { b64 = map[v]; break; }
    }
    if (!b64) {
        ctx.fillText(emoji, x, y);
        return;
    }
    const buf = Buffer.from(b64, 'base64');
    const img = await loadImage(buf);
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
}

async function ensureAssets() {
    if (!fontsLoaded) {
        for (const f of INTER_FONTS) {
            const buf = await downloadFile(f.url);
            GlobalFonts.register(buf, 'Inter');
        }
        fontsLoaded = true;
    }

    await loadAppleEmojiMap();

    if (!bgImgBuffer) {
        bgImgBuffer = await downloadFile(BG_URL);
    }
}

function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function measureTextCustom(ctx, text, fontSize) {
    const parts = text.split(/(\p{Extended_Pictographic})/gu);
    let totalWidth = 0;
    for (const part of parts) {
        if (!part) continue;
        if (/\p{Extended_Pictographic}/u.test(part)) {
            totalWidth += fontSize * 1.05; 
        } else {
            totalWidth += ctx.measureText(part).width;
        }
    }
    return totalWidth;
}

async function drawTextWithEmojis(ctx, text, x, y, fontSize) {
    const parts = text.split(/(\p{Extended_Pictographic})/gu);
    let currentX = x;
    
    for (const part of parts) {
        if (!part) continue;
        if (/\p{Extended_Pictographic}/u.test(part)) {
            const emojiSize = fontSize * 1.05;
            const emojiCX = currentX + emojiSize / 2;
            const emojiCY = y; 
            await drawAppleEmoji(ctx, part, emojiCX, emojiCY, emojiSize);
            currentX += emojiSize;
        } else {
            ctx.fillText(part, currentX, y);
            currentX += ctx.measureText(part).width;
        }
    }
}

function wrapText(ctx, text, maxWidth, fontSize) {
    ctx.font = `500 ${fontSize}px Inter`;
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word.includes('\n')) {
            const parts = word.split('\n');
            for (let j = 0; j < parts.length; j++) {
                const test = cur + (cur ? " " : "") + parts[j];
                if (measureTextCustom(ctx, test, fontSize) > maxWidth && cur) {
                    lines.push(cur); cur = parts[j];
                } else { cur = test; }
                if (j < parts.length - 1) { lines.push(cur); cur = ""; }
            }
            continue;
        }
        const test = cur + (cur ? " " : "") + word;
        if (measureTextCustom(ctx, test, fontSize) > maxWidth && i > 0) {
            lines.push(cur); cur = word;
        } else { cur = test; }
    }
    if (cur) lines.push(cur);
    return lines;
}

async function render(text, time, imgUrl, outputPath) {
    await ensureAssets();

    const s = { ...state, text: text ?? state.text, time: time ?? state.time };

    let imgObj = null;
    if (imgUrl) {
        imgObj = await loadImage(imgUrl);
    }

    const canvas = createCanvas(BG_W, BG_H);
    const ctx    = canvas.getContext('2d');

    const bgImg = await loadImage(bgImgBuffer);
    ctx.drawImage(bgImg, 0, 0, BG_W, BG_H);

    const rightPadding   = Math.round(80  * SX);
    const textPaddingX   = Math.round(36  * SX);
    const paddingTop     = Math.round(28  * SY);
    const paddingBottom  = Math.round(28  * SY);
    const bRadius        = Math.round(32  * SX);
    const menuTopBorderY = Math.round(1276 * SY);
    const timeFontSize   = Math.round(23  * SX);

    ctx.font = `600 ${timeFontSize}px Inter`;
    const timeMetrics    = ctx.measureText(s.time);
    const ticksWidth     = Math.round(34 * SX);
    const timestampWidth = timeMetrics.width + ticksWidth + Math.round(12 * SX);
    const timestampHeight = timeFontSize;

    const textLimitW = s.bubbleWidth - (textPaddingX * 2);
    ctx.font = `500 ${s.fontSize}px Inter`;
    let textLines = [];
    if (s.text) textLines = wrapText(ctx, s.text, textLimitW, s.fontSize);

    const lineWidths = textLines.map(line => measureTextCustom(ctx, line, s.fontSize));
    const maxLineWidth = Math.max(...lineWidths, 0);

    let bubbleActualW = 0;
    let timestampOnNewRow = false;
    const minBubbleW = Math.round(280 * SX);

    let imgDrawH = 0;
    if (imgObj) {
        const imgAspect = imgObj.width / imgObj.height;
        bubbleActualW = Math.min(Math.max(imgObj.width, minBubbleW), s.bubbleWidth);
        if (s.text && textLines.length > 0) {
            bubbleActualW = Math.max(bubbleActualW, maxLineWidth + (textPaddingX * 2));
        }
        imgDrawH = Math.round(bubbleActualW / imgAspect);
    } else {
        if (textLines.length === 1) {
            bubbleActualW = maxLineWidth + (textPaddingX * 2) + timestampWidth + Math.round(35 * SX);
        } else if (textLines.length > 1) {
            const lastLineWidth = lineWidths[textLines.length - 1] || 0;
            if (lastLineWidth + timestampWidth + Math.round(35 * SX) <= maxLineWidth) {
                bubbleActualW = maxLineWidth + (textPaddingX * 2);
            } else if (lastLineWidth + timestampWidth + Math.round(35 * SX) <= textLimitW) {
                bubbleActualW = lastLineWidth + timestampWidth + Math.round(35 * SX) + (textPaddingX * 2);
            } else {
                bubbleActualW = maxLineWidth + (textPaddingX * 2);
                timestampOnNewRow = true;
            }
        }
    }

    if (bubbleActualW < minBubbleW) bubbleActualW = minBubbleW;
    if (bubbleActualW > s.bubbleWidth) bubbleActualW = s.bubbleWidth;
    if (imgObj && bubbleActualW < timestampWidth + Math.round(50 * SX)) bubbleActualW = timestampWidth + Math.round(50 * SX);

    const bubbleX = BG_W - bubbleActualW - rightPadding;

    const lineGap = Math.round(12 * SY);
    const textTotalHeight = (textLines.length * s.fontSize) + (Math.max(0, textLines.length - 1) * lineGap);

    let bubbleHeight = 0;
    if (timestampOnNewRow || !s.text) {
        bubbleHeight = paddingTop + textTotalHeight + Math.round(16 * SY) + timestampHeight + paddingBottom;
    } else {
        bubbleHeight = paddingTop + textTotalHeight + paddingBottom;
    }

    if (imgObj) {
        bubbleHeight += imgDrawH;
        if (s.text) bubbleHeight += Math.round(12 * SY);
    }

    const currentBubbleY = menuTopBorderY - bubbleHeight - Math.round(28 * SY);

    ctx.save();
    ctx.translate(s.offsetX, s.offsetY);

    ctx.save();
    ctx.shadowColor   = "rgba(0,0,0,0.05)";
    ctx.shadowBlur    = 20;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle     = s.bubbleColor;
    drawRoundedRect(ctx, bubbleX, currentBubbleY, bubbleActualW, bubbleHeight, bRadius);
    ctx.fill();
    ctx.restore();

    if (imgObj) {
        ctx.save();
        drawRoundedRect(ctx, bubbleX, currentBubbleY, bubbleActualW, bubbleHeight, bRadius);
        ctx.clip();
        ctx.drawImage(imgObj, bubbleX, currentBubbleY, bubbleActualW, imgDrawH);
        ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bubbleX + bubbleActualW - Math.round(15 * SX), currentBubbleY + bubbleHeight - 5);
    ctx.lineTo(bubbleX + bubbleActualW + Math.round(10 * SX), currentBubbleY + bubbleHeight - 5);
    ctx.quadraticCurveTo(
        bubbleX + bubbleActualW + Math.round(2 * SX),
        currentBubbleY + bubbleHeight - Math.round(20 * SY),
        bubbleX + bubbleActualW - Math.round(1 * SX),
        currentBubbleY + bubbleHeight - Math.round(32 * SY)
    );
    ctx.closePath();
    ctx.fillStyle = s.bubbleColor;
    ctx.fill();
    ctx.restore();

    if (s.text) {
        ctx.save();
        ctx.fillStyle    = s.textColor;
        ctx.font         = `400 ${s.fontSize}px Inter`;
        ctx.textAlign    = "left";
        ctx.textBaseline = "middle";
        let textStartY = currentBubbleY + paddingTop;
        if (imgObj) textStartY = currentBubbleY + imgDrawH + Math.round(12 * SY);
        for (let i = 0; i < textLines.length; i++) {
            const lineY = textStartY + (i * (s.fontSize + lineGap)) + (s.fontSize / 2);
            await drawTextWithEmojis(ctx, textLines[i], bubbleX + textPaddingX, lineY, s.fontSize);
        }
        ctx.restore();
    }

    ctx.save();
    let timeX = bubbleX + bubbleActualW - textPaddingX - timestampWidth;
    let timeY = 0;

    if (timestampOnNewRow || !s.text) {
        timeY = currentBubbleY + bubbleHeight - paddingBottom - timestampHeight + Math.round(4 * SY);
    } else {
        let textStartY = currentBubbleY + paddingTop;
        if (imgObj) textStartY = currentBubbleY + imgDrawH + Math.round(12 * SY);
        const lastLineTop = textStartY + ((textLines.length - 1) * (s.fontSize + lineGap));
        timeY = lastLineTop + s.fontSize - timestampHeight + Math.round(2 * SY);
    }

    ctx.fillStyle    = s.timeColor;
    ctx.font         = `600 ${timeFontSize}px Inter`;
    ctx.textBaseline = "top";
    ctx.fillText(s.time, timeX, timeY);

    const tickX = timeX + timeMetrics.width + Math.round(10 * SX);
    const t     = (n) => Math.round(n * SX);
    const tickY = timeY + (timeFontSize / 2) - t(8); 

    ctx.strokeStyle = s.tickColor;
    ctx.lineWidth   = 3.6 * SX;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    
    ctx.beginPath();
    ctx.moveTo(tickX,         tickY + t(8));
    ctx.lineTo(tickX + t(6),  tickY + t(14));
    ctx.lineTo(tickX + t(16), tickY + t(2));
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(tickX + t(7),         tickY + t(8));
    ctx.lineTo(tickX + t(7) + t(6),  tickY + t(14));
    ctx.lineTo(tickX + t(7) + t(16), tickY + t(2));
    ctx.stroke();
    ctx.restore();

    if (s.showReaction) {
        ctx.save();
        const emojiNum  = s.emojis.length;
        const startPad  = Math.round(52  * SX);
        const plusBtnW  = Math.round(80  * SX);
        const rxHeight  = Math.round(160 * SX);
        const rxWidth   = startPad + ((emojiNum - 1) * s.emojiSpacing) + s.emojiSpacing * 0.5 + plusBtnW + startPad * 0.5;

        const rxX       = bubbleX + bubbleActualW - rxWidth + s.emojiXOffset;
        const rxY       = currentBubbleY - rxHeight + s.emojiYOffset;
        const rxRadius  = rxHeight / 2;

        const rxPivotX = rxX + rxWidth - Math.round(80 * SX);
        const rxPivotY = rxY + rxHeight / 2;
        ctx.translate(rxPivotX, rxPivotY);
        ctx.scale(s.reactionScale, s.reactionScale);
        ctx.translate(-rxPivotX, -rxPivotY);

        ctx.save();
        ctx.shadowColor   = "rgba(0,0,0,0.10)";
        ctx.shadowBlur    = 36;
        ctx.shadowOffsetY = 16;
        ctx.fillStyle     = "#FFFFFF";
        drawRoundedRect(ctx, rxX, rxY, rxWidth, rxHeight, rxRadius);
        ctx.fill();
        ctx.restore();

        const emojiCY = rxY + rxHeight / 2;
        for (let i = 0; i < emojiNum; i++) {
            await drawAppleEmoji(ctx, s.emojis[i], rxX + startPad + (i * s.emojiSpacing), emojiCY, s.emojiSize);
        }

        const plusX = rxX + startPad + (emojiNum - 1) * s.emojiSpacing + Math.round(90 * SX);
        const plusY = emojiCY;
        const plusR = Math.round(38 * SX);
        const arm   = Math.round(13 * SX);
        ctx.beginPath();
        ctx.arc(plusX, plusY, plusR, 0, Math.PI * 2);
        ctx.fillStyle = "#E5E5EA";
        ctx.fill();
        ctx.strokeStyle = "#8E8E93";
        ctx.lineWidth   = 4.5 * SX;
        ctx.lineCap     = "round";
        ctx.beginPath();
        ctx.moveTo(plusX - arm, plusY); ctx.lineTo(plusX + arm, plusY);
        ctx.moveTo(plusX, plusY - arm); ctx.lineTo(plusX, plusY + arm);
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();

    const pngData = await canvas.encode('png');
    const out = outputPath ?? join(process.cwd(), 'temp', `iqcpink_${Date.now()}.png`);
    await writeFile(out, pngData);
    return out;
}

async function handler(m, { sock, text }) {
    try {
        const targetText = text || (m.quoted && m.quoted.text ? m.quoted.text : "");
        
        let targetImgBuffer = null;
        try {
            if (m.quoted && typeof m.quoted.download === 'function') {
                targetImgBuffer = await m.quoted.download();
            } else if (typeof m.download === 'function' && (m.isMedia || m.mtype === 'imageMessage' || m.type === 'imageMessage')) {
                targetImgBuffer = await m.download();
            }
        } catch (e) {}
        
        if (!targetText && !targetImgBuffer) {
            return m.reply(
                `🩷 *FITUR FAKE QUOTE iOS PINK*\n\n` +
                `Sistem ini akan mengubah teks yang kamu berikan menjadi gambar *quote* bergaya iOS dengan tema Pink yang cantik dan elegan.\n\n` +
                `*CARA PENGGUNAAN:*\n` +
                `- Ketik \`${m.prefix}iqcpink <teks kamu>\`\n` +
                `- Atau balas (*reply*) pesan orang lain dengan perintah \`${m.prefix}iqcpink\`\n\n` +
                `_Pesan yang dibalas akan otomatis diubah menjadi quote menggunakan nama dan foto profil pembuat pesan tersebut!_`
            );
        }

        let ts = m.messageTimestamp;
        if (ts && typeof ts === 'object' && ts.low !== undefined) ts = ts.low;
        ts = Number(ts) * 1000;
        const date = isNaN(ts) ? new Date() : new Date(ts);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}.${minutes}`;

        await m.react('🕕');

        let imgUrl = "";
        let caption = targetText || "";
        const tmpImgPath = join(process.cwd(), 'temp', `iqcpink_${Date.now()}.png`);
        
        if (targetImgBuffer) {
            await writeFile(tmpImgPath, targetImgBuffer);
            imgUrl = tmpImgPath;
        }

        const outPath = join(process.cwd(), 'temp', `iqcpink_out_${Date.now()}.png`);
        await mkdir(join(process.cwd(), 'temp'), { recursive: true });

        const resultPath = await render(caption, timeStr, imgUrl, outPath);

        await sock.sendMessage(m.chat, { image: { url: resultPath } }, { quoted: m });
        
        if (existsSync(resultPath)) fs.unlinkSync(resultPath);
        if (imgUrl && existsSync(imgUrl)) fs.unlinkSync(imgUrl);
        await m.react('✅');

    } catch (error) {
        bgImgBuffer = null;
        fontsLoaded = false;
        appleEmojiMap = null;
        console.error("[iqcpink error]:", error);
        await m.react('❌');
        m.reply(`❌ *GAGAL MEMPROSES QUOTE*\n\nMaaf, terjadi kesalahan saat mencoba membuat gambar quote pink. Silakan coba lagi beberapa saat.`);
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── ttqc ──
const _ttqc = (() => {
// Ditxzz

const TEMPLATE_URL  = 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/qyzwa.png';

const FONT_ASSETS = [
  { name: 'Plus Jakarta Sans', url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Regular.ttf' },
  { name: 'Plus Jakarta Sans', url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Medium.ttf' },
  { name: 'Plus Jakarta Sans', url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Bold.ttf' },
  { name: 'Font Awesome 6 Free', url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/fa-solid-900.ttf' },
  { name: 'Noto Color Emoji', url: 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf' },
];

const MENU_ICONS = [
  { unicode: '\uf3e5', text: 'Balas',           color: '#000000' },
  { unicode: '\uf064', text: 'Teruskan',         color: '#000000' },
  { unicode: '\uf0c5', text: 'Salin',            color: '#000000' },
  { unicode: '\uf1ab', text: 'Terjemahkan',      color: '#000000' },
  { unicode: '\uf2ed', text: 'Hapus untuk saya', color: '#000000' },
  { unicode: '\uf024', text: 'Laporkan',         color: '#ea4335' },
];

const canvasConfig = {
  topPPX: 183, topPPY: 83, topPPRadius: 42,
  topNameX: 250, topNameY: 82, topNameSize: 34,
  chatPPX: 75, chatPPRadius: 38,
  textX: 175, textY: 962,
  bubbleWidth: 520, textSize: 30,
  bubbleBgColor: '#ffffff', textColor: '#161823',
};

// Cache di Global Object agar tidak ter-reset saat hot-reload
global.ttqcCache = global.ttqcCache || {
  fontsLoaded: false,
  templateImage: null
};

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} → ${url}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function prepareAssets() {
  if (!global.ttqcCache.templateImage) {
    const buffer = await fetchBuffer(TEMPLATE_URL);
    global.ttqcCache.templateImage = await loadImage(buffer);
  }

  if (!global.ttqcCache.fontsLoaded) {
    // Gunakan Promise.all agar 5 font di download secara bersamaan (paralel), tidak satu-satu (mempercepat waktu loading 5x lipat)
    await Promise.all(FONT_ASSETS.map(async (font) => {
      try {
        const buffer = await fetchBuffer(font.url);
        GlobalFonts.register(buffer, font.name);
      } catch (err) {
        console.error(`[TTQC] Gagal load font ${font.name}:`, err.message);
      }
    }));
    global.ttqcCache.fontsLoaded = true;
  }
}

async function loadImageSmart(src) {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
        return await loadImage(await fetchBuffer(src));
    } catch {
        return await loadImage("https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/6b71d84a580f385bd7ee36402df5341ead4770a0/Image/artworks-gWLRE6HyPH3DgVMG-ZFFxtg-t500x500.jpg");
    }
  }
  return await loadImage(src);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/(\s+)/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    if (word.trim() === '' && currentLine === '') continue;

    const testLine = currentLine + word;
    if (ctx.measureText(testLine).width > maxWidth) {
      if (currentLine !== '') {
        lines.push(currentLine.trimEnd());
        currentLine = word.trimStart();
      } else {
        lines.push(testLine);
        currentLine = '';
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trimEnd());
  }
  return lines;
}

function drawRoundedRect(ctx, x, y, w, h, r, fill, stroke = null, shadow = false) {
  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.05)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
}

function drawCircleImage(ctx, img, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

async function render(username, chatText, avatarSrc) {
  await prepareAssets();

  const templateImage = global.ttqcCache.templateImage;
  const avatarImage   = await loadImageSmart(avatarSrc);

  const canvas = createCanvas(1080 * 2, 2280 * 2);
  const ctx    = canvas.getContext('2d');

  ctx.scale(2, 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.clearRect(0, 0, 1080, 2280);
  if (templateImage) {
    ctx.drawImage(templateImage, 0, 0, 1080, 2280);
  }

  drawCircleImage(ctx, avatarImage, canvasConfig.topPPX, canvasConfig.topPPY, canvasConfig.topPPRadius);

  ctx.font = `bold ${canvasConfig.topNameSize}px 'Plus Jakarta Sans', 'Noto Color Emoji'`;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(username, canvasConfig.topNameX, canvasConfig.topNameY);

  ctx.font = `500 ${canvasConfig.textSize}px 'Plus Jakarta Sans', 'Noto Color Emoji'`;
  
  const lines = wrapText(ctx, chatText, canvasConfig.bubbleWidth - 52);
  const lineH = canvasConfig.textSize * 1.45;

  let maxW = 0;
  for (const l of lines) {
    const w = ctx.measureText(l).width;
    if (w > maxW) maxW = w;
  }

  const padX = 30, padY = 24;
  const bubbleW = Math.max(maxW + padX * 2, 180);
  const bubbleH = lines.length * lineH + padY * 2;
  const bubbleX = canvasConfig.textX - padX;
  const bubbleY = canvasConfig.textY - padY;

  drawCircleImage(ctx, avatarImage, canvasConfig.chatPPX, bubbleY + bubbleH / 2, canvasConfig.chatPPRadius);
  drawRoundedRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 35, canvasConfig.bubbleBgColor);

  ctx.fillStyle = canvasConfig.textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  lines.forEach((line, i) => {
    const lineY = canvasConfig.textY + i * lineH + canvasConfig.textSize / 2;
    ctx.fillText(line, canvasConfig.textX, lineY);
  });

  const menuX = 90, menuY = bubbleY + bubbleH + 28;
  drawRoundedRect(ctx, menuX, menuY, 565, 580, 40, '#ffffff', 'rgba(0,0,0,0.02)', true);

  const itemH = 90, iconX = menuX + 60, labelX = menuX + 130;
  MENU_ICONS.forEach((item, i) => {
    const cy = menuY + 25 + i * itemH + itemH / 2;
    ctx.fillStyle = item.color;
    ctx.font = `900 34px 'Font Awesome 6 Free'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.unicode, iconX, cy);
    ctx.font = `500 34px 'Plus Jakarta Sans'`;
    ctx.textAlign = 'left';
    ctx.fillText(item.text, labelX, cy);
  });

  ctx.restore();

  return await canvas.encode('png');
}

const pluginConfig = {
  name: "ttqc",
  alias: [],
  category: "canvas",
  description: "Buat fake quote chat ala TikTok",
  usage: ".ttqc <teks> (atau reply teks)",
  example: ".ttqc Hallo Dunia",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 2,
  isEnabled: true,
};

async function handler(m, { sock }) {
  let text = m.args.join(" ");
  let targetJid = m.sender;
  let targetName = m.pushName;

  if (m.quoted && m.quoted.text) {
    if (!text) text = m.quoted.text;
    targetJid = m.quoted.sender;
    targetName = m.quoted.pushName || (await sock.getName?.(targetJid)) || "User";
  }

  if (!text) {
    return m.reply(
      `💬 *ᴛɪᴋᴛᴏᴋ ǫᴜᴏᴛᴇ*\n\n> Masukkan teks atau reply pesan yang ingin dijadikan quote.\n\n\`Contoh: ${m.prefix}ttqc Hallo Dunia\``,
    );
  }

  m.react("🕕");

  try {
    let ppUrl;
    try {
      ppUrl = await sock.profilePictureUrl(targetJid, "image");
    } catch {
      ppUrl = "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/6b71d84a580f385bd7ee36402df5341ead4770a0/Image/artworks-gWLRE6HyPH3DgVMG-ZFFxtg-t500x500.jpg";
    }

    const imageBuffer = await render(targetName, text, ppUrl);

    m.react("✅");
    await sock.sendMessage(m.chat, { 
      image: imageBuffer, 
      caption: `💬 *TikTok Quote*` 
    }, { quoted: m });
  } catch (error) {
    console.error(error);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

  return wrapPlugin(pluginConfig, handler)
})()

// ── tiktokchat ──
const _tiktokchat = (() => {
const pluginConfig = {
  name: "tiktokchat",
  alias: [],
  category: "canvas",
  description: "Membuat fake chat TikTok dari avatar kamu",
  usage: ".tiktokchat username | pesan (reply gambar)",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 2,
  isEnabled: true,
};

async function handler(m, { sock, text }) {
  const isImage = m.isImage || (m.quoted && m.quoted.type === "imageMessage");

  if (!isImage || !text || !text.includes("|")) {
    let help = `💬 *TIKTOK CHAT CANVAS*\n\n`
    help += `Fitur ini digunakan untuk membuat desain chat palsu bergaya TikTok yang estetis!\n\n`
    help += `*Cara Penggunaan:*\n`
    help += `- Kirim foto profil (avatar) dengan caption *${m.prefix}tiktokchat username | pesan kamu*\n`
    help += `- Atau balas (reply) foto profil dengan pesan *${m.prefix}tiktokchat username | pesan kamu*\n\n`
    help += `*Contoh:* ${m.prefix}tiktokchat Zann | Halo, hari ini cerah ya!`
    return m.reply(help);
  }

  await m.react("🕕");

  try {
    let [username, ...msgParts] = text.split("|");
    username = username.trim();
    const message = msgParts.join("|").trim();

    let buffer;
    if (m.quoted && m.quoted.isMedia) {
      buffer = await m.quoted.download();
    } else if (m.isMedia) {
      buffer = await m.download();
    }

    if (!buffer) {
      await m.react("❌");
      return m.reply(`Maaf, sistem gagal mengunduh gambar avatar yang kamu berikan.`);
    }

    const form = new FormData();
    form.append("username", username);
    form.append("text", message);
    form.append("avatar", buffer, { filename: "avatar.jpg", contentType: "image/jpeg" });

    const response = await axios.post("https://my.izuka-api.xyz/api/canvas/tiktok-chat", form, {
      headers: form.getHeaders(),
      responseType: "arraybuffer",
      timeout: 60000
    });

    await sock.sendMessage(m.chat, { image: Buffer.from(response.data) }, { quoted: m });
    await m.react("✅");

  } catch (error) {
    console.error("[TIKTOKCHAT Plugin Error]", error);
    await m.react("❌");
    m.reply(`Maaf, gagal membuat canvas TikTok Chat kali ini. Coba lagi beberapa saat.`);
  }
}

  return wrapPlugin(pluginConfig, handler)
})()

export default mergePlugins(
    'canvas',
    _buatquotes,
    _iqc,
    _iqc2,
    _iqcpink,
    _ttqc,
    _tiktokchat
)
