import {DatabaseSync,backup} from 'node:sqlite';
import {chmodSync} from 'node:fs';
import {resolve} from 'node:path';
const source=process.env.ACCOUNT_DB,target=process.argv[2];
if(!source||!target)throw Error('Usage: ACCOUNT_DB=/var/data/drift.sqlite npm run backup:accounts -- /safe/path/backup.sqlite');
if(resolve(source)===resolve(target))throw Error('Backup destination must differ from the live database.');
const db=new DatabaseSync(source,{readOnly:true});try{await backup(db,target);chmodSync(target,0o600);console.log('Account backup completed.');}finally{db.close();}
