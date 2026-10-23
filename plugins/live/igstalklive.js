import { dioRun, dioRegister } from '../../lib/plugin-engine.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const libs = {
    "igstalk": (module, exports, require) => {
    // IG STALK Kaguya: ambil profil publik Instagram, rapikan datanya, lalu analisis ringan.
    // Hanya data publik dari API pihak ketiga. Tidak ada data palsu: kalau gagal, hasilnya error, bukan profil karangan.
    // Tambahkan API cadangan lewat settings: global.igstalkApis = ['https://contoh.api/igstalk?username=']
    // Bentuk alamat yang diterima: berakhiran '=' (username ditempel), memakai {u} sebagai tempat username,
    // atau tanpa parameter (bot mencoba ?username= , ?user= , ?q= , ?url= secara berurutan).
    const axios = require('axios')
    
    const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36'
    const DEFAULT_APIS = ['https://api.vreden.web.id/api/igstalk?username=', 'https://api.deline.web.id/stalker/igstalk']
    const CACHE = new Map(), CACHE_MS = 10 * 60 * 1000
    
    const apis = () => [...(Array.isArray(global.igstalkApis) ? global.igstalkApis : []), ...DEFAULT_APIS]
    
    // ── input ──
    function cleanUser(s) {
      let t = String(s || '').trim()
      const m = t.match(/instagram\.com\/(?:_u\/)?([a-z0-9._]+)/i)
      if (m) t = m[1]
      t = t.replace(/^@+/, '').replace(/[/?#].*$/, '').toLowerCase()
      return /^[a-z0-9._]{1,30}$/.test(t) ? t : ''
    }
    
    // ── normalisasi ──
    function find(o, keys, depth = 0) {
      if (!o || typeof o !== 'object' || depth > 3) return undefined
      for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]
      for (const c of ['result', 'data', 'user', 'profile', 'graphql', 'info']) {
        if (o[c] && typeof o[c] === 'object') { const r = find(o[c], keys, depth + 1); if (r !== undefined) return r }
      }
      return undefined
    }
    function toNum(v) {
      if (v === null || v === undefined || v === '') return null
      if (typeof v === 'number') return Number.isFinite(v) ? v : null
      if (typeof v === 'object') return v.count !== undefined ? toNum(v.count) : null
      const m = String(v).trim().toLowerCase().replace(/\s/g, '').match(/^([\d.,]+)(k|rb|m|jt|b)?$/)
      if (!m) return null
      if (!m[2]) { const n = parseInt(m[1].replace(/[.,]/g, ''), 10); return Number.isFinite(n) ? n : null }
      const n = parseFloat(m[1].replace(',', '.')); if (!Number.isFinite(n)) return null
      return Math.round(n * ({ k: 1e3, rb: 1e3, m: 1e6, jt: 1e6, b: 1e9 })[m[2]])
    }
    const toBool = (v) => v === true || v === 1 || /^(true|1|yes|ya)$/i.test(String(v))
    const str = (v) => (v === undefined || v === null) ? '' : String(v).trim()
    
    function normalize(raw, username) {
      const f = (...k) => find(raw, k)
      const p = {
        username: str(f('username', 'user_name', 'userName')) || username,
        fullName: str(f('fullName', 'full_name', 'name', 'nickname')),
        bio: str(f('biography', 'bio', 'description', 'about')),
        avatar: str(f('profile_pic_url_hd', 'avatar', 'profilePic', 'profile_pic_url', 'profilePicUrl', 'profile_picture', 'pp', 'image')),
        followers: toNum(f('followers', 'follower_count', 'followersCount', 'edge_followed_by')),
        following: toNum(f('following', 'following_count', 'followingCount', 'edge_follow')),
        posts: toNum(f('posts', 'post_count', 'postsCount', 'media_count', 'edge_owner_to_timeline_media')),
        verified: toBool(f('isVerified', 'is_verified', 'verified')),
        private: toBool(f('isPrivate', 'is_private', 'private')),
        business: toBool(f('isBusiness', 'is_business', 'is_business_account', 'isBusinessAccount')),
        category: str(f('category', 'category_name', 'business_category_name')),
        link: str(f('external_url', 'externalUrl', 'website', 'url')),
        id: str(f('id', 'pk', 'user_id')),
      }
      p.url = 'https://www.instagram.com/' + p.username
      const hasData = p.fullName || p.bio || p.followers !== null || p.posts !== null || p.avatar
      return hasData ? p : null
    }
    
    // ── analisis (perkiraan dari data publik) ──
    function analyze(p) {
      const a = { tier: '-', ratio: null, ratioNote: '', score: 0, notes: [], tags: [], mentions: [], emails: [], links: [] }
      const fl = p.followers
      if (fl !== null) a.tier = fl >= 1e6 ? 'Mega (1 jt+)' : fl >= 5e5 ? 'Makro (500 rb+)' : fl >= 1e5 ? 'Tengah (100 rb+)' : fl >= 1e4 ? 'Mikro (10 rb+)' : fl >= 1e3 ? 'Nano (1 rb+)' : 'Akun kecil (<1 rb)'
      if (fl !== null && p.following !== null) {
        a.ratio = p.following ? +(fl / p.following).toFixed(2) : null
        a.ratioNote = p.following === 0 ? 'Tidak mengikuti siapa pun' : a.ratio >= 10 ? 'Jauh lebih banyak diikuti daripada mengikuti, ciri akun publik/tokoh' : a.ratio >= 1.5 ? 'Pengikut lebih banyak dari yang diikuti' : a.ratio >= 0.8 ? 'Seimbang, ciri akun pribadi biasa' : 'Mengikuti lebih banyak dari pengikut, ciri akun yang masih tumbuh'
      }
      // kelengkapan profil (0-100)
      const parts = [[p.avatar ? 1 : 0, 'Foto profil', 20], [p.fullName ? 1 : 0, 'Nama lengkap', 15], [p.bio ? 1 : 0, 'Bio', 25], [p.link ? 1 : 0, 'Tautan luar', 15], [(p.posts || 0) > 0 ? 1 : 0, 'Sudah ada postingan', 15], [(p.verified || p.business) ? 1 : 0, 'Terverifikasi / bisnis', 10]]
      a.score = parts.reduce((s, x) => s + (x[0] ? x[2] : 0), 0)
      for (const x of parts) if (!x[0]) a.notes.push('Belum ada: ' + x[1].toLowerCase())
      if (p.private) a.notes.push('Akun privat: postingan hanya terlihat oleh pengikut')
      if (p.posts !== null && fl !== null && p.posts > 0) a.notes.push(`Rata-rata ${Math.round(fl / p.posts).toLocaleString('id-ID')} pengikut per postingan`)
      // isi bio
      const bio = p.bio || ''
      a.tags = [...new Set((bio.match(/#[\p{L}\p{N}_]+/gu) || []))].slice(0, 12)
      a.mentions = [...new Set((bio.match(/(?<![\w.])@[a-z0-9._]{2,30}/gi) || []))].slice(0, 8)
      a.emails = [...new Set((bio.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []))].slice(0, 4)
      a.links = [...new Set([...(bio.match(/https?:\/\/[^\s]+/g) || []), p.link].filter(Boolean))].slice(0, 5)
      return a
    }
    
    // ── foto profil → data URI (sandbox kartu tidak bisa memuat gambar luar) ──
    async function avatarBuffer(url) {
      if (!url || !/^https?:\/\//i.test(url)) return null
      try {
        const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 9000, maxContentLength: 8 * 1024 * 1024, headers: { 'User-Agent': UA, Referer: 'https://www.instagram.com/' }, validateStatus: s => s === 200 })
        return Buffer.from(r.data)
      } catch { return null }
    }
    async function avatarDataUri(buf) {
      if (!buf) return ''
      try {
        const out = await require('sharp')(buf).resize(160, 160, { fit: 'cover' }).jpeg({ quality: 68 }).toBuffer()
        return 'data:image/jpeg;base64,' + out.toString('base64')
      } catch { return buf.length < 60000 ? 'data:image/jpeg;base64,' + buf.toString('base64') : '' }
    }
    
    // ── utama ──
    const candidates = (base, u) => {
      if (base.includes('{u}')) return [base.replace('{u}', encodeURIComponent(u))]
      if (/=$/.test(base)) return [base + encodeURIComponent(u)]
      const sep = base.includes('?') ? '&' : '?'
      return [`${sep}username=${encodeURIComponent(u)}`, `${sep}user=${encodeURIComponent(u)}`, `${sep}q=${encodeURIComponent(u)}`, `${sep}url=${encodeURIComponent('https://www.instagram.com/' + u)}`].map(x => base + x)
    }
    async function fetchRaw(username) {
      let lastErr = null
      for (const base of apis()) {
        for (const url of candidates(base, username)) {
          try {
            const r = await axios.get(url, { timeout: 12000, headers: { 'User-Agent': UA, Accept: 'application/json' }, validateStatus: s => s < 500 })
            const data = r.data
            if (r.status >= 400) { lastErr = new Error((data && (data.message || data.msg || data.error)) || 'Permintaan ditolak (' + r.status + ')'); continue }   // coba nama parameter berikutnya
            if (data && (data.status === false || data.success === false)) { lastErr = new Error(data.message || data.msg || 'Akun tidak ditemukan'); break }
            const p = normalize(data, username)
            if (p) return p
            lastErr = new Error('Akun tidak ditemukan atau datanya kosong'); break
          } catch (e) { lastErr = e; break }
        }
      }
      throw new Error(lastErr && /timeout|ENOTFOUND|ECONN|socket/i.test(lastErr.message || '') ? 'Server data Instagram sedang tidak bisa dihubungi, coba lagi sebentar lagi' : (lastErr && lastErr.message) || 'Gagal mengambil data')
    }
    
    async function lookup(username, { withAvatar = true } = {}) {
      const key = username + (withAvatar ? ':a' : '')
      const hit = CACHE.get(key)
      if (hit && Date.now() - hit.t < CACHE_MS) return hit.v
      const p = await fetchRaw(username)
      p.a = analyze(p)
      p.avatarBuf = withAvatar ? await avatarBuffer(p.avatar) : null
      p.avatarUri = withAvatar ? await avatarDataUri(p.avatarBuf) : ''
      p.takenAt = Date.now()
      CACHE.set(key, { t: Date.now(), v: p })
      if (CACHE.size > 60) CACHE.delete(CACHE.keys().next().value)
      return p
    }
    
    // versi ringan untuk dikirim ke kartu (tanpa buffer)
    const forCard = (p) => { const { avatarBuf, avatar, ...rest } = p; return rest }
    
    module.exports = { cleanUser, lookup, forCard, normalize, analyze, toNum }
        },
    "cards/igstalk": (module, exports, require) => {
    const NB = () => String(global.namebot || 'Kaguya').replace(/[<>&'"`$\\]/g, '')
    // Kartu HTML statis: IG STALK LIVE (1 akun, atau 2 akun untuk dibandingkan)
    // Semua data ditanam di HTML lewat __CFG__, tanpa fetch (sandbox WA memblokir jaringan).
    const { BASE_CSS, safeJson } = require("../htmlcard");
    
    const BODY = String.raw`
    <style>
    __BASECSS__
    .hd{display:flex;gap:12px;align-items:center;margin-bottom:10px;}
    .av{width:68px;height:68px;border-radius:50%;flex:none;background:var(--card2);border:2px solid var(--acc);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:var(--acc);overflow:hidden;}
    .av img{width:100%;height:100%;object-fit:cover;display:block;}
    .nm{font-size:16px;font-weight:800;line-height:1.2;word-break:break-word;}
    .un{font-size:12px;color:var(--soft);margin-top:2px;}
    .bd{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px;}
    .b{font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;background:var(--card2);border:1px solid var(--line);color:var(--soft);}
    .b.g{color:#04130a;background:var(--acc);border-color:var(--acc);}
    .b.w{color:#1a1203;background:var(--warn);border-color:var(--warn);}
    .b.r{color:#fff;background:var(--red);border-color:var(--red);}
    .st{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0;}
    .st div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:9px 4px;text-align:center;}
    .st b{display:block;font-size:17px;font-weight:800;}
    .st span{font-size:10px;color:var(--soft);}
    .bio{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.45;margin:8px 0;}
    .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:10px;}
    .sec{font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--acc);margin:2px 0 8px;}
    .kv{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:12.5px;}
    .kv:last-child{border-bottom:0;}
    .kv span{color:var(--soft);flex:none;}
    .kv b{text-align:right;word-break:break-word;}
    .bar{height:8px;border-radius:8px;background:var(--card2);overflow:hidden;margin:6px 0 2px;}
    .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--acc2),var(--acc));border-radius:8px;}
    .note{font-size:12px;color:var(--soft);line-height:1.5;padding:3px 0;}
    .tg{display:flex;flex-wrap:wrap;gap:6px;}
    .tg .b{font-size:11.5px;font-weight:700;color:var(--ink);cursor:pointer;}
    .act{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;}
    .act .btn{flex:1;min-width:110px;font-size:12px;padding:9px 8px;}
    .tb{width:100%;border-collapse:collapse;font-size:12.5px;}
    .tb th,.tb td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:center;}
    .tb th{color:var(--soft);font-size:11px;font-weight:700;}
    .tb td:first-child,.tb th:first-child{text-align:left;color:var(--soft);}
    .tb td.w{color:var(--acc);font-weight:800;}
    .foot{text-align:center;margin-top:10px;letter-spacing:.12em;font-size:10px;}
    .sep{height:1px;background:var(--line);margin:12px 0;}
    .toast{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:var(--acc);color:#04130a;font-weight:800;font-size:12px;padding:8px 14px;border-radius:20px;opacity:0;transition:opacity .2s;pointer-events:none;}
    .toast.on{opacity:1;}
    </style>
    <div class="stage"><div class="app">
      <div class="top"><div class="logo">𓂀</div><div class="meta"><div class="title">${NB().toUpperCase()} • IG STALK</div><div class="sub" id="sub"></div></div></div>
      <div class="chips" id="tabs"></div>
      <div id="view"></div>
      <div class="muted foot">𓂀 𝐃𝐈𝐎𝐍𝐘𝐒𝐔𝐒</div>
    </div></div>
    <div class="toast" id="toast">Tersalin</div>
    <script>
    (function(){
    var C=__CFG__, P=C.profiles, tab='ringkasan';
    function $(i){return document.getElementById(i);}
    function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
    function full(n){return n==null?'-':Number(n).toLocaleString('id-ID');}
    function short(n){if(n==null)return '-';if(n>=1e9)return (n/1e9).toFixed(1).replace('.',',')+' M';if(n>=1e6)return (n/1e6).toFixed(1).replace('.',',')+' jt';if(n>=1e4)return (n/1e3).toFixed(1).replace('.',',')+' rb';return full(n);}
    function toast(t){var e=$('toast');e.textContent=t||'Tersalin';e.className='toast on';setTimeout(function(){e.className='toast';},1400);}
    function copy(t){
      try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){toast();},function(){fb(t);});return;}}catch(e){}
      fb(t);
    }
    function fb(t){try{var a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();document.execCommand('copy');document.body.removeChild(a);toast();}catch(e){toast('Gagal menyalin');}}
    window.__cp=function(i,k){var p=P[i],v={user:'@'+p.username,url:p.url,bio:p.bio||''}[k];if(v)copy(v);};
    window.__ct=function(t){copy(t);};
    
    function badges(p){
      var h='';
      if(p.verified)h+='<span class="b g">Terverifikasi</span>';
      if(p.business)h+='<span class="b w">Bisnis'+(p.category?' • '+esc(p.category):'')+'</span>';
      if(p.private)h+='<span class="b r">Privat</span>';
      if(!p.verified&&!p.business&&!p.private)h+='<span class="b">Publik</span>';
      return h;
    }
    function head(p){
      var ini=esc((p.fullName||p.username||'?').charAt(0).toUpperCase());
      return '<div class="hd"><div class="av">'+(p.avatarUri?'<img src="'+p.avatarUri+'">':ini)+'</div><div style="min-width:0"><div class="nm">'+esc(p.fullName||p.username)+'</div><div class="un">@'+esc(p.username)+'</div><div class="bd">'+badges(p)+'</div></div></div>';
    }
    function ringkasan(p,i){
      return '<div class="card">'+head(p)+
      '<div class="st"><div><b>'+short(p.posts)+'</b><span>Postingan</span></div><div><b>'+short(p.followers)+'</b><span>Pengikut</span></div><div><b>'+short(p.following)+'</b><span>Mengikuti</span></div></div>'+
      (p.bio?'<div class="bio">'+esc(p.bio)+'</div>':'<div class="note">Bio kosong.</div>')+
      '<div class="kv"><span>Tautan profil</span><b>'+esc(p.url.replace('https://',''))+'</b></div>'+
      (p.link?'<div class="kv"><span>Tautan luar</span><b>'+esc(p.link)+'</b></div>':'')+
      '<div class="act"><button class="btn" onclick="__cp('+i+',\'user\')">Salin @user</button><button class="btn alt" onclick="__cp('+i+',\'url\')">Salin tautan</button>'+(p.bio?'<button class="btn alt" onclick="__cp('+i+',\'bio\')">Salin bio</button>':'')+'</div></div>';
    }
    function analisis(p){
      var a=p.a,h='<div class="card"><div class="sec">ANALISIS @'+esc(p.username).toUpperCase()+'</div>'+
      '<div class="kv"><span>Tingkat akun</span><b>'+esc(a.tier)+'</b></div>'+
      '<div class="kv"><span>Pengikut : mengikuti</span><b>'+(a.ratio==null?'-':a.ratio+' : 1')+'</b></div>'+
      (p.followers!=null&&p.following!=null?'<div class="kv"><span>Selisih</span><b>'+(p.followers>=p.following?'+':'-')+full(Math.abs(p.followers-p.following))+'</b></div>':'')+
      (a.ratioNote?'<div class="note">'+esc(a.ratioNote)+'.</div>':'')+
      '<div class="sep"></div><div class="kv"><span>Kelengkapan profil</span><b>'+a.score+' / 100</b></div><div class="bar"><i style="width:'+a.score+'%"></i></div>';
      for(var i=0;i<a.notes.length;i++)h+='<div class="note">• '+esc(a.notes[i])+'</div>';
      return h+'<div class="note" style="margin-top:6px">Perkiraan dari data publik, bukan penilaian pasti.</div></div>';
    }
    function chipsOf(arr){var h='<div class="tg">';for(var i=0;i<arr.length;i++)h+='<span class="b" onclick="__ct(this.textContent)">'+esc(arr[i])+'</span>';return h+'</div>';}
    function bio(p){
      var a=p.a,h='<div class="card"><div class="sec">ISI BIO @'+esc(p.username).toUpperCase()+'</div>';
      if(!p.bio)return h+'<div class="note">Bio kosong.</div></div>';
      h+='<div class="bio">'+esc(p.bio)+'</div>';
      if(a.tags.length)h+='<div class="sec" style="margin-top:10px">TAGAR</div>'+chipsOf(a.tags);
      if(a.mentions.length)h+='<div class="sec" style="margin-top:10px">AKUN DISEBUT</div>'+chipsOf(a.mentions);
      if(a.emails.length)h+='<div class="sec" style="margin-top:10px">SURAT ELEKTRONIK</div>'+chipsOf(a.emails);
      if(a.links.length)h+='<div class="sec" style="margin-top:10px">TAUTAN</div>'+chipsOf(a.links);
      if(!a.tags.length&&!a.mentions.length&&!a.emails.length&&!a.links.length)h+='<div class="note">Tidak ada tagar, akun, surel, atau tautan di bio.</div>';
      return h+'<div class="note" style="margin-top:6px">Ketuk salah satu untuk menyalin.</div></div>';
    }
    function banding(){
      var A=P[0],B=P[1];
      var rows=[['Postingan','posts'],['Pengikut','followers'],['Mengikuti','following']];
      var h='<div class="card"><div class="sec">BANDING</div><table class="tb"><tr><th></th><th>@'+esc(A.username)+'</th><th>@'+esc(B.username)+'</th></tr>';
      for(var i=0;i<rows.length;i++){
        var k=rows[i][1],x=A[k],y=B[k],cx='',cy='';
        if(k!=='following'&&x!=null&&y!=null&&x!==y){if(x>y)cx='w';else cy='w';}
        h+='<tr><td>'+rows[i][0]+'</td><td class="'+cx+'">'+full(x)+'</td><td class="'+cy+'">'+full(y)+'</td></tr>';
      }
      var ra=A.a.ratio,rb=B.a.ratio,sa=A.a.score,sb=B.a.score;
      h+='<tr><td>Rasio</td><td class="'+(ra!=null&&rb!=null&&ra>rb?'w':'')+'">'+(ra==null?'-':ra)+'</td><td class="'+(ra!=null&&rb!=null&&rb>ra?'w':'')+'">'+(rb==null?'-':rb)+'</td></tr>';
      h+='<tr><td>Kelengkapan</td><td class="'+(sa>sb?'w':'')+'">'+sa+'</td><td class="'+(sb>sa?'w':'')+'">'+sb+'</td></tr>';
      h+='<tr><td>Tingkat</td><td>'+esc(A.a.tier.split(' ')[0])+'</td><td>'+esc(B.a.tier.split(' ')[0])+'</td></tr>';
      h+='<tr><td>Status</td><td>'+(A.private?'Privat':'Publik')+'</td><td>'+(B.private?'Privat':'Publik')+'</td></tr></table>';
      var ff=(A.followers!=null&&B.followers!=null&&A.followers!==B.followers)?(A.followers>B.followers?A:B):null;
      if(ff&&Math.min(A.followers,B.followers)>0)h+='<div class="note" style="margin-top:8px">@'+esc(ff.username)+' punya pengikut '+(Math.max(A.followers,B.followers)/Math.min(A.followers,B.followers)).toFixed(1).replace('.',',')+' kali lipat lebih banyak.</div>';
      return h+'</div>';
    }
    function render(){
      var h='',i;
      if(tab==='ringkasan'){for(i=0;i<P.length;i++)h+=ringkasan(P[i],i);}
      else if(tab==='analisis'){for(i=0;i<P.length;i++)h+=analisis(P[i]);}
      else if(tab==='bio'){for(i=0;i<P.length;i++)h+=bio(P[i]);}
      else if(tab==='banding'){h=banding();}
      $('view').innerHTML=h;
      var t=[['ringkasan','Ringkasan'],['analisis','Analisis'],['bio','Bio']];
      if(P.length>1)t.push(['banding','Banding']);
      var c='';for(i=0;i<t.length;i++)c+='<button class="chip'+(t[i][0]===tab?' on':'')+'" onclick="__tab(\''+t[i][0]+'\')">'+t[i][1]+'</button>';
      $('tabs').innerHTML=c;
    }
    window.__tab=function(t){tab=t;render();};
    $('sub').textContent=P.map(function(p){return '@'+p.username;}).join(' vs ')+' • '+C.waktu;
    render();
    })();
    </script>
    `;
    
    function buildIgstalkHtml({ profiles = [], waktu = "" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ profiles, waktu: String(waktu) }));
    }
    
    module.exports = { buildIgstalkHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: IG Stalk Live — profil publik Instagram, analisis, isi bio, foto HD, dan banding 2 akun
//   .igstalk <username|tautan>          kartu live 1 akun
//   .igstalk <akun1> <akun2>            banding dua akun
//   .igstalk foto <username>            kirim foto profil ukuran asli
const IG = require('../../lib/igstalk')
const { buildIgstalkHtml } = require('../../lib/cards/igstalk')
const { sendHtmlCard } = require('../../lib/htmlcard')

const wib = () => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date()) + ' WIB'

module.exports = {
  name: 'igstalk',
  alias: ['igstalklive', 'instalookup', 'igcek'],
  category: 'live',
  desc: 'Stalk profil Instagram: kartu live, analisis, isi bio, foto HD, banding 2 akun',
  run: async ({ sock, m, text, prefix, command, reply }) => {
    const usage = `𓂀 *IG STALK • ${String(global.namebot || 'Kaguya').toUpperCase()}*\n\n${prefix}${command} <username>\n${prefix}${command} <akun1> <akun2>   (banding)\n${prefix}${command} foto <username>   (foto asli)\n\nContoh: ${prefix}${command} instagram`
    const tok = String(text || '').trim().split(/\s+/).filter(Boolean)
    if (!tok.length) return reply(usage)

    const mode = /^(foto|pp|avatar)$/i.test(tok[0]) ? 'foto' : 'kartu'
    if (mode === 'foto') tok.shift()
    const users = [...new Set(tok.filter(t => !/^(vs|banding|bandingkan|dan|&)$/i.test(t)).map(IG.cleanUser).filter(Boolean))].slice(0, mode === 'foto' ? 1 : 2)
    if (!users.length) return reply(`Username tidak valid.\n\n${usage}`)

    try { await sock.sendPresenceUpdate('composing', m.chat) } catch {}
    try {
      const profiles = []
      for (const u of users) profiles.push(await IG.lookup(u))

      if (mode === 'foto') {
        const p = profiles[0]
        if (!p.avatarBuf) return reply(`Foto profil @${p.username} tidak bisa diambil (kosong atau diblokir Instagram).`)
        return sock.sendMessage(m.chat, { image: p.avatarBuf, caption: `𓂀 @${p.username}\n${p.fullName || ''}`.trim() }, { quoted: m })
      }

      const html = buildIgstalkHtml({ profiles: profiles.map(IG.forCard), waktu: wib() })
      await sendHtmlCard(sock, m, html, `IG Stalk @${users.join(' vs @')}`, '🔍')
    } catch (e) {
      return reply(`✕ Gagal mengambil data @${users.join(' / @')}\n${e.message}`)
    } finally {
      try { await sock.sendPresenceUpdate('paused', m.chat) } catch {}
    }
  },
}
    }

dioRegister("live/igstalklive", feature, libs)

let handler = (m, ctx) => dioRun("live/igstalklive", m, ctx)

handler.command = ["igstalklive", "instalookup", "igcek"]
handler.help = ["igstalklive", "instalookup"]
handler.tags = ["live"]

export default handler
