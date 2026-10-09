/* Property Tycoon relay server: serves index.html and relays game state between players in a room (state kept in memory). */
const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const J=JSON.stringify,rooms={};
const srv=http.createServer((q,r)=>{if(q.url=='/healthz')return r.end('ok');r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});fs.createReadStream(path.join(__dirname,'index.html')).pipe(r)});
const wss=new WebSocketServer({server:srv});
const send=(w,o)=>{if(w&&w.readyState==1)w.send(J(o))};
/* Sends each lobby member the player list and their own seat number */
function lobby(R,code){R.players.forEach((p,i)=>send(p.ws,{t:'lobby',room:code,players:R.players.map(x=>({name:x.name,tok:x.tok})),you:i}))}
wss.on('connection',ws=>{let R=null,code=null;
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch(e){return}
  if(m.t=='join'){code=String(m.room||'').slice(0,8).toUpperCase();if(!code)return;
   const X=rooms[code]||(rooms[code]={players:[],state:null,started:false,last:Date.now()});
   let i=X.players.findIndex(p=>p.cid==m.cid);
   if(i<0){
    if(X.started)return send(ws,{t:'err',m:'That game has already started.'});
    if(X.players.length>=8)return send(ws,{t:'err',m:'Room is full.'});
    if(X.players.some(p=>p.tok==m.tok))return send(ws,{t:'err',m:'That token is taken: pick another.'});
    if(X.players.some(p=>p.name==m.name))return send(ws,{t:'err',m:'That name is taken: pick another.'});
    X.players.push({cid:m.cid,name:m.name,tok:m.tok,ws});i=X.players.length-1}
   else X.players[i].ws=ws;
   R=X;R.last=Date.now();
   if(R.started)send(ws,{t:'st',G:R.state,sync:1,you:i});else lobby(R,code)}
  else if(R&&(m.t=='st'||m.t=='dice')){R.last=Date.now();if(m.t=='st'){if(m.start)R.started=true;R.state=m.G}
   R.players.forEach(p=>{if(p.ws!==ws)send(p.ws,m)})}});
 ws.on('close',()=>{if(!R)return;const i=R.players.findIndex(p=>p.ws===ws);if(i<0)return;if(R.started)R.players[i].ws=null;else{R.players.splice(i,1);lobby(R,code)}})});
setInterval(()=>{for(const k in rooms)if(Date.now()-rooms[k].last>6*3600e3)delete rooms[k]},600e3);
srv.listen(process.env.PORT||3000,()=>console.log('Property Tycoon running'));
