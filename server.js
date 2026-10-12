/* Property Tycoon relay server: serves index.html and relays game state between players in a room (state kept in memory). */
const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const J=JSON.stringify,rooms={};
const srv=http.createServer((q,r)=>{if(q.url=='/healthz')return r.end('ok');r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});fs.createReadStream(path.join(__dirname,'index.html')).pipe(r)});
const wss=new WebSocketServer({server:srv});
const send=(w,o)=>{if(w&&w.readyState==1)w.send(J(o))};
/* Sends each lobby member the player list and their own seat number */
function lobby(R,code){R.players.forEach((p,i)=>send(p.ws,{t:'lobby',room:code,players:R.players.map(x=>({name:x.name,tok:x.tok})),you:i}))}
wss.on('connection',ws=>{let R=null,code=null;
 /* Adds a player to a room (lobby), or reconnects/claims a seat in a game already started */
 function join(m){code=String(m.room||'').slice(0,8).toUpperCase();if(!code)return;
  const X=rooms[code]||(rooms[code]={players:[],state:null,started:false,last:Date.now()});
  let i=X.players.findIndex(p=>p.cid==m.cid);
  if(i<0){
   if(X.started){i=X.players.findIndex(p=>p.cid==null&&p.name==m.name);if(i<0)return send(ws,{t:'err',m:'That game has already started. To rejoin a resumed game, use exactly the same name as in the save.'});X.players[i].cid=m.cid}
   else{
    if(X.players.length>=8)return send(ws,{t:'err',m:'Room is full.'});
    if(X.players.some(p=>p.tok==m.tok))return send(ws,{t:'err',m:'That token is taken: pick another.'});
    if(X.players.some(p=>p.name==m.name))return send(ws,{t:'err',m:'That name is taken: pick another.'});
    X.players.push({cid:m.cid,name:m.name,tok:m.tok,ws});i=X.players.length-1}}
  X.players[i].ws=ws;R=X;R.last=Date.now();
  if(R.started)send(ws,{t:'st',G:R.state,sync:1,you:R.players[i].seat??i});else lobby(R,code)}
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch(e){return}
  if(m.t=='join')join(m);
  else if(m.t=='resume'){const c=String(m.room||'').slice(0,8).toUpperCase(),g=m.G;
   if(!c||!g||!Array.isArray(g.pl))return send(ws,{t:'err',m:'Not a valid save.'});
   if(rooms[c])return send(ws,{t:'err',m:'That room code is already in use. Pick a new one.'});
   g.pl.forEach(p=>{if(p.cid==null)p.cid=p.id});
   rooms[c]={players:g.pl.map(p=>({cid:null,name:p.n,tok:p.tok,seat:p.cid,ws:null})),state:g,started:true,last:Date.now()};
   m.room=c;join(m)}
  else if(R&&(m.t=='st'||m.t=='dice')){R.last=Date.now();if(m.t=='st'){if(m.start)R.started=true;R.state=m.G}
   R.players.forEach(p=>{if(p.ws!==ws)send(p.ws,m)})}});
 ws.on('close',()=>{if(!R)return;const i=R.players.findIndex(p=>p.ws===ws);if(i<0)return;if(R.started)R.players[i].ws=null;else{R.players.splice(i,1);lobby(R,code)}})});
setInterval(()=>{for(const k in rooms)if(Date.now()-rooms[k].last>6*3600e3)delete rooms[k]},600e3);
srv.listen(process.env.PORT||3000,()=>console.log('Property Tycoon running'));
