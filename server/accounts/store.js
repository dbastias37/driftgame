import {DatabaseSync, backup} from 'node:sqlite';
import {mkdirSync, chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import '../../js/career.js';
export const Career=globalThis.DriftCareer;
export class AccountStore {
  constructor(path){
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
    this.db=new DatabaseSync(path,{timeout:5000});
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password TEXT,google_sub TEXT UNIQUE,verified INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS oauth(state TEXT PRIMARY KEY,binding TEXT NOT NULL,nonce TEXT NOT NULL,verifier TEXT NOT NULL,user_id TEXT,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,mode TEXT NOT NULL,level INTEGER NOT NULL,started INTEGER NOT NULL,result TEXT);
      CREATE INDEX IF NOT EXISTS runs_user ON runs(user_id,started);
      CREATE TABLE IF NOT EXISTS operations(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,id TEXT NOT NULL,request TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(user_id,id));
      CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,amount INTEGER NOT NULL,balance INTEGER NOT NULL,detail TEXT NOT NULL,created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id,created);
      CREATE TABLE IF NOT EXISTS records(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,key TEXT NOT NULL,value TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(user_id,key));
      CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
      PRAGMA user_version=1;`);
    if(path!==':memory:')chmodSync(path,0o600);
  }
  get(sql,...params){return this.db.prepare(sql).get(...params);}
  all(sql,...params){return this.db.prepare(sql).all(...params);}
  run(sql,...params){return this.db.prepare(sql).run(...params);}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  create({email,name,password=null,google=null,now=Date.now()}){
    const id=randomUUID();this.run('INSERT INTO users VALUES(?,?,?,?,?,?,?)',id,email,name,password,google,google?1:0,now);
    this.run('INSERT INTO profiles(user_id,data) VALUES(?,?)',id,JSON.stringify(Career.load({getItem:()=>null})));
    return this.user(id);
  }
  user(id){return this.get('SELECT * FROM users WHERE id=?',id);}
  profile(id){const row=this.get('SELECT * FROM profiles WHERE user_id=?',id);return {profile:JSON.parse(row.data),revision:row.revision};}
  save(id,p){this.run('UPDATE profiles SET data=?,revision=revision+1 WHERE user_id=?',JSON.stringify(p),id);}
  storage(id){return {getItem:key=>key===Career.KEY?this.get('SELECT data FROM profiles WHERE user_id=?',id).data:null,setItem:(key,value)=>{if(key!==Career.KEY)throw Error('Invalid career key');this.save(id,JSON.parse(value));}};}
  entry(id,kind,amount,p,detail){this.run('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',randomUUID(),id,kind,amount,p.cash,JSON.stringify(detail),Date.now());}
  achievements(p){const stars=Career.stars(p),count=Object.values(p.cars).reduce((n,c)=>n+Object.values(c.owned).filter(x=>x>0).length,0);return [
    ['first_win','Primera victoria',p.wins>=1],['ten_wins','Diez victorias',p.wins>=10],['first_objective','Primer objetivo',stars>=1],['six_objectives','En marcha',stars>=6],['campaign_master','Campaña completa',stars===60],['first_purchase','Primer proyecto',count>=1],['mechanic','Preparador',count>=10]
  ].map(([id,name,unlocked])=>({id,name,unlocked}));}
  snapshot(id){const u=this.user(id),p=this.profile(id);return {...p,user:{id:u.id,email:u.email,name:u.name,google:!!u.google_sub,created:u.created},achievements:this.achievements(p.profile),ledger:this.all('SELECT kind,amount,balance,detail,created FROM ledger WHERE user_id=? ORDER BY created DESC,rowid DESC LIMIT 50',id).map(x=>({...x,detail:JSON.parse(x.detail)}))};}
  limit(key,max,period,now){return this.transaction(()=>{const row=this.get('SELECT * FROM limits WHERE key=?',key);if(!row||row.expires<=now){this.run('INSERT OR REPLACE INTO limits VALUES(?,1,?)',key,now+period);return true;}if(row.count>=max)return false;this.run('UPDATE limits SET count=count+1 WHERE key=?',key);return true;});}
  purge(now){this.run('DELETE FROM sessions WHERE expires<?',now);this.run('DELETE FROM tokens WHERE expires<?',now);this.run('DELETE FROM oauth WHERE expires<?',now);this.run('DELETE FROM limits WHERE expires<?',now);this.run('DELETE FROM runs WHERE started<?',now-86400e3);}
  backup(path){return backup(this.db,path);}
  close(){this.db.close();}
}
