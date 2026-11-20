import {supabaseConfig} from './supabase-config.js';
const $=id=>document.getElementById(id);
const ready=Boolean(supabaseConfig.url && supabaseConfig.publishableKey && !supabaseConfig.url.includes('PASTE_') && !supabaseConfig.publishableKey.includes('PASTE_'));
let client=null,account=null,people=[],peer='global',chatChannel=null,boardChannel=null,displayName='Player';
function notice(msg){$('gameNotice').textContent=msg}
function show(tab){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===tab));document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.tab)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
const readable=e=>e?.message||'Unknown error';
const safeName=n=>String(n||'Player').trim().slice(0,24)||'Player';
async function start(){
 if(!ready) return;
 try{
  const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  client=sdk.createClient(supabaseConfig.url,supabaseConfig.publishableKey);
  $('setupBanner').textContent='Supabase connected. Sign up or log in to chat and post scores.';
  client.auth.onAuthStateChange((_event,_session)=>{setTimeout(()=>syncAuth(),0)});
  await syncAuth();
 }catch(e){$('accountStatus').textContent='Supabase initialization failed: '+readable(e);console.error(e)}
}
async function syncAuth(){
 if(!client)return;
 const {data:{user},error}=await client.auth.getUser();if(error && error.name!=='AuthSessionMissingError')console.warn(error);
 account=user||null;
 if(chatChannel){client.removeChannel(chatChannel);chatChannel=null}
 if(boardChannel){client.removeChannel(boardChannel);boardChannel=null}
 if(!account){people=[];peer='global';$('people').replaceChildren();$('messages').textContent='Log in to chat.';$('leaderRows').textContent='Log in to view scores.';displayName='Player';}
 else {displayName=safeName(account.user_metadata?.display_name||account.email?.split('@')[0]);
  const {error:profileError}=await client.from('profiles').upsert({id:account.id,display_name:displayName},{onConflict:'id'});
  if(profileError)console.warn('Profile save failed:',profileError.message);
  await loadPeople();await openConversation();await renderLeaderboard();
 }
 $('who').textContent=account?'Signed in: '+displayName:'Guest mode';
 $('logout').classList.toggle('hidden',!account);
 $('accountStatus').textContent=account?'Signed in as '+displayName:'Create an account or log in.';
}
start();
$('signup').onclick=async()=>{
 if(!client)return alert('Connect Supabase first (see README).');
 const name=$('displayName').value.trim(),email=$('email').value.trim(),password=$('password').value;
 if(name.length<2||name.length>24)return alert('Display name must be 2–24 characters.');
 if(password.length<8)return alert('Use a password at least 8 characters long.');
 const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name:name}}});
 if(error)return alert(error.message);
 $('accountStatus').textContent=data.session?'Account created and signed in.':'Account requested. Check your email for a confirmation link, then log in.';
};
$('login').onclick=async()=>{if(!client)return alert('Connect Supabase first.');const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)alert(error.message);else await syncAuth()};
$('logout').onclick=async()=>{if(client){const {error}=await client.auth.signOut();if(error)alert(error.message);else await syncAuth()}};
async function loadPeople(){
 if(!account)return;
 const {data,error}=await client.from('profiles').select('id,display_name').order('display_name').limit(100);
 const list=$('people');list.replaceChildren();
 if(error){list.textContent='Unable to load friends: '+error.message;return}
 people=(data||[]).filter(x=>x.id!==account.id);
 for(const p of people){const btn=document.createElement('button');btn.className='room';btn.textContent='@ '+safeName(p.display_name);btn.onclick=()=>{peer=p.id;openConversation()};list.append(btn)}
}
async function openConversation(){
 if(chatChannel&&client){client.removeChannel(chatChannel);chatChannel=null}
 if(!account)return;
 $('chatTitle').textContent=peer==='global'?'# Group chat':'@ '+safeName(people.find(x=>x.id===peer)?.display_name||'Player');
 document.querySelector('[data-peer="global"]').classList.toggle('active',peer==='global');
 $('messages').textContent='Loading messages...';
 await loadMessages();
 // RLS permits message reads only when a user belongs to the conversation.
 chatChannel=client.channel('gymnae-messages-'+account.id+'-'+peer).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},()=>{loadMessages()}).subscribe();
}
async function loadMessages(){
 if(!account)return;
 const expected=peer;
 let query=client.from('messages').select('id,sender_id,recipient_id,kind,body,created_at').order('created_at',{ascending:false}).limit(100);
 if(peer==='global')query=query.eq('kind','group');
 else query=query.eq('kind','dm').or(`and(sender_id.eq.${account.id},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${account.id})`);
 const {data,error}=await query;
 if(peer!==expected)return;
 const box=$('messages');box.replaceChildren();
 if(error){box.textContent='Chat error: '+error.message;return}
 if(!data?.length){box.textContent='No messages yet.';return}
 const lookup=new Map(people.map(x=>[x.id,x.display_name]));lookup.set(account.id,displayName);
 for(const m of data.reverse()){const item=document.createElement('div'),label=document.createElement('small'),body=document.createElement('div');item.className='message';label.textContent=safeName(lookup.get(m.sender_id)||'Player');body.textContent=m.body;item.append(label,body);box.append(item)}
 box.scrollTop=box.scrollHeight;
}
document.querySelector('[data-peer="global"]').onclick=()=>{peer='global';openConversation()};
$('chatForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!account)return alert('Log in to chat.');
 const body=$('messageInput').value.trim();if(!body||body.length>500)return;
 const data={sender_id:account.id,recipient_id:peer==='global'?null:peer,kind:peer==='global'?'group':'dm',body};
 const {error}=await client.from('messages').insert(data);if(error)alert('Message not sent: '+error.message);else{$('messageInput').value='';await loadMessages()}
});
async function submitScore(game,score){
 if(!account)return notice('Sign in under Account to post scores.');
 if(!Number.isInteger(score)||score<0||score>10000000)return notice('Invalid score.');
 const {error}=await client.from('scores').insert({user_id:account.id,game,score});
 notice(error?'Unable to submit: '+error.message:'Score submitted! Check the leaderboard.');
}
async function renderLeaderboard(){
 if(boardChannel&&client){client.removeChannel(boardChannel);boardChannel=null}
 if(!account)return;
 const game=$('leaderGame').value,box=$('leaderRows');
 box.textContent='Loading leaderboard...';
 async function load(){
  const {data,error}=await client.from('scores').select('user_id,score').eq('game',game).order('score',{ascending:false}).limit(500);
  box.replaceChildren();if(error){box.textContent='Leaderboard error: '+error.message;return}
  const best=new Map();for(const s of data||[])if(!best.has(s.user_id))best.set(s.user_id,s.score);
  const ids=[...best.keys()];let names=new Map();
  if(ids.length){const p=await client.from('profiles').select('id,display_name').in('id',ids);if(!p.error)names=new Map(p.data.map(x=>[x.id,x.display_name]))}
  if(!best.size){box.textContent='No scores yet. Be first!';return}
  [...best].sort((a,b)=>b[1]-a[1]).slice(0,25).forEach(([id,score],i)=>{const r=document.createElement('div'),left=document.createElement('span'),right=document.createElement('strong');r.className='leader-row';left.textContent=(i+1)+'. '+safeName(names.get(id)||'Player');right.textContent=score.toLocaleString();r.append(left,right);box.append(r)});
 }
 await load();
 boardChannel=client.channel('gymnae-scores-'+game).on('postgres_changes',{event:'INSERT',schema:'public',table:'scores'},payload=>{if(payload.new.game===game)load()}).subscribe();
}
$('leaderGame').onchange=renderLeaderboard;$('refreshBoard').onclick=renderLeaderboard;
// Game switching
document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-game]').forEach(x=>x.classList.toggle('active',x===b));['tetris','chess','2048'].forEach(g=>$(g+'Panel').classList.toggle('hidden',g!==b.dataset.game))});
function currentGame(){return document.querySelector('[data-game].active')?.dataset.game}
// 2048: working directional merges + touch controls.
let grid=[],score2048=0,over2048=false;const randomTile=()=>{let a=[];for(let i=0;i<16;i++)if(!grid[i])a.push(i);if(a.length)grid[a[Math.random()*a.length|0]]=Math.random()<.9?2:4};
function render2048(){const b=$('board2048');b.replaceChildren();grid.forEach(n=>{const t=document.createElement('div');t.className='tile '+(!n?'empty':n>=128?'big':'');t.textContent=n||'';b.append(t)});$('score2048').textContent=score2048.toLocaleString()}
function reset2048(){grid=Array(16).fill(0);score2048=0;over2048=false;randomTile();randomTile();render2048()}function slide2048(dir){if(over2048||currentGame()!=='2048')return;const old=grid.join(',');const lines=[];for(let r=0;r<4;r++){const line=[];for(let c=0;c<4;c++){let i=dir==='ArrowLeft'?r*4+c:dir==='ArrowRight'?r*4+(3-c):dir==='ArrowUp'?c*4+r:(3-c)*4+r;line.push(i)}lines.push(line)}for(const indices of lines){let vals=indices.map(i=>grid[i]).filter(Boolean),out=[];for(let k=0;k<vals.length;k++){if(vals[k]===vals[k+1]){const v=vals[k]*2;score2048+=v;out.push(v);k++}else out.push(vals[k])}indices.forEach((i,k)=>grid[i]=out[k]||0)}if(old!==grid.join(',')){randomTile();render2048();if(!grid.includes(0)&&!grid.some((v,i)=>i%4!==3&&grid[i+1]===v||i<12&&grid[i+4]===v)){over2048=true;notice('2048 game over! Submit your score.')}}}reset2048();$('reset2048').onclick=reset2048;$('save2048').onclick=()=>submitScore('2048',score2048);document.querySelectorAll('[data-2048]').forEach(b=>b.onclick=()=>slide2048(b.dataset['2048']));let tx=0,ty=0;$('board2048').addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY},{passive:true});$('board2048').addEventListener('touchend',e=>{let dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;slide2048(Math.abs(dx)>Math.abs(dy)?dx>0?'ArrowRight':'ArrowLeft':dy>0?'ArrowDown':'ArrowUp')},{passive:true});
// Tetris: 10x20, real collision and line clearing.
const ctx=$('tetrisCanvas').getContext('2d');let arena=Array.from({length:20},()=>Array(10).fill(0)),piece=null,px=3,py=0,tScore=0,timer=null,live=false;const shapes=[[[1,1,1,1]],[[2,2],[2,2]],[[0,3,0],[3,3,3]],[[4,0,0],[4,4,4]],[[0,0,5],[5,5,5]],[[0,6,6],[6,6,0]],[[7,7,0],[0,7,7]]],colors=['','#4cbfff','#f4d35e','#b18cf4','#e8a359','#658bfa','#67ceab','#ee758b'];function paint(){ctx.fillStyle='#091321';ctx.fillRect(0,0,240,480);const draw=(arr,ox,oy)=>arr.forEach((row,y)=>row.forEach((val,x)=>{if(!val)return;ctx.fillStyle=colors[val];ctx.fillRect((x+ox)*24+1,(y+oy)*24+1,22,22)}));draw(arena,0,0);if(piece)draw(piece,px,py)}function collides(matrix,x,y){return matrix.some((row,yy)=>row.some((v,xx)=>v&&(x+xx<0||x+xx>=10||y+yy>=20||(y+yy>=0&&arena[y+yy][x+xx]))))}function spawn(){piece=shapes[Math.random()*shapes.length|0].map(r=>r.slice());px=(10-piece[0].length)>>1;py=0;if(collides(piece,px,py)){clearInterval(timer);live=false;notice('Tetris game over! Submit your score.')}}function clearLines(){let cleared=0;for(let y=19;y>=0;y--)if(arena[y].every(Boolean)){arena.splice(y,1);arena.unshift(Array(10).fill(0));cleared++;y++}tScore+=([0,100,300,500,800][cleared]||0);$('tetrisScore').textContent=tScore}function tick(){if(!live)return;if(!collides(piece,px,py+1))py++;else{piece.forEach((row,y)=>row.forEach((v,x)=>{if(v)arena[py+y][px+x]=v}));clearLines();spawn()}paint()}function startTetris(){clearInterval(timer);arena=Array.from({length:20},()=>Array(10).fill(0));tScore=0;$('tetrisScore').textContent=0;live=true;spawn();paint();timer=setInterval(tick,650);notice('Tetris started!')}function tmove(key){if(!live||currentGame()!=='tetris')return;if(key==='left'&&!collides(piece,px-1,py))px--;if(key==='right'&&!collides(piece,px+1,py))px++;if(key==='down')tick();if(key==='drop'){while(!collides(piece,px,py+1))py++;tick()}if(key==='rotate'){let rotated=piece[0].map((_,i)=>piece.map(r=>r[i]).reverse());if(!collides(rotated,px,py))piece=rotated}paint()}$('startTetris').onclick=startTetris;$('saveTetris').onclick=()=>submitScore('tetris',tScore);document.querySelectorAll('[data-tmove]').forEach(b=>b.onclick=()=>tmove(b.dataset.tmove));paint();
window.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(tag)||currentGame()!=='tetris'&&currentGame()!=='2048'||!$('games').classList.contains('active'))return;const keys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '];if(keys.includes(e.key)){e.preventDefault();if(currentGame()==='2048')slide2048(e.key);else tmove(({ArrowUp:'rotate',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',' ':'drop'})[e.key])}});
// Chess.js provides legal chess moves including en passant, check, castling and promotion.
let chess=null,selected=null;const pieces={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟',K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙'};
function paintChess(){if(!chess)return;const board=$('chessBoard'),matrix=chess.board();board.replaceChildren();for(let rank=0;rank<8;rank++)for(let file=0;file<8;file++){const s='abcdefgh'[file]+(8-rank),p=matrix[rank][file],b=document.createElement('button');b.className='square '+((rank+file)%2?'dark':'light')+(selected===s?' selected':'');b.setAttribute('aria-label',s+(p?' '+p.color+' '+p.type:''));b.textContent=p?pieces[p.color==='w'?p.type.toUpperCase():p.type]:'';if(selected&&chess.moves({square:selected,verbose:true}).some(m=>m.to===s))b.classList.add('target');b.onclick=()=>clickChess(s);board.append(b)}$('chessStatus').textContent=chess.isCheckmate()?'Checkmate · '+(chess.turn()==='w'?'Black':'White')+' wins':chess.isDraw()?'Draw':(chess.turn()==='w'?'White':'Black')+' to move'+(chess.isCheck()?' · Check':'')}
function clickChess(s){if(!chess||chess.isGameOver())return;const p=chess.get(s);if(selected){try{const moves=chess.moves({square:selected,verbose:true}).filter(m=>m.to===s);if(moves.length){let promotion='q';if(moves.some(m=>m.promotion)){const choice=prompt('Promote to q (queen), r (rook), b (bishop) or n (knight):','q');promotion=['q','r','b','n'].includes(choice)?choice:'q'}chess.move({from:selected,to:s,promotion});selected=null;paintChess();return}}catch(e){console.warn(e)}}selected=p&&p.color===chess.turn()?s:null;paintChess()}
$('chessReset').onclick=()=>{if(chess){chess.reset();selected=null;paintChess()}};$('chessUndo').onclick=()=>{if(chess){chess.undo();selected=null;paintChess()}};
import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm').then(m=>{chess=new m.Chess();paintChess()}).catch(()=>{$('chessStatus').textContent='Chess rules library blocked or unavailable. Try a permitted network.'});
